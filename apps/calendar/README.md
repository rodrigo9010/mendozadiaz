# Calendar — build notes

A shared vacation calendar, built incrementally as a tutorial in how a small
local-first app can read/write data and later show up on a public,
read-only website.

## Architecture (v0.1 direction)

- **Editing happens locally.** You run a tiny local server on your own
  machine, open the calendar in a browser, and every add/remove is
  written straight to a JSON file on disk.
- **The JSON file is the database.** No Firebase, no Postgres, no remote
  API. `data.json` in this folder *is* the data store.
- **GitHub is the sync mechanism, not a live backend.** When you're happy
  with your edits, you `git commit` + `git push`. That's what makes the
  changes show up on the public site — there is no server running on
  GitHub Pages, it only serves static files.
- **The public site (GitHub Pages) is read-only.** It fetches
  `data.json` and renders the calendar, but has no way to write back to
  it. A password there is a light deterrent on *viewing*, not real
  security — anyone who looks at the page source can read it. Don't put
  anything behind it you'd be upset about a stranger seeing.
- **One page, two modes.** `view.html` is used both locally (as the
  editor) and publicly (as the viewer) — it detects which mode to run in
  itself, see Step 4 below. There's no separate editor/viewer file to
  keep in sync.

## Why not write straight from the browser?

Browsers intentionally cannot write arbitrary files to disk from
JavaScript running on a webpage — that would be a huge security hole (any
website could silently modify your files). This is why "just edit in the
browser and save to `data.json`" needs a helper: something running
*outside* the browser sandbox that has real filesystem access. That's
what the local server is for — it accepts a request from the browser tab
and does the actual `fs.writeFileSync` on your behalf.

## Files in this folder

| File | Purpose | Status |
|---|---|---|
| `data.json` | The data store: a `_countries` color legend plus one entry per date, `{ "YYYY-MM-DD": { "country", "city", "entries": [...] } }` | done |
| `itinerary.md` | Readable, English source for the trip — dated headings, optionally tagged `[Country / City]`, with bullets underneath. Hand-edit this, not `data.json` | done |
| `md-to-json.js` | Regenerates `data.json` from `itinerary.md` — run with `node md-to-json.js` | done |
| `try-write.js` | Minimal proof-of-concept: a Node script that reads, modifies, and writes `data.json` directly — no server, no browser yet | done (throwaway, not used by the app) |
| `server.js` | Local HTTP server: serves `view.html` and exposes `/data` (read) and `/save` (write) endpoints | done |
| `view.html` | The calendar UI — edit mode locally (via `server.js`), read-only view mode on the public site (via static `data.json`) | done |
| `COMMANDS.md` | Quick copy-paste command reference for running the local editor and regenerating `data.json` | done |

## Concepts covered so far

**Step 1 — prove the write mechanism in isolation.**
Before wiring up any UI, `try-write.js` shows the exact read/modify/write
pattern everything else builds on:

```js
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); // read
data[key].push('...');                                       // modify in memory
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));    // write back
```

This is the same three-step pattern `server.js` runs every time the
page asks it to save an entry — the only difference is *what triggers
it* (running the script by hand vs. an HTTP request from a browser).

### How to run `try-write.js`

On your own machine, in a terminal, inside your local clone of this repo:

```
cd apps/calendar
node try-write.js
```

This appends a test entry to `data.json` and prints the result. Reset
`data.json` back to `{}` afterward so the next step starts clean — this
script is a throwaway proof, not part of the final app.

**Step 2 — a browser-triggered version of the same write.**
`server.js` is a plain Node `http` server (no npm install, no
dependencies — only the built-in `http`, `fs`, `path` modules). It does
three things:

1. `GET /` → serves `view.html`.
2. `GET /data` → reads `data.json` and sends it to the browser as JSON.
3. `POST /save` → receives the browser's updated JSON in the request
   body, and runs the exact same `fs.writeFileSync` pattern
   `try-write.js` proved works — just triggered by an HTTP request
   instead of you running a script.

```js
// before (didn't actually work in a plain browser):
await window.storage.get('vacation-entries', true);
await window.storage.set('vacation-entries', JSON.stringify(data), true);

// now:
await fetch('/data');
await fetch('/save', { method: 'POST', body: JSON.stringify(data) });
```

**Step 2.5 — fixed 3-month range.**
The calendar covers a fixed trip window: November 2026, December 2026,
January 2027 — no more prev/next month browsing. On desktop, explicit
grid placement puts November top-left, December on the right (spanning
both rows), and January bottom-left, under November. On mobile (under
780px) the months stack vertically in order.

**Step 2.6 — Jost typeface.**
The page uses Jost (the same house font as the rest of the site), embedded
as a base64 WOFF2 `@font-face` directly in `view.html` — the same
self-hosted block used in `thesis.html` and `index.html`. That means it
renders identically on every machine regardless of whether the font is
installed locally, with no external font request (unlike `apps/clock.html`,
which pulls Jost from Google Fonts instead).

**Step 2.7 — zoom levels.**
The toolbar above the calendar switches between three zoom levels: Trip
(all 3 months, the original fixed view), Month (one month, with ‹ ›
buttons to page between months), and Week (one week, with entries shown
in full instead of truncated). Clicking a month's title while in Trip
view jumps straight into that month.

**Step 2.8 — country/city tags and an editable color legend.**
Each day can carry a `country`/`city` tag. The country's color shows up
on that day's entry bubbles (so the color that matters is the one
attached to actual content, not a border nobody's looking at), plus a
small city-name label at Month/Week zoom. The color mapping lives in
`data.json`'s `_countries` object — a plain `{ "Japan": "#b8503c", ... }`
map, shown as a legend row above the calendar. Tagging is driven from
`itinerary.md`: a heading like `## 2026-11-04 [Japan / Tokyo]` tags that
day, and any country name used there that isn't in the legend yet is
added automatically with a placeholder color. Opening a day (in edit
mode) shows Country/City fields, autocompleting from existing country
names, to tag that day directly instead.

The legend itself is fully editable from the local editor, not just via
`itinerary.md`: click a swatch to recolor a country (native color
picker, updates every day tagged with it at once); click a name to
rename it in place (renaming cascades to every day tagged with the old
name, and refuses silently on an empty name or a collision with an
existing country); click the × to remove a country entirely (after a
confirm — this clears the country/city tag, not the entries, from every
day that used it); "+ Add country" appends a new placeholder-colored
entry, focused and ready to rename.

**Step 2.9 — drag entries between days.**
In the local editor, an entry bubble can be dragged onto a different day
cell to move it there (native HTML5 drag-and-drop — no library). The
entry keeps its text but takes on whatever tag the destination day
already has; it doesn't drag its origin day's tag along with it. Works
at any zoom level, limited to whichever days are currently on screen
(so moving between two different months means zooming out to Trip, or
navigating Month view to bring both into view first).

**Step 3 → Step 4 — one file, auto-detecting mode.**
Originally the editor (`editor.html`) and the public viewer
(`viewer.html`) were two separate files sharing most of their markup/
CSS/JS. They were merged into a single `view.html` that detects
which mode to run in on load:

```js
try {
  const res = await fetch('/data', { signal: AbortSignal.timeout(800) });
  // local server responded -> edit mode: show add/remove UI, save on change
} catch (e) {
  const res = await fetch('data.json'); // no local server -> read-only view
  // read-only mode: no add/remove UI, clicking a day only shows entries
}
```

`/data` only exists when `server.js` is running (i.e. locally). On the
public site there's no server at all — just static files — so that
`fetch('/data')` fails fast (bounded by an 800ms timeout so a visitor
never sits on a hung request) and the page falls back to reading
`data.json` directly, read-only. One set of markup/CSS/rendering code
serves both roles; only the storage calls and which buttons are shown
differ, gated behind a single `editable` flag set once at load.

### How to run locally (edit mode)

On your own machine, in a terminal, inside your local clone of this repo:

```
cd apps/calendar
node server.js
```

Then open `http://localhost:5500` in a browser. Add/remove entries —
each change is written straight to `data.json` on disk. Stop the server
with `Ctrl+C` when done. Then `git add`, `commit`, and `push` from the
repo root to publish your changes.

### How to publish

There is no separate deploy step. Publishing = pushing to `main`:

```
git add apps/calendar/
git commit -m "..."
git push
```

Once pushed, the page is live (read-only, since there's no server on
GitHub Pages) at:

- `https://mendozadiaz.ch/apps/calendar/view.html` (custom domain)
- `https://rodrigo9010.github.io/mendozadiaz/apps/calendar/view.html` (same content, GitHub's own domain)

Both point at the same GitHub Pages deploy — `mendozadiaz.ch` is DNS
registered through Infomaniak, pointed at GitHub Pages via the `CNAME`
file at the repo root. GitHub Pages is what actually serves every page,
including this one.

## Workflow summary

1. `cd apps/calendar && node server.js`, edit at `http://localhost:5500`.
2. Stop the server (`Ctrl+C`) when done editing.
3. From the repo root: `git add`, `commit`, `push`.
4. The public page at `mendozadiaz.ch/apps/calendar/view.html`
   now reflects your changes (read-only there, since it's the same file
   running in view mode).

## Next step

Not yet decided — possible directions: a password gate (deterrent only,
see the security note above), or moving off plain-JSON storage to
something with real multi-device sync (see options below) if
local-only editing turns out to be too limiting in practice.

## Other storage options (for later, not built)

If local-only editing + git push ever feels like too much friction, free
alternatives with real sync between devices:

- **Firebase (Firestore/Realtime DB)** — free tier, real-time sync,
  public API key is normal (access controlled by security rules, not
  secrecy).
- **Supabase** — free tier, Postgres-backed, similar tradeoffs to Firebase.
- **GitHub-as-a-database** — save `data.json` via GitHub's API using a
  personal access token instead of a local git commit. Removes the need
  to be on a machine with the repo cloned, but the token is another
  secret exposed client-side, and every save becomes a real git commit
  (slower, subject to API rate limits).

# Calendario — build notes

A shared vacation calendar, built incrementally as a tutorial in how a small
local-first app can read/write data and later show up on a public,
read-only website.

## Architecture (v0.1 direction)

- **Editing happens locally.** You run a tiny local server on your own
  machine, open the editor in a browser, and every add/remove is written
  straight to a JSON file on disk.
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
| `data.json` | The entries themselves: `{ "YYYY-MM-DD": ["entry", ...] }` | done |
| `try-write.js` | Minimal proof-of-concept: a Node script that reads, modifies, and writes `data.json` directly — no server, no browser yet | done |
| `server.js` | Local HTTP server: serves the editor page and exposes a save endpoint that does the write `try-write.js` demonstrated | not built yet |
| `editor.html` | The local-only editing UI (talks to `server.js`) | not built yet |
| `viewer.html` | The public, read-only calendar (talks only to `data.json`, no writes) | not built yet |

## Concepts covered so far

**Step 1 — prove the write mechanism in isolation.**
Before wiring up any UI, `try-write.js` shows the exact read/modify/write
pattern everything else builds on:

```js
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); // read
data[key].push('...');                                       // modify in memory
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));    // write back
```

This is the same three-step pattern `server.js` will run every time the
editor page asks it to save an entry — the only difference is *what
triggers it* (running the script by hand vs. an HTTP request from a
browser).

### How to run `try-write.js`

On your own machine, in a terminal, inside your local clone of this repo:

```
cd apps/calendario
node try-write.js
```

This appends a test entry to `data.json` and prints the result. Reset
`data.json` back to `{}` afterward so the next step starts clean — this
script is a throwaway proof, not part of the final app.

## Next step

Build `server.js`: a plain Node `http` server (no npm install, no
dependencies) that serves `editor.html` and exposes a `POST /save`
endpoint doing the same write `try-write.js` does, so the browser can
trigger it instead of you running the script by hand.

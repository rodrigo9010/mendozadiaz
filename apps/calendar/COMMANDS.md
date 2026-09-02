# Calendar — command cheat sheet

Run these from the repo root (`01-Webpage/`).

## 1. Open the editable version locally

```
cd apps/calendar && node server.js
```

Then open **http://localhost:5500** in a browser. Add/remove entries there —
each change writes straight to `data.json`. Stop the server with `Ctrl+C`
when done.

## 2. Import the itinerary CSV into data.json

Edit `apps/calendar/Itinerario-v2.csv`, then:

```
cd apps/calendar && node csv-to-json.js
```

This handles spreadsheet-style quoted cells and multi-line notes. It replaces
only the dates represented by the CSV, preserves the country colour legend,
and leaves hand-added entries on other dates alone. For a future trip year or
another source file, use `node csv-to-json.js filename.csv 2027`.

`itinerary.md` and `md-to-json.js` remain available for manually curated,
day-by-day entries, but the CSV is the preferred source for the booking plan.

## 3. Commit and push

```
git add apps/calendar/
git commit -m "Update calendar entries"
git push
```

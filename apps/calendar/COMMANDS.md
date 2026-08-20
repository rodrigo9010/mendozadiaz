# Calendar — command cheat sheet

Run these from the repo root (`01-Webpage/`).

## 1. Open the editable version locally

```
cd apps/calendar && node server.js
```

Then open **http://localhost:5500** in a browser. Add/remove entries there —
each change writes straight to `data.json`. Stop the server with `Ctrl+C`
when done.

## 2. Regenerate data.json from itinerary.md

Edit `apps/calendar/itinerary.md`, then:

```
cd apps/calendar && node md-to-json.js
```

This overwrites, in `data.json`, only the dates `itinerary.md` mentions.
Anything you added by hand through the local editor for other dates is
left alone.

## 3. Commit and push

```
git add apps/calendar/
git commit -m "Update calendar entries"
git push
```

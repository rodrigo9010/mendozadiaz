// Regenerates data.json from the readable itinerary.md source.
// Run with: node md-to-json.js
//
// Parses "## YYYY-MM-DD" headings and the "- " bullets under each one.
// For every date itinerary.md mentions, its entries fully replace
// whatever was in data.json for that date. Dates data.json has that
// itinerary.md doesn't mention (e.g. entries added by hand through the
// local editor) are left untouched.
const fs = require('fs');
const path = require('path');

const MD_PATH = path.join(__dirname, 'itinerary.md');
const DATA_PATH = path.join(__dirname, 'data.json');

const DATE_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
const BULLET_RE = /^-\s+(.*\S)\s*$/;

function parseItinerary(text) {
  const parsed = {};
  let currentDate = null;

  text.split(/\r?\n/).forEach(line => {
    const dateMatch = line.match(DATE_RE);
    if (dateMatch) {
      currentDate = dateMatch[1];
      if (!parsed[currentDate]) parsed[currentDate] = [];
      return;
    }
    if (!currentDate) return;
    const bulletMatch = line.match(BULLET_RE);
    if (bulletMatch) {
      parsed[currentDate].push(bulletMatch[1]);
    }
  });

  return parsed;
}

function main() {
  const mdText = fs.readFileSync(MD_PATH, 'utf8');
  const fromMd = parseItinerary(mdText);

  const existing = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

  const merged = { ...existing, ...fromMd };

  const sorted = {};
  Object.keys(merged).sort().forEach(date => {
    sorted[date] = merged[date];
  });

  fs.writeFileSync(DATA_PATH, JSON.stringify(sorted, null, 2) + '\n');

  const dateCount = Object.keys(fromMd).length;
  const entryCount = Object.values(fromMd).reduce((n, arr) => n + arr.length, 0);
  console.log(`Wrote ${entryCount} entries across ${dateCount} dates from itinerary.md into data.json.`);
}

main();

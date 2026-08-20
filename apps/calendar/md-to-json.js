// Regenerates data.json from the readable itinerary.md source.
// Run with: node md-to-json.js
//
// Parses "## YYYY-MM-DD" headings, each optionally tagged with
// "[Country / City]", and the "- " bullets under each one. For every
// date itinerary.md mentions, its entries (and tag, if present) fully
// replace whatever was in data.json for that date. Dates data.json has
// that itinerary.md doesn't mention (e.g. entries added by hand through
// the local editor) are left untouched. The "_countries" color legend
// is preserved across runs; a country name that appears in a tag but
// isn't in the legend yet is added automatically with a placeholder
// color, recolorable from the local editor.
const fs = require('fs');
const path = require('path');

const MD_PATH = path.join(__dirname, 'itinerary.md');
const DATA_PATH = path.join(__dirname, 'data.json');

const HEADING_RE = /^##\s+(\d{4}-\d{2}-\d{2})(?:\s*\[\s*([^\]/]+?)\s*\/\s*([^\]]+?)\s*\])?\s*$/;
const BULLET_RE = /^-\s+(.*\S)\s*$/;

const PLACEHOLDER_COLORS = ['#7a8f99', '#a97d5d', '#6b9b7a', '#9b6b8f', '#7d8f5d', '#5d7d8f'];

function parseItinerary(text) {
  const days = {};
  let currentDate = null;

  text.split(/\r?\n/).forEach(line => {
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      const [, date, country, city] = headingMatch;
      currentDate = date;
      const day = {};
      if (country) day.country = country.trim();
      if (city) day.city = city.trim();
      day.entries = [];
      days[currentDate] = day;
      return;
    }
    if (!currentDate) return;
    const bulletMatch = line.match(BULLET_RE);
    if (bulletMatch) {
      days[currentDate].entries.push(bulletMatch[1]);
    }
  });

  return days;
}

function main() {
  const mdText = fs.readFileSync(MD_PATH, 'utf8');
  const fromMd = parseItinerary(mdText);

  const existing = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const countries = { ...(existing._countries || {}) };

  let colorIdx = 0;
  Object.values(fromMd).forEach(day => {
    if (day.country && !countries[day.country]) {
      countries[day.country] = PLACEHOLDER_COLORS[colorIdx % PLACEHOLDER_COLORS.length];
      colorIdx++;
    }
  });

  const merged = { ...existing, ...fromMd };
  delete merged._countries;

  const sorted = { _countries: countries };
  Object.keys(merged).sort().forEach(date => {
    sorted[date] = merged[date];
  });

  fs.writeFileSync(DATA_PATH, JSON.stringify(sorted, null, 2) + '\n');

  const dateCount = Object.keys(fromMd).length;
  const entryCount = Object.values(fromMd).reduce((n, d) => n + d.entries.length, 0);
  console.log(`Wrote ${entryCount} entries across ${dateCount} dates from itinerary.md into data.json.`);
}

main();

// Imports the trip-planning CSV into data.json.
//
// Usage: node csv-to-json.js [input.csv] [start-year]
// Example: node csv-to-json.js Itinerary-v3.csv 2026
//
// The CSV may have quoted, multi-line cells (as exported by spreadsheet apps).
// Add an optional `Country` column for new destinations. Without it, the
// COUNTRY_BY_LOCATION map below supplies the country for the current itinerary.
// A `Riservato` column marks a row as booked: its entry is written as
// { text, reserved: true } instead of a plain string, and a booked stay also
// flags each of its days with reserved: true (the calendar tints them green).
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data.json');
const inputName = process.argv[2] || 'Itinerary-v3.csv';
const CSV_PATH = path.resolve(__dirname, inputName);
const START_YEAR = Number(process.argv[3] || 2026);

const COUNTRY_BY_LOCATION = {
  Tokyo: 'Japan', Kyoto: 'Japan', Osaka: 'Japan', Hiroshima: 'Japan', Fukuoka: 'Japan',
  Seoul: 'South Korea', Beijing: 'China', "Xi'an": 'China', Shanghai: 'China', Chongqing: 'China',
  Guangzhou: 'China', 'Zhangjiajie / Wu Lingyuan': 'China', Hongkong: 'Hong Kong', 'Hong Kong': 'Hong Kong',
  'Bohol/Panglao': 'Philippines', Cebu: 'Philippines', Boracay: 'Philippines', Manila: 'Philippines',
  Bkk: 'Thailand', Bangkok: 'Thailand', 'Ko Chang': 'Thailand'
};

const PLACEHOLDER_COLORS = ['#7a8f99', '#a97d5d', '#6b9b7a', '#9b6b8f', '#7d8f5d', '#5d7d8f'];

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

function clean(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

// Spreadsheet cells may stack several values on their own lines ("hotel\nairbnb").
// Keep them distinct instead of running the words together.
function cleanLines(value) {
  const parts = (value || '').split('\n').map(clean).filter(Boolean);
  return [...new Set(parts)].join(' / ');
}

// Costs used to carry their unit ("369 chf"); newer sheets put the currency in
// the column header and leave the cell a bare number.
function formatCost(value) {
  const text = clean(value);
  if (!text) return '';
  return /^[\d.,'\u2019]+$/.test(text) ? `${text} chf` : text;
}

// Header names drift between CSV versions (Costi -> "Costi -CHF"), so match on
// the stable prefix rather than the exact string.
function findHeader(headers, prefix, fallback) {
  return headers.find(header => header.toLowerCase().startsWith(prefix)) || fallback;
}

// The Riservato column is a yes/no cell; accept the spellings a sheet is
// likely to hold. Anything else (including empty) means not booked.
function isReserved(value) {
  return /^(s[iì]|yes|y|x|true|1|ok|\u2713)$/i.test(clean(value));
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`Invalid date: ${day}.${month}`);
  return date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function keyFor(date) {
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function parseDateRange(value) {
  const text = clean(value);
  let match = text.match(/^(\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})$/);
  if (match) return { startDay: +match[1], startMonth: +match[2], endDay: +match[3], endMonth: +match[4] };
  match = text.match(/^(\d{1,2})-(\d{1,2})\.(\d{1,2})$/);
  if (match) return { startDay: +match[1], startMonth: +match[3], endDay: +match[2], endMonth: +match[3] };
  match = text.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (match) return { startDay: +match[1], startMonth: +match[2], endDay: +match[1], endMonth: +match[2], single: true };
  throw new Error(`Unsupported date format "${value}". Use e.g. 04-09.11, 27.11-03.12, or 09.11.`);
}

function yearFor(month) {
  return START_YEAR + (month < 7 ? 1 : 0);
}

function buildEntry(row, location, columns) {
  const transportOrStay = cleanLines(row[columns.stay]);
  const costs = formatCost(row[columns.cost]);
  const comments = clean(row.Comments);
  const details = [costs, comments].filter(Boolean).join('; ');
  if (!location) return [transportOrStay, details].filter(Boolean).join(' — ');
  return [location, transportOrStay, details].filter(Boolean).join(' — ');
}

function main() {
  if (!Number.isInteger(START_YEAR)) throw new Error('The start year must be a whole number.');
  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  const headerRow = rows.find(row => row.some(cell => clean(cell) === 'Date'));
  if (!headerRow) throw new Error('Could not find a header row containing a Date column.');
  const headers = headerRow.map(clean);
  if (!headers.includes('Location')) throw new Error('CSV must contain a Location column.');
  const columns = {
    stay: findHeader(headers, 'alloggio', 'Alloggio / / tipo di trasporto'),
    cost: findHeader(headers, 'costi', 'Costi'),
    reserved: findHeader(headers, 'riservato', 'Riservato')
  };
  const dateIndex = rows.indexOf(headerRow);
  const imported = {};
  let windowStart = null;
  let windowEnd = null;
  let records = 0;

  rows.slice(dateIndex + 1).forEach((cells, offset) => {
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
    const rawDate = clean(row.Date);
    if (!rawDate) return;
    const parsed = parseDateRange(rawDate);
    const start = toDate(yearFor(parsed.startMonth), parsed.startMonth, parsed.startDay);
    const end = toDate(yearFor(parsed.endMonth), parsed.endMonth, parsed.endDay);
    if (!parsed.single && end <= start) throw new Error(`Row ${dateIndex + offset + 2}: end date must be after start date.`);
    const location = clean(row.Location);
    const country = clean(row.Country) || COUNTRY_BY_LOCATION[location];
    const reserved = isReserved(row[columns.reserved]);
    const text = buildEntry(row, location, columns);
    const entry = text && reserved ? { text, reserved: true } : text;
    const dates = parsed.single ? [start] : Array.from({ length: Math.round((end - start) / 86400000) }, (_, i) => addDays(start, i));
    const rowEnd = parsed.single ? addDays(start, 1) : end;
    if (!windowStart || start < windowStart) windowStart = start;
    if (!windowEnd || rowEnd > windowEnd) windowEnd = rowEnd;

    if (location && !country) throw new Error(`Row ${dateIndex + offset + 2}: add a Country column value or map "${location}" in COUNTRY_BY_LOCATION.`);
    dates.forEach((date, index) => {
      const key = keyFor(date);
      const day = imported[key] || { entries: [] };
      if (location) { day.country = country; day.city = location; }
      if (location && reserved) day.reserved = true;
      if (index === 0 && entry) day.entries.push(entry);
      imported[key] = day;
    });
    records++;
  });

  if (!records) throw new Error('No dated itinerary rows were imported.');
  const existing = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const countries = { ...(existing._countries || {}) };
  let colorIndex = 0;
  Object.values(imported).forEach(day => {
    if (day.country && !countries[day.country]) countries[day.country] = PLACEHOLDER_COLORS[colorIndex++ % PLACEHOLDER_COLORS.length];
  });
  // The CSV owns one continuous trip window. Clear old values inside it first,
  // so shortening a stay cannot leave stale calendar days behind. The window
  // ends on the last stay's checkout day, which no row ever writes to, so it is
  // left alone — clearing it would only delete hand-added entries (the flight
  // home, say) that the CSV knows nothing about.
  const merged = { ...existing };
  for (let date = new Date(windowStart); date < windowEnd; date = addDays(date, 1)) delete merged[keyFor(date)];
  Object.assign(merged, imported);
  delete merged._countries;
  const output = { _countries: countries };
  Object.keys(merged).sort().forEach(key => { output[key] = merged[key]; });
  fs.writeFileSync(DATA_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`Imported ${records} CSV rows into ${Object.keys(imported).length} calendar dates.`);
}

try { main(); } catch (error) { console.error(`Import failed: ${error.message}`); process.exitCode = 1; }

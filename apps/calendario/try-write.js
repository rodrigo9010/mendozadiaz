// Step 1 tutorial script: read data.json, add one entry, write it back.
// Run with: node try-write.js
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'data.json');

const raw = fs.readFileSync(dataPath, 'utf8');
const data = JSON.parse(raw);

const key = '2026-08-16';
if (!data[key]) data[key] = [];
data[key].push('test entry ' + new Date().toISOString());

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

console.log('Wrote to', dataPath);
console.log(JSON.stringify(data, null, 2));

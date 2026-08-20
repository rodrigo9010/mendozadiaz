// Step 2 tutorial: the smallest local server that can read/write data.json.
// No dependencies — only Node's built-in http/fs/path modules.
// Run with: node server.js
// Then open: http://localhost:5500
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5500;
const DATA_PATH = path.join(__dirname, 'data.json');
const PAGE_PATH = path.join(__dirname, 'view.html');

function readData() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

const server = http.createServer((req, res) => {
  // Serve the calendar page
  if (req.method === 'GET' && (req.url === '/' || req.url === '/view.html')) {
    const html = fs.readFileSync(PAGE_PATH, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  // Send current entries to the browser
  if (req.method === 'GET' && req.url === '/data') {
    const data = readData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // Receive updated entries from the browser and write them to disk
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        writeData(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Calendar editor running at http://localhost:${PORT}`);
});

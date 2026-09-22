// Copyright Tax Policy Associates Limited 2026. MIT licence: see LICENSE.
// A local static server for the web app, so the page can load its own scripts.
// Everything it serves lives in web/. Listens on localhost only.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, 'web');
const port = Number(process.env.PORT || 8787);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.txt':'text/plain; charset=utf-8',
  '.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};

http.createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end(body);
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return send(405, 'Method not allowed');
  }
  let route;
  try { route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { return send(400, 'Invalid path'); }
  if (route.includes('\0')) return send(400, 'Invalid path');
  if (route.endsWith('/')) route += 'index.html';
  const file = path.join(root, route);
  // The URL parser above already resolves ".." segments. This is the backstop.
  if (file !== root && !file.startsWith(root + path.sep)) return send(403, 'Not available');
  fs.readFile(file, (err, data) => {
    if (err) return send(404, 'Not found');
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Model: http://127.0.0.1:${port}/`));

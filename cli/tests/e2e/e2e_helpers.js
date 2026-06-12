'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
let server = null;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
};

function startServer(port) {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const urlNoQ = decodeURIComponent(req.url).split('?')[0];
      let filePath = path.join(ROOT, urlNoQ === '/' ? '/index.html' : urlNoQ);
      filePath = path.normalize(filePath);
      if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      try { const stat = fs.statSync(filePath); if (stat.isDirectory()) filePath = path.join(filePath, 'index.html'); } catch (e) {}
      const contentType = MIME[path.extname(filePath)] || 'application/octet-stream';
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });
    server.listen(port, () => resolve(server));
  });
}

function stopServer() {
  if (server) { server.close(); server = null; }
}

module.exports = { startServer, stopServer, ROOT };

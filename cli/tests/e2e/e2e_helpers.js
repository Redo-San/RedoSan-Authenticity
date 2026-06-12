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
      let urlNoQ;
      try {
        urlNoQ = decodeURIComponent(req.url).split('?')[0];
      } catch (e) {
        res.writeHead(400); res.end(); return;
      }
      const requestPath = urlNoQ === '/' ? '/index.html' : urlNoQ;
      const isSafePath =
        requestPath.startsWith('/') &&
        requestPath.indexOf('\0') === -1 &&
        requestPath.indexOf('\\') === -1 &&
        /^\/[A-Za-z0-9._\-\/]*$/.test(requestPath) &&
        requestPath.split('/').every((seg) => seg !== '.' && seg !== '..');
      if (!isSafePath) { res.writeHead(403); res.end(); return; }
      let filePath = path.resolve(ROOT, `.${requestPath}`);
      const normalizedRoot = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
      if (!(filePath === ROOT || filePath.startsWith(normalizedRoot))) { res.writeHead(403); res.end(); return; }
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
      } catch (e) {}
      let realRoot;
      let realFilePath;
      try {
        realRoot = fs.realpathSync(ROOT);
        realFilePath = fs.realpathSync(filePath);
      } catch (e) {
        res.writeHead(404); res.end(); return;
      }
      if (!(realFilePath === realRoot || realFilePath.startsWith(realRoot + path.sep))) { res.writeHead(403); res.end(); return; }
      const contentType = MIME[path.extname(realFilePath)] || 'application/octet-stream';
      fs.readFile(realFilePath, (err, data) => {
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

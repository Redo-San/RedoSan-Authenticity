const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
let server = null;

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

function startServer(port) {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let pathname;
      try {
        // Use the WHATWG URL parser with a base so malformed percent-encoding
        // doesn't throw from decodeURIComponent directly on req.url.
        const parsed = new URL(req.url, "http://localhost");
        pathname = parsed.pathname || "/";
      } catch (err) {
        void err;
        res.writeHead(400);
        res.end();
        return;
      }

      const requestPath = pathname === "/" ? "/index.html" : pathname;

      // Basic sanity checks: reject null bytes and ensure leading slash. Backslashes are normalized by path.resolve on POSIX,
      // but we explicitly reject backslashes to avoid confusion on Windows vs POSIX inputs.
      if (requestPath.indexOf("\0") !== -1 || requestPath.indexOf("\\") !== -1 || !requestPath.startsWith("/")) {
        res.writeHead(403);
        res.end();
        return;
      }

      // Resolve candidate path anchored at ROOT. Prefix with '.' so leading '/' doesn't make it absolute.
      let filePath = path.resolve(ROOT, `.${requestPath}`);

      // Fast containment check: ensure the resolved path is within ROOT (platform-aware).
      const normalizedRoot = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
      if (!(filePath === ROOT || filePath.startsWith(normalizedRoot))) {
        res.writeHead(403);
        res.end();
        return;
      }

      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
      } catch (err) {
        void err;
      }

      // Resolve real paths to handle symlinks and final containment check.
      let realRoot;
      let realFilePath;
      try {
        realRoot = fs.realpathSync(ROOT);
        realFilePath = fs.realpathSync(filePath);
      } catch (err) {
        void err;
        res.writeHead(404);
        res.end();
        return;
      }
      if (!(realFilePath === realRoot || realFilePath.startsWith(realRoot + path.sep))) {
        res.writeHead(403);
        res.end();
        return;
      }

      const contentType = MIME[path.extname(realFilePath)] || "application/octet-stream";
      fs.readFile(realFilePath, (err, data) => {
        if (err) {
          void err;
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
      });
    });
    server.listen(port, () => resolve(server));
  });
}

function stopServer() {
  if (server) {
    server.close();
    server = null;
  }
}

module.exports = { startServer, stopServer, ROOT };

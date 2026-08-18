var http = require("node:http"),
  https = require("node:https"),
  fs = require("node:fs"),
  path = require("node:path"),
  zlib = require("node:zlib");
var ROOT = path.resolve(__dirname);
var REAL_ROOT = fs.realpathSync(ROOT);

// CLI flags: --https (TLS with local certs), --port N, --host H.
var useHttps = false;
var port = 8080;
var host = "127.0.0.1";
for (var ai = 0; ai < process.argv.length; ai++) {
  var arg = process.argv[ai];
  if (arg === "--https") useHttps = true;
  else if (arg === "--port" && process.argv[ai + 1]) {
    port = Number.parseInt(process.argv[++ai], 10) || 8080;
  } else if (arg === "--host" && process.argv[ai + 1]) {
    host = process.argv[++ai];
  }
}
if (useHttps && port === 8080 && !process.argv.includes("--port")) port = 8443;

var CERT_DIR = path.join(ROOT, "certs");
var TLS_OPTIONS = null;
if (useHttps) {
  var certPath = path.join(CERT_DIR, "localhost.crt");
  var keyPath = path.join(CERT_DIR, "localhost.key");
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.error(
      "[dev-server] HTTPS requested but no local certificates found.\n" +
        "  Generate them first:  pwsh -ExecutionPolicy Bypass -File scripts/generate-dev-cert.ps1\n" +
        "  Expected files: certs/localhost.crt and certs/localhost.key",
    );
    process.exit(1);
  }
  TLS_OPTIONS = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
}

/**
 *
 * @param s
 */
function escHtml(s) {
  return String(s).replaceAll(/[&<>"']/g, function (c) {
    return "&#" + c.charCodeAt(0) + ";";
  });
}

var MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

var PAGE_NAMES = new Set([
  "about",
  "audio-watermark",
  "c2pa",
  "certificate",
  "contact",
  "converter",
  "did",
  "document-watermark",
  "face-biometric",
  "fingerprint",
  "forensic",
  "home",
  "id_forge",
  "metadata",
  "pixel-injection",
  "privacy",
  "removal-tools",
  "search",
  "social",
  "timestamp",
  "watermark",
]);

// Sensitive paths that must never be served over HTTP: VCS internals,
// dotenv secrets, dependency trees, private key material and local TLS certs.
var BLOCKED_PATH_RE =
  /(^|\/)(\.git|\.hg|\.svn|\.env|node_modules|certs)(\/|$)/i;
var BLOCKED_SECRET_EXT_RE = /\.(pem|key|p12|pfx|asc|gpg|secret|env)$/i;

/**
 *
 * @param resolved
 */
function isBlockedPath(resolved) {
  var rel = resolved.slice(ROOT.length).replaceAll(path.sep, "/");
  if (BLOCKED_PATH_RE.test(rel)) return true;
  if (BLOCKED_SECRET_EXT_RE.test(rel)) return true;
  return false;
}

var serverFactory = useHttps
  ? https.createServer.bind(null, TLS_OPTIONS)
  : http.createServer;
serverFactory(function (req, res) {
  var pathname = "/" + req.url.split("?", 1)[0].replaceAll(/^\/+|\/+$/g, "");
  var filePath;
  var m;
  var rewritten;
  var stylePath;
  var notFoundPath;
  if (pathname === "/") pathname = "/index.html";
  filePath = path.join(ROOT, pathname.replaceAll("/", path.sep));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }

  // Try direct path first; if 404, try rewrites
  if (!tryServe(filePath, req, res)) {
    // Rewrite `/page_name/`, `/page_name/index.html`, or bare `/page_name`
    // → Style/pages/{name}/index.html
    m = pathname.match(/^\/([^\/]+?)(?:\/index\.html|\/)?$/);
    if (m && PAGE_NAMES.has(m[1])) {
      rewritten = path.join(ROOT, "Style", "pages", m[1], "index.html");
      if (tryServe(rewritten, req, res)) return;
    }
    // Rewrite unmatched paths to Style/ directory
    // (handles relative asset references from MPA pages, e.g. /style.css → Style/style.css)
    stylePath = path.join(ROOT, "Style", pathname.replace(/^\//, ""));
    if (tryServe(stylePath, req, res)) return;
    // Last resort: serve custom 404 page with a real 404 status (never 200+
    // text/html for missing assets — that makes <script> requests fail with a
    // "script has an unsupported MIME type" console error)
    notFoundPath = path.join(ROOT, "404.html");
    if (fs.existsSync(notFoundPath)) {
      res.writeHead(404, {
        "Content-Type": "text/html",
        "Cache-Control": "no-store",
      });
      res.end(fs.readFileSync(notFoundPath));
      return;
    }
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end("Not Found: " + escHtml(pathname));
  }
}).listen(port, host, function () {
  var scheme = useHttps ? "https" : "http";
  console.log(
    "[dev-server] " + scheme + "://" + host + ":" + port + " serving " + ROOT,
  );
});

/**
 *
 * @param filePath
 * @param req
 * @param res
 */
function tryServe(filePath, req, res) {
  var resolved;
  var stat;
  var target;
  var ext;
  var isHtml;
  var etag;
  var headers;
  var COMPRESSIBLE;
  var acceptGzip;
  var range;
  var parts;
  var start;
  var end;
  try {
    resolved = path.resolve(filePath);
    if (isBlockedPath(resolved)) return false;
    if (resolved === REAL_ROOT) resolved = path.join(REAL_ROOT, "index.html");
    if (!resolved.startsWith(REAL_ROOT + path.sep)) return false;
    stat = fs.statSync(resolved);
    target = resolved;
    if (stat.isDirectory()) {
      target = path.join(resolved, "index.html");
      if (!target.startsWith(REAL_ROOT + path.sep)) return false;
      stat = fs.statSync(target);
    }
    ext = path.extname(target);
    isHtml = ext === ".html";
    etag = '"' + stat.mtimeMs.toString(36) + "-" + stat.size.toString(36) + '"';
    headers = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
      ETag: etag,
    };
    if (!isHtml && req.headers["if-none-match"] === etag) {
      res.writeHead(304, headers);
      res.end();
      return true;
    }
    COMPRESSIBLE = [
      ".html",
      ".js",
      ".css",
      ".json",
      ".svg",
      ".xml",
      ".md",
      ".txt",
    ];
    acceptGzip =
      COMPRESSIBLE.includes(ext) &&
      req.headers["accept-encoding"] &&
      req.headers["accept-encoding"].includes("gzip");
    range = req.headers.range;
    if (range) {
      parts = range.replace(/bytes=/, "").split("-");
      start = Number.parseInt(parts[0], 10);
      end = parts[1] ? Number.parseInt(parts[1], 10) : stat.size - 1;
      if (start >= stat.size) {
        res.writeHead(416);
        res.end();
        return true;
      }
      headers["Content-Range"] = "bytes " + start + "-" + end + "/" + stat.size;
      headers["Content-Length"] = end - start + 1;
      res.writeHead(206, headers);
      fs.createReadStream(target, { start: start, end: end }).pipe(res);
    } else if (acceptGzip) {
      headers["Content-Encoding"] = "gzip";
      headers["Content-Type"] = MIME[ext] || "application/octet-stream";
      delete headers["Content-Length"];
      res.writeHead(200, headers);
      fs.createReadStream(target).pipe(zlib.createGzip()).pipe(res);
    } else {
      headers["Content-Length"] = stat.size;
      headers["Content-Type"] = MIME[ext] || "application/octet-stream";
      res.writeHead(200, headers);
      fs.createReadStream(target).pipe(res);
    }
    return true;
  } catch {
    return false;
  }
}

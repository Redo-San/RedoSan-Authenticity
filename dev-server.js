var http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  zlib = require("node:zlib");
var ROOT = path.resolve(__dirname);
var REAL_ROOT = fs.realpathSync(ROOT);

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
// dotenv secrets, dependency trees and private key material.
var BLOCKED_PATH_RE = /(^|\/)(\.git|\.hg|\.svn|\.env|node_modules)(\/|$)/i;
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

http
  .createServer(function (req, res) {
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
  })
  .listen(8080, "127.0.0.1");

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

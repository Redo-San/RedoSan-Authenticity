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

http
  .createServer(function (req, res) {
    var pathname = "/" + req.url.split("?", 1)[0].replaceAll(/^\/+|\/+$/g, "");
    if (pathname === "/") pathname = "/index.html";
    var filePath = path.join(ROOT, pathname.replaceAll("/", path.sep));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }

    // Try direct path first; if 404, try rewrites
    if (!tryServe(filePath, req, res)) {
      // Rewrite `/page_name/`, `/page_name/index.html`, or bare `/page_name`
      // → Style/pages/{name}/index.html
      var m = pathname.match(/^\/([^\/]+?)(?:\/index\.html|\/)?$/);
      if (m && PAGE_NAMES.has(m[1])) {
        var rewritten = path.join(ROOT, "Style", "pages", m[1], "index.html");
        if (tryServe(rewritten, req, res)) return;
      }
      // Rewrite unmatched paths to Style/ directory
      // (handles relative asset references from MPA pages, e.g. /style.css → Style/style.css)
      var stylePath = path.join(ROOT, "Style", pathname.replace(/^\//, ""));
      if (tryServe(stylePath, req, res)) return;
      // Last resort: serve custom 404 page with a real 404 status (never 200+
      // text/html for missing assets — that makes <script> requests fail with a
      // "script has an unsupported MIME type" console error)
      var notFoundPath = path.join(ROOT, "404.html");
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
  .listen(8080, "0.0.0.0");

/**
 *
 * @param filePath
 * @param req
 * @param res
 */
function tryServe(filePath, req, res) {
  try {
    var realPath = fs.realpathSync(filePath);
    if (!(realPath.startsWith(REAL_ROOT + path.sep) || realPath === REAL_ROOT))
      return false;
    var stat = fs.statSync(realPath);
    if (stat.isDirectory()) {
      realPath = path.join(realPath, "index.html");
      stat = fs.statSync(realPath);
    }
    filePath = realPath;
    var ext = path.extname(filePath);
    var isHtml = ext === ".html";
    var headers = {
      "Accept-Ranges": "bytes",
      "Cache-Control": isHtml ? "max-age=0, must-revalidate" : "max-age=3600",
    };
    var COMPRESSIBLE = [".html", ".js", ".css", ".json", ".svg", ".xml", ".md", ".txt"];
    var acceptGzip = COMPRESSIBLE.includes(ext) && req.headers["accept-encoding"] && req.headers["accept-encoding"].includes("gzip");
    var range = req.headers.range;
    if (range) {
      var parts = range.replace(/bytes=/, "").split("-");
      var start = Number.parseInt(parts[0], 10);
      var end = parts[1] ? Number.parseInt(parts[1], 10) : stat.size - 1;
      if (start >= stat.size) {
        res.writeHead(416);
        res.end();
        return true;
      }
      headers["Content-Range"] = "bytes " + start + "-" + end + "/" + stat.size;
      headers["Content-Length"] = end - start + 1;
      res.writeHead(206, headers);
      fs.createReadStream(filePath, { start: start, end: end }).pipe(res);
    } else if (acceptGzip) {
      headers["Content-Encoding"] = "gzip";
      headers["Content-Type"] = MIME[ext] || "application/octet-stream";
      delete headers["Content-Length"];
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(zlib.createGzip()).pipe(res);
    } else {
      headers["Content-Length"] = stat.size;
      headers["Content-Type"] = MIME[ext] || "application/octet-stream";
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    }
    return true;
  } catch {
    return false;
  }
}

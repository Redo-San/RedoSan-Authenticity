const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
let { startCoverage, stopCoverage } = require("./e2e_coverage");

const PORT = 9455;
const BASE = `http://localhost:${PORT}`;
const ROOT = path.resolve(__dirname, "../../..");
const REAL_ROOT = fs.realpathSync(ROOT);

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

let _covSeq = 0;

const PAGE_NAMES = new Set([
  "about", "audio-watermark", "c2pa", "certificate", "contact",
  "converter", "did", "document-watermark", "face-biometric",
  "fingerprint", "forensic", "home", "id_forge", "metadata",
  "pixel-injection", "privacy", "removal-tools", "search",
  "social", "timestamp", "watermark",
]);

var AMP = "(?:&amp;|&)";
var DASH = "\u2014";
var SUFFIX = DASH + " RedoSan Authenticity$";

var PAGE_TITLES = {};
function setRE(id, pattern) {
  PAGE_TITLES[id] = { re: new RegExp("^" + pattern + SUFFIX) };
}
PAGE_TITLES.home = { re: new RegExp("^RedoSan Authenticity " + DASH + " Digital Watermark, Fingerprint " + AMP + " Metadata Tool$") };
setRE("about", "About ");
setRE("privacy", "Privacy Policy ");
setRE("contact", "Contact ");
setRE("social", "Social Links ");
setRE("search", "Search ");
setRE("watermark", "Digital Watermark ");
setRE("audio-watermark", "Audio Watermark ");
setRE("fingerprint", "Fingerprint " + AMP + " Image Hashing ");
setRE("pixel-injection", "Pixel Injection ");
setRE("metadata", "Metadata " + AMP + " EXIF Reader ");
setRE("timestamp", "Timestamp " + AMP + " OTS Verification ");
setRE("did", "Decentralized Identity \\(DID\\) ");
setRE("c2pa", "C2PA Content Provenance ");
setRE("certificate", "Digital Passport Certificate ");
setRE("forensic", "Forensic Analyzer ");
setRE("converter", "File Converter ");
setRE("removal-tools", "Watermark Removal Tools ");
setRE("id_forge", "ID Forge ");
setRE("document-watermark", "Document Watermark ");
setRE("face-biometric", "Face Biometric Rights ");

let server = null;
let started = false;

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tryServe(filePath, res) {
  try {
    var resolved = path.resolve(filePath);
    if (resolved === REAL_ROOT) resolved = path.join(REAL_ROOT, "index.html");
    if (!resolved.startsWith(REAL_ROOT + path.sep)) return false;
    var stat = fs.statSync(resolved);
    var target = resolved;
    if (stat.isDirectory()) {
      target = path.join(resolved, "index.html");
      if (!target.startsWith(REAL_ROOT + path.sep)) return false;
      stat = fs.statSync(target);
    }
    var ext = path.extname(target);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(target).pipe(res);
    return true;
  } catch {
    return false;
  }
}

function ensureServer() {
  if (started) return Promise.resolve();
  return new Promise(function (resolve, reject) {
    // Check if port is already in use from a previous process
    var tester = http.request({ host: "localhost", port: PORT, path: "/", method: "HEAD" }, function (res) {
      tester.destroy();
      started = true;
      resolve();
    });
    tester.on("error", function () {
      // Port is free, start the server
      server = http.createServer(function (req, res) {
        var pathname = "/" + req.url.split("?", 1)[0].replaceAll(/^\/+|\/+$/g, "");
        if (pathname === "/") pathname = "/index.html";
        var filePath = path.join(ROOT, pathname.replaceAll("/", path.sep));

        if (tryServe(filePath, res)) return;

        var m = pathname.match(/^\/([^\/]+?)(?:\/index\.html|\/)?$/);
        if (m && PAGE_NAMES.has(m[1])) {
          var rewritten = path.join(ROOT, "Style", "pages", m[1], "index.html");
          if (tryServe(rewritten, res)) return;
        }

        var stylePath = path.join(ROOT, "Style", pathname.replace(/^\//, ""));
        if (tryServe(stylePath, res)) return;

        var notFoundPath = path.join(ROOT, "404.html");
        if (tryServe(notFoundPath, res)) return;

        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("Not Found: " + escHtml(pathname));
      });
      server.on("error", function (err) {
        if (err.code === "EADDRINUSE") {
          started = true;
          resolve();
        } else {
          reject(err);
        }
      });
      server.listen(PORT, function () { server.unref(); resolve(); });
    });
    tester.setTimeout(3000, function () { tester.destroy(); started = true; resolve(); });
    tester.end();
  });
}

function pageURL(pageId) {
  return BASE + "/" + pageId + "/";
}

async function openPage(browser, pageId) {
  var ctx = await browser.newContext({ locale: "en-US" });
  var page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  var errors = [];
  page.on("pageerror", function (e) { errors.push(e.message); });
  page.on("console", function (msg) {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await startCoverage(page);
  _covSeq++;
  page.__covTag = pageId + "-" + _covSeq;
  await page.goto(pageURL(pageId), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  return { ctx: ctx, page: page, errors: errors };
}

async function closePage(ctx, page) {
  if (page && page.__covTag) {
    await stopCoverage(page, page.__covTag);
  }
  if (ctx) await ctx.close();
}

async function checkPageLoad(page, pageId) {
  var title = await page.title();
  var info = PAGE_TITLES[pageId];
  assert.ok(info && info.re.test(title), "Title should match for " + pageId + ". Got: " + title);
  var standalone = await page.evaluate(function () {
    return document.documentElement.dataset.standalone;
  });
  assert.equal(standalone, pageId, "data-standalone should be " + pageId);
  var active = await page.evaluate(function (id) {
    var el = document.getElementById("page-" + id);
    return el && el.classList.contains("active");
  }, pageId);
  assert.ok(active, "#page-" + pageId + " should have active class");
}

var KNOWN_BENIGN = [
  /frame-ancestors.*ignored.*meta/i,
  /unsupported MIME type.*text\/html/i,
  /ERR_ABORTED/i,
  /Failed to load resource/i,
  /favicon/i,
  /valid digest/i,
  /404/i,
];

function checkNoErrors(errors, pageId) {
  var critical = errors.filter(function (e) {
    return !KNOWN_BENIGN.some(function (re) { return re.test(e); });
  });
  assert.equal(
    critical.length,
    0,
    "No critical console errors for " + pageId + ": " + JSON.stringify(critical)
  );
}

function stopServer() {
  if (server) {
    server.close();
    server = null;
    started = false;
  }
}

module.exports = {
  ensureServer, stopServer, pageURL, openPage, closePage, checkPageLoad, checkNoErrors,
  BASE, PORT, ROOT, PAGE_NAMES, PAGE_TITLES,
};

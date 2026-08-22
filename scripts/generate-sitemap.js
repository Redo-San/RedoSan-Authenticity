var fs = require("node:fs");
var path = require("node:path");
var cp = require("node:child_process");

var ROOT = path.resolve(__dirname, "..");
var BASE = "https://redo-san.github.io/RedoSan-Authenticity";
var PAGES_DIR = path.join(ROOT, "Style", "pages");

var STATIC_PAGES = new Set(["about", "contact", "privacy", "social", "search"]);

// Pages that exist only locally / are still under development and must not be
// indexed publicly. face-biometric is fully implemented and IS indexed.
var LOCAL_ONLY_PAGES = new Set(["removal-tools"]);

/**
 *
 * @param relPath
 */
function gitLastMod(relPath) {
  var res = cp.spawnSync("git", ["log", "-1", "--format=%cI", "--", relPath], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 10_000,
  });
  if (res.status === 0 && res.stdout && res.stdout.trim()) {
    return res.stdout.trim().slice(0, 10);
  }
  var st = fs.statSync(path.join(ROOT, relPath));
  return st.mtime.toISOString().slice(0, 10);
}

/**
 *
 * @param loc
 * @param lastmod
 * @param changefreq
 * @param priority
 */
function entry(loc, lastmod, changefreq, priority) {
  return (
    "  <url>\n" +
    "    <loc>" +
    loc +
    "</loc>\n" +
    "    <lastmod>" +
    lastmod +
    "</lastmod>\n" +
    "    <changefreq>" +
    changefreq +
    "</changefreq>\n" +
    "    <priority>" +
    priority +
    "</priority>\n" +
    "  </url>"
  );
}

var urls = [];
urls.push(entry(BASE + "/", gitLastMod("index.html"), "weekly", "1.0"));

var names = fs
  .readdirSync(PAGES_DIR, { withFileTypes: true })
  .filter(function (d) {
    return (
      d.isDirectory() &&
      d.name !== "home" &&
      !LOCAL_ONLY_PAGES.has(d.name) &&
      fs.existsSync(path.join(PAGES_DIR, d.name, "index.html"))
    );
  })
  .map(function (d) {
    return d.name;
  })
  .sort();

names.forEach(function (name) {
  var rel = path.join("Style", "pages", name, "index.html");
  var loc = BASE + "/Style/pages/" + name + "/index.html";
  if (STATIC_PAGES.has(name)) {
    urls.push(entry(loc, gitLastMod(rel), "monthly", "0.5"));
  } else {
    urls.push(entry(loc, gitLastMod(rel), "monthly", "0.8"));
  }
});

var xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.join("\n") +
  "\n</urlset>\n";

fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml);
console.log("sitemap.xml generated: " + urls.length + " URLs");

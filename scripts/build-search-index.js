var fs = require("node:fs");
var path = require("node:path");

var ROOT = path.resolve(__dirname, "..");

/**
 *
 * @param s
 */
function stripTags(s) {
  var out = "";
  var inTag = false;
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch === "<") {
      inTag = true;
      continue;
    }
    if (ch === ">") {
      inTag = false;
      continue;
    }
    if (!inTag) out += ch;
  }
  return out;
}

/**
 *
 * @param content
 */
function extractTitle(content) {
  var m = content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  return m ? stripTags(m[1]).replaceAll(/\s+/g, " ").trim() : "";
}

/**
 *
 * @param content
 */
function extractKeywords(content) {
  var re = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  var kws = [];
  var m;
  while ((m = re.exec(content)) !== null) {
    var kw = stripTags(m[1]).replaceAll(/\s+/g, " ").trim();
    if (kw) kws.push(kw);
  }
  return kws;
}

/**
 *
 * @param content
 */
function extractText(content) {
  return stripTags(content).replaceAll(/\s+/g, " ").trim();
}

/**
 *
 * @param pageDir
 */
function buildForStandalonePage(pageDir) {
  var htmlPath = path.join(pageDir, "index.html");
  if (!fs.existsSync(htmlPath)) return null;
  var html = fs.readFileSync(htmlPath, "utf8");

  var m = html.match(/<main[^>]*id="app"[^>]*>([\s\S]*?)<\/main>/i);
  if (!m) return null;

  var content = m[1];
  var pageId = path.basename(pageDir);

  return {
    id: pageId,
    title: extractTitle(content),
    url: "../" + pageId + "/",
    keywords: extractKeywords(content),
    text: extractText(content),
  };
}

/**
 *
 */
function buildIndex() {
  var pagesDir = path.join(ROOT, "Style", "pages");
  var index = [];

  var dirs = fs.readdirSync(pagesDir);
  dirs.forEach(function (d) {
    var dirPath = path.join(pagesDir, d);
    if (!fs.statSync(dirPath).isDirectory()) return;
    var entry = buildForStandalonePage(dirPath);
    if (entry) {
      index.push(entry);
    }
  });

  index.sort(function (a, b) {
    return a.id.localeCompare(b.id);
  });

  var outPath = path.join(pagesDir, "search", "search-index.json");
  fs.writeFileSync(outPath, JSON.stringify(index), "utf-8");
}

buildIndex();

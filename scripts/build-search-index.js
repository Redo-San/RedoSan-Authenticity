var fs = require("fs");
var path = require("path");

var ROOT = path.resolve(__dirname, "..");
var PAGES = [
  { id: "home", title: "Home" },
  { id: "watermark", title: "Image Watermarking" },
  { id: "audio-watermark", title: "Audio Watermarking" },
  { id: "fingerprint", title: "File Fingerprinting" },
  { id: "search", title: "Search" },
  { id: "pixel-injection", title: "Pixel Injection" },
  { id: "metadata", title: "Metadata / EXIF Reader" },
  { id: "timestamp", title: "OpenTimestamps" },
  { id: "did", title: "DID Identity" },
  { id: "c2pa", title: "C2PA Provenance" },
  { id: "certificate", title: "Digital Passport Certificate" },
  { id: "forensic", title: "Forensic Analyzer" },
  { id: "converter", title: "File Converter" },
  { id: "removal-tools", title: "Removal Tools" },
  { id: "id_forge", title: "ID Forge" },
  { id: "document-watermark", title: "Document Watermarking" },
  { id: "about", title: "About" },
  { id: "privacy", title: "Privacy Policy" },
  { id: "contact", title: "Contact" },
  { id: "social", title: "Social" },
];

function stripTags(s) {
  return s.replace(/<[^>]*>/g, "");
}

function extractTitle(content) {
  var m = content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  return m ? stripTags(m[1]).replace(/\s+/g, " ").trim() : "";
}

function extractKeywords(content) {
  var re = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  var kws = [];
  var m;
  while ((m = re.exec(content)) !== null) {
    var kw = stripTags(m[1]).replace(/\s+/g, " ").trim();
    if (kw) kws.push(kw);
  }
  return kws;
}

function extractText(content) {
  return stripTags(content).replace(/\s+/g, " ").trim();
}

function buildForIndexHtml() {
  var html = fs.readFileSync(path.join(ROOT, "index.html"), "utf-8");
  var index = [];
  PAGES.forEach(function (p) {
    var re = new RegExp(
      '<section[^>]*id="page-' + p.id + '"[^>]*>([\\s\\S]*?)<\\/section>',
      "i",
    );
    var m = html.match(re);
    if (!m) {
      console.warn("  WARN: page-" + p.id + " section not found in index.html");
      return;
    }
    var content = m[1];
    index.push({
      id: p.id,
      title: p.title,
      keywords: extractKeywords(content),
      text: extractText(content),
    });
  });
  return index;
}

function buildForStandalonePage(pageDir) {
  var htmlPath = path.join(pageDir, "index.html");
  if (!fs.existsSync(htmlPath)) return null;
  var html = fs.readFileSync(htmlPath, "utf-8");

  // Extract content from main#app section
  var m = html.match(
    /<main[^>]*class="container"[^>]*id="app"[^>]*>([\s\S]*?)<\/main>/i,
  );
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

function buildIndex() {
  var pagesDir = path.join(ROOT, "Style", "pages");
  var index = [];

  console.log("Building search index...");
  console.log("SPA mode: scanning index.html sections\n");

  // Build from SPA sections first (fallback for SPA mode)
  var spaIndex = buildForIndexHtml();
  console.log("SPA index: " + spaIndex.length + " pages");

  // Build from standalone pages
  console.log("\nMPA mode: scanning standalone pages...");
  var dirs = fs.readdirSync(pagesDir);
  dirs.forEach(function (d) {
    var dirPath = path.join(pagesDir, d);
    if (!fs.statSync(dirPath).isDirectory()) return;
    var entry = buildForStandalonePage(dirPath);
    if (entry) {
      index.push(entry);
      console.log("  " + d + " -> " + entry.title);
    }
  });

  // Also add SPA sections that might not have standalone pages
  // (but all should have standalone pages now)

  // Sort by id
  index.sort(function (a, b) {
    return a.id.localeCompare(b.id);
  });

  // Write index
  var outPath = path.join(pagesDir, "search", "search-index.json");
  fs.writeFileSync(outPath, JSON.stringify(index), "utf-8");
  console.log("\nWrote " + index.length + " pages to " + outPath);

  var sizeKB = (
    Buffer.byteLength(JSON.stringify(index), "utf-8") / 1024
  ).toFixed(1);
  console.log("Index size: " + sizeKB + " KB");
}

buildIndex();

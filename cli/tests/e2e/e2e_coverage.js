const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const V8_DIR = path.resolve(ROOT, "coverage/e2e-v8");
const C8_DIR = path.resolve(ROOT, "coverage/temp");

function ensureDir(p) {
  if (!fs.existsSync(p))
    fs.mkdirSync(p, { recursive: true });
}

async function startCoverage(page) {
  await page.coverage.startJSCoverage({
    resetOnNavigation: false,
    reportAnonymousScripts: false,
  });
}

async function stopCoverage(page, tag) {
  const entries = await page.coverage.stopJSCoverage();
  ensureDir(V8_DIR);
  const filePath = path.join(V8_DIR, `${tag}-${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2));
  return filePath;
}

function prepareForC8() {
  ensureDir(V8_DIR);
  const files = fs.readdirSync(V8_DIR).filter(f => f.endsWith(".json"));
  if (!files.length) {
    console.log("No V8 coverage files found in " + V8_DIR);
    return;
  }

  ensureDir(C8_DIR);
  let copied = 0;
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(V8_DIR, file), "utf8"));
    const mapped = raw.map(entry => {
      let url = entry.url || "";
      const src = entry.source || "";
      if (url.startsWith("http://localhost") || url.startsWith("https://localhost")) {
        const parsed = new URL(url);
        url = path.resolve(ROOT, "." + parsed.pathname);
      }
      return {
        scriptId: entry.scriptId || "1",
        url,
        functions: entry.functions || [],
        source: src,
      };
    });

    const outPath = path.join(C8_DIR, `e2e-${Date.now()}-${file}`);
    fs.writeFileSync(outPath, JSON.stringify({ result: mapped }, null, 2));
    copied++;
  }
  console.log(`Copied ${copied} e2e coverage file(s) to ${C8_DIR}`);
}

function cleanV8Dir() {
  ensureDir(V8_DIR);
  for (const f of fs.readdirSync(V8_DIR)) {
    fs.rmSync(path.join(V8_DIR, f), { force: true });
  }
}

if (require.main === module) {
  prepareForC8();
}

module.exports = { startCoverage, stopCoverage, prepareForC8, cleanV8Dir };

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
// Unique V8 dir per process so parallel test files never delete each other's
// coverage data mid-run (each node --test file is its own process).
const V8_DIR = path.resolve(ROOT, "coverage", "e2e-v8-" + process.pid);
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
  try {
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2));
  } catch (e) {
    // Never let a coverage write failure fail the test itself.
    void e;
  }
  return filePath;
}

function prepareForC8() {
  // Collect coverage from every per-process V8 dir (each parallel test file
  // writes to its own e2e-v8-<pid> folder).
  const v8Root = path.resolve(ROOT, "coverage");
  let dirs = [];
  try {
    dirs = fs.readdirSync(v8Root).filter((d) => d.startsWith("e2e-v8-"));
  } catch (e) {
    void e;
    return;
  }
  const files = [];
  for (const dir of dirs) {
    try {
      files.push(
        ...fs.readdirSync(path.join(v8Root, dir)).map((f) => path.join(v8Root, dir, f))
      );
    } catch (e) {
      void e; // Dir may have been removed by another process — skip.
    }
  }
  if (!files.length) {
    console.log("No V8 coverage files found in " + v8Root);
    return;
  }

  ensureDir(C8_DIR);
  let copied = 0;
  for (const file of files) {
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      // File may be gone or locked by a parallel test process — skip it.
      void e;
      continue;
    }
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

    const outPath = path.join(C8_DIR, `e2e-${process.pid}-${Date.now()}-${path.basename(file)}`);
    try {
      fs.writeFileSync(outPath, JSON.stringify({ result: mapped }, null, 2));
      copied++;
    } catch (e) {
      void e; // Never fail the test run because of coverage export.
    }
  }
  console.log(`Copied ${copied} e2e coverage file(s) to ${C8_DIR}`);
}

function cleanV8Dir() {
  ensureDir(V8_DIR);
  for (const f of fs.readdirSync(V8_DIR)) {
    try {
      fs.rmSync(path.join(V8_DIR, f), { force: true });
    } catch (e) {
      // A parallel test process may still hold the file open — ignore.
    }
  }
}

if (require.main === module) {
  prepareForC8();
}

module.exports = { startCoverage, stopCoverage, prepareForC8, cleanV8Dir };

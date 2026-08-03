const { execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.resolve(__dirname, "..");
const V8_DIR = path.resolve(ROOT, "coverage/e2e-v8");

/**
 *
 */
function main() {
  const useDeep = process.argv.includes("--deep");
  const suite = useDeep ? "test:e2e-deep" : "test:e2e-all";

  console.log(`Running E2E coverage guard: npm run ${suite}`);
  execSync(`npm run ${suite}`, { cwd: ROOT, stdio: "inherit" });

  if (!fs.existsSync(V8_DIR)) {
    console.error("FAIL: No coverage/e2e-v8 directory found");
    process.exit(1);
  }

  const files = fs.readdirSync(V8_DIR).filter(f => f.endsWith(".json"));
  if (files.length === 0) {
    console.error("FAIL: No V8 coverage JSON files produced");
    process.exit(1);
  }

  let totalScripts = 0;
  let styleScripts = 0;
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(V8_DIR, f), "utf8"));
    for (const entry of raw) {
      totalScripts++;
      if (entry.url && (entry.url.includes("/Style/") || entry.url.includes("/Watermark/") || entry.url.includes("/Fingerprint/"))) {
        styleScripts++;
      }
    }
  }

  console.log(`\nE2E coverage guard: ${files.length} file(s), ${totalScripts} script entries, ${styleScripts} Style/ scripts`);

  if (styleScripts === 0 && !useDeep) {
    console.warn("WARN: No Style/ scripts captured in V8 coverage (expected with shallow run)");
  }
  if (styleScripts === 0 && useDeep) {
    console.error("FAIL: Deep run should capture Style/ scripts in V8 coverage");
    process.exit(1);
  }

  console.log("PASS: E2E coverage guard OK");
}

main();

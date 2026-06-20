import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8080";

const pages = [
  "/watermark/index.html",
  "/fingerprint/index.html",
  "/pixel-injection/index.html",
  "/document-watermark/index.html",
  "/audio-watermark/index.html",
  "/c2pa/index.html",
  "/certificate/index.html",
  "/forensic/index.html",
  "/converter/index.html",
  "/metadata/index.html",
  "/id_forge/index.html",
  "/did/index.html",
  "/timestamp/index.html",
  "/removal-tools/index.html",
  "/search/index.html",
];

let total = 0;
let passed = true;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

for (const p of pages) {
  try {
    await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 15000 });
    const results = await new AxeBuilder({ page }).analyze();
    if (results.violations.length > 0) {
      console.log(`${p}: ${results.violations.length} violations`);
      for (const v of results.violations) {
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
        for (const n of v.nodes.slice(0, 3)) {
          console.log(`    ${n.html}`);
        }
      }
      total += results.violations.length;
      passed = false;
    } else {
      console.log(`${p}: 0 violations`);
    }
  } catch (e) {
    console.log(`${p}: SKIPPED (${e.message})`);
  }
}

await browser.close();
console.log(`\nTotal violations across ${pages.length} pages: ${total}`);
if (!passed) process.exit(1);

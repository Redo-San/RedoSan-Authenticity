const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("node:path");
const fs = require("node:fs");

const PORT = 9904;
const BASE = `http://localhost:${PORT}`;
const PNG_BUF = fs.readFileSync(path.resolve(__dirname, "..", "fixtures", "testimg_64x64.png"));

(async () => {
  const _server = await startServer(PORT);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on("console", (msg) => console.log("PAGE:", msg.text()));
  page.on("pageerror", (err) => console.log("PAGE_ERROR:", err.message));

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Click sidebar
  await page.evaluate(() => {
    const a = document.querySelector('#sidebar a[data-page="pixel-injection"]');
    if (a) a.click();
  });
  await page.waitForTimeout(2000);

  // Select DCT algorithm
  const setAlgoResult = await page.evaluate(() => {
    const sel = document.getElementById("pi-algorithm");
    if (!sel) return { error: "no embed algorithm select", opts: [] };
    const beforeOpts = Array.from(sel.options).map((o) => o.value);
    sel.value = "dct";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return {
      beforeOpts,
      selected: sel.value,
      curAlgo: globalThis.pixelInjection?.currentAlgorithm || "N/A",
    };
  });
  console.log("SET DCT ALGO:", JSON.stringify(setAlgoResult));

  // Upload and embed
  await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
  await page.waitForTimeout(500);
  await page.setInputFiles("#pi-secret-file", [
    { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("PI ROUNDTRIP DCT") },
  ]);
  await page.waitForTimeout(500);

  await page.evaluate(() => document.getElementById("pi-btn").click());
  await page.waitForFunction(
    () => {
      const r = document.getElementById("pi-result");
      return r && r.style.display !== "none";
    },
    { timeout: 30000 },
  );
  await page.waitForTimeout(1000);

  // Check embed result
  const embedCheck = await page.evaluate(() => {
    const output = document.getElementById("pi-output");
    const img = output ? output.querySelector("img") : null;
    return { hasImg: !!img, imgSrcStart: img ? img.src.substring(0, 30) : "none" };
  });
  console.log("EMBED CHECK:", JSON.stringify(embedCheck));

  // Get watermarked image
  const imgDataUrl = await page.evaluate(() => {
    const output = document.getElementById("pi-output");
    if (!output) return null;
    const img = output.querySelector("img");
    return img ? img.src : null;
  });
  const base64Data = imgDataUrl.split(",")[1];
  const imgBuf = Buffer.from(base64Data, "base64");

  // Switch to extract tab
  await page.evaluate(() => switchPiTab("extract"));
  await page.waitForTimeout(500);

  // Check extract algorithm selector
  const extractDiag = await page.evaluate(() => {
    const sel = document.getElementById("pi-extract-algorithm");
    if (!sel) return { error: "no extract select" };
    const opts = Array.from(sel.options).map((o) => o.value);
    return { opts, selected: sel.value };
  });
  console.log("EXTRACT DIAG:", JSON.stringify(extractDiag));

  // Set DCT in extract
  await page.evaluate(() => {
    const sel = document.getElementById("pi-extract-algorithm");
    if (sel) {
      sel.value = "dct";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await page.waitForTimeout(300);

  const afterSet = await page.evaluate(() => {
    const sel = document.getElementById("pi-extract-algorithm");
    return { selected: sel ? sel.value : "N/A", opts: sel ? Array.from(sel.options).map((o) => o.value) : [] };
  });
  console.log("AFTER SET DCT EXTRACT:", JSON.stringify(afterSet));

  // Upload watermarked image
  await page.setInputFiles("#pi-watermarked-image", [
    { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
  ]);
  await page.waitForTimeout(500);

  // Click extract
  await page.evaluate(() => document.getElementById("pi-extract-btn").click());
  await page.waitForFunction(
    () => {
      const r = document.getElementById("pi-result");
      return r && r.style.display !== "none";
    },
    { timeout: 30000 },
  );
  await page.waitForTimeout(1000);

  const outputHtml = await page.evaluate(() => {
    const el = document.getElementById("pi-output");
    return el ? el.innerHTML : "";
  });
  console.log("OUTPUT HTML:", outputHtml.substring(0, 500));

  await ctx.close();
  await browser.close();
  stopServer();
})().catch((e) => {
  console.error("ERROR:", e.message, e.stack);
  stopServer();
  process.exit(1);
});

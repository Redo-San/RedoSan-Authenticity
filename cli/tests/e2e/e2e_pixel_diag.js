const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("node:path");
const fs = require("node:fs");

const PORT = 9903;
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

  const initialDiag = await page.evaluate(() => {
    const sel = document.getElementById("pi-extract-algorithm");
    const opts = sel ? Array.from(sel.options).map((o) => o.value) : [];
    const embedSel = document.getElementById("pi-algorithm");
    const embedOpts = embedSel ? Array.from(embedSel.options).map((o) => o.value) : [];
    const embedCat = document.getElementById("pi-category");
    const catOpts = embedCat ? Array.from(embedCat.options).map((o) => o.value) : [];
    return { extractOpts: opts, embedOpts: embedOpts, catOpts: catOpts };
  });
  console.log("BEFORE NAV:", JSON.stringify(initialDiag));

  // Click sidebar
  await page.evaluate(() => {
    const a = document.querySelector('#sidebar a[data-page="pixel-injection"]');
    if (a) a.click();
  });
  await page.waitForTimeout(2000);

  // Check state after navigation
  const afterNav = await page.evaluate(() => {
    const extractSel = document.getElementById("pi-extract-algorithm");
    const extractOpts = extractSel ? Array.from(extractSel.options).map((o) => o.value) : [];
    const embedSel = document.getElementById("pi-algorithm");
    const embedOpts = embedSel ? Array.from(embedSel.options).map((o) => o.value) : [];
    const embedCat = document.getElementById("pi-category");
    const catOpts = embedCat ? Array.from(embedCat.options).map((o) => o.value) : [];
    const hasPI = typeof globalThis.pixelInjection !== "undefined";
    const curAlgo = hasPI ? globalThis.pixelInjection.currentAlgorithm : "N/A";
    const curCat = hasPI ? globalThis.pixelInjection.currentCategory : "N/A";
    const hasCore = hasPI ? typeof globalThis.pixelInjection.core !== "undefined" : false;
    const hasEmbedFn = hasCore ? typeof globalThis.pixelInjection.core.enhancedLSB === "function" : false;
    const hasExtractFn = hasCore ? typeof globalThis.pixelInjection.core.extractEnhancedLSB === "function" : false;
    const extractMap = hasPI ? globalThis.pixelInjection.extractMap : {};
    return {
      extractOpts,
      embedOpts,
      catOpts,
      hasPixelInjection: hasPI,
      currentAlgorithm: curAlgo,
      currentCategory: curCat,
      hasCore,
      hasEmbedFn,
      hasExtractFn,
      extractMap: JSON.parse(JSON.stringify(extractMap)),
    };
  });
  console.log("AFTER NAV:", JSON.stringify(afterNav, null, 2));

  // Now try embed then extract to see what happens
  await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
  await page.waitForTimeout(500);
  await page.setInputFiles("#pi-secret-file", [
    { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("PI ROUNDTRIP") },
  ]);
  await page.waitForTimeout(500);

  // Click embed
  await page.evaluate(() => document.getElementById("pi-btn").click());
  await page.waitForFunction(
    () => {
      const r = document.getElementById("pi-result");
      return r && r.style.display !== "none";
    },
    { timeout: 30000 },
  );
  await page.waitForTimeout(1000);

  // Get watermarked image
  const imgDataUrl = await page.evaluate(() => {
    const output = document.getElementById("pi-output");
    if (!output) return null;
    const img = output.querySelector("img");
    return img ? img.src : null;
  });
  console.log("WATERMARKED IMG URL starts with data:", imgDataUrl ? imgDataUrl.startsWith("data:") : false);

  if (!imgDataUrl) {
    console.log("EMBED FAILED - no image shown");
    await ctx.close();
    await browser.close();
    stopServer();
    process.exit(1);
  }

  const base64Data = imgDataUrl.split(",")[1];
  const imgBuf = Buffer.from(base64Data, "base64");

  // Switch to extract tab
  await page.evaluate(() => switchPiTab("extract"));
  await page.waitForTimeout(500);

  // Check extract state
  const extractDiag = await page.evaluate(() => {
    const sel = document.getElementById("pi-extract-algorithm");
    return {
      options: sel ? Array.from(sel.options).map((o) => o.value) : [],
      selected: sel ? sel.value : null,
      curAlgo: globalThis.pixelInjection ? globalThis.pixelInjection.currentAlgorithm : "N/A",
    };
  });
  console.log("EXTRACT DIAG:", JSON.stringify(extractDiag));

  // Set algorithm - try to set enhanced_lsb even if option doesn't exist
  await page.evaluate(() => {
    const sel = document.getElementById("pi-extract-algorithm");
    if (sel) {
      sel.value = "enhanced_lsb";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await page.waitForTimeout(300);

  const afterSetAlgo = await page.evaluate(() => {
    const sel = document.getElementById("pi-extract-algorithm");
    return { selected: sel ? sel.value : null, options: sel ? Array.from(sel.options).map((o) => o.value) : [] };
  });
  console.log("AFTER SET ALGO:", JSON.stringify(afterSetAlgo));

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
  console.error("ERROR:", e.message);
  stopServer();
  process.exit(1);
});

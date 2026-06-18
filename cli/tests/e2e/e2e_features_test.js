const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("node:path");
const fs = require("node:fs");

const PORT = 9892;
const BASE = `http://localhost:${PORT}`;
const NAV_WAIT = { waitUntil: "domcontentloaded" };

const TEST_PNG = path.resolve(__dirname, "..", "fixtures", "testimg.png");
const PNG_BUF = fs.readFileSync(TEST_PNG);

let browser;
let _server;

before(async () => {
  _server = await startServer(PORT);
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  stopServer();
});

function navTo(page, id) {
  return page.evaluate((pid) => {
    const a = document.querySelector(`#sidebar a[data-page="${pid}"]`);
    if (a) a.click();
  }, id);
}

describe("E2E — Theme Toggle", () => {
  it("should toggle from dark to light on click", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));

    await page.evaluate(() => {
      const btn = document.getElementById("themeToggle");
      if (btn) btn.click();
    });
    await page.waitForTimeout(300);

    const toggledTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    assert.notEqual(initialTheme, toggledTheme, "Theme should change after toggle");
    await ctx.close();
  });

  it("should toggle back on second click", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    const initial = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));

    await page.evaluate(() => document.getElementById("themeToggle").click());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById("themeToggle").click());
    await page.waitForTimeout(300);

    const after = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    assert.equal(initial, after, "Should return to original after double toggle");
    await ctx.close();
  });
});

describe("E2E — Language Switching", () => {
  it("should switch to Arabic and change html lang", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    // Open language dropdown
    await page.evaluate(() => document.getElementById("langBtn").click());
    await page.waitForTimeout(300);

    // Click Arabic option
    await page.evaluate(() => {
      const ar = document.querySelector('#langMenu .lang-option[data-lang="ar"]');
      if (ar) ar.click();
    });
    await page.waitForTimeout(500);

    const lang = await page.evaluate(() => document.documentElement.getAttribute("lang"));
    assert.equal(lang, "ar", "Lang should be Arabic");
    await ctx.close();
  });

  it("should switch to French and change html lang", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    await page.evaluate(() => document.getElementById("langBtn").click());
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const fr = document.querySelector('#langMenu .lang-option[data-lang="fr"]');
      if (fr) fr.click();
    });
    await page.waitForTimeout(500);

    const lang = await page.evaluate(() => document.documentElement.getAttribute("lang"));
    assert.equal(lang, "fr", "Lang should be French");
    await ctx.close();
  });

  it("should switch back to English", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    await page.evaluate(() => document.getElementById("langBtn").click());
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const en = document.querySelector('#langMenu .lang-option[data-lang="en"]');
      if (en) en.click();
    });
    await page.waitForTimeout(500);

    const lang = await page.evaluate(() => document.documentElement.getAttribute("lang"));
    assert.equal(lang, "en", "Lang should be English");
    await ctx.close();
  });
});

describe("E2E — Download Formats", () => {
  function testDownloadFormat(format, fileNamePart) {
    return async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      const downloads = [];
      page.on("download", (dl) => downloads.push(dl));

      await page.goto(BASE, NAV_WAIT);
      await page.waitForTimeout(2000);
      await navTo(page, "fingerprint");
      await page.waitForTimeout(1000);

      // Upload and generate fingerprint
      await page.setInputFiles("#fp-file", [{ name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }]);
      await page.waitForTimeout(500);
      await page.evaluate(() => document.getElementById("fp-btn").click());
      await page.waitForSelector("#fp-result", { state: "visible", timeout: 30000 });
      await page.waitForTimeout(1000);

      // Open download modal
      await page.evaluate(() => {
        const btn = document.querySelector("#fp-download .btn");
        if (btn) btn.click();
      });
      await page.waitForTimeout(500);

      // Click format button directly
      await page.evaluate((fmt) => downloadResult(fmt), format);
      await page.waitForTimeout(2000);

      // Check download was triggered
      assert.ok(downloads.length > 0, `${format} download should start`);
      const dl = downloads[0];
      const suggested = dl.suggestedFilename();
      assert.ok(suggested.includes(fileNamePart), `${format} filename "${suggested}" should contain "${fileNamePart}"`);

      await ctx.close();
    };
  }

  it("should download TXT fingerprint", testDownloadFormat("txt", ".fingerprint.txt"));
  it("should download JSON fingerprint", testDownloadFormat("json", ".fingerprint.json"));
  it("should download CSV fingerprint", testDownloadFormat("csv", ".fingerprint.csv"));
  it("should download XML fingerprint", testDownloadFormat("xml", ".fingerprint.xml"));
  it("should download PDF fingerprint", testDownloadFormat("pdf", ".fingerprint.pdf"));
  it("should download DOCX fingerprint", testDownloadFormat("doc", ".fingerprint.docx"));
});

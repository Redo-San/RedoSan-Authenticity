const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("node:path");
const fs = require("node:fs");

const PORT = 9877;
const BASE = `http://localhost:${PORT}`;
const NAV_WAIT = { waitUntil: "domcontentloaded" };

// Valid 1x1 PNG for image/* accept filter
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

describe("E2E — Fingerprint Page", () => {
  it("should navigate to fingerprint page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "fingerprint");
    await page.waitForTimeout(1000);
    assert.equal(errors.filter((e) => !e.includes("404") && !e.includes("Failed to load")).length, 0);
    await ctx.close();
  });

  it("should have file input and fingerprint button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "fingerprint");
    await page.waitForTimeout(1000);
    const hasFileInput = await page.evaluate(() => !!document.getElementById("fp-file"));
    const hasBtn = await page.evaluate(() => !!document.getElementById("fp-btn"));
    assert.ok(hasFileInput, "File input should exist");
    assert.ok(hasBtn, "Fingerprint button should exist");
    await ctx.close();
  });

  it("should fingerprint a PNG file and show SHA-256 hash", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "fingerprint");
    await page.waitForTimeout(1000);

    // Upload a valid PNG file
    await page.setInputFiles("#fp-file", [{ name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }]);

    await page.waitForTimeout(500);

    // Verify file was actually accepted by the input
    const fileAccepted = await page.evaluate(() => {
      const input = document.getElementById("fp-file");
      return input?.files && input.files.length > 0;
    });
    assert.ok(fileAccepted, "File should be accepted by the input");

    // Click fingerprint button
    await page.evaluate(() => document.getElementById("fp-btn").click());

    // Wait for result
    await page.waitForSelector("#fp-result", { state: "visible", timeout: 30000 });
    await page.waitForTimeout(1000);

    // Verify output contains hash info
    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("fp-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(outputHtml.length > 0, "Output should contain hash results");
    assert.ok(outputHtml.includes("SHA-256"), "Should contain SHA-256 hash");
    assert.ok(outputHtml.includes("testimg.png"), "Should show file name");

    // Verify result is stored
    const hasResult = await page.evaluate(() => {
      const getFn = typeof getResult === "function" ? getResult : window.getResult;
      return getFn ? !!getFn("fpResult") : false;
    });
    assert.ok(hasResult, "fpResult should be set in result store");

    await ctx.close();
  });

  it("should show download button after fingerprinting", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "fingerprint");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#fp-file", [{ name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("fp-btn").click());

    await page.waitForSelector("#fp-result", { state: "visible", timeout: 30000 });
    await page.waitForTimeout(1000);

    const dlHtml = await page.evaluate(() => {
      const el = document.getElementById("fp-download");
      return el ? el.innerHTML : "";
    });
    assert.ok(dlHtml.includes("Download") || dlHtml.includes("تحميل"), "Download button should appear");

    // Click download to verify modal appears
    await page.evaluate(() => {
      const btn = document.querySelector("#fp-download .btn");
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    const modalVisible = await page.evaluate(() => {
      const modal = document.getElementById("dl-modal");
      return modal ? modal.classList.contains("open") : false;
    });
    assert.ok(modalVisible, "Download modal should be visible after clicking download");

    await ctx.close();
  });

  it("should fingerprint without fatal console errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "fingerprint");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#fp-file", [{ name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("fp-btn").click());
    await page.waitForSelector("#fp-result", { state: "visible", timeout: 30000 });
    await page.waitForTimeout(1000);

    const fatal = errors.filter((e) => !e.includes("frame-ancestors") && !e.includes("404"));
    assert.equal(fatal.length, 0, `Fatal errors: ${fatal.join(", ")}`);
    await ctx.close();
  });
});

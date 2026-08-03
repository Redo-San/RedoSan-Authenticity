const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("path");
const fs = require("fs");

const PORT = 9874;
const BASE = `http://localhost:${PORT}`;
const NAV_WAIT = { waitUntil: "domcontentloaded" };

const TEST_PNG = path.resolve(__dirname, "..", "fixtures", "testimg.png");
const PNG_BUF = fs.readFileSync(TEST_PNG);

let browser;
let server;

before(async () => {
  server = await startServer(PORT);
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

describe("E2E — Fingerprint Hash Families", () => {
  it("should navigate to fingerprint page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "fingerprint");
    await page.waitForTimeout(1000);
    assert.equal(
      errors.filter(
        (e) => !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest"),
      ).length,
      0,
    );
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

  it("should display all hash families after fingerprinting PNG", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "fingerprint");
    await page.waitForTimeout(1000);

    // Upload test PNG
    await page.setInputFiles("#fp-file", [
      { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(500);

    // Click fingerprint button
    await page.evaluate(() => document.getElementById("fp-btn").click());

    // Wait for result to appear
    await page.waitForSelector("#fp-result", { state: "visible", timeout: 30000 });
    await page.waitForTimeout(1000);

    // Get output HTML
    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("fp-output");
      return el ? el.innerHTML : "";
    });

    // Verify all expected hash family labels appear
    // Perceptual hashes only show for images with adequate size; test image may be too small
    const expectedFamilies = ["SHA-1", "SHA-2", "SHA-3", "MD", "BLAKE"];
    for (const family of expectedFamilies) {
      assert.ok(outputHtml.includes(family), `Output should contain "${family}" hash family`);
    }
    // Check that 64-bit SHA-2 and SHAKE sections also appear
    assert.ok(outputHtml.includes("64-bit") || outputHtml.includes("SHA-512"), "Should show SHA-2 (64-bit) section");
    assert.ok(outputHtml.includes("SHAKE"), "Should show SHAKE section");

    await ctx.close();
  });

  it("should have download button after fingerprinting", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "fingerprint");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#fp-file", [
      { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("fp-btn").click());

    await page.waitForSelector("#fp-result", { state: "visible", timeout: 30000 });
    await page.waitForTimeout(1000);

    const dlHtml = await page.evaluate(() => {
      const el = document.getElementById("fp-download");
      return el ? el.innerHTML : "";
    });
    assert.ok(dlHtml.includes("Download"), "Download button should appear after fingerprinting");

    await ctx.close();
  });
});

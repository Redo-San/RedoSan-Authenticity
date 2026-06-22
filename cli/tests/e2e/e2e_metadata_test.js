const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("path");
const fs = require("fs");

const PORT = 9898;
const BASE = `http://localhost:${PORT}`;
const PNG_BUF = fs.readFileSync(path.resolve(__dirname, "..", "fixtures", "testimg.png"));

let browser, server;

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

describe("E2E — Metadata Reader", () => {
  it("should navigate to metadata page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "metadata");
    await page.waitForTimeout(1000);
    assert.equal(errors.filter((e) => !e.includes("404") && !e.includes("Failed to load")).length, 0);
    await ctx.close();
  });

  it("should have file input and read metadata button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "metadata");
    await page.waitForTimeout(1000);
    const hasFile = await page.evaluate(() => !!document.getElementById("md-file"));
    const hasBtn = await page.evaluate(() => !!document.getElementById("md-btn"));
    assert.ok(hasFile, "File input exists");
    assert.ok(hasBtn, "Read Metadata button exists");
    await ctx.close();
  });

  it("should read metadata from a PNG and show file info", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await navTo(page, "metadata");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#md-file", [{ name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("md-btn").click());
    await page.waitForSelector("#md-result", { state: "visible", timeout: 45000 });
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("md-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(outputHtml.includes("testimg.png"), "Should show filename");
    assert.ok(outputHtml.includes("SHA-256"), "Should show hash: " + outputHtml.substring(0, 200));

    const dlHtml = await page.evaluate(() => {
      const dl = document.getElementById("md-download");
      return dl ? dl.innerHTML : "md-download NOT FOUND";
    });
    assert.ok(dlHtml.includes('class="btn"') || dlHtml.includes('class="btn '), "Download JSON button should appear, got innerHTML: " + dlHtml);
    await ctx.close();
  });
});

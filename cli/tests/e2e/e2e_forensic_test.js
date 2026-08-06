const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("path");
const fs = require("fs");

const PORT = 9903;
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

describe("E2E — Forensic Analyzer", () => {
  it("should navigate to forensic page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "forensic");
    await page.waitForTimeout(1000);
    assert.equal(errors.filter((e) => !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest")).length, 0);
    await ctx.close();
  });

  it("should have file input and analyze button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "forensic");
    await page.waitForTimeout(1000);
    const hasFile = await page.evaluate(() => !!document.getElementById("forensic-file"));
    const hasBtn = await page.evaluate(() => !!document.getElementById("forensic-btn"));
    assert.ok(hasFile, "File input exists");
    assert.ok(hasBtn, "Analyze button exists");
    await ctx.close();
  });

  it("should analyze a PNG and show forensic results", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "forensic");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#forensic-file", [{ name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("forensic-btn").click());
    await page.waitForSelector("#forensic-result", { state: "visible", timeout: 30000 });
    await page.waitForTimeout(1000);

    const outputText = await page.evaluate(() => {
      const el = document.getElementById("forensic-output");
      return el ? el.textContent : "";
    });
    assert.ok(outputText.length > 0, "Forensic output should have content");
    assert.ok(!outputText.includes("Please select"), "Output should not show file select prompt");
    await ctx.close();
  });

  it("should show ELA (Error Level Analysis) results", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "forensic");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#forensic-file", [{ name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("forensic-btn").click());
    await page.waitForSelector("#forensic-result", { state: "visible", timeout: 30000 });
    await page.waitForTimeout(1500);

    const hasELAMap = await page.evaluate(() => {
      return document.getElementById("forensic-ela-map") !== null;
    });
    assert.ok(hasELAMap, "ELA map element should exist");
    const outputText = await page.evaluate(() => {
      const el = document.getElementById("forensic-output");
      return el ? el.textContent : "";
    });
    assert.ok(
      outputText.includes("ELA") || outputText.includes("Error Level"),
      "Output should mention ELA. Got: " + outputText.substring(0, 200),
    );
    await ctx.close();
  });

  it("should show noise analysis results", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "forensic");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#forensic-file", [{ name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("forensic-btn").click());
    await page.waitForSelector("#forensic-result", { state: "visible", timeout: 30000 });
    await page.waitForTimeout(1500);

    const hasNoiseMap = await page.evaluate(() => {
      return document.getElementById("forensic-noise-map") !== null;
    });
    assert.ok(hasNoiseMap, "Noise map element should exist");
    const outputText2 = await page.evaluate(() => {
      const el = document.getElementById("forensic-output");
      return el ? el.textContent : "";
    });
    assert.ok(
      outputText2.includes("Noise") || outputText2.includes("noise"),
      "Output should mention noise. Got: " + outputText2.substring(0, 200),
    );
    await ctx.close();
  });
});

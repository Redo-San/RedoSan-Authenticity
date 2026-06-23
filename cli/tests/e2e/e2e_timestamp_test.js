const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("path");
const fs = require("fs");

const PORT = 9899;
const BASE = `http://localhost:${PORT}`;
const TXT_BUF = Buffer.from("Hello E2E Test for Timestamp");

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

describe("E2E — Timestamp", () => {
  it("should navigate to timestamp page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "timestamp");
    await page.waitForTimeout(1000);
    assert.equal(errors.filter((e) => !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest")).length, 0);
    await ctx.close();
  });

  it("should have file input and create .ots button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "timestamp");
    await page.waitForTimeout(1000);
    const hasFile = await page.evaluate(() => !!document.getElementById("ts-create-file"));
    const hasBtn = await page.evaluate(() => !!document.getElementById("ts-create-btn"));
    assert.ok(hasFile, "File input exists");
    assert.ok(hasBtn, "Create .ots button exists");
    await ctx.close();
  });

  it("should create an .ots timestamp and show result", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "timestamp");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#ts-create-file", [{ name: "test.txt", mimeType: "text/plain", buffer: TXT_BUF }]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("ts-create-btn").click());
    await page.waitForSelector("#ts-result", { state: "visible", timeout: 30000 });
    await page.waitForTimeout(1000);

    const outputText = await page.evaluate(() => {
      const el = document.getElementById("ts-output");
      return el ? el.textContent : "";
    });
    assert.ok(outputText.length > 0, "Result should have text");
    assert.ok(outputText.includes("SHA-256"), "Should show SHA-256 hash. Got: " + outputText.substring(0, 100));

    const hasDlLink = await page.evaluate(() => {
      const dl = document.getElementById("ts-download");
      return dl && dl.querySelector("a") !== null;
    });
    assert.ok(hasDlLink, "Download link should appear");
    await ctx.close();
  });

  it("should have verify tab with file and .ots proof inputs", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "timestamp");
    await page.waitForTimeout(1000);

    await page.evaluate(() => switchOtsTab("verify"));
    await page.waitForTimeout(300);

    const hasFile = await page.evaluate(() => !!document.getElementById("ts-verify-file"));
    const hasOts = await page.evaluate(() => !!document.getElementById("ts-ots-proof"));
    const hasBtn = await page.evaluate(() => !!document.getElementById("ts-verify-btn"));
    assert.ok(hasFile, "Verify file input exists");
    assert.ok(hasOts, "OTS proof input exists");
    assert.ok(hasBtn, "Verify button exists");
    await ctx.close();
  });
});

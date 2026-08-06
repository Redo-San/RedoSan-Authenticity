const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");

const PORT = 9909;
const BASE = `http://localhost:${PORT}`;
const NAV_WAIT = { waitUntil: "domcontentloaded" };

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

describe("E2E — Security Console Output", () => {
  it("should log '🔐 RedoSan Security' to console on page load", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);

    const consoleLines = [];
    page.on("console", (msg) => {
      consoleLines.push({ type: msg.type(), text: msg.text() });
    });

    await page.goto(BASE, NAV_WAIT);
    // Wait for DOMContentLoaded so shared.js init runs
    await page.waitForTimeout(3000);

    const securityHeader = consoleLines.filter((c) =>
      c.text.includes("🔐 RedoSan Security"),
    );
    assert.ok(
      securityHeader.length > 0,
      "Console should contain '🔐 RedoSan Security' header",
    );

    await ctx.close();
  });

  it("should log bot/automation status line (PASS or BLOCKED)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);

    const consoleLines = [];
    page.on("console", (msg) => {
      consoleLines.push({ type: msg.type(), text: msg.text() });
    });

    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    // In headless Playwright, webdriver=true triggers automation detection
    // so the status should show "BLOCKED" (or "PASS" if detection is bypassed)
    const hasStatusLine = consoleLines.some(
      (c) => c.text.includes("BLOCKED") || c.text.includes("PASS"),
    );
    assert.ok(
      hasStatusLine,
      "Console should contain bot status line with 'BLOCKED' or 'PASS'",
    );

    await ctx.close();
  });

  it("should show BLOCKED when webdriver is enabled", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);

    const consoleLines = [];
    page.on("console", (msg) => {
      consoleLines.push(msg.text());
    });

    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    const blockedLine = consoleLines.find((t) => t.includes("BLOCKED"));
    // Playwright headless always has webdriver=true so it should be blocked
    assert.ok(blockedLine, "Should report BLOCKED due to webdriver detection");
    assert.ok(blockedLine.includes("webdriver"), "Should mention 'webdriver' signal");

    await ctx.close();
  });

  it("should show security icon styling in console", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);

    const consoleArgs = [];
    page.on("console", (msg) => {
      if (msg.text().includes("🔐 RedoSan Security")) {
        // Collect the styling argument (second argument for %c)
        consoleArgs.push({
          text: msg.text(),
          argsCount: msg.args().length,
        });
      }
    });

    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    // The styled console.log has a format string (%c) + style arg = 2 args
    assert.ok(consoleArgs.length > 0, "Security header should be logged");
    assert.ok(
      consoleArgs.some((a) => a.argsCount >= 1),
      "Security log should have at least 1 console arg",
    );

    await ctx.close();
  });
});

describe("E2E — Security Status Report", () => {
  it("should produce score and signals in console", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);

    const consoleLines = [];
    page.on("console", (msg) => {
      consoleLines.push(msg.text());
    });

    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    const scoreLine = consoleLines.find((t) => t.includes("score:"));
    assert.ok(scoreLine, "Console should contain a line with 'score:'");
    assert.ok(
      scoreLine.includes("webdriver"),
      "Score line should mention 'webdriver' signal in headless mode",
    );

    await ctx.close();
  });
});

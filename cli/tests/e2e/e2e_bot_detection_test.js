const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");

const PORT = 9910;
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

describe("E2E — checkAutomation() detection", () => {
  it("should detect webdriver=true in headless Playwright", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
      return checkAutomation();
    });

    assert.ok(typeof result.score === "number", "Score should be a number");
    assert.ok(Array.isArray(result.signals), "Signals should be an array");
    assert.ok(
      result.signals.includes("webdriver"),
      "Should detect 'webdriver' signal in headless mode",
    );
    assert.ok(result.score >= 35, "Score should be >= 35 with webdriver signal");
    assert.ok(result.isAutomated === true, "isAutomated should be true when webdriver is detected");

    await ctx.close();
  });

  it("should detect no_plugins in headless browser", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
      return checkAutomation();
    });

    assert.ok(
      result.signals.includes("no_plugins"),
      "Should detect 'no_plugins' signal in headless mode",
    );

    await ctx.close();
  });

  it("should detect few_languages signal in headless mode", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
      return checkAutomation();
    });

    assert.ok(
      result.signals.includes("few_languages") || result.signals.includes("webdriver"),
      "Should detect either few_languages or webdriver (or both) in headless mode",
    );

    await ctx.close();
  });
});

describe("E2E — showBotOverlay() behavior", () => {
  it("should show the bot overlay when called", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    // The overlay should be active since checkAutomation returns isAutomated=true
    const overlayActive = await page.evaluate(() => {
      const overlay = document.getElementById("botBlockOverlay");
      if (!overlay) return "missing";
      return overlay.classList.contains("active") ? "active" : "inactive";
    });

    // In headless Playwright, the overlay should be shown automatically
    // due to webdriver detection on DOMContentLoaded
    assert.equal(overlayActive, "active", "Bot overlay should have 'active' class");

    await ctx.close();
  });

  it("should display 'Access Denied' title in overlay", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    const titleText = await page.evaluate(() => {
      const overlay = document.getElementById("botBlockOverlay");
      if (!overlay) return null;
      const title = overlay.querySelector(".bot-block-title");
      return title ? title.textContent : null;
    });

    assert.ok(titleText, "Overlay should have a title element");
    assert.ok(
      titleText.includes("Access Denied") || titleText.includes("رفض"),
      "Title should indicate access denied",
    );

    await ctx.close();
  });

  it("should show shield icon in overlay", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    const iconText = await page.evaluate(() => {
      const overlay = document.getElementById("botBlockOverlay");
      if (!overlay) return null;
      const icon = overlay.querySelector(".bot-block-icon");
      return icon ? icon.textContent : null;
    });

    assert.ok(iconText, "Overlay should have an icon element");
    assert.ok(
      iconText.includes("🛡️"),
      "Icon should display the shield emoji",
    );

    await ctx.close();
  });

  it("should have report link in overlay", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    const hasLink = await page.evaluate(() => {
      const overlay = document.getElementById("botBlockOverlay");
      if (!overlay) return false;
      const link = overlay.querySelector(".bot-block-link");
      return link && link.href ? true : false;
    });

    assert.ok(hasLink, "Overlay should have a report link");

    await ctx.close();
  });
});

describe("E2E — Bot detection console messages", () => {
  it("should log security status to console on DOMContentLoaded", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);

    const consoleLines = [];
    page.on("console", (msg) => {
      consoleLines.push(msg.text());
    });

    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    // logSecurityStatus() runs on DOMContentLoaded
    const securityLine = consoleLines.find((t) => t.includes("🔐"));
    const statusLine = consoleLines.find(
      (t) => t.includes("BLOCKED") || t.includes("PASS"),
    );

    assert.ok(securityLine, "Security icon should appear in console");
    assert.ok(statusLine, "Security status (BLOCKED/PASS) should appear in console");

    await ctx.close();
  });

  it("should show accumulated score in console status", async () => {
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
    assert.ok(scoreLine, "Status line should contain score");

    // Extract score number
    const scoreMatch = scoreLine.match(/score:(\d+)/);
    assert.ok(scoreMatch, "Score should be numeric");
    const score = parseInt(scoreMatch[1], 10);
    assert.ok(score >= 0 && score <= 100, "Score should be between 0 and 100");

    await ctx.close();
  });
});

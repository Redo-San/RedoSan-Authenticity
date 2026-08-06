const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");

const PORT = 9882;
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

describe("E2E — WebRTC / VPN Detection", () => {
  it("should set REDOSAN_BOT_CHECK after page load", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    // Wait for DOMContentLoaded handlers (checkAutomation, startAsyncVPNDetection)
    await page.waitForTimeout(3000);

    const botCheck = await page.evaluate(() => {
      const b = typeof REDOSAN_BOT_CHECK !== "undefined" ? REDOSAN_BOT_CHECK : null;
      return b ? { score: b.score, isAutomated: b.isAutomated, signalCount: b.signals ? b.signals.length : 0 } : null;
    });

    assert.ok(botCheck !== null, "REDOSAN_BOT_CHECK should be a non-null object");
    assert.equal(typeof botCheck.score, "number", "score should be a number");
    assert.ok(botCheck.score >= 0 && botCheck.score <= 100, "score should be 0-100");
    assert.ok(botCheck.signalCount >= 0, "should have zero or more signals");

    await ctx.close();
  });

  it("should detect headless Chromium as automated (score >= 40)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    const automated = await page.evaluate(() => {
      return REDOSAN_BOT_CHECK ? REDOSAN_BOT_CHECK.isAutomated : null;
    });

    // In headless Chromium, navigator.webdriver is true → score >= 40
    assert.equal(automated, true, "Headless Chromium should be detected as automated");
    await ctx.close();
  });

  it("should include 'webdriver' signal for headless Chromium", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    const hasWebdriver = await page.evaluate(() => {
      return REDOSAN_BOT_CHECK && REDOSAN_BOT_CHECK.signals
        ? REDOSAN_BOT_CHECK.signals.includes("webdriver")
        : false;
    });

    assert.ok(hasWebdriver, "headless Chromium should trigger 'webdriver' signal");
    await ctx.close();
  });

  it("should show bot overlay in headless mode", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    const overlayVisible = await page.evaluate(() => {
      const overlay = document.getElementById("botBlockOverlay");
      if (!overlay) return false;
      return overlay.classList.contains("active");
    });

    assert.ok(overlayVisible, "botBlockOverlay should have 'active' class in headless mode");
    await ctx.close();
  });

  it("should have Access Denied message in the bot overlay", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    const overlayText = await page.evaluate(() => {
      const title = document.querySelector(".bot-block-title");
      const text = document.querySelector(".bot-block-text");
      return {
        title: title ? title.textContent : "",
        text: text ? text.textContent : "",
      };
    });

    assert.ok(
      overlayText.title.includes("Access Denied") || overlayText.title.includes("رفض"),
      "Overlay title should indicate access denial"
    );
    assert.ok(
      overlayText.text.includes("headless") || overlayText.text.includes("automation") || overlayText.text.includes("أتمتة"),
      "Overlay text should mention headless/automation"
    );
    await ctx.close();
  });

  it("should call startAsyncVPNDetection (may be skipped in headless)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    // In headless mode, startAsyncVPNDetection returns early due to isAutomated.
    // In non-headless mode, it would attempt WebRTC. We verify the function exists
    // and check the REDOSAN_BOT_CHECK state after the detection attempt.
    const fnExists = await page.evaluate(() => typeof startAsyncVPNDetection === "function");
    assert.ok(fnExists, "startAsyncVPNDetection function should exist");

    const detectWebRTCExists = await page.evaluate(() => typeof detectWebRTCIPs === "function");
    assert.ok(detectWebRTCExists, "detectWebRTCIPs function should exist");

    // REDOSAN_BOT_CHECK was set by checkAutomation(), and if automated,
    // startAsyncVPNDetection skipped. The check variable must still reflect
    // the initial automation detection.
    const score = await page.evaluate(() => REDOSAN_BOT_CHECK ? REDOSAN_BOT_CHECK.score : -1);
    assert.ok(score >= 40, "Automation score should be >= 40 in headless mode");
    await ctx.close();
  });

  it("should not block non-automated access (backstop signal bypass)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    // Simulate the backstop bypass flag
    await page.goto(BASE + "?backstop=1", NAV_WAIT);
    await page.waitForTimeout(3000);

    const botCheck = await page.evaluate(() => {
      return REDOSAN_BOT_CHECK
        ? { isAutomated: REDOSAN_BOT_CHECK.isAutomated, signals: REDOSAN_BOT_CHECK.signals }
        : null;
    });

    assert.ok(botCheck !== null, "REDOSAN_BOT_CHECK should be set");
    assert.ok(botCheck.signals.includes("backstop"), "Should contain backstop signal");
    assert.equal(botCheck.isAutomated, false, "Backstop bypass should result in isAutomated=false");

    const overlayActive = await page.evaluate(() => {
      const o = document.getElementById("botBlockOverlay");
      return o ? o.classList.contains("active") : false;
    });
    assert.equal(overlayActive, false, "Bot overlay should NOT be active for backstop bypass");

    await ctx.close();
  });

  it("should not produce fatal console errors during detection", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(3000);

    const fatal = errors.filter(
      (e) =>
        !e.includes("frame-ancestors") &&
        !e.includes("404") &&
        !e.includes("Failed to load") &&
        !e.includes("valid digest")
    );
    assert.equal(fatal.length, 0, `Fatal errors during detection: ${fatal.join(", ")}`);
    await ctx.close();
  });
});

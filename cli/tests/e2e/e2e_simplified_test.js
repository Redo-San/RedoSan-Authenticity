const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const { startCoverage, stopCoverage } = require("./e2e_coverage");
const path = require("path");
const fs = require("fs");

const PORT = 9906;
const BASE = `http://localhost:${PORT}`;
const PNG_BUF = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "testimg.png"),
);
const WAV_BUF = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "silence.wav"),
);

let browser, server;

before(async () => {
  server = await startServer(PORT);
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  if (browser) await browser.close();
  stopServer();
});

describe("E2E — Simplified Mode (Wizard)", () => {
  it("should show mode selection overlay on load and activate simplified mode", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const modeVisible = await page.evaluate(() => {
      const el = document.getElementById("modeSelect");
      return el && el.style.display !== "none";
    });
    assert.ok(modeVisible, "Mode selection overlay should be visible");

    await page.evaluate(() => {
      const card = document.querySelector(".mode-card-simple");
      if (card) card.click();
    });
    await page.waitForTimeout(1000);

    const simplifiedVisible = await page.evaluate(() => {
      const el = document.getElementById("simplifiedMode");
      if (!el) return false;
      return window.getComputedStyle(el).display !== "none";
    });
    assert.ok(simplifiedVisible, "Simplified mode container should be visible");

    const modeHidden = await page.evaluate(() => {
      const el = document.getElementById("modeSelect");
      return el && el.style.display === "none";
    });
    assert.ok(modeHidden, "Mode selection overlay should be hidden");

    const fatal = errors.filter(
      (e) =>
        !e.includes("404") &&
        !e.includes("Failed to load") &&
        !e.includes("valid digest"),
    );
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));
    await stopCoverage(page, "simple-activate");
    await ctx.close();
  });

  it("should upload an image and show file info in simplified step 1", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const card = document.querySelector(".mode-card-simple");
      if (card) card.click();
    });
    await page.waitForTimeout(1000);

    await page.setInputFiles("#simpleFileInput", [
      { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(2000);

    const hasFileInfo = await page.evaluate(() => {
      const info = document.getElementById("simpleFileInfo");
      return info && info.textContent.includes("testimg.png");
    });
    assert.ok(hasFileInfo, "File info should show uploaded filename");

    const hasName = await page.evaluate(
      () => !!document.getElementById("sinfo-name"),
    );
    const hasEmail = await page.evaluate(
      () => !!document.getElementById("sinfo-email"),
    );
    assert.ok(hasName, "Name field should exist");
    assert.ok(hasEmail, "Email field should exist");
    await stopCoverage(page, "simple-upload");
    await ctx.close();
  });

  it("should fill owner info and advance to AI question step", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const card = document.querySelector(".mode-card-simple");
      if (card) card.click();
    });
    await page.waitForTimeout(1000);

    await page.setInputFiles("#simpleFileInput", [
      { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(1000);

    await page.fill("#sinfo-name", "E2E Tester");
    await page.fill("#sinfo-email", "test@example.com");
    await page.evaluate(() => {
      const sel = document.getElementById("sinfo-phonecode");
      if (sel) sel.value = "+1";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.fill("#sinfo-phone", "5551234567");
    await page.fill("#sinfo-website", "https://example.com");

    const nextBtn = await page.evaluate(() => {
      const btn = document.getElementById("simpleNextBtn");
      return btn && btn.style.display !== "none" && !btn.disabled;
    });
    assert.ok(nextBtn, "Next button should be visible and enabled");

    await page.evaluate(() => {
      document.getElementById("simpleNextBtn").click();
    });
    await page.waitForTimeout(1000);

    const hasAiStep = await page.evaluate(() => {
      const aiCards = document.querySelectorAll(".simple-ai-card");
      return aiCards.length >= 2;
    });
    assert.ok(
      hasAiStep,
      "Should advance to AI question step (2+ .simple-ai-card)",
    );
    await stopCoverage(page, "simple-advance");
    await ctx.close();
  });

  it("should process image through simplified wizard steps", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const card = document.querySelector(".mode-card-simple");
      if (card) card.click();
    });
    await page.waitForTimeout(1000);

    await page.setInputFiles("#simpleFileInput", [
      { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(1000);

    await page.fill("#sinfo-name", "E2E Tester");
    await page.fill("#sinfo-email", "test@example.com");
    await page.evaluate(() => {
      const sel = document.getElementById("sinfo-phonecode");
      if (sel) sel.value = "+1";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.fill("#sinfo-phone", "5551234567");
    await page.fill("#sinfo-website", "https://example.com");

    await page.evaluate(() => document.getElementById("simpleNextBtn").click());
    await page.waitForTimeout(1000);

    const step1Text = await page.evaluate(() => {
      const body = document.getElementById("simpleBody");
      return body ? body.textContent : "";
    });
    assert.ok(step1Text.length > 0, "Should see step 2 content");

    await page.evaluate(() => {
      const btn = document.getElementById("simpleNextBtn");
      if (btn && btn.style.display !== "none") btn.click();
    });
    await page.waitForTimeout(500);
    await stopCoverage(page, "simple-image-flow");
    await ctx.close();
  });

  it("should handle audio file upload in simplified mode", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const card = document.querySelector(".mode-card-simple");
      if (card) card.click();
    });
    await page.waitForTimeout(1000);

    await page.setInputFiles("#simpleFileInput", [
      { name: "silence.wav", mimeType: "audio/wav", buffer: WAV_BUF },
    ]);
    await page.waitForTimeout(1000);

    await page.fill("#sinfo-name", "Audio Tester");
    await page.fill("#sinfo-email", "audio@test.com");
    await page.evaluate(() => {
      const sel = document.getElementById("sinfo-phonecode");
      if (sel) sel.value = "+1";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.fill("#sinfo-phone", "5551234567");
    await page.fill("#sinfo-website", "https://example.com");

    await page.evaluate(() => document.getElementById("simpleNextBtn").click());
    await page.waitForTimeout(1000);

    const stepContent = await page.evaluate(() => {
      const body = document.getElementById("simpleBody");
      return body ? body.textContent : "";
    });
    assert.ok(stepContent.length > 0, "Should see next step content for audio");
    await stopCoverage(page, "simple-audio");
    await ctx.close();
  });

  it("should complete pixel injection and timestamp steps in the SPA", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // The SPA shell has no professional pixel-injection/timestamp markup, so
    // these steps must run against their engines directly.
    await page.evaluate(() => {
      if (typeof setMode === "function") setMode("simplified");
    });
    await page.waitForTimeout(800);

    const steps = await page.evaluate((b64) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      window.simpleFile = new File([bytes], "testimg.png", {
        type: "image/png",
      });
      window.simpleType = "image";
      window.simpleIsAI = false;
      window.simpleResults = window.simpleResults || {};
      window.simpleResults.didSig = { did: "did:key:zE2E", signature: "00" };
      window.simpleSteps = window.buildSteps("image", false);
      return window.simpleSteps.map((s, i) => ({ i, id: s.id }));
    }, PNG_BUF.toString("base64"));

    const stepIndex = (id) => steps.find((s) => s.id === id).i;

    await page.evaluate((i) => {
      window.simpleStep = i;
      window.simpleStepDone = false;
      window.renderStep();
    }, stepIndex("pixel-injection"));
    await page.waitForTimeout(400);
    // Headless runs show the bot-block overlay, which intercepts pointer
    // events; dispatch the click directly to exercise the same handler.
    await page.evaluate(() => document.getElementById("spi-btn").click());
    await page.waitForFunction(() => window.simpleStepDone === true, null, {
      timeout: 60000,
    });

    const pixel = await page.evaluate(() => {
      const next = document.getElementById("simpleNextBtn");
      return {
        blob: (window.simpleResults.piFinalUrl || "").startsWith("blob:"),
        next: !!next && next.style.display !== "none" && !next.disabled,
        status: (document.getElementById("spi-status") || {}).textContent || "",
      };
    });
    assert.ok(pixel.blob, "Pixel injection should produce an image blob");
    assert.ok(pixel.next, "Next should be enabled after pixel injection");
    assert.ok(
      pixel.status.length > 0,
      "Pixel injection should report a result",
    );

    await page.evaluate((i) => {
      window.simpleStep = i;
      window.simpleStepDone = false;
      window.renderStep();
    }, stepIndex("timestamp"));
    await page.waitForFunction(
      () => !!(window.simpleResults && window.simpleResults.timestamp),
      null,
      { timeout: 60000 },
    );

    const timestamp = await page.evaluate(() => {
      const next = document.getElementById("simpleNextBtn");
      return {
        result: (window.simpleResults.tsResult || "").length > 0,
        next: !!next && next.style.display !== "none" && !next.disabled,
        text: (document.getElementById("sts-result") || {}).textContent || "",
      };
    });
    assert.ok(timestamp.result, "Timestamp should produce a result");
    assert.ok(timestamp.next, "Next should be enabled after timestamp");
    assert.ok(
      timestamp.text.length > 0,
      "Timestamp should report a result in the step",
    );

    const fatal = errors.filter(
      (e) => !e.includes("404") && !e.includes("Failed to load"),
    );
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));
    await stopCoverage(page, "simple-pixel-timestamp");
    await ctx.close();
  });
});

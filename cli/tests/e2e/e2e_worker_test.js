const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("path");
const fs = require("fs");

const PORT = 9879;
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

describe("E2E — Web Worker Hash Fingerprinting", () => {
  it("should navigate to fingerprint page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "fingerprint");
    await page.waitForTimeout(1000);
    const fatal = errors.filter(
      (e) =>
        !e.includes("404") &&
        !e.includes("Failed to load") &&
        !e.includes("valid digest") &&
        !e.includes("frame-ancestors"),
    );
    assert.equal(fatal.length, 0, `Fatal errors: ${fatal.join(", ")}`);
    await ctx.close();
  });

  it("should show progress bar after uploading file and clicking fingerprint", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "fingerprint");
    await page.waitForTimeout(1000);

    // Upload the PNG
    await page.setInputFiles("#fp-file", [
      { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(500);

    // Set up a flag BEFORE clicking: intercept style changes on #fp-progress
    const progressWasShown = await page.evaluate(() => {
      return new Promise((resolve) => {
        const el = document.getElementById("fp-progress");
        if (!el) { resolve(false); return; }
        let shown = false;
        // Use MutationObserver to detect style changes
        const observer = new MutationObserver(() => {
          if (el.style.display === "block" || el.style.display === "") {
            shown = true;
          }
        });
        observer.observe(el, { attributes: true, attributeFilter: ["style"] });
        // Also poll in case MutationObserver misses the transition
        const poll = setInterval(() => {
          if (el.style.display !== "none") {
            shown = true;
            clearInterval(poll);
          }
        }, 5);
        // After fingerprint click starts, wait then clean up
        setTimeout(() => {
          observer.disconnect();
          clearInterval(poll);
          resolve(shown);
        }, 3000);
        // Now trigger the fingerprint
        const btn = document.getElementById("fp-btn");
        if (btn) btn.click();
      });
    });

    assert.ok(progressWasShown, "Progress bar should have been visible during processing");

    // Wait for results to complete
    await page.waitForSelector("#fp-result", {
      state: "visible",
      timeout: 60000,
    });
    await page.waitForTimeout(1000);

    const fatal = errors.filter(
      (e) =>
        !e.includes("404") &&
        !e.includes("Failed to load") &&
        !e.includes("valid digest") &&
        !e.includes("frame-ancestors"),
    );
    assert.equal(fatal.length, 0, `Fatal errors during progress: ${fatal.join(", ")}`);
    await ctx.close();
  });

  it("should compute SHA-256 hash and show in results", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "fingerprint");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#fp-file", [
      { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const btn = document.getElementById("fp-btn");
      if (btn) btn.click();
    });

    // Wait for result to appear (long timeout for all hashes)
    await page.waitForSelector("#fp-result", {
      state: "visible",
      timeout: 60000,
    });
    await page.waitForTimeout(2000);

    // Check output contains SHA-256
    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("fp-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(outputHtml.length > 0, "Output should contain hash results");
    assert.ok(
      outputHtml.includes("SHA-256"),
      "Output should contain SHA-256 hash",
    );
    assert.ok(
      outputHtml.includes("testimg.png"),
      "Output should show file name",
    );

    const fatal = errors.filter(
      (e) =>
        !e.includes("404") &&
        !e.includes("Failed to load") &&
        !e.includes("valid digest") &&
        !e.includes("frame-ancestors"),
    );
    assert.equal(
      fatal.length,
      0,
      `Fatal errors during fingerprint: ${fatal.join(", ")}`,
    );
    await ctx.close();
  });

  it("should populate all hash families in result output", async () => {
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

    await page.evaluate(() => {
      const btn = document.getElementById("fp-btn");
      if (btn) btn.click();
    });

    await page.waitForSelector("#fp-result", {
      state: "visible",
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    // Check various hash families are present
    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("fp-output");
      return el ? el.innerHTML : "";
    });

    // Core hash families that should always be present
    const expectedFamilies = [
      "SHA-256",
      "SHA-384",
      "SHA-512",
      "SHA-1",
      "BLAKE3",
    ];
    for (const family of expectedFamilies) {
      assert.ok(
        outputHtml.includes(family),
        `Output should contain ${family}`,
      );
    }

    // Perceptual hashes should be present for PNG images
    const expectedPerceptual = ["ahash", "dhash", "phash"];
    for (const ph of expectedPerceptual) {
      assert.ok(outputHtml.includes(ph), `Output should contain ${ph} perceptual hash`);
    }

    await ctx.close();
  });

  it("should have fpResult stored after fingerprinting", async () => {
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

    await page.evaluate(() => {
      const btn = document.getElementById("fp-btn");
      if (btn) btn.click();
    });

    await page.waitForSelector("#fp-result", {
      state: "visible",
      timeout: 60000,
    });
    await page.waitForTimeout(2000);

    const hasResult = await page.evaluate(() => {
      const getFn = typeof getResult === "function" ? getResult : window.getResult;
      return getFn ? !!getFn("fpResult") : false;
    });
    assert.ok(hasResult, "fpResult should be stored in global result store");

    const resultHashes = await page.evaluate(() => {
      const getFn = typeof getResult === "function" ? getResult : window.getResult;
      const r = getFn ? getFn("fpResult") : null;
      if (!r) return null;
      return {
        hasSha256: !!r.hashes["SHA-256"],
        hasMd5: !!r.hashes["MD5"],
        hasBlake3: !!r.hashes["BLAKE3"],
        hasSha3512: !!r.hashes["SHA-3_512"],
        hasSha3224: !!r.hashes["SHA-3_224"],
        hasPerceptual: r.perceptual_hashes && Object.keys(r.perceptual_hashes).length > 0,
        fileName: r.file_info ? r.file_info.file_name : null,
      };
    });

    assert.ok(resultHashes, "Result object should be available");
    assert.ok(resultHashes.hasSha256, "Result should contain SHA-256");
    assert.ok(resultHashes.hasBlake3, "Result should contain BLAKE3");
    // SHA-3 hashes come from the Web Worker — verify they were computed
    assert.ok(resultHashes.hasSha3512, "Result should contain SHA-3_512 from worker");
    assert.ok(resultHashes.hasSha3224, "Result should contain SHA-3_224 from worker");
    // Perceptual hashes for PNG
    assert.ok(resultHashes.hasPerceptual, "Result should contain perceptual hashes for PNG");
    assert.equal(resultHashes.fileName, "testimg.png", "File name should match");

    await ctx.close();
  });

  it("should show progress label updates during worker processing", async () => {
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

    // Set up a flag BEFORE clicking: monitor #fp-progress-label text changes
    const labelWasUpdated = await page.evaluate(() => {
      return new Promise((resolve) => {
        const label = document.getElementById("fp-progress-label");
        if (!label) { resolve(false); return; }
        let updated = false;
        const origText = label.textContent;
        // MutationObserver to detect text changes
        const observer = new MutationObserver(() => {
          if (label.textContent !== origText && label.textContent.length > 0) {
            updated = true;
          }
        });
        observer.observe(label, {
          childList: true,
          characterData: true,
          subtree: true,
        });
        // Also poll to catch fast changes
        const poll = setInterval(() => {
          if (label.textContent !== origText && label.textContent.length > 0) {
            updated = true;
            clearInterval(poll);
          }
        }, 5);
        // After fingerprint click starts, wait then clean up
        setTimeout(() => {
          observer.disconnect();
          clearInterval(poll);
          resolve(updated);
        }, 5000);
        // Now trigger the fingerprint
        const btn = document.getElementById("fp-btn");
        if (btn) btn.click();
      });
    });

    assert.ok(labelWasUpdated, "Progress label should have been updated during processing");

    // Wait for complete results
    await page.waitForSelector("#fp-result", {
      state: "visible",
      timeout: 60000,
    });
    await page.waitForTimeout(1000);
    await ctx.close();
  });

  it("should show download button after successful fingerprint", async () => {
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

    await page.evaluate(() => {
      const btn = document.getElementById("fp-btn");
      if (btn) btn.click();
    });

    await page.waitForSelector("#fp-result", {
      state: "visible",
      timeout: 60000,
    });
    await page.waitForTimeout(2000);

    const dlHtml = await page.evaluate(() => {
      const el = document.getElementById("fp-download");
      return el ? el.innerHTML : "";
    });

    assert.ok(
      dlHtml.includes("Download") || dlHtml.includes("تحميل"),
      "Download button should appear after fingerprinting",
    );

    await ctx.close();
  });
});

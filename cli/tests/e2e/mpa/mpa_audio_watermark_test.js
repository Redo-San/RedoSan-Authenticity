var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var { chromium } = require("playwright");
var { ensureServer, openPage, checkPageLoad, checkNoErrors , closePage } = require("../mpa_helpers");
var path = require("path");
var fs = require("fs");

var PAGE_ID = "audio-watermark";
var browser;
var WAV_BUF = fs.readFileSync(path.resolve(__dirname, "../../fixtures/silence.wav"));

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("MPA — Audio Watermark", function () {
  it("should load page with correct title and metadata", async function () {
    var { ctx, page, errors } = await openPage(browser, PAGE_ID);
    try {
      await checkPageLoad(page, PAGE_ID);
      checkNoErrors(errors, PAGE_ID);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should have key form elements", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var hasAudio = await page.evaluate(function () { return !!document.getElementById("awm-audio"); });
      var hasType = await page.evaluate(function () { return !!document.getElementById("awm-type"); });
      var hasBtn = await page.evaluate(function () { return !!document.getElementById("awm-btn"); });
      assert.ok(hasAudio, "Audio input should exist");
      assert.ok(hasType, "Algorithm select should exist");
      assert.ok(hasBtn, "Embed button should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should upload audio file and check embed button exists", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.setInputFiles("#awm-audio", [
        { name: "silence.wav", mimeType: "audio/wav", buffer: WAV_BUF }
      ]);
      await page.waitForTimeout(500);
      var hasBtn = await page.evaluate(function () { return !!document.getElementById("awm-btn"); });
      assert.ok(hasBtn, "Embed button should still exist after upload");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should not have critical console errors", async function () {
    var { ctx, page, errors } = await openPage(browser, PAGE_ID);
    try {
      checkNoErrors(errors, PAGE_ID);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should embed a watermark using LSB algorithm", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.setInputFiles("#awm-audio", [
        { name: "silence.wav", mimeType: "audio/wav", buffer: WAV_BUF }
      ]);
      await page.waitForTimeout(300);
      await page.setInputFiles("#awm-file", [
        { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("E2E TEST MESSAGE") }
      ]);
      await page.waitForTimeout(300);
      await page.fill("#awm-password", "testpassword123");
      await page.waitForTimeout(200);
      await page.evaluate(function () { document.getElementById("awm-btn").click(); });
      await page.waitForTimeout(8000);
      var resultDiv = await page.evaluate(function () {
        var el = document.getElementById("awm-result");
        return el ? el.style.display : null;
      });
      var progDone = await page.evaluate(function () {
        var prog = document.getElementById("awm-progress");
        return prog ? prog.style.display : null;
      });
      assert.ok(resultDiv === "block" || resultDiv === "" || progDone === "none",
        "Watermark embed should complete (result display: " + resultDiv + ", progress: " + progDone + ")");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should switch to extract tab and have extract and dual elements", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { switchAwmTab("extract"); });
      await page.waitForTimeout(500);
      var hasExtractBtn = await page.evaluate(function () { return !!document.getElementById("awm-btn-ex"); });
      var hasAudioEx = await page.evaluate(function () { return !!document.getElementById("awm-audio-ex"); });
      assert.ok(hasExtractBtn, "Extract button should exist after switching tab");
      assert.ok(hasAudioEx, "Extract audio input should exist");

      // Also check dual extract elements exist
      var hasFpAlgo = await page.evaluate(function () { return !!document.getElementById("awm-dual-fp-algo"); });
      var hasDidAlgo = await page.evaluate(function () { return !!document.getElementById("awm-dual-did-algo"); });
      assert.ok(hasFpAlgo, "Dual extract FP algo select should exist");
      assert.ok(hasDidAlgo, "Dual extract DID algo select should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should round-trip LSB: embed then extract recovers message", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      // Embed
      await page.setInputFiles("#awm-audio", [
        { name: "silence.wav", mimeType: "audio/wav", buffer: WAV_BUF }
      ]);
      await page.waitForTimeout(300);
      await page.setInputFiles("#awm-file", [
        { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("ROUNDTRIP TEST LSB") }
      ]);
      await page.waitForTimeout(300);
      await page.fill("#awm-password", "rt-password");
      await page.waitForTimeout(200);
      await page.evaluate(function () { document.getElementById("awm-btn").click(); });
      await page.waitForTimeout(8000);

      // Capture watermarked blob
      var wmInfo = await page.evaluate(async function () {
        var getFn = typeof getResult === "function" ? getResult : window.getResult;
        var r = getFn ? getFn("awmResult") : null;
        if (!r || !r.blob) return null;
        var resp = await fetch(URL.createObjectURL(r.blob));
        var blob = await resp.blob();
        return { buf: Array.from(new Uint8Array(await blob.arrayBuffer())) };
      });
      assert.ok(wmInfo, "Watermarked blob should be available");
      var wmBuf = Buffer.from(wmInfo.buf);

      // Switch to extract tab
      await page.evaluate(function () { switchAwmTab("extract"); });
      await page.waitForTimeout(500);

      // Set algorithm and password
      await page.evaluate(function () {
        var sel = document.getElementById("awm-type-ex");
        if (sel) sel.value = "1";
      });
      await page.fill("#awm-password-ex", "rt-password");
      await page.waitForTimeout(200);

      // Upload watermarked audio and extract
      await page.setInputFiles("#awm-audio-ex", [
        { name: "watermarked.wav", mimeType: "audio/wav", buffer: wmBuf }
      ]);
      await page.waitForTimeout(500);
      await page.evaluate(function () { document.getElementById("awm-btn-ex").click(); });
      await page.waitForTimeout(10000);

      var extractHtml = await page.evaluate(function () {
        var el = document.getElementById("awm-output");
        return el ? el.innerHTML : "";
      });
      assert.ok(extractHtml.includes("ROUNDTRIP TEST LSB"),
        "Extract should recover original message. Got: " + extractHtml.substring(0, 200));
    } finally {
      await closePage(ctx, page);
    }
  });
});

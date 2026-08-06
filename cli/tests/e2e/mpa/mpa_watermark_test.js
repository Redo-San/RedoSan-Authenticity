var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var { chromium } = require("playwright");
var { ensureServer, openPage, checkPageLoad, checkNoErrors , closePage } = require("../mpa_helpers");
var path = require("path");
var fs = require("fs");

var PAGE_ID = "watermark";
var browser;
var PNG_BUF = fs.readFileSync(path.resolve(__dirname, "../../fixtures/testimg.png"));
var PNG_64_BUF = fs.readFileSync(path.resolve(__dirname, "../../fixtures/testimg_64x64.png"));
var SECRET_BUF = fs.readFileSync(path.resolve(__dirname, "../../fixtures/secret.txt"));

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("MPA — Watermark", function () {
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
      var hasType = await page.evaluate(function () { return !!document.getElementById("wm-type"); });
      var hasImage = await page.evaluate(function () { return !!document.getElementById("wm-image"); });
      var hasBtn = await page.evaluate(function () { return !!document.getElementById("wm-btn"); });
      assert.ok(hasType, "Algorithm select should exist");
      assert.ok(hasImage, "Image input should exist");
      assert.ok(hasBtn, "Embed button should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should embed watermark with Zero-bit algorithm", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        var sel = document.getElementById("wm-type");
        if (sel) sel.value = "5";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForTimeout(300);
      await page.setInputFiles("#wm-image", [
        { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }
      ]);
      await page.waitForTimeout(300);
      await page.setInputFiles("#wm-secret", [
        { name: "secret.txt", mimeType: "text/plain", buffer: SECRET_BUF }
      ]);
      await page.waitForTimeout(300);
      await page.evaluate(function () {
        document.getElementById("wm-btn").click();
      });
      await page.waitForSelector("#wm-result", { state: "visible", timeout: 30000 });
      await page.waitForTimeout(1000);
      var outputHtml = await page.evaluate(function () {
        var el = document.getElementById("wm-output");
        return el ? el.innerHTML : "";
      });
      assert.ok(outputHtml.length > 0, "Output should contain embed result");
      var hasDownload = await page.evaluate(function () {
        var el = document.getElementById("wm-download");
        return el ? el.innerHTML.length > 20 : false;
      });
      assert.ok(hasDownload, "Download section should be populated");
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

  it("should show capacity after uploading image", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.setInputFiles("#wm-image", [
        { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }
      ]);
      await page.waitForTimeout(1000);
      var capText = await page.evaluate(function () {
        var el = document.getElementById("wm-capacity");
        return el ? el.textContent : "";
      });
      assert.ok(capText.length > 0, "Capacity text should be populated. Got: '" + capText + "'");
      assert.ok(capText.includes("Capacity") || capText.includes("capacity") || capText.includes("byte"),
        "Capacity text should mention bytes. Got: " + capText);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should switch to extract tab and have extract elements", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { switchWmTab("extract"); });
      await page.waitForTimeout(500);
      var hasImageEx = await page.evaluate(function () { return !!document.getElementById("wm-image-ex"); });
      var hasTypeEx = await page.evaluate(function () { return !!document.getElementById("wm-type-ex"); });
      var hasBtnEx = await page.evaluate(function () { return !!document.getElementById("wm-btn-ex"); });
      assert.ok(hasImageEx, "Extract image input should exist");
      assert.ok(hasTypeEx, "Extract algorithm selector should exist");
      assert.ok(hasBtnEx, "Extract button should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should round-trip LSB with password: embed then extract recovers secret", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      // Embed LSB (type 1, requires password)
      await page.evaluate(function () {
        var sel = document.getElementById("wm-type");
        if (sel) sel.value = "1";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForTimeout(300);

      // Check password group is visible
      var pwVisible = await page.evaluate(function () {
        var g = document.getElementById("wm-password-group");
        return g ? g.style.display !== "none" : false;
      });
      assert.ok(pwVisible, "Password group should be visible for type 1");

      await page.fill("#wm-password", "lsb-test-pw");
      await page.waitForTimeout(200);
      await page.setInputFiles("#wm-image", [
        { name: "cover.png", mimeType: "image/png", buffer: PNG_64_BUF }
      ]);
      await page.waitForTimeout(300);
      await page.setInputFiles("#wm-secret", [
        { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("LSB SECRET DATA") }
      ]);
      await page.waitForTimeout(300);
      await page.evaluate(function () { document.getElementById("wm-btn").click(); });
      await page.waitForSelector("#wm-result", { state: "visible", timeout: 30000 });
      await page.waitForTimeout(1000);

      var wmInfo = await page.evaluate(async function () {
        var getFn = typeof getResult === "function" ? getResult : window.getResult;
        var url = getFn ? getFn("wmLastBlobUrl") : null;
        if (!url) return null;
        var resp = await fetch(url);
        var blob = await resp.blob();
        return { buf: Array.from(new Uint8Array(await blob.arrayBuffer())), type: blob.type || "image/png" };
      });
      assert.ok(wmInfo, "Watermarked blob should be available");
      var wmBuf = Buffer.from(wmInfo.buf);

      // Switch to extract tab
      await page.evaluate(function () { switchWmTab("extract"); });
      await page.waitForTimeout(500);

      await page.evaluate(function () {
        var sel = document.getElementById("wm-type-ex");
        if (sel) sel.value = "1";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.fill("#wm-password-ex", "lsb-test-pw");
      await page.waitForTimeout(200);
      await page.setInputFiles("#wm-image-ex", [
        { name: "watermarked.png", mimeType: "image/png", buffer: wmBuf }
      ]);
      await page.waitForTimeout(500);
      await page.evaluate(function () { document.getElementById("wm-btn-ex").click(); });
      await page.waitForSelector("#wm-result", { state: "visible", timeout: 30000 });
      await page.waitForTimeout(1000);

      var extractHtml = await page.evaluate(function () {
        var el = document.getElementById("wm-output");
        return el ? el.innerHTML : "";
      });
      assert.ok(extractHtml.includes("LSB SECRET DATA"),
        "LSB extract should recover secret. Got: " + extractHtml.substring(0, 200));
    } finally {
      await closePage(ctx, page);
    }
  });
});

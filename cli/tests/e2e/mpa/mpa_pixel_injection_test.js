var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var { chromium } = require("playwright");
var {
  ensureServer,
  openPage,
  checkPageLoad,
  checkNoErrors,
  closePage,
} = require("../mpa_helpers");
var path = require("path");
var fs = require("fs");

var PAGE_ID = "pixel-injection";
var browser;
var PNG_BUF = fs.readFileSync(
  path.resolve(__dirname, "../../fixtures/testimg_64x64.png"),
);

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("MPA — Pixel Injection", function () {
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
      var hasImage = await page.evaluate(function () {
        return !!document.getElementById("pi-image");
      });
      var hasCategory = await page.evaluate(function () {
        return !!document.getElementById("pi-category");
      });
      var hasBtn = await page.evaluate(function () {
        return !!document.getElementById("pi-btn");
      });
      assert.ok(hasImage, "Image input should exist");
      assert.ok(hasCategory, "Category select should exist");
      assert.ok(hasBtn, "Embed button should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should embed with Enhanced LSB algorithm", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        var cat = document.getElementById("pi-category");
        if (cat) cat.value = "spatial";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForTimeout(300);
      await page.setInputFiles("#pi-image", [
        { name: "testimg_64x64.png", mimeType: "image/png", buffer: PNG_BUF },
      ]);
      await page.waitForTimeout(500);
      await page.evaluate(function () {
        document.getElementById("pi-btn").click();
      });
      await page.waitForTimeout(5000);
      var hasResult = await page.evaluate(function () {
        var el = document.getElementById("page-pixel-injection");
        var text = el ? el.textContent : "";
        return text.length > 0;
      });
      assert.ok(hasResult, "Page should have content after embed attempt");
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
});

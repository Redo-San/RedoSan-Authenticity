var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var { chromium } = require("playwright");
var { ensureServer, openPage, checkPageLoad, checkNoErrors, closePage } = require("../mpa_helpers");
var path = require("path");
var fs = require("fs");

var PAGE_ID = "iris-biometric";
var browser;
var PNG_BUF = fs.readFileSync(path.resolve(__dirname, "../../fixtures/testimg.png"));

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("MPA — Iris Biometric", function () {
  it("should load page with correct title and metadata", async function () {
    var { ctx, page, errors } = await openPage(browser, PAGE_ID);
    try {
      await checkPageLoad(page, PAGE_ID);
      checkNoErrors(errors, PAGE_ID);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should have key UI elements", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var hasFile = await page.evaluate(function () { return !!document.getElementById("iris-image"); });
      var hasBtn = await page.evaluate(function () { return !!document.getElementById("iris-run"); });
      assert.ok(hasFile, "File input should exist");
      assert.ok(hasBtn, "Iris run button should exist");
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

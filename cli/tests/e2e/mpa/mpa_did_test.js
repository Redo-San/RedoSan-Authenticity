var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var { chromium } = require("playwright");
var { ensureServer, openPage, checkPageLoad, checkNoErrors , closePage } = require("../mpa_helpers");

var PAGE_ID = "did";
var browser;

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("MPA — DID Identity", function () {
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
      var hasGenBtn = await page.evaluate(function () { return !!document.getElementById("did-gen-btn"); });
      var hasAlgo = await page.evaluate(function () { return !!document.getElementById("did-algo-select"); });
      assert.ok(hasGenBtn, "Generate button should exist");
      assert.ok(hasAlgo, "Algorithm select should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should generate a key and show DID document", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        var sel = document.getElementById("did-algo-select");
        if (sel) sel.value = "ed25519";
        if (typeof handleDidGenerate === "function") handleDidGenerate();
      });
      await page.waitForTimeout(5000);
      var hasResult = await page.evaluate(function () {
        var el = document.getElementById("did-did-value");
        return el && el.textContent.length > 0;
      });
      assert.ok(hasResult, "DID document should be generated");
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

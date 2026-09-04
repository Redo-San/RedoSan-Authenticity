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

var PAGE_ID = "certificate";
var browser;

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("MPA — Certificate", function () {
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
      var hasFile = await page.evaluate(function () {
        return !!document.getElementById("cert-file");
      });
      var hasName = await page.evaluate(function () {
        return !!document.getElementById("cert-name");
      });
      var hasEmail = await page.evaluate(function () {
        return !!document.getElementById("cert-email");
      });
      var hasGenBtn = await page.evaluate(function () {
        return !!document.getElementById("cert-gen-btn");
      });
      assert.ok(hasFile, "File input should exist");
      assert.ok(hasName, "Name input should exist");
      assert.ok(hasEmail, "Email input should exist");
      assert.ok(hasGenBtn, "Generate button should exist");
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

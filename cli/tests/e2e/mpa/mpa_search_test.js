const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { ensureServer, openPage, checkPageLoad, checkNoErrors , closePage } = require("../mpa_helpers");

const PAGE_ID = "search";
let browser;

before(async () => {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
});

describe("MPA — Search", function () {
  it("should load search page with correct title and metadata", async function () {
    var { ctx, page, errors } = await openPage(browser, PAGE_ID);
    try {
      await checkPageLoad(page, PAGE_ID);
      checkNoErrors(errors, PAGE_ID);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should have search input", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var input = await page.$("#searchInput");
      assert.ok(input, "Search input should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should accept search query and show results", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.fill("#searchInput", "watermark");
      await page.waitForTimeout(300);
      // Submit search
      await page.evaluate(function () { siteSearch(); });
      await page.waitForTimeout(2000);
      var hasOutput = await page.evaluate(function () {
        var el = document.getElementById("search-output");
        return el && el.innerHTML && el.innerHTML.length > 0;
      });
      assert.ok(hasOutput, "Search output should contain results");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should show no-results message for nonsense query", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.fill("#searchInput", "xyznonexistentquery");
      await page.waitForTimeout(300);
      await page.evaluate(function () { siteSearch(); });
      await page.waitForTimeout(2000);
      var noResultsMsg = await page.evaluate(function () {
        var el = document.getElementById("search-output");
        return el && el.innerHTML && el.innerHTML.indexOf("No results") !== -1;
      });
      assert.ok(noResultsMsg, "Should show no-results message for nonsense query");
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

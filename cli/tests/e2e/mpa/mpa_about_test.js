const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const {
  ensureServer,
  openPage,
  checkPageLoad,
  checkNoErrors,
  closePage,
} = require("../mpa_helpers");

const PAGE_ID = "about";
let browser;

before(async () => {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
});

describe("MPA — About", function () {
  it("should load about page with correct title and metadata", async function () {
    var { ctx, page, errors } = await openPage(browser, PAGE_ID);
    try {
      await checkPageLoad(page, PAGE_ID);
      checkNoErrors(errors, PAGE_ID);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should display about content", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var section = await page.$("#page-about");
      assert.ok(section, "About section should exist");
      var text = await page.evaluate(function (el) {
        return el.textContent;
      }, section);
      assert.ok(text.length > 100, "About should have substantial content");
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

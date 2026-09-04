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

const PAGE_ID = "social";
let browser;

before(async () => {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
});

describe("MPA — Social Impact", function () {
  it("should load social page with correct title and metadata", async function () {
    var { ctx, page, errors } = await openPage(browser, PAGE_ID);
    try {
      await checkPageLoad(page, PAGE_ID);
      checkNoErrors(errors, PAGE_ID);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should display social content and links", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var section = await page.$("#page-social");
      assert.ok(section, "Social section should exist");
      var links = await page.$$("#page-social a");
      assert.ok(links.length >= 3, "Social should have at least 3 links");
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

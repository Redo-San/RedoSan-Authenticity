const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { ensureServer, openPage, checkPageLoad, checkNoErrors , closePage } = require("../mpa_helpers");

const PAGE_ID = "contact";
let browser;

before(async () => {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
});

describe("MPA — Contact Us", function () {
  it("should load contact page with correct title and metadata", async function () {
    var { ctx, page, errors } = await openPage(browser, PAGE_ID);
    try {
      await checkPageLoad(page, PAGE_ID);
      checkNoErrors(errors, PAGE_ID);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should display contact information", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var section = await page.$("#page-contact");
      assert.ok(section, "Contact section should exist");
      var text = await page.evaluate(function (el) { return el.textContent; }, section);
      assert.ok(text.length > 50, "Contact should have content");
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

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { ensureServer, openPage, checkPageLoad, checkNoErrors , closePage } = require("../mpa_helpers");

const PAGE_ID = "home";
let browser;

before(async () => {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
});

describe("MPA — Home", function () {
  it("should load home page with correct title and metadata", async function () {
    var { ctx, page, errors } = await openPage(browser, PAGE_ID);
    try {
      await checkPageLoad(page, PAGE_ID);
      checkNoErrors(errors, PAGE_ID);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should display hero section", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var hero = await page.$("h1, .hero-title, .banner-title");
      assert.ok(hero, "Hero heading should exist");
      var text = await page.evaluate(function (el) { return el.textContent; }, hero);
      assert.ok(text.length > 0, "Hero should have text");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should have tool cards linking to tool pages", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var links = await page.$$("#page-home a[href], #page-home .card a");
      assert.ok(links.length >= 5, "Home should have at least 5 tool links, got " + links.length);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should have functioning sidebar", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var sidebar = await page.$("#sidebar");
      assert.ok(sidebar, "Sidebar should exist");
      var links = await page.$$("#sidebar a");
      assert.ok(links.length >= 5, "Sidebar should have links");
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

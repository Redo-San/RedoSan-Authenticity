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

var PAGE_ID = "timestamp";
var browser;
var TXT_BUF = fs.readFileSync(
  path.resolve(__dirname, "../../fixtures/test.txt"),
);

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("MPA — Timestamp", function () {
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
        return !!document.getElementById("ts-create-file");
      });
      var hasBtn = await page.evaluate(function () {
        return !!document.getElementById("ts-create-btn");
      });
      assert.ok(hasFile, "Create file input should exist");
      assert.ok(hasBtn, "Create timestamp button should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should create timestamp from uploaded file and show result", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.setInputFiles("#ts-create-file", [
        { name: "test.txt", mimeType: "text/plain", buffer: TXT_BUF },
      ]);
      await page.waitForTimeout(500);
      await page.evaluate(function () {
        document.getElementById("ts-create-btn").click();
      });
      await page.waitForSelector("#ts-result", {
        state: "visible",
        timeout: 30000,
      });
      await page.waitForTimeout(1000);
      var outputHtml = await page.evaluate(function () {
        var el = document.getElementById("ts-output");
        return el ? el.innerHTML : "";
      });
      assert.ok(
        outputHtml.length > 0,
        "Output should contain timestamp result",
      );
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

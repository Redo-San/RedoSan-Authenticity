var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var { chromium } = require("playwright");
var { ensureServer, openPage, checkPageLoad, checkNoErrors, closePage } = require("../mpa_helpers");
var path = require("path");
var fs = require("fs");

var PAGE_ID = "c2pa";
var browser;
var PNG_BUF = fs.readFileSync(path.resolve(__dirname, "../../fixtures/testimg.png"));

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("MPA — C2PA", function () {
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
      var hasReadFile = await page.evaluate(function () { return !!document.getElementById("c2pa-read-file"); });
      var hasReadBtn = await page.evaluate(function () { return !!document.getElementById("c2pa-read-btn"); });
      var hasWriteFile = await page.evaluate(function () { return !!document.getElementById("c2pa-write-file"); });
      var hasWriteBtn = await page.evaluate(function () { return !!document.getElementById("c2pa-write-btn"); });
      assert.ok(hasReadFile, "Read file input should exist");
      assert.ok(hasReadBtn, "Read button should exist");
      assert.ok(hasWriteFile, "Write file input should exist");
      assert.ok(hasWriteBtn, "Write button should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("upload file for reading", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.setInputFiles("#c2pa-read-file", [
        { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }
      ]);
      await page.waitForTimeout(500);
      var hasBtn = await page.evaluate(function () { return !!document.getElementById("c2pa-read-btn"); });
      assert.ok(hasBtn, "Read button should still exist after upload");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should have write form content type checkboxes", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var types = await page.evaluate(function () {
        var ids = [
          "c2pa-write-create",
          "c2pa-write-edit",
          "c2pa-write-ai",
          "c2pa-write-capture",
          "c2pa-write-composite",
          "c2pa-write-dnt",
        ];
        return ids.map(function (id) { return !!document.getElementById(id); });
      });
      assert.ok(types.every(Boolean), "All content type checkboxes should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should have social link inputs in write tab", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var links = await page.evaluate(function () {
        var ids = [
          "c2pa-link-instagram",
          "c2pa-link-twitter",
          "c2pa-link-facebook",
          "c2pa-link-tiktok",
          "c2pa-link-youtube",
          "c2pa-link-website",
        ];
        return ids.map(function (id) { return !!document.getElementById(id); });
      });
      assert.ok(links.every(Boolean), "All social link inputs should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should switch between read/write/verify tabs", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var readVisible = await page.evaluate(function () {
        var el = document.getElementById("c2pa-read");
        return el && el.style.display !== "none";
      });
      assert.ok(readVisible, "Read tab should be visible by default");

      await page.evaluate(function () { switchC2paTab("write"); });
      await page.waitForTimeout(300);
      var writeVisible = await page.evaluate(function () {
        var el = document.getElementById("c2pa-write");
        return el && el.style.display !== "none";
      });
      assert.ok(writeVisible, "Write tab should be visible after switching");

      await page.evaluate(function () { switchC2paTab("verify"); });
      await page.waitForTimeout(300);
      var verifyVisible = await page.evaluate(function () {
        var el = document.getElementById("c2pa-verify");
        return el && el.style.display !== "none";
      });
      assert.ok(verifyVisible, "Verify tab should be visible after switching");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should attempt C2PA read and show result section", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.setInputFiles("#c2pa-read-file", [
        { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }
      ]);
      await page.waitForTimeout(500);

      await page.evaluate(function () {
        var btn = document.getElementById("c2pa-read-btn");
        if (btn) btn.click();
      });

      await page.waitForTimeout(5000);

      var resultVisible = await page.evaluate(function () {
        var el = document.getElementById("c2pa-read-result");
        return el && el.style.display !== "none";
      });
      assert.ok(resultVisible, "Read result section should be visible after clicking read");

      var hasOutput = await page.evaluate(function () {
        var el = document.getElementById("c2pa-read-output");
        return el && el.innerHTML.trim().length > 0;
      });
      assert.ok(hasOutput, "Read output should contain result or status message");
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

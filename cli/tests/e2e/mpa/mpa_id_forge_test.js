var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var { chromium } = require("playwright");
var path = require("path");
var fs = require("fs");
var { ensureServer, openPage, checkPageLoad, checkNoErrors, closePage } = require("../mpa_helpers");

var PAGE_ID = "id_forge";
var browser;

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

async function generateId(page, type) {
  await page.evaluate(function (t) {
    var sel = document.getElementById("if-type");
    if (sel) { sel.value = t; sel.dispatchEvent(new Event("change", { bubbles: true })); }
  }, type);
  await page.waitForTimeout(300);
  await page.evaluate(function () { document.getElementById("if-gen-btn").click(); });
  await page.waitForSelector("#if-result", { state: "visible", timeout: 10000 });
  await page.waitForTimeout(500);
  return await page.evaluate(function () {
    var el = document.getElementById("if-output");
    return el ? el.value : "";
  });
}

describe("MPA — ID Forge", function () {
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
      var hasType = await page.evaluate(function () { return !!document.getElementById("if-type"); });
      var hasGenBtn = await page.evaluate(function () { return !!document.getElementById("if-gen-btn"); });
      assert.ok(hasType, "Type select should exist");
      assert.ok(hasGenBtn, "Generate button should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should generate a UUID v4", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var output = await generateId(page, "uuidv4");
      assert.ok(output.length > 0, "Output should contain generated ID");
      assert.match(output, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "Should match UUID v4 format");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should generate UUID v7", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var output = await generateId(page, "uuidv7");
      assert.ok(output.length > 0, "Output should contain generated ID");
      assert.match(output, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "Should match UUID v7 format");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should generate a ULID", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var output = await generateId(page, "ulid");
      assert.ok(output.length > 0, "Output should contain generated ID");
      assert.match(output, /^[0-9A-Z]+$/, "Should be uppercase alphanumeric");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should generate a NanoID", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var output = await generateId(page, "nanoid");
      assert.ok(output.length > 0, "Output should contain generated ID");
      assert.ok(output.length <= 256, "NanoID should be within length limit");
      assert.match(output, /^[a-zA-Z0-9_-]+$/, "Should match NanoID URL-safe format");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should generate a SWHID", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var output = await generateId(page, "swhid");
      assert.ok(output.length > 0, "Output should contain generated SWHID");
      assert.match(output, /^swh:/, "SWHID should start with swh:");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should have a functioning copy button", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await generateId(page, "uuidv4");
      // Verify copy button exists and is clickable
      var hasCopyBtn = await page.evaluate(function () {
        var btns = document.querySelectorAll("#if-result .btn");
        for (var i = 0; i < btns.length; i++) {
          if (btns[i].textContent.indexOf("Copy") !== -1) return true;
        }
        return false;
      });
      assert.ok(hasCopyBtn, "Copy button should exist in result area");

      // Click it and verify it changes text
      var newText = await page.evaluate(function () {
        var btns = document.querySelectorAll("#if-result .btn");
        for (var i = 0; i < btns.length; i++) {
          if (btns[i].textContent.indexOf("Copy") !== -1) {
            btns[i].click();
            return btns[i].textContent;
          }
        }
        return "";
      });
      // Button text should have changed after click (e.g. "✓ Copied!")
      assert.notEqual(newText, "Copy", "Button text should change after click");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should show download modal", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await generateId(page, "uuidv4");
      await page.evaluate(function () { idForgeShowDownload(); });
      await page.waitForTimeout(500);
      var modalHasOpen = await page.evaluate(function () {
        var modal = document.getElementById("dl-modal");
        return modal && modal.classList.contains("open");
      });
      assert.ok(modalHasOpen, "Download modal should have open class");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should generate SWHID from file upload", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        var sel = document.getElementById("if-type");
        sel.value = "swhid";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForTimeout(300);
      // Switch to file tab and upload
      await page.evaluate(function () { switchSwhidTab("file"); });
      await page.waitForTimeout(300);
      var testFile = path.resolve(__dirname, "../../fixtures/test.txt");
      var fileBuf = fs.readFileSync(testFile);
      await page.setInputFiles("#if-swhid-file", [
        { name: "test.txt", mimeType: "text/plain", buffer: fileBuf }
      ]);
      await page.waitForTimeout(300);
      await page.evaluate(function () { document.getElementById("if-gen-btn").click(); });
      await page.waitForSelector("#if-result", { state: "visible", timeout: 10000 });
      await page.waitForTimeout(500);
      var output = await page.evaluate(function () {
        var el = document.getElementById("if-output");
        return el ? el.value : "";
      });
      assert.match(output, /^swh:1:cnt:[0-9a-f]{40}$/, "SWHID from file should be valid");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should show download button and modal with format options", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await generateId(page, "uuidv4");
      await page.evaluate(function () { idForgeShowDownload(); });
      await page.waitForTimeout(500);
      var hasFormats = await page.evaluate(function () {
        var btns = document.querySelectorAll("#dl-modal .dl-option");
        return btns.length >= 3;
      });
      assert.ok(hasFormats, "Download modal should have at least 3 format options");
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

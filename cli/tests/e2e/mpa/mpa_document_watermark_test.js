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

var PAGE_ID = "document-watermark";
var browser;
var TXT_BUF = fs.readFileSync(
  path.resolve(__dirname, "../../fixtures/test.txt"),
);
var SECRET_BUF = Buffer.from("secret message for watermark");

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("MPA — Document Watermark", function () {
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
      var hasCoverFile = await page.evaluate(function () {
        return !!document.getElementById("docw-cover-file");
      });
      var hasSecretFile = await page.evaluate(function () {
        return !!document.getElementById("docw-secret-file");
      });
      var hasEmbedBtn = await page.evaluate(function () {
        return !!document.getElementById("docw-embed-btn");
      });
      var hasAlgo = await page.evaluate(function () {
        return !!document.getElementById("docw-algo");
      });
      assert.ok(hasCoverFile, "Cover file input should exist");
      assert.ok(hasSecretFile, "Secret file input should exist");
      assert.ok(hasEmbedBtn, "Embed button should exist");
      assert.ok(hasAlgo, "Algorithm select should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should upload cover file", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.setInputFiles("#docw-cover-file", [
        { name: "test.txt", mimeType: "text/plain", buffer: TXT_BUF },
      ]);
      await page.waitForTimeout(500);
      var hasBtn = await page.evaluate(function () {
        return !!document.getElementById("docw-embed-btn");
      });
      assert.ok(hasBtn, "Embed button should still exist after upload");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should switch between embed and extract tabs", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var embedVisible = await page.evaluate(function () {
        var el = document.getElementById("docw-embed");
        return el && el.style.display !== "none";
      });
      assert.ok(embedVisible, "Embed tab should be visible by default");

      await page.evaluate(function () {
        switchDocwTab("extract");
      });
      await page.waitForTimeout(300);
      var extractVisible = await page.evaluate(function () {
        var el = document.getElementById("docw-extract");
        return el && el.style.display !== "none";
      });
      assert.ok(
        extractVisible,
        "Extract tab should be visible after switching",
      );

      await page.evaluate(function () {
        switchDocwTab("embed");
      });
      await page.waitForTimeout(300);
      embedVisible = await page.evaluate(function () {
        var el = document.getElementById("docw-embed");
        return el && el.style.display !== "none";
      });
      assert.ok(
        embedVisible,
        "Embed tab should be visible after switching back",
      );
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should embed watermark in TXT file and show result", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      // Register dialog handler
      page.on("dialog", function (d) {
        d.dismiss().catch(function () {});
      });

      // Upload cover file
      await page.setInputFiles("#docw-cover-file", [
        { name: "cover.txt", mimeType: "text/plain", buffer: TXT_BUF },
      ]);
      await page.waitForTimeout(1000);

      // Upload secret message file
      await page.setInputFiles("#docw-secret-file", [
        { name: "secret.txt", mimeType: "text/plain", buffer: SECRET_BUF },
      ]);
      await page.waitForTimeout(500);

      // Set password
      await page.fill("#docw-password", "test123");

      // Select algorithm 1 (zero-width)
      await page.evaluate(function () {
        document.getElementById("docw-algo").value = "1";
        document.getElementById("docw-algo").dispatchEvent(new Event("change"));
      });
      await page.waitForTimeout(300);

      // Click embed
      await page.evaluate(function () {
        document.getElementById("docw-embed-btn").click();
      });
      await page.waitForTimeout(3000);

      var resultVisible = await page.evaluate(function () {
        var el = document.getElementById("docw-embed-result");
        return el && el.style.display !== "none";
      });
      assert.ok(
        resultVisible,
        "Embed result section should be visible after embedding",
      );

      var hasOutput = await page.evaluate(function () {
        var el = document.getElementById("docw-embed-output");
        return el && el.value && el.value.length > 0;
      });
      assert.ok(hasOutput, "Embed output should contain watermarked text");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should have extract tab form elements", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        switchDocwTab("extract");
      });
      await page.waitForTimeout(300);

      var hasExtractFile = await page.evaluate(function () {
        return !!document.getElementById("docw-extract-file");
      });
      var hasExtractBtn = await page.evaluate(function () {
        return !!document.getElementById("docw-extract-btn");
      });
      var hasExtractAlgo = await page.evaluate(function () {
        return !!document.getElementById("docw-algo-ex");
      });
      assert.ok(hasExtractFile, "Extract file input should exist");
      assert.ok(hasExtractBtn, "Extract button should exist");
      assert.ok(hasExtractAlgo, "Extract algorithm select should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should show download button after embedding", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      page.on("dialog", function (d) {
        d.dismiss().catch(function () {});
      });
      await page.setInputFiles("#docw-cover-file", [
        { name: "cover.txt", mimeType: "text/plain", buffer: TXT_BUF },
      ]);
      await page.waitForTimeout(500);
      await page.setInputFiles("#docw-secret-file", [
        { name: "secret.txt", mimeType: "text/plain", buffer: SECRET_BUF },
      ]);
      await page.waitForTimeout(500);
      await page.fill("#docw-password", "test123");
      await page.evaluate(function () {
        document.getElementById("docw-algo").value = "1";
        document.getElementById("docw-algo").dispatchEvent(new Event("change"));
      });
      await page.waitForTimeout(300);
      await page.evaluate(function () {
        document.getElementById("docw-embed-btn").click();
      });
      await page.waitForTimeout(3000);
      var hasDownloadBtn = await page.evaluate(function () {
        var dlArea = document.getElementById("docw-embed-buttons");
        if (!dlArea) return false;
        var txt = (dlArea.textContent || dlArea.innerText || "").toLowerCase();
        return txt.indexOf("download") !== -1;
      });
      assert.ok(
        hasDownloadBtn,
        "Download button area should appear after embed",
      );
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should have watermark algorithm options", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var algoOptions = await page.evaluate(function () {
        var sel = document.getElementById("docw-algo");
        if (!sel) return [];
        var opts = [];
        for (var i = 0; i < sel.options.length; i++) {
          opts.push(sel.options[i].value);
        }
        return opts;
      });
      assert.ok(
        algoOptions.length >= 3,
        "Should have at least 3 algorithm options",
      );
      assert.ok(
        algoOptions.indexOf("1") !== -1,
        "Zero-width algorithm should exist",
      );
      assert.ok(
        algoOptions.indexOf("2") !== -1,
        "Whitespace algorithm should exist",
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

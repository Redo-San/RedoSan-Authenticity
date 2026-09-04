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

var PAGE_ID = "metadata";
var browser;
var PNG_BUF = fs.readFileSync(
  path.resolve(__dirname, "../../fixtures/testimg.png"),
);

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("MPA — Metadata", function () {
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
        return !!document.getElementById("md-file");
      });
      var hasBtn = await page.evaluate(function () {
        return !!document.getElementById("md-btn");
      });
      assert.ok(hasFile, "File input should exist");
      assert.ok(hasBtn, "Analyze button should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should analyze image metadata and show result", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.setInputFiles("#md-file", [
        { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
      ]);
      await page.waitForTimeout(500);
      await page.evaluate(function () {
        document.getElementById("md-btn").click();
      });
      await page.waitForSelector("#md-result", {
        state: "visible",
        timeout: 30000,
      });
      await page.waitForTimeout(1000);
      var outputHtml = await page.evaluate(function () {
        var el = document.getElementById("md-output");
        return el ? el.innerHTML : "";
      });
      assert.ok(outputHtml.length > 0, "Output should contain metadata result");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should show download button after analysis", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.setInputFiles("#md-file", [
        { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
      ]);
      await page.waitForTimeout(500);
      await page.evaluate(function () {
        document.getElementById("md-btn").click();
      });
      await page.waitForSelector("#md-result", {
        state: "visible",
        timeout: 30000,
      });
      await page.waitForTimeout(500);
      var hasDlBtn = await page.evaluate(function () {
        var dl = document.getElementById("md-download");
        return dl && dl.innerHTML.indexOf("Download") !== -1;
      });
      assert.ok(
        hasDlBtn,
        "Download button should appear in md-download after analysis",
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

  it("should display EXIF entries from JPEG with EXIF data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      // Test parseJPEGExif directly in the browser with a crafted EXIF buffer
      var exifStr = await page.evaluate(function () {
        var buf = new Uint8Array([
          // SOI
          0xff,
          0xd8,
          // APP1 segment
          0xff,
          0xe1,
          0x00,
          0x3b, // segment length (59 bytes)
          // Exif identifier
          0x45,
          0x78,
          0x69,
          0x66,
          0x00,
          0x00, // "Exif\0\0"
          // TIFF header (little-endian) — starts at byte 12
          0x49,
          0x49, // byte order
          0x2a,
          0x00, // magic 42
          0x08,
          0x00,
          0x00,
          0x00, // IFD0 at offset 8 (abs byte 20)
          // IFD0: 2 entries at byte 20
          0x02,
          0x00,
          // Entry 1: Make (0x010F) - ASCII, count=6, offset=38 → "Canon\0"
          0x0f,
          0x01,
          0x02,
          0x00,
          0x06,
          0x00,
          0x00,
          0x00,
          0x26,
          0x00,
          0x00,
          0x00,
          // Entry 2: Model (0x0110) - ASCII, count=7, offset=44 → "EOS70D\0"
          0x10,
          0x01,
          0x02,
          0x00,
          0x07,
          0x00,
          0x00,
          0x00,
          0x2c,
          0x00,
          0x00,
          0x00,
          // Next IFD offset
          0x00,
          0x00,
          0x00,
          0x00,
          // String data at offset 38: "Canon\0"
          0x43,
          0x61,
          0x6e,
          0x6f,
          0x6e,
          0x00,
          // String data at offset 44: "EOS70D\0"
          0x45,
          0x4f,
          0x53,
          0x37,
          0x30,
          0x44,
          0x00,
          // EOI
          0xff,
          0xd9,
        ]);
        var exif = parseJPEGExif(buf);
        return JSON.stringify(exif);
      });
      var parsed = JSON.parse(exifStr);
      assert.equal(parsed.Make, "Canon", "EXIF Make should be Canon");
      assert.equal(parsed.Model, "EOS70D", "EXIF Model should be EOS70D");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should not display EXIF section for JPEG without EXIF data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      // Test parseJPEGExif with plain JPEG data (no APP1)
      var result = await page.evaluate(function () {
        var buf = new Uint8Array([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
          0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
        ]);
        return JSON.stringify(parseJPEGExif(buf));
      });
      assert.equal(result, "{}", "No EXIF data for plain JPEG");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should handle malformed EXIF data gracefully", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      // Test with buffer that has APP1 marker but truncated Exif data
      var result = await page.evaluate(function () {
        var buf = new Uint8Array([
          0xff, 0xd8, 0xff, 0xe1, 0x00, 0x0a, 0x45, 0x78, 0x69,
        ]);
        return JSON.stringify(parseJPEGExif(buf));
      });
      assert.equal(
        result,
        "{}",
        "Should return empty object for truncated EXIF",
      );
    } finally {
      await closePage(ctx, page);
    }
  });
});

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

var PAGE_ID = "converter";
var browser;
var PNG_BUF = fs.readFileSync(
  path.resolve(__dirname, "../../fixtures/testimg.png"),
);
var TXT_BUF = fs.readFileSync(
  path.resolve(__dirname, "../../fixtures/test.txt"),
);
var SRT_BUF = fs.readFileSync(
  path.resolve(__dirname, "../../fixtures/test.srt"),
);

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("MPA — Converter", function () {
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
        return !!document.getElementById("conv-file");
      });
      var hasBtn = await page.evaluate(function () {
        return !!document.getElementById("conv-btn");
      });
      assert.ok(hasFile, "File input should exist");
      assert.ok(hasBtn, "Convert button should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should upload file for conversion", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.setInputFiles("#conv-file", [
        { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
      ]);
      await page.waitForTimeout(500);
      var hasBtn = await page.evaluate(function () {
        return !!document.getElementById("conv-btn");
      });
      assert.ok(hasBtn, "Convert button should still exist after upload");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should convert PNG to JPEG and produce download link", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.setInputFiles("#conv-file", [
        { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
      ]);
      await page.waitForTimeout(500);

      var optsVisible = await page.evaluate(function () {
        var opts = document.getElementById("conv-options");
        return opts && opts.style.display !== "none";
      });
      assert.ok(
        optsVisible,
        "Format options should be visible after PNG upload",
      );

      var firstFmt = await page.evaluate(function () {
        var grid = document.getElementById("conv-format-grid");
        if (!grid) return "";
        var btn = grid.querySelector(".tab-btn.active");
        return btn ? btn.dataset.fmt : "";
      });
      assert.equal(
        firstFmt,
        "jpeg",
        "Default image format should be JPEG (filtering out PNG)",
      );

      await page.evaluate(function () {
        document.getElementById("conv-btn").click();
      });
      await page.waitForTimeout(3000);

      var outputVisible = await page.evaluate(function () {
        var out = document.getElementById("conv-output");
        return out && out.style.display !== "none";
      });
      assert.ok(
        outputVisible,
        "Output section should be visible after conversion",
      );

      var hasDownload = await page.evaluate(function () {
        var dl = document.getElementById("conv-download");
        return dl && dl.querySelector("a") !== null;
      });
      assert.ok(hasDownload, "Download link should exist after conversion");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should convert TXT to HTML and produce download link", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.setInputFiles("#conv-file", [
        { name: "test.txt", mimeType: "text/plain", buffer: TXT_BUF },
      ]);
      await page.waitForTimeout(500);

      var optsVisible = await page.evaluate(function () {
        var opts = document.getElementById("conv-options");
        return opts && opts.style.display !== "none";
      });
      assert.ok(
        optsVisible,
        "Format options should be visible after TXT upload",
      );

      var firstFmt = await page.evaluate(function () {
        var grid = document.getElementById("conv-format-grid");
        if (!grid) return "";
        var btn = grid.querySelector(".tab-btn.active");
        return btn ? btn.dataset.fmt : "";
      });
      assert.equal(
        firstFmt,
        "html",
        "Default doc format should be HTML (filtering out TXT)",
      );

      await page.evaluate(function () {
        document.getElementById("conv-btn").click();
      });
      await page.waitForTimeout(2000);

      var outputVisible = await page.evaluate(function () {
        var out = document.getElementById("conv-output");
        return out && out.style.display !== "none";
      });
      assert.ok(
        outputVisible,
        "Output section should be visible after TXT→HTML conversion",
      );

      var hasDownload = await page.evaluate(function () {
        var dl = document.getElementById("conv-download");
        return dl && dl.querySelector("a") !== null;
      });
      assert.ok(
        hasDownload,
        "Download link should exist after TXT→HTML conversion",
      );
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should convert SRT to VTT and produce download link", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.setInputFiles("#conv-file", [
        { name: "test.srt", mimeType: "text/plain", buffer: SRT_BUF },
      ]);
      await page.waitForTimeout(500);

      var optsVisible = await page.evaluate(function () {
        var opts = document.getElementById("conv-options");
        return opts && opts.style.display !== "none";
      });
      assert.ok(
        optsVisible,
        "Format options should be visible after SRT upload",
      );

      var firstFmt = await page.evaluate(function () {
        var grid = document.getElementById("conv-format-grid");
        if (!grid) return "";
        var btn = grid.querySelector(".tab-btn.active");
        return btn ? btn.dataset.fmt : "";
      });
      assert.equal(
        firstFmt,
        "vtt",
        "Default sub format should be VTT (filtering out SRT)",
      );

      await page.evaluate(function () {
        document.getElementById("conv-btn").click();
      });
      await page.waitForTimeout(2000);

      var outputVisible = await page.evaluate(function () {
        var out = document.getElementById("conv-output");
        return out && out.style.display !== "none";
      });
      assert.ok(
        outputVisible,
        "Output section should be visible after SRT→VTT conversion",
      );

      var hasDownload = await page.evaluate(function () {
        var dl = document.getElementById("conv-download");
        return dl && dl.querySelector("a") !== null;
      });
      assert.ok(
        hasDownload,
        "Download link should exist after SRT→VTT conversion",
      );
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should show error for unknown file type", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var unknownBuf = Buffer.from("some binary data");
      page.on("dialog", function (d) {
        d.dismiss().catch(function () {});
      });
      await page.setInputFiles("#conv-file", [
        {
          name: "test.xyz",
          mimeType: "application/octet-stream",
          buffer: unknownBuf,
        },
      ]);
      await page.waitForTimeout(500);

      var fileCleared = await page.evaluate(function () {
        var input = document.getElementById("conv-file");
        return !input || !input.files || input.files.length === 0;
      });
      assert.ok(
        fileCleared,
        "File input should be cleared after validation rejection",
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

  it("should encode video via convVideoEncode in browser (MediaRecorder)", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var result = await page.evaluate(async function () {
        var canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        var c = canvas.getContext("2d");
        c.fillStyle = "red";
        c.fillRect(0, 0, 64, 64);
        var stream = canvas.captureStream(30);
        try {
          var r = await convVideoEncode(
            stream,
            "video/webm;codecs=vp8",
            "webm",
            0.1,
          );
          return {
            ok: true,
            hasBlob: r.blob instanceof Blob,
            size: r.blob.size,
            ext: r.ext,
          };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      });
      assert.ok(
        result.ok,
        "convVideoEncode should not throw. Error: " + (result.error || "none"),
      );
      assert.ok(result.hasBlob, "Should produce a Blob");
      assert.ok(
        result.size > 0,
        "Blob should have non-zero size. Got: " + result.size,
      );
      assert.equal(result.ext, "webm", "Extension should match");
    } finally {
      await closePage(ctx, page);
    }
  });
});

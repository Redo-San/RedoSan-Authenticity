var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var { chromium } = require("playwright");
var { ensureServer, openPage, checkPageLoad, checkNoErrors, closePage } = require("../mpa_helpers");

var PAGE_ID = "face-biometric";
var browser;

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("MPA — Face Biometric", function () {
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
      var hasInput = await page.evaluate(function () { return !!document.getElementById("face-image"); });
      var hasLabel = await page.evaluate(function () { return !!document.getElementById("face-label"); });
      var hasRun = await page.evaluate(function () { return !!document.getElementById("face-run"); });
      var hasEmbedder = await page.evaluate(function () { return !!document.getElementById("face-embedder"); });
      assert.ok(hasInput, "File input should exist");
      assert.ok(hasLabel, "Label field should exist");
      assert.ok(hasRun, "Generate Identifiers button should exist");
      assert.ok(hasEmbedder, "Embedder selector should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should list both embedder options (human + arcface)", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var opts = await page.evaluate(function () {
        var sel = document.getElementById("face-embedder");
        if (!sel) return [];
        return Array.from(sel.options).map(function (o) { return o.value; });
      });
      assert.ok(opts.indexOf("human") !== -1, "human embedder option should exist");
      assert.ok(opts.indexOf("arcface") !== -1, "arcface embedder option should exist");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should expose the ArcFace ONNX embedder module", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var has = await page.evaluate(function () {
        return typeof window.FaceONNXEmbedder === "object" &&
          typeof window.FaceONNXEmbedder.load === "function" &&
          typeof window.FaceONNXEmbedder.embed === "function" &&
          window.FaceONNXEmbedder.DIMS === 512;
      });
      assert.ok(has, "FaceONNXEmbedder (512-d) should be exposed on window");
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
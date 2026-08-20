var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var { chromium } = require("playwright");
var { ensureServer, openPage, pageURL, checkPageLoad, checkNoErrors, closePage } = require("../mpa_helpers");

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

describe("MPA — Face Biometric via router navigation", function () {
  it("should inject page CSS and run init when navigated via __mpaNavigate", async function () {
    var ctx = await browser.newContext({ locale: "en-US" });
    var page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    var errors = [];
    page.on("pageerror", function (e) { errors.push(e.message); });
    page.on("console", function (m) {
      if (m.type() === "error") errors.push(m.text());
    });
    // The router loads feature scripts sequentially; aborting the heavy
    // CDN model download keeps the test fast and deterministic while still
    // exercising CSS injection + reInitPage + the consent flow (init
    // degrades gracefully when the face model is unavailable).
    await page.route("**cdn.jsdelivr.net**", function (route) {
      return route.abort();
    });
    try {
      await page.goto(pageURL("home"), { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.evaluate(function () { localStorage.clear(); });
      await page.evaluate(function () { __mpaNavigate("face-biometric"); });
      await page.waitForFunction(function () {
        return !!document.getElementById("face-image");
      }, { timeout: 30000 });
      await page.waitForFunction(function () {
        return document.getElementById("face-image").disabled === true;
      }, { timeout: 60000 });
      var state = await page.evaluate(function () {
        var links = Array.prototype.slice.call(
          document.querySelectorAll('link[rel="stylesheet"]'),
        );
        return {
          cssLoaded: links.some(function (l) {
            return (l.href || "").indexOf("face-biometric/css/style.css") !== -1;
          }),
          panelVisible:
            getComputedStyle(document.getElementById("face-consent-panel")).display !== "none",
          runDisabled: document.getElementById("face-run").disabled,
        };
      });
      assert.equal(state.cssLoaded, true, "page css should be injected after AJAX navigation");
      assert.equal(state.panelVisible, true, "consent panel should be visible without consent");
      assert.equal(state.runDisabled, true, "run button should be disabled until consent");
      checkNoErrors(errors, "face-biometric(router)");

      await page.evaluate(function () {
        var check = document.getElementById("face-consent-check");
        check.checked = true;
        check.dispatchEvent(new Event("change", { bubbles: true }));
      });
      var acceptDisabled = await page.evaluate(function () {
        return document.getElementById("face-consent-accept").disabled;
      });
      assert.equal(acceptDisabled, false, "accept button should enable after ticking the checkbox");
      await page.evaluate(function () {
        document.getElementById("face-consent-accept").click();
      });
      var after = await page.evaluate(function () {
        return {
          saved: !!sessionStorage.getItem("redoSan.faceConsent"),
          notPersisted: localStorage.getItem("redoSan.faceConsent") === null,
          panelHidden:
            getComputedStyle(document.getElementById("face-consent-panel")).display === "none",
          inputEnabled: !document.getElementById("face-image").disabled,
        };
      });
      assert.equal(after.saved, true, "consent should be saved to sessionStorage");
      assert.equal(after.notPersisted, true, "consent must not persist in localStorage");
      assert.equal(after.panelHidden, true, "consent panel should hide after accept");
      assert.equal(after.inputEnabled, true, "file input should enable after consent");
    } finally {
      if (ctx) await ctx.close();
    }
  });
});
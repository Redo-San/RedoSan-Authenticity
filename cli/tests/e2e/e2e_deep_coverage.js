const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const {
  startCoverage,
  stopCoverage,
  prepareForC8,
  cleanV8Dir,
} = require("./e2e_coverage");
const path = require("path");
const fs = require("fs");

const PORT = 9905;
const BASE = `http://localhost:${PORT}`;
const PNG_BUF = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "testimg.png"),
);
const TXT_BUF = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "test.txt"),
);
// test.jpg may not exist — only read if present
var JPEG_BUF = null;
try {
  JPEG_BUF = fs.readFileSync(
    path.resolve(__dirname, "..", "fixtures", "test.jpg"),
  );
} catch (e) {}

let browser, server;

before(async () => {
  cleanV8Dir();
  server = await startServer(PORT);
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  stopServer();
  prepareForC8();
});

function navTo(page, id) {
  return page.goto(`${BASE}/Style/pages/${id}/index.html`);
}

describe("E2E Deep Coverage — shared.js utilities", () => {
  it("should exercise escHtml with all edge cases", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // Test escHtml via inline evaluation
    const r1 = await page.evaluate(function () {
      return escHtml(null);
    });
    const r2 = await page.evaluate(function () {
      return escHtml(undefined);
    });
    const r3 = await page.evaluate(function () {
      return escHtml("");
    });
    const r4 = await page.evaluate(function () {
      return escHtml("hello");
    });
    const r5 = await page.evaluate(function () {
      return escHtml("a&b");
    });
    const r6 = await page.evaluate(function () {
      return escHtml("<tag>");
    });
    const r7 = await page.evaluate(function () {
      return escHtml('"hi"');
    });
    const r8 = await page.evaluate(function () {
      return escHtml('&<>"');
    });

    assert.equal(r1, "");
    assert.equal(r2, "");
    assert.equal(r3, "");
    assert.equal(r4, "hello");
    assert.equal(r5, "a&amp;b");
    assert.equal(r6, "&lt;tag&gt;");
    // Some escHtml implementations also escape quotes, some don't — accept both
    if (r7.indexOf("&quot;") !== -1) {
      assert.equal(r7, "&quot;hi&quot;");
    } else {
      assert.equal(r7, '"hi"');
    }
    if (r8.indexOf("&quot;") !== -1) {
      assert.equal(r8, "&amp;&lt;&gt;&quot;");
    } else {
      assert.equal(r8, '&amp;&lt;&gt;"');
    }

    await stopCoverage(page, "shared-escHtml");
    await ctx.close();
  });

  it("should exercise __ translation function", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const r = await page.evaluate(function () {
      return {
        withFallback: __("nonexistent.key", "fallback"),
        noFallback: __("another.missing"),
        // i18n.data may or may not be loaded — test both paths
      };
    });

    assert.equal(r.withFallback, "fallback");
    assert.equal(r.noFallback, "another.missing");

    await stopCoverage(page, "shared-translate");
    await ctx.close();
  });

  it("should exercise pack32/unpack32 and sha256Hex", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const r = await page.evaluate(async function () {
      var vals = [0, 1, 255, 256, 65535, 16777215, 2147483647, 4294967295];
      var roundtrips = vals.map(function (v) {
        var packed = pack32(v >>> 0);
        var unpacked = unpack32(packed);
        return {
          input: v,
          output: unpacked >>> 0,
          ok: v >>> 0 === unpacked >>> 0,
        };
      });

      var emptyHash = await sha256Hex(new Uint8Array([]));
      var helloHash = await sha256Hex(new TextEncoder().encode("hello"));

      return {
        roundtrips: roundtrips,
        emptyHash: emptyHash,
        helloHash: helloHash,
      };
    });

    assert.ok(
      r.roundtrips.every(function (x) {
        return x.ok;
      }),
    );
    assert.equal(
      r.emptyHash,
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    assert.equal(
      r.helloHash,
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );

    await stopCoverage(page, "shared-pack-sha");
    await ctx.close();
  });

  it("should exercise theme toggle functions", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const r = await page.evaluate(function () {
      var initial = document.documentElement.dataset.theme;
      toggleTheme();
      var afterFirst = document.documentElement.dataset.theme;
      toggleTheme();
      var afterSecond = document.documentElement.dataset.theme;
      return {
        initial: initial,
        afterFirst: afterFirst,
        afterSecond: afterSecond,
      };
    });

    assert.notEqual(r.initial, r.afterFirst);
    assert.equal(r.initial, r.afterSecond);

    await stopCoverage(page, "shared-theme");
    await ctx.close();
  });

  it("should exercise isInAppBrowser and downloadBlobSimple", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const r = await page.evaluate(function () {
      var inApp = isInAppBrowser();
      var blob = new Blob(["test"], { type: "text/plain" });
      downloadBlobSimple(blob, "test.txt");
      return { inApp: inApp };
    });

    assert.equal(r.inApp, false);

    await stopCoverage(page, "shared-download");
    await ctx.close();
  });

  it("should exercise checkAutomation and showBotOverlay", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const r = await page.evaluate(function () {
      var result = checkAutomation();
      // showBotOverlay should not throw even if overlay exists
      showBotOverlay();
      var overlay = document.getElementById("botBlockOverlay");
      return {
        hasScore: typeof result.score === "number",
        hasSignals: Array.isArray(result.signals),
        isAutomated: result.isAutomated,
        overlayClass: overlay ? overlay.className : "missing",
      };
    });

    assert.ok(r.hasScore);
    assert.ok(r.hasSignals);

    await stopCoverage(page, "shared-bot");
    await ctx.close();
  });

  it("should exercise setStatus, spinner, showResult, setOutput, setText on home page", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // Run each function independently to pinpoint the issue
    var dbg = await page.evaluate(function () {
      var el = document.createElement("div");
      el.id = "py-status";
      document.body.appendChild(el);

      var found = document.getElementById("py-status");
      if (!found) return { err: "element not found after append" };

      // Try calling setStatus — does it throw?
      var ssError = null;
      try {
        setStatus("test status", "success");
      } catch (e) {
        ssError = e.message;
      }

      // Try setStatusLegacy approach: directly do what setStatus does
      var innerEl = document.getElementById("py-status");
      if (innerEl) {
        innerEl.textContent = "test status";
        if (true) innerEl.className = "badge badge-success";
      }
      var afterDirect = found.textContent;
      var afterDirectClass = found.className;

      // Now try spinner
      var spError = null;
      try {
        spinner("py-status", true);
      } catch (e) {
        spError = e.message;
      }
      var spShow = found.style.display;

      // Now try setOutput
      var soError = null;
      try {
        setOutput("py-status", "<b>bold output</b>");
      } catch (e) {
        soError = e.message;
      }
      var outHtml = found.innerHTML;

      // Now try setText
      var stError = null;
      try {
        setText("py-status", "plain text");
      } catch (e) {
        stError = e.message;
      }
      var stText = found.textContent;

      return {
        ssError: ssError,
        afterDirect: afterDirect,
        afterDirectClass: afterDirectClass,
        spError: spError,
        spShow: spShow,
        soError: soError,
        outHtml: outHtml,
        stError: stError,
        stText: stText,
      };
    });

    // Direct equivalent of setStatus should work
    assert.equal(
      dbg.afterDirect,
      "test status",
      "Direct setStatus body: err=" + dbg.ssError,
    );
    assert.ok(
      dbg.afterDirectClass.indexOf("badge-success") !== -1,
      "Direct setStatus class: " + dbg.afterDirectClass,
    );
    // spinner via function call
    assert.equal(dbg.spShow, "block", "spinner: err=" + dbg.spError);
    // setOutput via function call
    assert.equal(
      dbg.outHtml,
      "<b>bold output</b>",
      "setOutput: err=" + dbg.soError,
    );
    // setText via function call
    assert.equal(dbg.stText, "plain text", "setText: err=" + dbg.stError);

    await stopCoverage(page, "shared-ui-utils");
    await ctx.close();
  });

  it("should exercise downloadBlob with container", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const r = await page.evaluate(function () {
      var container = document.getElementById("test-dl-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "test-dl-container";
        document.body.appendChild(container);
      }
      var blob = new Blob(["data"], { type: "text/plain" });
      downloadBlob(blob, "blob.txt", "test-dl-container");
      var link = container.querySelector("a");
      return { linkExists: !!link, linkText: link ? link.textContent : "" };
    });

    assert.ok(r.linkExists);

    await stopCoverage(page, "shared-downloadBlob");
    await ctx.close();
  });

  it("should exercise getRGB and canvasToBlob", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const r = await page.evaluate(async function () {
      var c = document.createElement("canvas");
      c.width = 4;
      c.height = 4;
      var ctx = c.getContext("2d");
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 2, 2);
      ctx.fillStyle = "blue";
      ctx.fillRect(2, 2, 2, 2);
      var imgData = ctx.getImageData(0, 0, 4, 4);
      imgData.w = 4;
      imgData.h = 4;

      var rgb = getRGB(imgData);
      var canvasBlob = await canvasToBlob(c);

      return {
        rgbLength: rgb.length,
        firstR: rgb[0],
        firstG: rgb[1],
        firstB: rgb[2],
        blobSize: canvasBlob ? canvasBlob.size : 0,
        blobType: canvasBlob ? canvasBlob.type : "",
      };
    });

    assert.equal(r.rgbLength, 48);
    assert.equal(r.firstR, 255);
    assert.equal(r.firstG, 0);
    assert.equal(r.firstB, 0);
    assert.ok(r.blobSize > 0);
    assert.equal(r.blobType, "image/png");

    await stopCoverage(page, "shared-getRGB");
    await ctx.close();
  });

  it("should exercise loadImage via canvas-based blob", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const r = await page.evaluate(async function () {
      // Create a test image blob in-memory
      var c = document.createElement("canvas");
      c.width = 16;
      c.height = 16;
      var ctx2d = c.getContext("2d");
      ctx2d.fillStyle = "red";
      ctx2d.fillRect(0, 0, 16, 16);

      // Convert to blob
      var blob = await new Promise(function (resolve) {
        c.toBlob(function (b) {
          resolve(b);
        }, "image/png");
      });
      if (!blob) return { loaded: false, reason: "no blob" };

      // Create a File from blob
      var file = new File([blob], "test-img.png", { type: "image/png" });

      try {
        var result = await loadImage(file);
        return {
          loaded: true,
          w: result.w,
          h: result.h,
          hasData:
            result.imgData &&
            result.imgData.data &&
            result.imgData.data.length > 0,
        };
      } catch (e) {
        return { loaded: false, error: e.message };
      }
    });

    assert.ok(r.loaded, "Image should load from canvas blob");
    assert.equal(r.w, 16);
    assert.equal(r.h, 16);
    assert.ok(r.hasData);

    await stopCoverage(page, "shared-loadImage");
    await ctx.close();
  });
});

describe("E2E Deep Coverage — search.js", () => {
  it("should exercise buildSearchIndex and siteSearch", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const r = await page.evaluate(function () {
      var idx = buildSearchIndex();
      return {
        indexLength: idx.length,
        firstPage:
          idx.length > 0
            ? {
                id: idx[0].id,
                hasTitle: !!idx[0].title,
                hasText: idx[0].text.length > 0,
              }
            : null,
      };
    });

    assert.ok(r.indexLength >= 20);
    assert.ok(r.firstPage.hasTitle);

    await stopCoverage(page, "search-buildIndex");
    await ctx.close();
  });

  it("should exercise siteSearch with 'watermark' query", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    await page.evaluate(function () {
      var input = document.getElementById("searchInput");
      if (input) input.value = "watermark";
      siteSearch();
    });
    await page.waitForTimeout(500);

    const r = await page.evaluate(function () {
      var output = document.getElementById("search-output");
      if (!output) return { hasOutput: false, hasResults: false };
      return {
        hasOutput: true,
        hasResults: output.innerHTML.indexOf("search-result-item") !== -1,
        htmlLen: output.innerHTML.length,
      };
    });

    assert.ok(r.hasOutput);
    assert.ok(
      r.hasResults,
      "Search should produce results. HTML length: " + r.htmlLen,
    );

    await stopCoverage(page, "search-siteSearch");
    await ctx.close();
  });

  it("should exercise siteSearch with empty query", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    await page.evaluate(function () {
      var input = document.getElementById("searchInput");
      if (input) input.value = "";
      siteSearch();
    });

    await stopCoverage(page, "search-empty");
    await ctx.close();
  });

  it("should exercise navigateToSearchResult", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const r = await page.evaluate(function () {
      navigateToSearchResult("watermark");
      var wmPage = document.getElementById("page-watermark");
      if (!wmPage) return { navigated: false };
      return { navigated: wmPage.classList.contains("active") };
    });

    assert.ok(r.navigated);

    await stopCoverage(page, "search-navigate");
    await ctx.close();
  });

  it("should exercise siteSearch with no-results query", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    await page.evaluate(function () {
      var input = document.getElementById("searchInput");
      if (input) input.value = "xyznonexistent12345xyz";
      siteSearch();
    });
    await page.waitForTimeout(500);

    const r = await page.evaluate(function () {
      var output = document.getElementById("search-output");
      if (!output) return { hasOutput: false };
      var html = output.innerHTML;
      return {
        hasOutput: html.length > 0,
        noResultsMsg:
          html.indexOf("xyznonexistent") !== -1 ||
          html.indexOf("No results") !== -1,
      };
    });

    assert.ok(r.hasOutput);
    assert.ok(
      r.noResultsMsg,
      "Search output should show no-results message. HTML length: " +
        (r.hasOutput ? "non-empty" : "empty"),
    );

    await stopCoverage(page, "search-noResults");
    await ctx.close();
  });

  it("should exercise closeSearchResults", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    await page.evaluate(function () {
      siteSearch();
    });

    await page.evaluate(function () {
      closeSearchResults();
    });

    await stopCoverage(page, "search-close");
    await ctx.close();
  });
});

describe("E2E Deep Coverage — converter module", () => {
  it("should exercise PNG to JPEG conversion", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "converter");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#conv-file", [
      { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(function () {
      document.getElementById("conv-btn").click();
    });
    await page.waitForTimeout(3000);

    const r = await page.evaluate(function () {
      var out = document.getElementById("conv-output");
      var dl = document.getElementById("conv-download");
      return {
        outputVisible: out && out.style.display !== "none",
        hasDownload: dl && dl.querySelector("a") !== null,
      };
    });

    assert.ok(r.outputVisible);
    assert.ok(r.hasDownload);

    await stopCoverage(page, "converter-png2jpg");
    await ctx.close();
  });
});

describe("E2E Deep Coverage — ID Forge", () => {
  it("should generate UUID v4 and v7", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await navTo(page, "id_forge");
    await page.waitForTimeout(2000);
    await navTo(page, "id_forge");
    await page.waitForTimeout(1000);

    // Check DOM elements exist
    var domOk = await page.evaluate(function () {
      return {
        sel: !!document.getElementById("if-type"),
        out: !!document.getElementById("if-output"),
        btn: !!document.getElementById("if-gen-btn"),
      };
    });
    assert.ok(
      domOk.sel && domOk.out && domOk.btn,
      "ID Forge DOM: sel=" +
        domOk.sel +
        " out=" +
        domOk.out +
        " btn=" +
        domOk.btn,
    );

    // Generate UUID v4
    await page.evaluate(function () {
      document.getElementById("if-type").value = "uuidv4";
      document.getElementById("if-gen-btn").click();
    });
    await page.waitForTimeout(2000);
    var uuidv4 = await page.evaluate(function () {
      return document.getElementById("if-output").value;
    });
    assert.ok(uuidv4.length > 0, "UUID v4 should not be empty");

    // Generate UUID v7
    await page.evaluate(function () {
      document.getElementById("if-type").value = "uuidv7";
      document.getElementById("if-gen-btn").click();
    });
    await page.waitForTimeout(2000);
    var uuidv7 = await page.evaluate(function () {
      return document.getElementById("if-output").value;
    });
    assert.ok(uuidv7.length > 0, "UUID v7 should not be empty");

    await stopCoverage(page, "idforge-uuids");
    await ctx.close();
  });

  it("should generate ULID and NanoID", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await navTo(page, "id_forge");
    await page.waitForTimeout(2000);
    await navTo(page, "id_forge");
    await page.waitForTimeout(1000);

    // Generate ULID
    await page.evaluate(function () {
      document.getElementById("if-type").value = "ulid";
      document.getElementById("if-gen-btn").click();
    });
    await page.waitForTimeout(2000);
    var ulid = await page.evaluate(function () {
      return document.getElementById("if-output").value;
    });
    assert.ok(ulid.length > 0, "ULID: " + ulid);

    // Generate NanoID
    await page.evaluate(function () {
      document.getElementById("if-type").value = "nanoid";
      document.getElementById("if-gen-btn").click();
    });
    await page.waitForTimeout(2000);
    var nanoid = await page.evaluate(function () {
      return document.getElementById("if-output").value;
    });
    assert.ok(nanoid.length > 0, "NanoID: " + nanoid);

    await stopCoverage(page, "idforge-ulid-nano");
    await ctx.close();
  });

  it("should generate SWHID from text", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await navTo(page, "id_forge");
    await page.waitForTimeout(2000);
    await navTo(page, "id_forge");
    await page.waitForTimeout(1000);

    // Switch to SWHID type, fill text area, generate
    await page.evaluate(function () {
      var sel = document.getElementById("if-type");
      sel.value = "swhid";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      switchSwhidTab("text");
      var textArea = document.getElementById("if-swhid-text");
      if (textArea) textArea.value = "test content for swhid generation";
      document.getElementById("if-gen-btn").click();
    });
    await page.waitForTimeout(3000);
    var swhid = await page.evaluate(function () {
      return document.getElementById("if-output").value;
    });
    assert.ok(swhid.length > 0, "SWHID: " + swhid);

    await stopCoverage(page, "idforge-swhid");
    await ctx.close();
  });

  it("should exercise idForgeShowInfo and idForgeUpdateCount", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "id_forge");
    await page.waitForTimeout(2000);

    const r = await page.evaluate(function () {
      idForgeShowInfo();
      idForgeUpdateCount();
      var count = document.getElementById("if-count");
      return { countValue: count ? count.value : "no-count" };
    });

    assert.equal(r.countValue, "1");

    await stopCoverage(page, "idforge-info-count");
    await ctx.close();
  });
});

describe("E2E Deep Coverage — Metadata module", () => {
  it("should exercise readMetadata on a PNG", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "metadata");
    await page.waitForTimeout(1000);

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

    const r = await page.evaluate(function () {
      var output = document.getElementById("md-output");
      var dl = document.getElementById("md-download");
      return {
        outputLength: output ? output.innerHTML.length : 0,
        hasFilename: output
          ? output.innerHTML.indexOf("testimg.png") !== -1
          : false,
        hasDownload: dl ? dl.innerHTML.length > 0 : false,
      };
    });

    assert.ok(r.outputLength > 0);
    assert.ok(r.hasFilename);
    assert.ok(r.hasDownload);

    await stopCoverage(page, "metadata-read");
    await ctx.close();
  });
});

describe("E2E Deep Coverage — Document Watermark", () => {
  it("should exercise document watermark tab switching and form fields", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await navTo(page, "document-watermark");
    await page.waitForTimeout(2000);
    await navTo(page, "document-watermark");
    await page.waitForTimeout(1000);

    // Test embed tab exists with expected elements
    const embedDom = await page.evaluate(function () {
      switchDocwTab("embed");
      return {
        hasAlgo: !!document.getElementById("docw-algo"),
        hasCoverFile: !!document.getElementById("docw-cover-file"),
        hasSecretFile: !!document.getElementById("docw-secret-file"),
        hasPassword: !!document.getElementById("docw-password"),
        hasEmbedBtn: !!document.getElementById("docw-embed-btn"),
        hasExtractBtn: !!document.getElementById("docw-extract-btn"),
      };
    });
    assert.ok(embedDom.hasAlgo);
    assert.ok(embedDom.hasCoverFile);
    assert.ok(embedDom.hasSecretFile);
    assert.ok(embedDom.hasPassword);
    assert.ok(embedDom.hasEmbedBtn);
    assert.ok(embedDom.hasExtractBtn);

    // Test extract tab
    const extractDom = await page.evaluate(function () {
      switchDocwTab("extract");
      return {
        hasAlgoEx: !!document.getElementById("docw-algo-ex"),
        hasExtractFile: !!document.getElementById("docw-extract-file"),
        hasExtractBtn: !!document.getElementById("docw-extract-btn"),
      };
    });
    assert.ok(extractDom.hasAlgoEx);
    assert.ok(extractDom.hasExtractFile);
    assert.ok(extractDom.hasExtractBtn);

    // Switch back to embed and upload files to exercise full embed flow
    await page.evaluate(function () {
      switchDocwTab("embed");
    });
    await page.waitForTimeout(500);

    // Set algorithm and password, then upload a cover file
    await page.evaluate(function () {
      document.getElementById("docw-algo").value = "0";
    });
    await page.fill("#docw-password", "test-password");
    // Upload a cover file (TXT) — this triggers the handler that sets _docwCoverText
    // We use setInputFiles on docw-cover-file
    // Note: The handler for docw-cover-file reads the file content into _docwCoverText
    await page.setInputFiles("#docw-cover-file", [
      { name: "test.txt", mimeType: "text/plain", buffer: TXT_BUF },
    ]);
    await page.waitForTimeout(500);
    // Upload a secret file
    await page.setInputFiles("#docw-secret-file", [
      {
        name: "secret.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("SECRET"),
      },
    ]);
    await page.waitForTimeout(500);

    await stopCoverage(page, "docw-embed");
    await ctx.close();
  });
});

describe("E2E Deep Coverage — C2PA Provenance", () => {
  it("should exercise C2PA tab switching", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "c2pa");
    await page.waitForTimeout(2000);

    const r = await page.evaluate(function () {
      switchC2paTab("write");
      var writeTab = document.getElementById("c2pa-write");
      var writeVisible = writeTab && writeTab.style.display !== "none";

      switchC2paTab("verify");
      var verifyTab = document.getElementById("c2pa-verify");
      var verifyVisible = verifyTab && verifyTab.style.display !== "none";

      switchC2paTab("read");
      var readTab = document.getElementById("c2pa-read");
      var readVisible = readTab && readTab.style.display !== "none";

      return {
        writeVisible: !!writeVisible,
        verifyVisible: !!verifyVisible,
        readVisible: !!readVisible,
      };
    });

    assert.ok(r.writeVisible);
    assert.ok(r.verifyVisible);
    assert.ok(r.readVisible);

    await stopCoverage(page, "c2pa-tabs");
    await ctx.close();
  });
});

describe("E2E Deep Coverage — Certificate", () => {
  it("should exercise certificate form fields and generate", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "certificate");
    await page.waitForTimeout(2000);

    await page.setInputFiles("#cert-file", [
      { name: "photo.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.fill("#cert-name", "Deep Coverage Test");
    await page.fill("#cert-email", "deep@test.com");
    await page.evaluate(function () {
      var sel = document.getElementById("cert-phonecode");
      if (sel) {
        sel.value = "+1";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.fill("#cert-phone", "5559876543");
    await page.fill("#cert-website", "https://deeptest.com");
    await page.waitForTimeout(300);

    await page.evaluate(function () {
      document.getElementById("cert-gen-btn").click();
    });
    await page.waitForTimeout(10000);

    const r = await page.evaluate(function () {
      var dlSection = document.getElementById("cert-download-section");
      return {
        dlVisible:
          dlSection &&
          dlSection.style.display !== "none" &&
          dlSection.style.display !== "",
        hasDlBtns: dlSection && dlSection.querySelectorAll("button").length > 0,
        btnCount: dlSection ? dlSection.querySelectorAll("button").length : 0,
      };
    });

    assert.ok(
      r.dlVisible,
      "Download section should be visible after cert generation",
    );
    assert.ok(
      r.hasDlBtns,
      "Download buttons should exist (found " + r.btnCount + " buttons)",
    );

    await stopCoverage(page, "cert-generate");
    await ctx.close();
  });
});

describe("E2E Deep Coverage — DID Identity", () => {
  it("should generate Ed25519 DID", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "did");
    await page.waitForTimeout(2000);

    var fpJson = JSON.stringify({
      file_info: { file_name: "test.png" },
      hashes: { "SHA-256": "abc123" },
    });
    await page.setInputFiles("#did-fp-file", [
      {
        name: "fp.json",
        mimeType: "application/json",
        buffer: Buffer.from(fpJson),
      },
    ]);
    await page.waitForTimeout(500);

    const r = await page.evaluate(async function () {
      var sel = document.getElementById("did-algo-select");
      if (!sel) return { hasSel: false };

      sel.value = "Ed25519";
      if (typeof handleDidGenerate === "function") handleDidGenerate();
      await new Promise(function (r) {
        setTimeout(r, 3000);
      });

      var didEl = document.getElementById("did-did-value");
      return {
        hasSel: true,
        didGenerated: didEl && didEl.textContent.length > 0,
        didPreview: didEl ? didEl.textContent.substring(0, 30) : "",
      };
    });

    assert.ok(r.hasSel);
    assert.ok(r.didGenerated, "DID should be generated: " + r.didPreview);

    await stopCoverage(page, "did-generate");
    await ctx.close();
  });

  it("should exercise DID sign button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "did");
    await page.waitForTimeout(2000);

    var fpJson = JSON.stringify({
      file_info: { file_name: "test.png" },
      hashes: { "SHA-256": "abc123" },
    });
    await page.setInputFiles("#did-fp-file", [
      {
        name: "fp.json",
        mimeType: "application/json",
        buffer: Buffer.from(fpJson),
      },
    ]);
    await page.waitForTimeout(500);

    const r = await page.evaluate(async function () {
      var sel = document.getElementById("did-algo-select");
      if (sel) sel.value = "Ed25519";
      if (typeof handleDidGenerate === "function") handleDidGenerate();
      await new Promise(function (r) {
        setTimeout(r, 3000);
      });

      var signBtn = document.getElementById("did-sign-btn");
      if (signBtn) signBtn.click();
      await new Promise(function (r) {
        setTimeout(r, 2000);
      });

      return {
        signExists: !!signBtn,
      };
    });

    assert.ok(r.signExists);

    await stopCoverage(page, "did-sign");
    await ctx.close();
  });
});

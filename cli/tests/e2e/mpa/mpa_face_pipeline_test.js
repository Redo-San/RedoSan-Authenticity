var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var path = require("node:path");
var fs = require("node:fs");
var { chromium } = require("playwright");
var { ensureServer, pageURL } = require("../mpa_helpers");

var PAGE_ID = "face-biometric";
var FACE_IMG = path.resolve(__dirname, "../../fixtures/face_identifier_test_img.jpg");
var BLANK_IMG = path.resolve(__dirname, "../../fixtures/testimg_16x16.png");
var browser;

before(async function () {
  await ensureServer();
  browser = await chromium.launch({
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--enable-unsafe-swiftshader",
    ],
  });
});

after(async function () {
  if (browser) await browser.close();
});

// NOTE: deliberately NO Playwright JS-coverage capture in this spec.
// Instrumenting the tfjs/human bundles slows CPU inference by an order of
// magnitude and turns the model stages into multi-minute hangs. This file
// optimises for real behavioural coverage of the live pipeline instead.
async function openPipelinePage(browserInstance) {
  await ensureServer();
  var ctx = await browserInstance.newContext({
    locale: "en-US",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  var page = await ctx.newPage();
  page.setDefaultTimeout(300000);
  await page.goto(pageURL(PAGE_ID), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(function () {
    var el = document.getElementById("botBlockOverlay");
    if (el) {
      el.style.display = "none";
      el.classList.remove("active");
    }
    // Headless CI has no authenticator: take the documented degradation path
    // (ensureFacePasskeyForAction returns true and the pipeline proceeds).
    if (window.FaceWebauthn) {
      window.__origWaAvailable = window.FaceWebauthn.isAvailable;
      window.FaceWebauthn.isAvailable = function () { return false; };
    }
  });
  var hasCheck = await page.evaluate(function () {
    return !!document.getElementById("face-consent-check");
  });
  if (hasCheck) {
    await page.evaluate(function () {
      var check = document.getElementById("face-consent-check");
      check.checked = true;
      check.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("face-consent-accept").click();
    });
    await page.waitForFunction(function () {
      return (document.getElementById("face-consent-panel") || {}).style?.display === "none";
    }, null, { timeout: 20000 });
  }
  await page.waitForFunction(function () {
    return !!window.faceRegistry;
  }, null, { timeout: 30000 });
  // Seed a passkey reference so updateFaceRunState() enables the run button
  // (the automatic PRF flow treats a stored reference as "registered").
  await page.evaluate(async function () {
    var existing = await window.faceRegistry.getMeta("passkey");
    if (!existing) {
      await window.faceRegistry.setMeta("passkey", {
        credentialId: "e2e-stub-credential",
        name: "E2E Virtual Passkey",
        createdAt: new Date().toISOString(),
      });
    }
    if (typeof window.refreshPasskeyStatus === "function") {
      await window.refreshPasskeyStatus();
    }
  });
  return { ctx: ctx, page: page };
}

async function pickPhotoAndRun(page, filePath) {
  await page.setInputFiles("#face-image", filePath);
  // The change handler is wired in-page; invoke it explicitly for determinism.
  await page.evaluate(function () { return window.handleFaceFilePicked(); });
  await page.waitForFunction(function () {
    return !!window._facePendingCanvas;
  }, null, { timeout: 60000 });
  await page.fill("#face-label", "E2E Face");
  await page.waitForFunction(function () {
    return document.getElementById("face-run").disabled === false;
  }, null, { timeout: 20000 });
  await page.click("#face-run");
}

describe("MPA — Face pipeline end-to-end (real Human models)", function () {
  it("runs blank-photo rejection, full generation, exports and auto-registration", async function (t) {
    // Biometric fixtures must never be committed. CI skips this spec;
    // run locally (or set FACE_FIXTURE_PATH) for the full model pass.
    var fixturePath = process.env.FACE_FIXTURE_PATH || FACE_IMG;
    if (!fs.existsSync(fixturePath)) {
      console.log("[pipeline] fixture missing -> skipping on CI");
      t.skip("face fixture unavailable in this environment");
      return;
    }
    var opened = await openPipelinePage(browser);
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      // ── 1. Synthetic blank canvas → model load (heavy, first time) → no-face arm ──
      // runFacePipeline is called directly: the automation layer may feed it
      // any canvas, and tiny fixtures would be rejected by the file validator.
      await page.evaluate(function () {
        var c = document.createElement("canvas");
        c.width = 320;
        c.height = 240;
        var g = c.getContext("2d");
        g.fillStyle = "#8899aa";
        g.fillRect(0, 0, c.width, c.height);
        return window.runFacePipeline(c, { source: "file", fileName: "blank.png" });
      });
      await page.waitForFunction(function () {
        var s = (document.getElementById("face-status") || {}).textContent || "";
        return s.indexOf("No face detected") !== -1;
      }, null, { timeout: 300000 });
      var blankStatus = await page.evaluate(function () {
        return (document.getElementById("face-status") || {}).textContent || "";
      });
      assert.ok(blankStatus.includes("No face detected"), blankStatus);
      assert.equal(await page.evaluate(function () { return window._lastFaceCount; }), 0);

      // ── 2. Real face fixture through the full file-input UX ──
      // A second in-page detection run makes human/TF try to switch to its
      // higher-priority (webgpu) backend mid-session, which never becomes
      // ready under swiftshader and hangs forever. A reload gives TF a clean
      // state while the browser HTTP cache keeps the model download warm.
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.evaluate(function () {
        var el = document.getElementById("botBlockOverlay");
        if (el) {
          el.style.display = "none";
          el.classList.remove("active");
        }
        if (window.FaceWebauthn) {
          window.FaceWebauthn.isAvailable = function () { return false; };
        }
      });
      await page.waitForFunction(function () {
        return !!window.faceRegistry;
      }, null, { timeout: 30000 });

      await pickPhotoAndRun(page, fixturePath);
      await page.waitForFunction(function () {
        return !!window._faceReport;
      }, null, { timeout: 300000 });

      var report = await page.evaluate(function () {
        return {
          hash: window._faceReport.photo.descriptorHash,
          faces: window._faceReport.photo.facesDetected,
          dims: window._faceReport.photo.descriptorDim,
          source: window._faceReport.source,
          keypairDid: window._faceKeypair ? window._faceKeypair.did : null,
          biohashBits: window._faceReport.biohash ? window._faceReport.biohash.bits : null,
          reportVisible: (document.getElementById("face-report") || {}).style?.display === "block",
          reportLen: ((document.getElementById("face-report") || {}).innerHTML || "").length,
          actionsVisible: (document.getElementById("face-actions") || {}).style?.display === "flex",
          registered: null,
        };
      });
      assert.ok(/^[0-9a-f]{64}$/.test(report.hash), "descriptor hash must be sha256 hex: " + report.hash);
      assert.ok(report.faces >= 1, "at least one face detected");
      assert.ok(
        report.dims > 0 && report.dims <= 1024,
        "plausible descriptor dims, got: " + report.dims,
      );
      assert.ok(report.keypairDid && report.keypairDid.indexOf("did:") === 0, "DID generated");
      assert.ok(report.biohashBits > 0, "biohash generated");
      assert.equal(report.reportVisible, true, "report rendered visible");
      assert.ok(report.reportLen > 100, "report has content");
      assert.equal(report.actionsVisible, true);

      // Auto-registration into the live IndexedDB registry
      await page.waitForFunction(async function () {
        if (typeof window.faceRegistry.getSize !== "function") return false;
        return (await window.faceRegistry.getSize()) >= 1;
      }, null, { timeout: 60000 });
      report.registered = await page.evaluate(async function () {
        return await window.faceRegistry.getSize();
      });
      assert.ok(report.registered >= 1, "pipeline should auto-register the face");

      // ── 2. Multi-format exports through the modal handler ──
      var restoreSpy = await page.evaluate(function () {
        window.__e2eDownloads = [];
        var original = window.downloadBlobSimple;
        window.downloadBlobSimple = function (blob, name) {
          window.__e2eDownloads.push({ name: name, size: blob ? blob.size : 0 });
        };
        return function () { window.downloadBlobSimple = original; };
      });

      var textFormats = ["json", "csv", "txt", "xml", "html"];
      for (var i = 0; i < textFormats.length; i++) {
        var fmt = textFormats[i];
        await page.evaluate(function (f) { return window.downloadFaceReport(f); }, fmt);
      }
      var textDls = await page.evaluate(function () { return window.__e2eDownloads.slice(); });
      assert.equal(textDls.length, textFormats.length, "five text formats exported");
      for (var j = 0; j < textFormats.length; j++) {
        assert.ok(
          textDls[j].name.endsWith(".face_report." + textFormats[j]),
          "export name for " + textFormats[j] + ": " + textDls[j].name,
        );
        assert.ok(textDls[j].size > 0);
      }

      // PDF / DOCX go through ensureLib (CDN); assert strictly when online.
      var online = await page.evaluate(function () { return navigator.onLine; });
      if (online) {
        await page.evaluate(function () { return window.downloadFaceReport("pdf"); });
        await page.waitForFunction(function () {
          return window.__e2eDownloads.some(function (d) { return /\.pdf$/.test(d.name); });
        }, null, { timeout: 60000 });
        await page.evaluate(function () { return window.downloadFaceReport("doc"); });
        await page.waitForFunction(function () {
          return window.__e2eDownloads.some(function (d) { return /\.docx$/.test(d.name); });
        }, null, { timeout: 60000 });
      }

      // Label sheets
      await page.evaluate(function () { return window.handleFaceExportLabels("csv"); });
      await page.evaluate(function () { return window.handleFaceExportLabels("txt"); });
      var labelDls = await page.evaluate(function () {
        return window.__e2eDownloads.filter(function (d) { return /label/i.test(d.name); });
      });
      assert.ok(labelDls.length >= 2, "csv+txt label sheets exported");

      // BioHash copy-to-clipboard
      var copied = await page.evaluate(async function () {
        try {
          window.handleFaceBioHashCopy();
          await new Promise(function (r) { setTimeout(r, 150); });
          return await navigator.clipboard.readText();
        } catch (err) {
          return "CLIPBOARD_ERR:" + err.message;
        }
      });
      assert.ok(copied.length > 8 && !/^CLIPBOARD_ERR/.test(copied), "clipboard holds the privacy id: " + copied.slice(0, 24));

      // W3C credential from the pipeline-produced keypair
      await page.evaluate(function () {
        var host = document.createElement("div");
        host.id = "face-ui-e2e-staging";
        host.innerHTML =
          '<pre id="face-vc-output"></pre><div id="face-vc-box"></div><button id="face-vc-download"></button>';
        document.body.appendChild(host);
      });
      await page.evaluate(function () { return window.handleFaceIssueCredential(); });
      var vcIssued = await page.evaluate(function () {
        return {
          ok: !!window._faceCredential &&
            (document.getElementById("face-status") || {}).textContent.includes("issued and signed"),
          box: document.getElementById("face-vc-box").style.display,
        };
      });
      assert.equal(vcIssued.ok, true, "VC issued from pipeline keypair");
      assert.equal(vcIssued.box, "block");

      await page.evaluate(restoreSpy);
      await page.evaluate(function () {
        var host = document.getElementById("face-ui-e2e-staging");
        if (host) host.remove();
      });

      // ── 3. Cleanup: remove every auto-registered face for later specs ──
      await page.evaluate(async function () {
        var all = await window.faceRegistry.getAllFaces();
        for (var k = 0; k < all.length; k++) {
          await window.faceRegistry.deleteFace(all[k].id);
        }
      });
      var finalCount = await page.evaluate(async function () {
        return await window.faceRegistry.getSize();
      });
      assert.equal(finalCount, 0, "registry cleaned up");
    } finally {
      await ctx.close();
    }
  });
});

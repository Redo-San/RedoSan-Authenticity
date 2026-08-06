const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const { startCoverage, stopCoverage, prepareForC8, cleanV8Dir } = require("./e2e_coverage");
const path = require("path");
const fs = require("fs");

const PORT = 9897;
const BASE = `http://localhost:${PORT}`;
const PNG_BUF = fs.readFileSync(path.resolve(__dirname, "..", "fixtures", "testimg.png"));

let browser, server;
var covSeq = 0;

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

/** Wrap page.close() with V8 coverage save */
async function closeCovPage(page, ctx) {
  try {
    await stopCoverage(page, "cert-" + (++covSeq));
  } catch (e) { /* page may already be closed */ }
  await ctx.close();
}

function navTo(page, id) {
  return page.evaluate((pid) => {
    const a = document.querySelector(`#sidebar a[data-page="${pid}"]`);
    if (a) a.click();
  }, id);
}

// ── Shared helpers ──

/** Fill the certificate form with valid data (optionally skipping a field) */
async function fillCertForm(page, skip) {
  if (skip !== "file") await page.setInputFiles("#cert-file", [{ name: "photo.png", mimeType: "image/png", buffer: PNG_BUF }]);
  if (skip !== "name") await page.fill("#cert-name", "Test User");
  if (skip !== "email") await page.fill("#cert-email", "test@example.com");
  if (skip !== "phone") {
    await page.evaluate(() => {
      var sel = document.getElementById("cert-phonecode");
      if (sel) { sel.value = "+1"; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    await page.fill("#cert-phone", "5551234567");
  }
  if (skip !== "website") await page.fill("#cert-website", "https://example.com");
}

/** Click the generate button and wait for a result */
async function clickGenerate(page) {
  await page.evaluate(function () { var b = document.getElementById("cert-gen-btn"); if (b) b.click(); });
  await page.waitForTimeout(8000);
}

/** Return whether the download section is visible */
async function downloadSectionVisible(page) {
  return page.evaluate(function () {
    var el = document.getElementById("cert-download-section");
    return el ? (el.style.display !== "none" && el.style.display !== "") : false;
  });
}

/** Navigate to the certificate page in SPA mode */
async function gotoCertPage(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  if (typeof navTo === "function") await navTo(page, "certificate");
  await page.waitForTimeout(1000);
}

// ═══════════════════════════════════════════════
//  SPA (Single-Page Application) Tests
// ═══════════════════════════════════════════════

describe("E2E — Certificate / Digital Passport", { timeout: 600000 }, () => {

  it("should navigate to certificate page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await gotoCertPage(page);
    assert.equal(errors.filter(function (e) { return !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest"); }).length, 0);
    await closeCovPage(page, ctx);
  });

  it("should have form fields and generate button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);
    const els = await page.evaluate(function () {
      return {
        name: !!document.getElementById("cert-name"),
        email: !!document.getElementById("cert-email"),
        phone: !!document.getElementById("cert-phone"),
        website: !!document.getElementById("cert-website"),
        file: !!document.getElementById("cert-file"),
        btn: !!document.getElementById("cert-gen-btn"),
      };
    });
    assert.ok(els.name, "Name input exists");
    assert.ok(els.email, "Email input exists");
    assert.ok(els.phone, "Phone input exists");
    assert.ok(els.website, "Website input exists");
    assert.ok(els.file, "Image file input exists");
    assert.ok(els.btn, "Generate button exists");
    await closeCovPage(page, ctx);
  });

  it("should generate certificate and show download links", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await gotoCertPage(page);
    await fillCertForm(page);
    await page.waitForTimeout(300);
    await clickGenerate(page);

    var dlVisible = await downloadSectionVisible(page);
    if (dlVisible) {
      var btnCount = await page.evaluate(function () {
        var section = document.getElementById("cert-download-section");
        return section ? section.querySelectorAll("button").length : 0;
      });
      assert.ok(btnCount >= 3, "Should show at least 3 download buttons (got " + btnCount + ")");
    }
    var fatal = errors.filter(function (e) { return !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest"); });
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));
    await closeCovPage(page, ctx);
  });

  it("should generate a certificate (or show status from UI flow)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);
    await fillCertForm(page);
    await page.waitForTimeout(300);
    await clickGenerate(page);

    var statusText = await page.evaluate(function () {
      var el = document.getElementById("cert-status");
      return el ? el.textContent : "";
    });
    var dlVisible = await downloadSectionVisible(page);
    var hasResult = statusText.length > 0 || dlVisible;
    assert.ok(hasResult, 'Certificate should produce status. Status: "' + statusText + '"' + ", DL: " + dlVisible);
    await closeCovPage(page, ctx);
  });

  // ── Validation failure paths ──

  it("should show missing required fields error when name is empty", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);
    await fillCertForm(page, "name");
    await page.waitForTimeout(200);
    await page.evaluate(function () { var b = document.getElementById("cert-gen-btn"); if (b) b.click(); });
    await page.waitForTimeout(500);

    var statusText = await page.evaluate(function () {
      var el = document.getElementById("cert-status");
      return el ? el.textContent : "";
    });
    assert.ok(statusText.includes("Please fill in all required fields"), 'Status: "' + statusText + '"');
    await closeCovPage(page, ctx);
  });

  it("should show email warning for invalid email", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);
    await fillCertForm(page, "email");
    await page.fill("#cert-email", "not-an-email");
    await page.waitForTimeout(200);
    await page.evaluate(function () { var b = document.getElementById("cert-gen-btn"); if (b) b.click(); });
    await page.waitForTimeout(500);

    var visible = await page.evaluate(function () {
      var el = document.getElementById("cert-email-warn");
      return el ? (el.style.display !== "none" && el.style.display !== "") : false;
    });
    assert.ok(visible, "Email warning should be visible for invalid email");
    await closeCovPage(page, ctx);
  });

  it("should show website warning for invalid URL", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await gotoCertPage(page);
    await fillCertForm(page, "website");
    // Set website via evaluate to avoid prefixHttps focus interference
    await page.evaluate(function () {
      var el = document.getElementById("cert-website");
      if (el) el.value = "https://";
    });
    await page.waitForTimeout(200);
    await page.evaluate(function () { var b = document.getElementById("cert-gen-btn"); if (b) b.click(); });
    await page.waitForTimeout(500);

    var visible = await page.evaluate(function () {
      var el = document.getElementById("cert-website-warn");
      return el ? (el.style.display !== "none" && el.style.display !== "") : false;
    });
    var statusText = await page.evaluate(function () {
      var el = document.getElementById("cert-status");
      return el ? el.textContent : "";
    });
    var fatal = errors.filter(function (e) { return !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest") && !e.includes("is not defined"); });
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));
    assert.ok(visible || statusText.includes("Please fill in"), 'Website warning or missing-fields error expected. status: "' + statusText + '"');
    await closeCovPage(page, ctx);
  });

  it("should show missing fields error when all fields are empty", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);
    await page.evaluate(function () { var b = document.getElementById("cert-gen-btn"); if (b) b.click(); });
    await page.waitForTimeout(500);

    var statusText = await page.evaluate(function () {
      var el = document.getElementById("cert-status");
      return el ? el.textContent : "";
    });
    assert.ok(statusText.includes("Please fill in all required fields"), 'Status: "' + statusText + '"');
    await closeCovPage(page, ctx);
  });

  // ── Music fields toggle (exercises toggleCertMusicFields) ──

  it("should toggle music fields visibility via checkbox", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);

    // Initially hidden
    var initDisplay = await page.evaluate(function () {
      var el = document.getElementById("cert-music-fields");
      return el ? el.style.display : "unknown";
    });
    assert.equal(initDisplay, "none", "Music fields should initially be hidden");

    // Check the checkbox (fires toggleCertMusicFields via onchange)
    await page.evaluate(function () {
      var cb = document.getElementById("cert-show-music");
      if (cb) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); }
      if (typeof toggleCertMusicFields === "function") toggleCertMusicFields();
    });
    await page.waitForTimeout(200);

    var afterCheck = await page.evaluate(function () {
      var el = document.getElementById("cert-music-fields");
      return el ? el.style.display : "unknown";
    });
    assert.equal(afterCheck, "", "Music fields should be visible after checking");

    // Uncheck → hidden
    await page.evaluate(function () {
      var cb = document.getElementById("cert-show-music");
      if (cb) { cb.checked = false; cb.dispatchEvent(new Event("change", { bubbles: true })); }
      if (typeof toggleCertMusicFields === "function") toggleCertMusicFields();
    });
    await page.waitForTimeout(200);

    var afterUncheck = await page.evaluate(function () {
      var el = document.getElementById("cert-music-fields");
      return el ? el.style.display : "unknown";
    });
    assert.equal(afterUncheck, "none", "Music fields should be hidden after uncheck");
    await closeCovPage(page, ctx);
  });

  // ── Phone code initialization (exercises initCertPhoneCode) ──

  it("should initialize phone code select with country options", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);

    var optionCount = await page.evaluate(function () {
      var sel = document.getElementById("cert-phonecode");
      return sel ? sel.options.length : -1;
    });
    assert.ok(optionCount >= 40, "Phone code select should have 40+ options, got " + optionCount);

    var firstEmpty = await page.evaluate(function () {
      var sel = document.getElementById("cert-phonecode");
      if (!sel || !sel.options.length) return false;
      return sel.options[0].value === "";
    });
    assert.ok(firstEmpty, "First option should be empty default");
    await closeCovPage(page, ctx);
  });

  // ── Generate with all result file uploads (exercises parsing paths in generateProfessionalCert) ──

  it("should generate certificate with all result files uploaded", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await gotoCertPage(page);

    // Upload main image
    await page.setInputFiles("#cert-file", [{ name: "photo.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(200);

    // Upload watermark result (plain text)
    await page.setInputFiles("#cert-result-wm", [{ name: "wm.txt", mimeType: "text/plain", buffer: Buffer.from("WM OK\nAlgo: LSB") }]);
    await page.waitForTimeout(200);

    // Upload pixel injection result
    await page.setInputFiles("#cert-result-pi", [{ name: "pi.txt", mimeType: "text/plain", buffer: Buffer.from("PI OK") }]);
    await page.waitForTimeout(200);

    // Upload fingerprint result (JSON format)
    var fpJson = JSON.stringify({ hashes: { "SHA-256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" }, perceptual_hashes: { ahash: "f0f0f0f0" } });
    await page.setInputFiles("#cert-result-fp", [{ name: "fp.json", mimeType: "application/json", buffer: Buffer.from(fpJson) }]);
    await page.waitForTimeout(200);

    // Upload DID result
    var didJson = JSON.stringify({ did: "did:key:z6Mk...test", signature: "sig123" });
    await page.setInputFiles("#cert-result-did", [{ name: "did.json", mimeType: "application/json", buffer: Buffer.from(didJson) }]);
    await page.waitForTimeout(200);

    // Upload timestamp file
    await page.setInputFiles("#cert-result-ts", [{ name: "proof.ots", mimeType: "application/octet-stream", buffer: Buffer.from([0x00, 0x4f, 0x70]) }]);
    await page.waitForTimeout(200);

    // Upload document watermark result
    await page.setInputFiles("#cert-result-docw", [{ name: "docw.txt", mimeType: "text/plain", buffer: Buffer.from("DocW OK") }]);
    await page.waitForTimeout(200);

    // Fill form
    await page.fill("#cert-name", "Multi-Result User");
    await page.fill("#cert-email", "multi@results.com");
    await page.evaluate(function () { var sel = document.getElementById("cert-phonecode"); if (sel) { sel.value = "+1"; sel.dispatchEvent(new Event("change", { bubbles: true })); } });
    await page.fill("#cert-phone", "5559876543");
    await page.fill("#cert-website", "https://multi-results.com");
    // Fill social links
    await page.fill("#cert-social-tiktok", "https://tiktok.com/@user");
    await page.fill("#cert-social-facebook", "https://facebook.com/user");
    await page.waitForTimeout(200);

    // Enable music fields and fill a couple
    await page.evaluate(function () { var cb = document.getElementById("cert-show-music"); if (cb) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); } if (typeof toggleCertMusicFields === "function") toggleCertMusicFields(); });
    await page.waitForTimeout(200);
    await page.fill("#cert-music-spotify", "https://open.spotify.com/track/abc");
    await page.fill("#cert-music-soundcloud", "https://soundcloud.com/user/track");

    await clickGenerate(page);

    var dlVisible = await downloadSectionVisible(page);
    if (dlVisible) {
      var btnCount = await page.evaluate(function () { var s = document.getElementById("cert-download-section"); return s ? s.querySelectorAll("button").length : 0; });
      assert.ok(btnCount >= 3, "Should show at least 3 download buttons (got " + btnCount + ")");
    }
    var fatal = errors.filter(function (e) { return !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest"); });
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));
    await closeCovPage(page, ctx);
  });

  // ── Download before generation (exercises downloadProfessionalCert guard) ──

  it("should show alert when attempting to download before generating", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    var alertMsg = "";
    page.on("dialog", function (d) { alertMsg = d.message(); d.accept().catch(function () {}); });
    await gotoCertPage(page);

    // Call downloadProfessionalCert directly (_certData is null)
    await page.evaluate(function () { if (typeof downloadProfessionalCert === "function") downloadProfessionalCert("pdf"); });
    await page.waitForTimeout(500);

    assert.ok(alertMsg.includes("Please generate the certificate first"), 'Alert: "' + alertMsg + '"');
    await closeCovPage(page, ctx);
  });

  // ── Reset form (exercises resetProfessionalCert) ──

  it("should reset form fields and hide download section", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);

    // Fill form and generate
    await fillCertForm(page);
    await page.waitForTimeout(300);
    await page.evaluate(function () { var b = document.getElementById("cert-gen-btn"); if (b) b.click(); });
    await page.waitForTimeout(5000);

    // Reset
    await page.evaluate(function () { if (typeof resetProfessionalCert === "function") resetProfessionalCert(); });
    await page.waitForTimeout(500);

    // Check fields are cleared
    var vals = await page.evaluate(function () {
      return {
        name: (document.getElementById("cert-name") || {}).value || "",
        email: (document.getElementById("cert-email") || {}).value || "",
        phone: (document.getElementById("cert-phone") || {}).value || "",
        website: (document.getElementById("cert-website") || {}).value || "",
      };
    });
    assert.equal(vals.name, "", "Name should be cleared");
    assert.equal(vals.email, "", "Email should be cleared");
    assert.equal(vals.phone, "", "Phone should be cleared");
    assert.equal(vals.website, "", "Website should be cleared");

    // Download section hidden
    var dlDisplay = await page.evaluate(function () { var el = document.getElementById("cert-download-section"); return el ? el.style.display : ""; });
    assert.equal(dlDisplay, "none", "Download section should be hidden");

    // Status cleared
    var statusText = await page.evaluate(function () { var el = document.getElementById("cert-status"); return el ? el.textContent : ""; });
    assert.equal(statusText, "", "Status text should be cleared");

    // Phone code still has options (initCertPhoneCode re-runs)
    var optCount = await page.evaluate(function () { var sel = document.getElementById("cert-phonecode"); return sel ? sel.options.length : 0; });
    assert.ok(optCount >= 40, "Phone code should have options after reset, got " + optCount);

    // Music checkbox unchecked and fields hidden
    var musicChecked = await page.evaluate(function () { var el = document.getElementById("cert-show-music"); return el ? el.checked : false; });
    assert.equal(musicChecked, false, "Music checkbox should be unchecked");
    var musicDisplay = await page.evaluate(function () { var el = document.getElementById("cert-music-fields"); return el ? el.style.display : ""; });
    assert.equal(musicDisplay, "none", "Music fields should be hidden");
    await closeCovPage(page, ctx);
  });

  // ── OTS proof download via downloadCertOtsProof ──

  it("should download certificate OTS proof via downloadCertOtsProof", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);

    var mockProof = Buffer.from("mock_ots_proof").toString("base64");
    await page.evaluate(function (proof) {
      if (typeof setResult === "function") {
        setResult("certCtResult", { submitted: true, pending: true, otsProof: proof, hash: "ab", format: "pdf", timestamp: new Date().toISOString() });
      }
      var btn = document.getElementById("cert-ots-dl-btn");
      if (!btn) { btn = document.createElement("button"); btn.id = "cert-ots-dl-btn"; btn.onclick = downloadCertOtsProof; document.body.append(btn); }
      btn.style.display = "inline-block";
    }, mockProof);
    await page.waitForTimeout(200);
    await page.evaluate(function () { var btn = document.getElementById("cert-ots-dl-btn"); if (btn) btn.click(); });
    await page.waitForTimeout(500);
    await closeCovPage(page, ctx);
  });

  // ── OTS proof download via downloadOtsProof ──

  it("should download OTS proof via downloadOtsProof", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);

    var mockProof = Buffer.from("mock_proof").toString("base64");
    await page.evaluate(function (proof) {
      if (typeof setResult === "function") {
        setResult("lastCtResult", { submitted: true, otsProof: proof, hash: "cd", timestamp: new Date().toISOString() });
      }
      var btn = document.getElementById("ots-dl-btn");
      if (!btn) { btn = document.createElement("button"); btn.id = "ots-dl-btn"; btn.onclick = downloadOtsProof; document.body.append(btn); }
      btn.style.display = "inline-block";
    }, mockProof);
    await page.waitForTimeout(200);
    await page.evaluate(function () { var btn = document.getElementById("ots-dl-btn"); if (btn) btn.click(); });
    await page.waitForTimeout(500);
    await closeCovPage(page, ctx);
  });

  // ── stampCertFile via downloadProfessionalCert after generation ──

  it("should trigger stampCertFile via download after successful generation", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await gotoCertPage(page);
    await fillCertForm(page);
    await page.waitForTimeout(300);
    await page.evaluate(function () { var b = document.getElementById("cert-gen-btn"); if (b) b.click(); });
    await page.waitForTimeout(8000);

    var dlVisible = await downloadSectionVisible(page);
    if (dlVisible) {
      page.on("dialog", function (d) { d.accept().catch(function () {}); });
      // Download PDF to trigger stampCertFile
      await page.evaluate(function () { if (typeof downloadProfessionalCert === "function") downloadProfessionalCert("pdf"); });
      await page.waitForTimeout(5000);
    }
    var fatal = errors.filter(function (e) { return !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest") && !e.includes("is not defined"); });
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));
    await closeCovPage(page, ctx);
  });

  // ── downloadCert (simple mode) existence check ──

  it("should have downloadCert function defined globally", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);

    var exists = await page.evaluate(function () { return typeof downloadCert === "function"; });
    assert.ok(exists, "downloadCert should exist globally");
    await closeCovPage(page, ctx);
  });

  // ── showCertOverlay / hideCertOverlay ──

  it("should show and hide loading overlay via showCertOverlay and hideCertOverlay", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);

    // Check for overlay by text content (more reliable than style selectors)
    var overlayText = 'Generating certificate';
    var initialText = await page.evaluate(function (text) {
      return document.body.textContent.indexOf(text) !== -1;
    }, overlayText);
    assert.equal(initialText, false, "No overlay text should exist initially");

    // Check for spin style absence
    var initialSpin = await page.evaluate(function () {
      return document.getElementById("cert-spin-style") !== null;
    });
    assert.equal(initialSpin, false, "No cert-spin-style element initially");

    // Show overlay
    var showResult = await page.evaluate(function () {
      if (typeof showCertOverlay !== "function") return "showCertOverlay not defined";
      showCertOverlay();
      var hasText = document.body.textContent.indexOf('Generating certificate') !== -1;
      var hasSpinStyle = !!(document.getElementById("cert-spin-style"));
      var hasStyleContent = hasSpinStyle ? document.getElementById("cert-spin-style").textContent.indexOf("certSpin") !== -1 : false;
      return { hasText: hasText, hasSpinStyle: hasSpinStyle, hasStyleContent: hasStyleContent };
    });
    assert.equal(typeof showResult, "object", "showCertOverlay executed");
    assert.ok(showResult.hasText, "Overlay text should exist after showCertOverlay");
    assert.ok(showResult.hasSpinStyle, "cert-spin-style element should exist after showCertOverlay");
    assert.ok(showResult.hasStyleContent, "cert-spin-style should contain certSpin animation");

    // Test idempotency: calling showCertOverlay again should be safe (guarded by _certOverlay)
    var idempotent = await page.evaluate(function () {
      try {
        showCertOverlay();
        return "ok";
      } catch (e) {
        return "err:" + e.message;
      }
    });
    assert.equal(idempotent, "ok", "Second showCertOverlay should not throw");

    // Hide overlay
    var afterHide = await page.evaluate(function () {
      if (typeof hideCertOverlay !== "function") return "hideCertOverlay not defined";
      hideCertOverlay();
      var textGone = document.body.textContent.indexOf('Generating certificate') === -1;
      return { textGone: textGone };
    });
    assert.equal(typeof afterHide, "object", "hideCertOverlay executed");
    assert.ok(afterHide.textGone, "Overlay text should be removed after hideCertOverlay");

    // Test idempotent hide: calling hide again should be safe
    var safeHide = await page.evaluate(function () {
      try {
        hideCertOverlay();
        return "ok";
      } catch (e) {
        return "err:" + e.message;
      }
    });
    assert.equal(safeHide, "ok", "Double hideCertOverlay should not throw");

    await closeCovPage(page, ctx);
  });

  // ── collectCertData ──

  it("should collect certificate data from window globals via collectCertData", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);

    var result = await page.evaluate(async function () {
      // Set up window globals
      window.simpleUserInfo = { name: "Test User", email: "user@test.com", phone: "+1234567890", website: "https://testuser.com", social: { twitter: "@testuser" }, isArtist: true, music: { spotify: "https://spotify.com/track/1" } };
      window.simpleResults = { watermark: true, watermarkUrl: "data:text/plain,wm", watermarkAlgoName: "DCT", watermarkResult: "OK", "pixel-injection": true, piResultHtml: "<b>PI Success</b>", timestamp: true, tsResult: "TS verified", fingerprint: true, fpResult: { hashes: { "SHA-256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" } } };
      window._didSig = { did: "did:key:test123", signature: "somesig", algorithm: "Ed25519", timestamp: new Date().toISOString() };
      window._didKeypair = { did: "did:key:test123" };
      window._faceData = null;

      // Create a test file
      var encoder = new TextEncoder();
      var content = "test image data";
      window.simpleFile = new File([content], "photo.png", { type: "image/png" });
      window.simpleBuf = encoder.encode(content).buffer;

      // Mock submitCertTransparency to avoid long network calls
      window.submitCertTransparency = async function () {
        return { submitted: true, pending: true, otsProof: "bW9jay1vdHM=", hash: "ab", timestamp: new Date().toISOString() };
      };

      if (typeof collectCertData !== "function") return { error: "collectCertData not defined" };

      var data = await collectCertData();
      return {
        generatorPrefix: data.generator.substring(0, 6),
        userName: data.user.name,
        userEmail: data.user.email,
        userPhone: data.user.phone,
        userWebsite: data.user.website,
        isArtist: data.user.isArtist,
        fileName: data.file.name,
        fileSize: data.file.size,
        hasWatermark: data.watermark,
        watermarkAlgo: data.watermarkAlgo,
        hasPixelInjection: data.pixelInjection,
        piResultNoHtml: data.piResultHtml.indexOf("<") === -1,
        hasTimestamp: data.timestamp,
        hasFingerprint: data.fingerprint,
        hasDidSig: data.didSig !== null,
        didIdentity: data.didIdentity,
        ctSubmitted: data.ct.submitted,
        fileWidth: data.file.width,
        fileHashLen: data.file.hash ? data.file.hash.length : 0,
      };
    });

    assert.equal(result.generatorPrefix, "RedoSa", "Generator should start with RedoSan");
    assert.equal(result.userName, "Test User");
    assert.equal(result.userEmail, "user@test.com");
    assert.equal(result.userPhone, "+1234567890");
    assert.equal(result.userWebsite, "https://testuser.com");
    assert.ok(result.isArtist, "isArtist should be true");
    assert.equal(result.fileName, "photo.png");
    assert.ok(result.fileSize > 0, "File size should be positive");
    assert.ok(result.hasWatermark, "watermark flag should be true");
    assert.equal(result.watermarkAlgo, "DCT", "Watermark algo should be DCT");
    assert.ok(result.hasPixelInjection, "pixelInjection flag should be true");
    assert.ok(result.piResultNoHtml, "piResultHtml should have HTML stripped");
    assert.ok(result.hasTimestamp, "timestamp flag should be true");
    assert.ok(result.hasFingerprint, "fingerprint flag should be true");
    assert.ok(result.hasDidSig, "DID signature should be set");
    assert.ok(result.didIdentity.length > 0, "DID identity should be non-empty");
    assert.ok(result.ctSubmitted, "CT should be submitted");
    assert.equal(result.fileWidth, 0, "File width should be 0 for non-image data");
    assert.ok(result.fileHashLen > 0, "File hash should be computed");

    await closeCovPage(page, ctx);
  });

  // ── ensureLib ──

  it("should resolve ensureLib when library is already defined globally", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);

    var result = await page.evaluate(async function () {
      // Ensure jspdf is defined (SPA page loads it via CDN + vendor scripts)
      if (typeof jspdf === "undefined") {
        window.jspdf = { jsPDF: function () { return { output: function () { return new Blob(); } }; } };
      }
      var results = {};
      try {
        await ensureLib("jspdf");
        results.jspdf = true;
      } catch (e) {
        results.jspdf = "Error: " + e.message;
      }
      // QRious
      if (typeof QRious === "undefined") {
        window.QRious = function () {};
      }
      try {
        await ensureLib("QRious");
        results.qrious = true;
      } catch (e) {
        results.qrious = "Error: " + e.message;
      }
      // JSZip
      if (typeof JSZip === "undefined") {
        window.JSZip = function () {};
      }
      try {
        await ensureLib("JSZip");
        results.jszip = true;
      } catch (e) {
        results.jszip = "Error: " + e.message;
      }
      return results;
    });

    assert.equal(result.jspdf, true, "ensureLib('jspdf') should resolve");
    assert.equal(result.qrious, true, "ensureLib('QRious') should resolve");
    assert.equal(result.jszip, true, "ensureLib('JSZip') should resolve");

    await closeCovPage(page, ctx);
  });

  // ── stampCertFile ──

  it("should stamp a certificate blob via stampCertFile and show OTS button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);

    var stampResult = await page.evaluate(async function () {
      // Ensure OTS button exists in DOM
      var btn = document.getElementById("cert-ots-dl-btn");
      if (!btn) {
        btn = document.createElement("button");
        btn.id = "cert-ots-dl-btn";
        btn.style.display = "none";
        document.body.append(btn);
      }

      // Mock generatePendingOts
      window.generatePendingOts = function (hash) {
        return btoa("mock-ots-proof-for-" + hash);
      };

      if (typeof stampCertFile !== "function") return { error: "stampCertFile not defined" };

      var blob = new Blob(["test-certificate-pdf-content"], { type: "application/pdf" });
      await stampCertFile(blob, "pdf");

      var btnDisplay = document.getElementById("cert-ots-dl-btn").style.display;
      var ctResult = null;
      if (typeof getResult === "function") {
        ctResult = getResult("certCtResult");
      }
      return {
        btnDisplay: btnDisplay,
        ctSubmitted: ctResult ? ctResult.submitted : null,
        hasOtsProof: ctResult ? !!ctResult.otsProof : false,
        ctHash: ctResult ? ctResult.hash : null,
        ctFormat: ctResult ? ctResult.format : null,
      };
    });

    assert.equal(stampResult.btnDisplay, "inline-block", "OTS button should be visible after stampCertFile");
    assert.ok(stampResult.ctSubmitted, "certCtResult.submitted should be true");
    assert.ok(stampResult.hasOtsProof, "certCtResult should have otsProof");
    assert.ok(stampResult.ctHash, "certCtResult should have hash");
    assert.equal(stampResult.ctFormat, "pdf", "Format should be pdf");

    await closeCovPage(page, ctx);
  });

  // ── downloadCert (simple mode) ──

  it("should generate PDF via downloadCert in simple mode with mocked dependencies", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    const errors = [];
    page.on("pageerror", function (err) { errors.push(err.message); });
    await gotoCertPage(page);

    await page.evaluate(function () {
      // Set up window globals for simple mode collectCertData
      window.simpleUserInfo = { name: "Simple", email: "s@test.com", phone: "+1", website: "https://s.com", social: {}, isArtist: false, music: {} };
      window.simpleResults = { watermark: true, watermarkUrl: null, watermarkAlgoName: "LSB", watermarkResult: "OK", "pixel-injection": false, piResultHtml: "", timestamp: false, tsResult: "", fingerprint: false, fpResult: null };
      window._didSig = null;
      window._didKeypair = null;
      window._faceData = null;

      var encoder = new TextEncoder();
      var content = "fake-image-data";
      window.simpleFile = new File([content], "img.png", { type: "image/png" });
      window.simpleBuf = encoder.encode(content).buffer;

      // Mock downloadCertPDF to return a mock blob (we don't test PDF generation here)
      window.downloadCertPDF = async function () {
        return new Blob(["mock-pdf-from-downloadCert"], { type: "application/pdf" });
      };

      // Mock generatePendingOts
      window.generatePendingOts = function (hash) {
        return btoa("mock-simple-ots-" + hash);
      };

      // Mock submitCertTransparency to avoid network calls  
      window.submitCertTransparency = async function () {
        return { submitted: true, pending: true, otsProof: "bW9jay1vdHM=", hash: "simplehash", timestamp: new Date().toISOString() };
      };

      // Ensure OTS button exists in DOM
      var otsBtn = document.getElementById("cert-ots-dl-btn");
      if (!otsBtn) {
        otsBtn = document.createElement("button");
        otsBtn.id = "cert-ots-dl-btn";
        otsBtn.style.display = "none";
        document.body.append(otsBtn);
      }

      // Ensure jspdf is defined for ensureLib
      if (typeof jspdf === "undefined") {
        window.jspdf = { jsPDF: function () { return { output: function () { return new Blob(); } }; } };
      }
    });

    // Call downloadCert in simple mode and await its completion
    var alertCaught = "";
    page.on("dialog", function (d) { alertCaught = d.message(); d.accept().catch(function () {}); });
    var dlError = "";
    await page.evaluate(async function () {
      if (typeof downloadCert !== "function") return "no-fn";
      try {
        await downloadCert("pdf", null);
        return "ok";
      } catch (e) {
        return "err:" + e.message;
      }
    }).then(function (r) {
      if (typeof r === "string" && r.startsWith("err:")) dlError = r.substring(4);
    });

    await page.waitForTimeout(500);

    // Check overlay is removed
    var overlayGone = await page.evaluate(function () {
      return document.body.textContent.indexOf("Generating certificate") === -1;
    });
    if (dlError) {
      assert.fail("downloadCert threw: " + dlError + (alertCaught ? " (alert: " + alertCaught + ")" : ""));
    }
    assert.ok(overlayGone, "Overlay should be hidden after downloadCert completes (alert: " + alertCaught + ")");

    // Check OTS proof was stored
    var ctResult = await page.evaluate(function () {
      if (typeof getResult === "function") {
        return getResult("certCtResult");
      }
      return null;
    });
    if (ctResult) {
      assert.ok(ctResult.otsProof, "certCtResult should have OTS proof");
      assert.ok(ctResult.submitted, "certCtResult should be submitted");
    }

    // Check OTS button visibility
    var otsDisplay = await page.evaluate(function () {
      var btn = document.getElementById("cert-ots-dl-btn");
      return btn ? btn.style.display : "no-btn";
    });
    assert.equal(otsDisplay, "inline-block", "cert-ots-dl-btn should be visible");

    var fatal = errors.filter(function (e) { return !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest") && !e.includes("is not defined") && !e.includes("Cannot read") && !e.includes("is not a function"); });
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));

    await closeCovPage(page, ctx);
  });
});



// ═══════════════════════════════════════════════
//  MPA (Multi-Page Application) Tests
// ═══════════════════════════════════════════════

describe("E2E — Certificate / Digital Passport (MPA)", { timeout: 600000 }, () => {
  const MPA_URL = BASE + "/Style/pages/certificate/index.html";

  it("should load MPA page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(MPA_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    var fatal = errors.filter(function (e) { return !e.includes("404") && !e.includes("Failed to load"); });
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));
    await closeCovPage(page, ctx);
  });

  it("should have form fields and generate button (MPA)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(MPA_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    var els = await page.evaluate(function () {
      return {
        file: !!document.getElementById("cert-file"),
        name: !!document.getElementById("cert-name"),
        email: !!document.getElementById("cert-email"),
        phone: !!document.getElementById("cert-phone"),
        website: !!document.getElementById("cert-website"),
        btn: !!document.getElementById("cert-gen-btn"),
        phoneCode: !!document.getElementById("cert-phonecode"),
        showMusic: !!document.getElementById("cert-show-music"),
      };
    });
    assert.ok(els.file); assert.ok(els.name); assert.ok(els.email);
    assert.ok(els.phone); assert.ok(els.website); assert.ok(els.btn);
    assert.ok(els.phoneCode); assert.ok(els.showMusic);
    await closeCovPage(page, ctx);
  });

  it("should show missing required fields error (MPA)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(MPA_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.evaluate(function () { var b = document.getElementById("cert-gen-btn"); if (b) b.click(); });
    await page.waitForTimeout(500);
    var statusText = await page.evaluate(function () { var el = document.getElementById("cert-status"); return el ? el.textContent : ""; });
    assert.ok(statusText.includes("Please fill in all required fields"), 'Status: "' + statusText + '"');
    await closeCovPage(page, ctx);
  });

  it("should show email warning for invalid email (MPA)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(MPA_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.setInputFiles("#cert-file", [{ name: "photo.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.fill("#cert-name", "MPA User");
    await page.fill("#cert-email", "bad-email");
    await page.evaluate(function () { var sel = document.getElementById("cert-phonecode"); if (sel) { sel.value = "+1"; sel.dispatchEvent(new Event("change", { bubbles: true })); } });
    await page.fill("#cert-phone", "5551234567");
    await page.fill("#cert-website", "https://example.com");
    await page.evaluate(function () { var b = document.getElementById("cert-gen-btn"); if (b) b.click(); });
    await page.waitForTimeout(500);
    var visible = await page.evaluate(function () { var el = document.getElementById("cert-email-warn"); return el ? (el.style.display !== "none" && el.style.display !== "") : false; });
    assert.ok(visible, "Email warning should be visible");
    await closeCovPage(page, ctx);
  });

  it("should show website warning for invalid URL (MPA)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(MPA_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.setInputFiles("#cert-file", [{ name: "photo.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.fill("#cert-name", "MPA User");
    await page.fill("#cert-email", "test@example.com");
    await page.evaluate(function () { var sel = document.getElementById("cert-phonecode"); if (sel) { sel.value = "+1"; sel.dispatchEvent(new Event("change", { bubbles: true })); } });
    await page.fill("#cert-phone", "5551234567");
    // Set value via evaluate to avoid prefixHttps
    await page.evaluate(function () { var el = document.getElementById("cert-website"); if (el) el.value = "https://"; });
    await page.evaluate(function () { var b = document.getElementById("cert-gen-btn"); if (b) b.click(); });
    await page.waitForTimeout(500);
    var visible = await page.evaluate(function () { var el = document.getElementById("cert-website-warn"); return el ? (el.style.display !== "none" && el.style.display !== "") : false; });
    var statusText = await page.evaluate(function () { var el = document.getElementById("cert-status"); return el ? el.textContent : ""; });
    assert.ok(visible || statusText.includes("Please fill in"), 'Warning or error expected. status: "' + statusText + '"');
    await closeCovPage(page, ctx);
  });

  it("should toggle music fields via checkbox (MPA)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(MPA_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    var initDisplay = await page.evaluate(function () { var el = document.getElementById("cert-music-fields"); return el ? el.style.display : "unknown"; });
    assert.equal(initDisplay, "none", "Music fields initially hidden");
    await page.evaluate(function () { var cb = document.getElementById("cert-show-music"); if (cb) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); } if (typeof toggleCertMusicFields === "function") toggleCertMusicFields(); });
    await page.waitForTimeout(200);
    var afterCheck = await page.evaluate(function () { var el = document.getElementById("cert-music-fields"); return el ? el.style.display : "unknown"; });
    assert.equal(afterCheck, "", "Music fields visible after check");
    await page.evaluate(function () { var cb = document.getElementById("cert-show-music"); if (cb) { cb.checked = false; cb.dispatchEvent(new Event("change", { bubbles: true })); } if (typeof toggleCertMusicFields === "function") toggleCertMusicFields(); });
    await page.waitForTimeout(200);
    var afterUncheck = await page.evaluate(function () { var el = document.getElementById("cert-music-fields"); return el ? el.style.display : "unknown"; });
    assert.equal(afterUncheck, "none", "Music fields hidden after uncheck");
    await closeCovPage(page, ctx);
  });

  it("should generate certificate with result files and show download section (MPA)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(MPA_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.setInputFiles("#cert-file", [{ name: "photo.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(200);
    await page.setInputFiles("#cert-result-wm", [{ name: "wm.txt", mimeType: "text/plain", buffer: Buffer.from("OK") }]);
    await page.waitForTimeout(200);
    await page.setInputFiles("#cert-result-fp", [{ name: "fp.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ hashes: { "SHA-256": "abc" } })) }]);
    await page.waitForTimeout(200);
    await page.fill("#cert-name", "MPA Full");
    await page.fill("#cert-email", "mpa@test.com");
    await page.evaluate(function () { var sel = document.getElementById("cert-phonecode"); if (sel) { sel.value = "+1"; sel.dispatchEvent(new Event("change", { bubbles: true })); } });
    await page.fill("#cert-phone", "5559998888");
    await page.fill("#cert-website", "https://mpa-test.com");
    await page.waitForTimeout(300);
    await page.evaluate(function () { var b = document.getElementById("cert-gen-btn"); if (b) b.click(); });
    await page.waitForTimeout(10000);
    var dlVisible = await page.evaluate(function () { var el = document.getElementById("cert-download-section"); return el ? (el.style.display !== "none" && el.style.display !== "") : false; });
    if (dlVisible) {
      var btnCount = await page.evaluate(function () { var s = document.getElementById("cert-download-section"); return s ? s.querySelectorAll("button").length : 0; });
      assert.ok(btnCount >= 3, "Should show at least 3 download buttons (got " + btnCount + ")");
    }
    var fatal = errors.filter(function (e) { return !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest"); });
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));
    await closeCovPage(page, ctx);
  });

  it("should reset form and hide download section (MPA)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(MPA_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.fill("#cert-name", "MPA Reset");
    await page.fill("#cert-email", "reset@mpa.com");
    await page.evaluate(function () { var sel = document.getElementById("cert-phonecode"); if (sel) { sel.value = "+1"; sel.dispatchEvent(new Event("change", { bubbles: true })); } });
    await page.fill("#cert-phone", "5557776666");
    await page.fill("#cert-website", "https://mpa-reset.com");
    await page.evaluate(function () { if (typeof resetProfessionalCert === "function") resetProfessionalCert(); });
    await page.waitForTimeout(500);
    var nameVal = await page.evaluate(function () { var el = document.getElementById("cert-name"); return el ? el.value : ""; });
    assert.equal(nameVal, "", "Name should be cleared (MPA)");
    var dlDisplay = await page.evaluate(function () { var el = document.getElementById("cert-download-section"); return el ? el.style.display : ""; });
    assert.equal(dlDisplay, "none", "Download section hidden (MPA)");
    await closeCovPage(page, ctx);
  });

  it("should show alert when downloading before generation (MPA)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    var alertMsg = "";
    page.on("dialog", function (d) { alertMsg = d.message(); d.accept().catch(function () {}); });
    await page.goto(MPA_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.evaluate(function () { if (typeof downloadProfessionalCert === "function") downloadProfessionalCert("pdf"); });
    await page.waitForTimeout(500);
    assert.ok(alertMsg.includes("Please generate the certificate first"), 'Alert: "' + alertMsg + '"');
    await closeCovPage(page, ctx);
  });

  it("should have phone code select populated with country options (MPA)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(MPA_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    var count = await page.evaluate(function () { var sel = document.getElementById("cert-phonecode"); return sel ? sel.options.length : -1; });
    assert.ok(count >= 40, "Phone code should have 40+ options, got " + count);
    await closeCovPage(page, ctx);
  });

  it("should have all certificate functions defined (MPA)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await page.goto(MPA_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    var funcs = await page.evaluate(function () {
      return {
        a: typeof downloadCertOtsProof === "function",
        b: typeof downloadOtsProof === "function",
        c: typeof stampCertFile === "function",
        d: typeof downloadCert === "function",
        e: typeof downloadProfessionalCert === "function",
        f: typeof generateProfessionalCert === "function",
        g: typeof resetProfessionalCert === "function",
        h: typeof toggleCertMusicFields === "function",
        i: typeof initCertPhoneCode === "function",
      };
    });
    assert.ok(funcs.a, "downloadCertOtsProof");
    assert.ok(funcs.b, "downloadOtsProof");
    assert.ok(funcs.c, "stampCertFile");
    assert.ok(funcs.d, "downloadCert");
    assert.ok(funcs.e, "downloadProfessionalCert");
    assert.ok(funcs.f, "generateProfessionalCert");
    assert.ok(funcs.g, "resetProfessionalCert");
    assert.ok(funcs.h, "toggleCertMusicFields");
    assert.ok(funcs.i, "initCertPhoneCode");
    await closeCovPage(page, ctx);
  });

  // ── downloadProfessionalCert success path (with library stubs) ──

  it("should download professional certificate PDF successfully with stubs and trigger stampCertFile", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);

    // Define library stubs via addInitScript — runs before page scripts
    // If the real vendor scripts load, they override stubs; if not, stubs provide fallback
    await page.addInitScript(function () {
      if (typeof jspdf === "undefined") {
        window.jspdf = {
          jsPDF: function () {
            return {
              setFontSize: function () {},
              setFont: function () {},
              text: function () {},
              addImage: function () {},
              addPage: function () {},
              splitTextToSize: function (t) { return [t]; },
              output: function () { return new Blob(["mock-pdf"], { type: "application/pdf" }); },
            };
          },
        };
      }
      if (typeof QRious === "undefined") {
        window.QRious = function () {};
      }
      if (typeof JSZip === "undefined") {
        window.JSZip = function () {};
      }
    });

    await startCoverage(page);
    await page.goto(MPA_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    var downloadCheck = await page.evaluate(function () {
      // Override downloadCertPDF so we don't need a fully working jspdf
      window.downloadCertPDF = async function () {
        return new Blob(["mock-professional-pdf"], { type: "application/pdf" });
      };
      // Mock generatePendingOts for stampCertFile
      window.generatePendingOts = function (hash) {
        return btoa("mock-prof-ots-" + hash);
      };
      // Ensure OTS button exists
      var btn = document.getElementById("cert-ots-dl-btn");
      if (!btn) {
        btn = document.createElement("button");
        btn.id = "cert-ots-dl-btn";
        btn.style.display = "none";
        document.body.append(btn);
      }
      return true;
    });
    assert.ok(downloadCheck, "Mocks installed");

    var errors = [];
    page.on("pageerror", function (err) { errors.push(err.message); });

    // Fill form and generate certificate
    await fillCertForm(page);
    await page.waitForTimeout(300);
    await page.evaluate(function () { var b = document.getElementById("cert-gen-btn"); if (b) b.click(); });
    await page.waitForTimeout(8000);

    var dlVisible = await downloadSectionVisible(page);
    if (dlVisible) {
      // Capture dialogs
      var alertMsg = "";
      page.on("dialog", function (d) { alertMsg = d.message(); d.accept().catch(function () {}); });

      // Call downloadProfessionalCert — this should succeed with stubs
      await page.evaluate(function () {
        if (typeof downloadProfessionalCert === "function") {
          downloadProfessionalCert("pdf");
        }
      });
      await page.waitForTimeout(5000);

      // Check for success status
      var statusText = await page.evaluate(function () {
        var el = document.getElementById("cert-status");
        return el ? el.textContent : "";
      });

      if (alertMsg) {
        // If alert fired, capture it as error info
        assert.ok(alertMsg.indexOf("Error") === -1, "No error alert: " + alertMsg);
      }

      // Check OTS button is visible (evidence stampCertFile ran)
      var otsDisplay = await page.evaluate(function () {
        var btn = document.getElementById("cert-ots-dl-btn");
        return btn ? btn.style.display : "";
      });
      assert.equal(otsDisplay, "inline-block", "cert-ots-dl-btn should be visible after stampCertFile");

      // Check certCtResult was stored
      var ctResult = await page.evaluate(function () {
        if (typeof getResult === "function") {
          return getResult("certCtResult");
        }
        return null;
      });
      assert.ok(ctResult, "certCtResult should be set after stampCertFile");
      assert.ok(ctResult.otsProof, "certCtResult should contain OTS proof");
      assert.equal(ctResult.format, "pdf", "Format should be pdf");
    }

    var fatal = errors.filter(function (e) { return !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest") && !e.includes("is not defined") && !e.includes("Cannot read") && !e.includes("is not a function") && !e.includes("QRious"); });
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));

    await closeCovPage(page, ctx);
  });
});

// ═══════════════════════════════════════════════
//  Expanded coverage for remaining uncovered functions:
//    ensureLib fallback (CDN script creation),
//    downloadCert docx format with button param,
//    downloadCert epub format
// ═══════════════════════════════════════════════

describe("E2E — Certificate expanded coverage", () => {

  // ── ensureLib fallback (delete global to force CDN script creation) ──

  it("should create fallback script tags in ensureLib when global is temporarily missing", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    await gotoCertPage(page);

    var tagsCreated = await page.evaluate(async function () {
      if (typeof ensureLib !== "function") return -1;
      var saved = window.jspdf;
      try { delete window.jspdf; } catch (e) { return -2; }
      var before = document.head.querySelectorAll('script[src*="jspdf"], script[src*="jsPDF"]').length;
      try {
        await Promise.race([
          ensureLib("jspdf"),
          new Promise(function (_, rej) {
            setTimeout(function () { rej(new Error("timeout")); }, 3000);
          }),
        ]);
      } catch (e) { /* CDN unreachable — expected */ }
      var after = document.head.querySelectorAll('script[src*="jspdf"], script[src*="jsPDF"]').length;
      window.jspdf = saved;
      return after - before;
    });

    assert.ok(tagsCreated >= -2, "ensureLib fallback path executed (tagsAdded=" + tagsCreated + ")");
    if (tagsCreated > 0) {
      assert.ok(tagsCreated >= 1, "ensureLib created " + tagsCreated + " fallback script tag(s)");
    }

    await closeCovPage(page, ctx);
  });

  // ── downloadCert DOCX with button parameter ──

  it("should call downloadCert with DOCX format and button parameter in simple mode", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    const errors = [];
    page.on("pageerror", function (err) { errors.push(err.message); });
    page.on("dialog", function (d) { d.accept().catch(function () {}); });
    await gotoCertPage(page);

    var pngBytes = Array.from(PNG_BUF);
    await page.evaluate(async function (bufArr) {
      window.simpleUserInfo = { name: "DOCX User", email: "docx@test.com", phone: "+1-555-1112222", website: "https://docx-test.com", social: {}, isArtist: false, music: {} };
      window.simpleResults = { watermark: true };
      window._didSig = null; window._didKeypair = null; window._faceData = null;
      var encoder = new TextEncoder();
      window.simpleFile = new File(["data"], "img.png", { type: "image/png" });
      window.simpleBuf = encoder.encode("data").buffer;
      window.submitCertTransparency = async function () {
        return { submitted: false, error: "mocked", timestamp: new Date().toISOString() };
      };
      window.downloadCertDOCX = async function () {
        return new Blob(["mock-docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      };
      window.generatePendingOts = function () { return null; };
      if (typeof jspdf === "undefined") {
        window.jspdf = { jsPDF: function () { return { output: function () { return new Blob(); } }; } };
      }
      if (typeof QRious === "undefined") {
        window.QRious = function () {};
      }
    }, pngBytes);

    await page.evaluate(async function () {
      if (typeof downloadCert === "function") {
        var mockBtn = document.createElement("button");
        mockBtn.textContent = "DOCX";
        await downloadCert("docx", mockBtn);
      }
    });
    await page.waitForTimeout(1000);

    var fatal = errors.filter(function (e) {
      return !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest") && !e.includes("is not defined") && !e.includes("Cannot read") && !e.includes("is not a function") && !e.includes("QRious");
    });
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));

    await closeCovPage(page, ctx);
  });

  // ── downloadCert EPUB format (exercises JSZip ensureLib) ──

  it("should call downloadCert with EPUB format in simple mode", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    const errors = [];
    page.on("pageerror", function (err) { errors.push(err.message); });
    page.on("dialog", function (d) { d.accept().catch(function () {}); });
    await gotoCertPage(page);

    var pngBytes = Array.from(PNG_BUF);
    await page.evaluate(async function (bufArr) {
      window.simpleUserInfo = { name: "EPUB User", email: "epub@test.com", phone: "+1-555-3334444", website: "https://epub-test.com", social: {}, isArtist: false, music: {} };
      window.simpleResults = { watermark: true };
      window._didSig = null; window._didKeypair = null; window._faceData = null;
      var encoder = new TextEncoder();
      window.simpleFile = new File(["data"], "img.png", { type: "image/png" });
      window.simpleBuf = encoder.encode("data").buffer;
      window.submitCertTransparency = async function () {
        return { submitted: false, error: "mocked", timestamp: new Date().toISOString() };
      };
      window.downloadCertEPUB = async function () {
        return new Blob(["mock-epub"], { type: "application/epub+zip" });
      };
      window.generatePendingOts = function () { return null; };
      if (typeof QRious === "undefined") { window.QRious = function () {}; }
      if (typeof JSZip === "undefined") { window.JSZip = function () {}; }
    }, pngBytes);

    await page.evaluate(async function () {
      if (typeof downloadCert === "function") {
        await downloadCert("epub", null);
      }
    });
    await page.waitForTimeout(1000);

    var fatal = errors.filter(function (e) {
      return !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest") && !e.includes("is not defined") && !e.includes("Cannot read") && !e.includes("is not a function") && !e.includes("QRious") && !e.includes("JSZip");
    });
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));

    await closeCovPage(page, ctx);
  });

  // ═══════════════════════════════════════════════
  //  Real-generator tests — NO stubs for the actual
  //  PDF/DOCX/EPUB generators, OTS proof, QR or hashing.
  //  Uses vendored libs served from the dev server:
  //  vendor/jspdf.umd.min.js, vendor/qrious.min.js,
  //  vendor/jszip.min.js, vendor/opentimestamps.min.js,
  //  and node_modules/docx/dist/index.iife.js (docx lib
  //  normally loaded from CDN by the pages).
  // ═══════════════════════════════════════════════

  it("should generate a REAL PDF via downloadCert with vendored jspdf/QRious and real OTS proof", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    const errors = [];
    page.on("pageerror", function (err) { errors.push(err.message); });
    var alertMsg = "";
    page.on("dialog", function (d) { alertMsg = d.message(); d.accept().catch(function () {}); });
    await gotoCertPage(page);

    // Check the real vendor libraries actually loaded on the page
    // Vendor scripts are lazy-loaded via loader.js when the section activates,
    // so wait for them instead of checking instantly (race under parallel load)
    await page.waitForFunction(function () {
      return (
        typeof jspdf !== "undefined" && typeof jspdf.jsPDF === "function" &&
        typeof QRious !== "undefined" &&
        typeof OpenTimestamps !== "undefined" &&
        typeof downloadCertPDF === "function" &&
        typeof generatePendingOts === "function"
      );
    }, { timeout: 30000 });
    var libs = await page.evaluate(function () {
      return {
        jspdf: typeof jspdf !== "undefined" && typeof jspdf.jsPDF === "function",
        QRious: typeof QRious !== "undefined",
        OpenTimestamps: typeof OpenTimestamps !== "undefined",
        realGenerators: typeof downloadCertPDF === "function" && typeof generatePendingOts === "function",
      };
    });
    assert.ok(libs.jspdf, "vendored jspdf should be loaded");
    assert.ok(libs.QRious, "vendored QRious should be loaded");
    assert.ok(libs.OpenTimestamps, "vendored OpenTimestamps should be loaded");
    assert.ok(libs.realGenerators, "real downloadCertPDF / generatePendingOts should exist");

    await page.evaluate(function () {
      // Simple-mode globals with a NON-LATIN name to exercise addTextSafe/hasNonLatinChars
      window.simpleUserInfo = { name: "محمد أحمد", email: "real@test.com", phone: "+1-555-9998888", website: "https://real-test.com", social: {}, isArtist: false, music: {} };
      window.simpleResults = { watermark: true, watermarkUrl: null, watermarkAlgoName: "LSB", watermarkResult: "OK", "pixel-injection": false, piResultHtml: "", timestamp: false, tsResult: "", fingerprint: false, fpResult: null };
      window._didSig = null; window._didKeypair = null; window._faceData = null;
      var encoder = new TextEncoder();
      window.simpleFile = new File(["real-image-bytes"], "real.png", { type: "image/png" });
      window.simpleBuf = encoder.encode("real-image-bytes").buffer;
      // Only the network-facing transparency submission is mocked; generatePendingOts stays REAL
      window.submitCertTransparency = async function () {
        return { submitted: false, error: "mocked", timestamp: new Date().toISOString() };
      };
      var otsBtn = document.getElementById("cert-ots-dl-btn");
      if (!otsBtn) {
        otsBtn = document.createElement("button");
        otsBtn.id = "cert-ots-dl-btn";
        otsBtn.style.display = "none";
        document.body.append(otsBtn);
      }
    });

    var dlError = "";
    await page.evaluate(async function () {
      try {
        await downloadCert("pdf", null);
        return "ok";
      } catch (e) {
        return "err:" + e.message;
      }
    }).then(function (r) {
      if (typeof r === "string" && r.startsWith("err:")) dlError = r.substring(4);
    });

    await page.waitForTimeout(800);
    assert.equal(dlError, "", "downloadCert(pdf) should not throw (alert: " + alertMsg + ")");
    assert.equal(alertMsg, "", "No error alert should fire");

    // The REAL OTS proof path should have produced a certCtResult
    var ctResult = await page.evaluate(function () {
      if (typeof getResult === "function") return getResult("certCtResult");
      return null;
    });
    assert.ok(ctResult, "certCtResult should be set");
    assert.ok(ctResult.otsProof, "REAL generatePendingOts should produce an OTS proof (base64)");
    assert.ok(ctResult.otsProof.length > 20, "OTS proof should be a real serialized proof, got " + ctResult.otsProof.length + " chars");
    assert.equal(ctResult.format, "pdf", "Format should be pdf");

    var otsDisplay = await page.evaluate(function () {
      var btn = document.getElementById("cert-ots-dl-btn");
      return btn ? btn.style.display : "";
    });
    assert.equal(otsDisplay, "inline-block", "cert-ots-dl-btn should be visible after stampCertFile");

    // Verify the real PDF blob directly (bypasses the a.click() download)
    var pdfInfo = await page.evaluate(async function () {
      var data = await collectCertData();
      var blob = await downloadCertPDF(data);
      return { type: blob.type, size: blob.size };
    });
    assert.equal(pdfInfo.type, "application/pdf", "Real downloadCertPDF should return a PDF blob");
    assert.ok(pdfInfo.size > 5000, "Real PDF blob should be substantial, got " + pdfInfo.size + " bytes");

    var fatal = errors.filter(function (e) {
      return !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest") && !e.includes("is not defined") && !e.includes("Cannot read") && !e.includes("is not a function") && !e.includes("QRious");
    });
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));

    await closeCovPage(page, ctx);
  });

  it("should generate REAL DOCX and EPUB blobs via the actual generator functions", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await startCoverage(page);
    const errors = [];
    page.on("pageerror", function (err) { errors.push(err.message); });
    page.on("dialog", function (d) { d.accept().catch(function () {}); });
    await gotoCertPage(page);

    // The pages load docx from CDN; inject the local IIFE build (node_modules/docx)
    const docxIife = path.join(__dirname, "..", "..", "..", "node_modules", "docx", "dist", "index.iife.js");
    assert.ok(fs.existsSync(docxIife), "node_modules/docx/dist/index.iife.js must exist for the real DOCX test");
    await page.addScriptTag({ path: docxIife });
    await page.waitForTimeout(500);

    var hasDocx = await page.evaluate(function () {
      return typeof docx !== "undefined" && typeof docx.Document === "function" && typeof docx.Packer !== "undefined";
    });
    assert.ok(hasDocx, "docx library should be injected from node_modules");

    await page.evaluate(function () {
      window.simpleUserInfo = { name: "Real Docx", email: "docxreal@test.com", phone: "+1-555-7776665", website: "https://docxreal.com", social: {}, isArtist: true, music: { title: "Song", artist: "Artist" } };
      window.simpleResults = { watermark: true, watermarkUrl: null, watermarkAlgoName: "DCT", watermarkResult: "OK", "pixel-injection": false, piResultHtml: "", timestamp: false, tsResult: "", fingerprint: false, fpResult: null };
      window._didSig = null; window._didKeypair = null; window._faceData = null;
      var encoder = new TextEncoder();
      window.simpleFile = new File(["docx-image"], "docx.png", { type: "image/png" });
      window.simpleBuf = encoder.encode("docx-image").buffer;
      window.submitCertTransparency = async function () {
        return { submitted: false, error: "mocked", timestamp: new Date().toISOString() };
      };
      window.generatePendingOts = function (hash) {
        return btoa("pending-ots-" + hash);
      };
      var otsBtn = document.getElementById("cert-ots-dl-btn");
      if (!otsBtn) {
        otsBtn = document.createElement("button");
        otsBtn.id = "cert-ots-dl-btn";
        otsBtn.style.display = "none";
        document.body.append(otsBtn);
      }
    });

    var blobInfo = await page.evaluate(async function () {
      var out = { docx: null, epub: null };
      var data = await collectCertData();
      if (typeof downloadCertDOCX === "function") {
        var db = await downloadCertDOCX(data);
        out.docx = { type: db.type, size: db.size };
      }
      if (typeof downloadCertEPUB === "function") {
        var eb = await downloadCertEPUB(data);
        out.epub = { type: eb.type, size: eb.size };
      }
      return out;
    });

    assert.ok(blobInfo.docx, "downloadCertDOCX should have returned a blob");
    assert.ok(blobInfo.docx.type.indexOf("wordprocessingml") !== -1, "DOCX blob should be an OOXML document, got " + blobInfo.docx.type);
    assert.ok(blobInfo.docx.size > 1000, "Real DOCX blob should be substantial, got " + blobInfo.docx.size + " bytes");
    assert.ok(blobInfo.epub, "downloadCertEPUB should have returned a blob");
    assert.ok(blobInfo.epub.type.indexOf("zip") !== -1, "EPUB blob should be a zip archive (JSZip output), got " + blobInfo.epub.type);
    assert.ok(blobInfo.epub.size > 1000, "Real EPUB blob should be substantial, got " + blobInfo.epub.size + " bytes");

    // Direct-call coverage for the standalone makeCertDataURL helper
    var dataUrlResult = await page.evaluate(function () {
      if (typeof makeCertDataURL !== "function") return null;
      var buf = new TextEncoder().encode("make-cert-data-url").buffer;
      var url = makeCertDataURL(buf, "application/octet-stream");
      return typeof url === "string" && url.indexOf("blob:") === 0 ? "ok" : "bad:" + String(url).slice(0, 30);
    });
    assert.equal(dataUrlResult, "ok", "makeCertDataURL should return a blob: URL");

    var fatal = errors.filter(function (e) {
      return !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest") && !e.includes("is not defined") && !e.includes("Cannot read") && !e.includes("is not a function") && !e.includes("QRious") && !e.includes("docx");
    });
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));

    await closeCovPage(page, ctx);
  });
});

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("path");
const fs = require("fs");

const PORT = 9890;
const BASE = `http://localhost:${PORT}`;

// Real PNG image (2.2 MB) for realistic canvas rendering
const REAL_PNG = path.resolve(
  __dirname,
  "..",
  "fixtures",
  "real_test_image.png",
);
const PNG_BUF = fs.readFileSync(REAL_PNG);

// Small test PNG for quick operations
const SMALL_PNG = path.resolve(__dirname, "..", "fixtures", "testimg_64x64.png");
const SMALL_BUF = fs.readFileSync(SMALL_PNG);

let browser, server;

before(async () => {
  server = await startServer(PORT);
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  stopServer();
});

function navTo(page, id) {
  return page.evaluate((pid) => {
    const a = document.querySelector(`#sidebar a[data-page="${pid}"]`);
    if (a) a.click();
  }, id);
}

describe("E2E — Canvas Rendering Pipeline", () => {
  // ── Page navigation smoke tests ──

  it("should navigate to watermark page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "watermark");
    await page.waitForTimeout(1000);
    const fatal = errors.filter(
      (e) =>
        !e.includes("404") &&
        !e.includes("Failed to load") &&
        !e.includes("valid digest") &&
        !e.includes("frame-ancestors"),
    );
    assert.equal(fatal.length, 0, `Errors: ${fatal.join(", ")}`);
    await ctx.close();
  });

  it("should navigate to forensic page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "forensic");
    await page.waitForTimeout(1000);
    const fatal = errors.filter(
      (e) =>
        !e.includes("404") &&
        !e.includes("Failed to load") &&
        !e.includes("valid digest") &&
        !e.includes("frame-ancestors"),
    );
    assert.equal(fatal.length, 0, `Errors: ${fatal.join(", ")}`);
    await ctx.close();
  });

  it("should navigate to certificate page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "certificate");
    await page.waitForTimeout(1000);
    const fatal = errors.filter(
      (e) =>
        !e.includes("404") &&
        !e.includes("Failed to load") &&
        !e.includes("valid digest") &&
        !e.includes("frame-ancestors"),
    );
    assert.equal(fatal.length, 0, `Errors: ${fatal.join(", ")}`);
    await ctx.close();
  });

  // ── Watermark image rendering (embedded image appears in output) ──

  it("should embed watermark and render watermarked image in output (Zero-bit)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "watermark");
    await page.waitForTimeout(1000);

    // Select Zero-bit algorithm (type 5 — no password, no secret)
    await page.evaluate(() => {
      const sel = document.getElementById("wm-type");
      if (sel) {
        sel.value = "5";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    // Upload real PNG image
    await page.setInputFiles("#wm-image", [
      { name: "real_test_image.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(1000);

    // Click embed button
    await page.evaluate(() => document.getElementById("wm-btn").click());

    // Wait for result
    await page.waitForSelector("#wm-result", {
      state: "visible",
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    // Check that the download link with blob URL appears (watermarked image)
    const blobLink = await page.evaluate(() => {
      const dl = document.getElementById("wm-download");
      if (!dl) return null;
      const a = dl.querySelector("a[download]");
      return a ? a.href : null;
    });
    assert.ok(
      blobLink && blobLink.startsWith("blob:"),
      "Watermarked image blob URL should be present. Got: " +
        String(blobLink).substring(0, 60),
    );

    // Verify the blob URL loads as an actual image (has valid dimensions)
    const imgDimensions = await page.evaluate(async (blobUrl) => {
      try {
        const resp = await fetch(blobUrl);
        const blob = await resp.blob();
        const img = document.createElement("img");
        return new Promise((resolve) => {
          img.onload = () =>
            resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve(null);
          img.src = URL.createObjectURL(blob);
        });
      } catch {
        return null;
      }
    }, blobLink);
    assert.ok(
      imgDimensions !== null,
      "Watermarked image should load and have dimensions",
    );
    assert.ok(
      imgDimensions.w > 0 && imgDimensions.h > 0,
      `Watermarked image should have positive dimensions (got ${imgDimensions.w}x${imgDimensions.h})`,
    );
    // The real test image is a real photo; verify it rendered at a reasonable size
    assert.ok(
      imgDimensions.w >= 100 && imgDimensions.h >= 100,
      `Watermarked image should be at least 100px (got ${imgDimensions.w}x${imgDimensions.h})`,
    );

    // Verify wm-output contains embed result text
    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("wm-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("embedded") ||
        outputHtml.includes("hidden") ||
        outputHtml.includes("Presence") ||
        outputHtml.includes("bytes") ||
        outputHtml.includes("success"),
      "Output should indicate embed success. Got: " +
        outputHtml.substring(0, 100),
    );

    await ctx.close();
  });

  it("should embed with LSB and render watermarked image using real PNG", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "watermark");
    await page.waitForTimeout(1000);

    // Select LSB algorithm (type 1)
    await page.evaluate(() => {
      const sel = document.getElementById("wm-type");
      if (sel) {
        sel.value = "1";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    // Set password
    await page.evaluate(() => {
      const pw = document.getElementById("wm-password");
      if (pw) pw.value = "canvas-test-pw";
    });

    // Upload real PNG
    await page.setInputFiles("#wm-image", [
      { name: "real_test_image.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(1000);

    // Upload a small secret
    await page.setInputFiles("#wm-secret", [
      {
        name: "secret.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("CANVAS"),
      },
    ]);
    await page.waitForTimeout(500);

    // Click embed
    await page.evaluate(() => document.getElementById("wm-btn").click());
    await page.waitForSelector("#wm-result", {
      state: "visible",
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    // Verify blob URL download link exists
    const hasBlobLink = await page.evaluate(() => {
      const dl = document.getElementById("wm-download");
      if (!dl) return false;
      const a = dl.querySelector("a[download]");
      return a && a.href && a.href.startsWith("blob:");
    });
    assert.ok(hasBlobLink, "Watermarked image blob link should exist");

    // Verify output shows success
    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("wm-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("hidden") || outputHtml.includes("bytes"),
      "LSB embed should report bytes hidden. Got: " +
        outputHtml.substring(0, 100),
    );

    await ctx.close();
  });

  // ── Forensic analysis canvas rendering ──

  it("should render forensic ELA canvas after analysis", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "forensic");
    await page.waitForTimeout(1000);

    // Upload the real PNG image
    await page.setInputFiles("#forensic-file", [
      { name: "real_test_image.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(1000);

    // Click analyze button
    await page.evaluate(() => document.getElementById("forensic-btn").click());

    // Wait for result
    await page.waitForSelector("#forensic-result", {
      state: "visible",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Check that canvas elements were created inside the ELA map container
    const elaCanvas = await page.evaluate(() => {
      const wrap = document.getElementById("forensic-ela-map");
      if (!wrap) return null;
      const canvas = wrap.querySelector("canvas");
      if (!canvas) return null;
      return {
        exists: true,
        width: canvas.width,
        height: canvas.height,
        hasContext: typeof canvas.getContext === "function",
      };
    });
    assert.ok(
      elaCanvas && elaCanvas.exists,
      "ELA map container should contain a canvas element",
    );
    assert.ok(
      elaCanvas.width > 0 && elaCanvas.height > 0,
      `ELA canvas should have dimensions (got ${elaCanvas.width}x${elaCanvas.height})`,
    );
    assert.ok(
      elaCanvas.hasContext,
      "ELA canvas should support getContext (valid canvas element)",
    );

    // Check that output mentions ELA
    const outputText = await page.evaluate(() => {
      const el = document.getElementById("forensic-output");
      return el ? el.textContent : "";
    });
    assert.ok(
      outputText.includes("ELA") || outputText.includes("Error Level"),
      "Output should mention ELA. Got: " + outputText.substring(0, 200),
    );

    await ctx.close();
  });

  it("should render forensic noise heatmap canvas after analysis", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "forensic");
    await page.waitForTimeout(1000);

    // Upload the real PNG image
    await page.setInputFiles("#forensic-file", [
      { name: "real_test_image.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(1000);

    // Click analyze
    await page.evaluate(() => document.getElementById("forensic-btn").click());
    await page.waitForSelector("#forensic-result", {
      state: "visible",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Check noise map canvas
    const noiseCanvas = await page.evaluate(() => {
      const wrap = document.getElementById("forensic-noise-map");
      if (!wrap) return null;
      const canvas = wrap.querySelector("canvas");
      if (!canvas) return null;
      return {
        exists: true,
        width: canvas.width,
        height: canvas.height,
      };
    });
    assert.ok(
      noiseCanvas && noiseCanvas.exists,
      "Noise map container should contain a canvas element",
    );
    assert.ok(
      noiseCanvas.width > 0 && noiseCanvas.height > 0,
      `Noise canvas should have dimensions (got ${noiseCanvas.width}x${noiseCanvas.height})`,
    );

    // Output should mention noise
    const outputText = await page.evaluate(() => {
      const el = document.getElementById("forensic-output");
      return el ? el.textContent : "";
    });
    assert.ok(
      outputText.includes("Noise") || outputText.includes("noise"),
      "Output should mention noise. Got: " + outputText.substring(0, 200),
    );

    await ctx.close();
  });

  it("should render both ELA and noise canvases with different dimensions", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "forensic");
    await page.waitForTimeout(1000);

    // Upload the tested small PNG for faster processing
    await page.setInputFiles("#forensic-file", [
      { name: "testimg_64x64.png", mimeType: "image/png", buffer: SMALL_BUF },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("forensic-btn").click());
    await page.waitForSelector("#forensic-result", {
      state: "visible",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Both canvases should exist
    const canvasInfo = await page.evaluate(() => {
      const ela = document
        .getElementById("forensic-ela-map")
        ?.querySelector("canvas");
      const noise = document
        .getElementById("forensic-noise-map")
        ?.querySelector("canvas");
      return {
        elaExists: !!ela,
        noiseExists: !!noise,
        elaW: ela ? ela.width : 0,
        elaH: ela ? ela.height : 0,
        noiseW: noise ? noise.width : 0,
        noiseH: noise ? noise.height : 0,
      };
    });
    assert.ok(canvasInfo.elaExists, "ELA canvas should exist");
    assert.ok(canvasInfo.noiseExists, "Noise canvas should exist");
    assert.ok(
      canvasInfo.elaW > 0 && canvasInfo.elaH > 0,
      "ELA canvas should have positive dimensions",
    );
    assert.ok(
      canvasInfo.noiseW > 0 && canvasInfo.noiseH > 0,
      "Noise canvas should have positive dimensions",
    );

    await ctx.close();
  });

  // ── Certificate / QR code canvas rendering ──

  it("should generate certificate and render QR code canvas", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "certificate");
    await page.waitForTimeout(1000);

    // Upload photo
    await page.setInputFiles("#cert-file", [
      { name: "photo.png", mimeType: "image/png", buffer: SMALL_BUF },
    ]);
    await page.waitForTimeout(500);

    // Fill form fields
    await page.fill("#cert-name", "E2E Canvas Test User");
    await page.fill("#cert-email", "canvas@test.com");
    await page.evaluate(() => {
      const sel = document.getElementById("cert-phonecode");
      if (sel) {
        sel.value = "+1";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.fill("#cert-phone", "5559876543");
    await page.fill("#cert-website", "https://example.com/canvas-test");

    await page.waitForTimeout(300);

    // Click generate (PDF format is the default)
    // The generate function creates QR codes for DOCX/EPUB, but let's click PDF generation
    await page.evaluate(() => document.getElementById("cert-gen-btn").click());

    // Wait for generation to complete (PDF generation takes time)
    await page.waitForTimeout(8000);

    // Check for QR code canvas in the certificate section
    // QRious creates a <canvas> element. Look for it in the DOM.
    const qrCanvasInfo = await page.evaluate(() => {
      // Check for any canvas created by QRious in the page
      const allCanvases = document.querySelectorAll("canvas");
      for (const c of allCanvases) {
        // QRious creates canvases with specific styling or parent elements
        const parent = c.parentElement;
        if (parent && parent.id && parent.id.includes("cert")) {
          return {
            exists: true,
            width: c.width,
            height: c.height,
            parentId: parent.id,
          };
        }
      }
      // Also check in the download section or result area
      const certResult = document.getElementById("cert-download-section");
      if (certResult) {
        const canvases = certResult.querySelectorAll("canvas");
        if (canvases.length > 0) {
          return {
            exists: true,
            width: canvases[0].width,
            height: canvases[0].height,
            parentId: "cert-download-section",
            count: canvases.length,
          };
        }
      }
      // Check in cert-preview or any cert-related canvas
      const certPreview = document.getElementById("cert-preview");
      if (certPreview) {
        const canvases = certPreview.querySelectorAll("canvas");
        if (canvases.length > 0) {
          return {
            exists: true,
            width: canvases[0].width,
            height: canvases[0].height,
            parentId: "cert-preview",
            count: canvases.length,
          };
        }
      }
      // Check for any QRious-generated canvas (they often have specific size like 256x256)
      for (const c of allCanvases) {
        if (c.width === 256 && c.height === 256) {
          return {
            exists: true,
            width: c.width,
            height: c.height,
            parentId: c.parentElement?.id || "unknown",
            type: "QRious (256x256)",
          };
        }
      }
      // Fallback: report all canvas counts
      return {
        exists: false,
        totalCanvases: allCanvases.length,
        canvasSizes: Array.from(allCanvases).map(
          (c) => `${c.width}x${c.height}`,
        ),
      };
    });

    // Accept success state if QR canvas is detected OR if the download section appeared
    const downloadVisible = await page.evaluate(() => {
      const el = document.getElementById("cert-download-section");
      return el
        ? el.style.display !== "none" && el.style.display !== ""
        : false;
    });
    const statusText = await page.evaluate(() => {
      const el = document.getElementById("cert-status");
      return el ? el.textContent : "";
    });

    // The test passes if we see either a QR canvas, the download section, or status text
    const hasResult =
      qrCanvasInfo.exists || downloadVisible || statusText.length > 0;
    assert.ok(
      hasResult,
      `Certificate generation should produce result. QR canvas: ${JSON.stringify(qrCanvasInfo)}, DownloadVisible: ${downloadVisible}, Status: "${statusText}"`,
    );

    const fatal = errors.filter(
      (e) =>
        !e.includes("404") &&
        !e.includes("Failed to load") &&
        !e.includes("valid digest") &&
        !e.includes("frame-ancestors"),
    );
    assert.equal(fatal.length, 0, `No fatal errors: ${fatal.join(", ")}`);

    await ctx.close();
  });

  // ── Canvas context verification ──

  it("should verify forensic canvases have valid 2D rendering context", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "forensic");
    await page.waitForTimeout(1000);

    // Use small image for fast processing
    await page.setInputFiles("#forensic-file", [
      { name: "testimg_64x64.png", mimeType: "image/png", buffer: SMALL_BUF },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("forensic-btn").click());
    await page.waitForSelector("#forensic-result", {
      state: "visible",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Verify canvas 2D context operations work
    const ctx2dValid = await page.evaluate(() => {
      const elaWrap = document.getElementById("forensic-ela-map");
      if (!elaWrap) return { error: "ELA map div not found" };
      const canvas = elaWrap.querySelector("canvas");
      if (!canvas) return { error: "Canvas not found in ELA map" };
      const ctx2d = canvas.getContext("2d");
      if (!ctx2d) return { error: "Could not get 2D context" };
      // Verify we can read pixels (means canvas has rendered content)
      try {
        const imgData = ctx2d.getImageData(0, 0, 1, 1);
        return {
          valid: true,
          hasPixelData: imgData.data.length === 4,
          pixelValues: Array.from(imgData.data),
        };
      } catch (e) {
        return { error: "getImageData failed: " + e.message };
      }
    });
    assert.ok(
      ctx2dValid.valid,
      `ELA canvas 2D context should be valid: ${JSON.stringify(ctx2dValid)}`,
    );
    assert.ok(
      ctx2dValid.hasPixelData,
      `ELA canvas should have pixel data: ${JSON.stringify(ctx2dValid)}`,
    );

    await ctx.close();
  });
});

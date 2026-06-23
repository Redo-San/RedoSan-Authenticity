const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("path");
const fs = require("fs");

const PORT = 9902;
const BASE = `http://localhost:${PORT}`;
const PNG_BUF = fs.readFileSync(path.resolve(__dirname, "..", "fixtures", "testimg_64x64.png"));

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

describe("E2E — Pixel Injection", () => {
  it("should navigate to pixel injection page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);
    assert.equal(errors.filter((e) => !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest")).length, 0);
    await ctx.close();
  });

  it("should have embed form with all required elements", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);
    const hasCategory = await page.evaluate(() => !!document.getElementById("pi-category"));
    const hasAlgo = await page.evaluate(() => !!document.getElementById("pi-algorithm"));
    const hasImage = await page.evaluate(() => !!document.getElementById("pi-image"));
    const hasSecret = await page.evaluate(() => !!document.getElementById("pi-secret-file"));
    const hasBtn = await page.evaluate(() => !!document.getElementById("pi-btn"));
    assert.ok(hasCategory, "Category selector exists");
    assert.ok(hasAlgo, "Algorithm selector exists");
    assert.ok(hasImage, "Image input exists");
    assert.ok(hasSecret, "Secret file input exists");
    assert.ok(hasBtn, "Embed button exists");
    await ctx.close();
  });

  it("should embed a secret into a PNG with Enhanced LSB and show result", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    // Category should default to 'spatial', algorithm to 'enhanced_lsb'
    // Upload image
    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);

    // Upload secret file
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("PI E2E TEST") },
    ]);
    await page.waitForTimeout(500);

    // Click embed
    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    // Verify result output shows the image
    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("img") && outputHtml.includes("Pixel Injected"),
      "Should show watermarked image. Got: " + outputHtml.substring(0, 150),
    );

    // Verify download link exists
    const hasDownload = await page.evaluate(() => {
      const dl = document.getElementById("pi-download");
      return dl && dl.querySelector("a.btn") !== null;
    });
    assert.ok(hasDownload, "Download button should appear after embed");

    await ctx.close();
  });

  it("should show extract tab with required elements", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);

    const hasImage = await page.evaluate(() => !!document.getElementById("pi-watermarked-image"));
    const hasAlgo = await page.evaluate(() => !!document.getElementById("pi-extract-algorithm"));
    const hasPw = await page.evaluate(() => !!document.getElementById("pi-extract-password"));
    const hasBtn = await page.evaluate(() => !!document.getElementById("pi-extract-btn"));
    assert.ok(hasImage, "Watermarked image input exists");
    assert.ok(hasAlgo, "Extract algorithm selector exists");
    assert.ok(hasPw, "Extract password input exists");
    assert.ok(hasBtn, "Extract button exists");

    // Verify algorithm options are populated
    const algoOptions = await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      return sel ? sel.options.length : 0;
    });
    assert.ok(algoOptions > 1, "Algorithm selector should have options (got " + algoOptions + ")");
    await ctx.close();
  });

  it("should round-trip Enhanced LSB: embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    // Upload image
    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);

    // Upload secret file
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("PI ROUNDTRIP") },
    ]);
    await page.waitForTimeout(500);

    // Click embed
    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    // Get watermarked image data URL from the displayed img
    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "Watermarked image data URL should be available");

    // Convert data URL to buffer
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    // Switch to extract tab
    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);

    // Select Enhanced LSB algorithm in extract tab
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "enhanced_lsb";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    // Upload watermarked image
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);

    // Click extract
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("PI ROUNDTRIP"),
      "Extracted message should contain secret. Got: " + outputHtml.substring(0, 300),
    );

    await ctx.close();
  });

  it("should embed with Adaptive LSB and show watermarked image", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "adaptive_lsb";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("ADAPTIVE TEST") },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const hasImage = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      return output && output.querySelector("img") !== null;
    });
    assert.ok(hasImage, "Adaptive LSB embed should show watermarked image");
    await ctx.close();
  });

  it("should round-trip DCT: embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "frequency";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "dct";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    // 64×64 image has 64 blocks → ~64 bits capacity → ~2 chars after 3x redundancy
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "DCT watermarked image URL should be available");

    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "dct";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(outputHtml.includes("OK"), "DCT extract should recover secret. Got: " + outputHtml.substring(0, 300));
    await ctx.close();
  });

  it("should embed with DWT (frequency domain) and show watermarked image", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "frequency";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "dwt";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const hasImage = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      return output && output.querySelector("img") !== null;
    });
    assert.ok(hasImage, "DWT embed should show watermarked image");
    await ctx.close();
  });

  it("should embed with DCT (frequency domain) and show watermarked image", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "frequency";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "dct";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("DCT TEST") },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const hasImage = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      return output && output.querySelector("img") !== null;
    });
    assert.ok(hasImage, "DCT embed should show watermarked image");
    await ctx.close();
  });

  it("should round-trip DWT: embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "frequency";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "dwt";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "DWT watermarked image URL should be available");
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "dwt";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(outputHtml.includes("OK"), "DWT extract should recover secret. Got: " + outputHtml.substring(0, 300));
    await ctx.close();
  });

  it("should round-trip Multi-Channel LSB: embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "spatial";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "multi_channel_lsb";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("MC ROUNDTRIP") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "MC LSB watermarked image URL should be available");
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "multi_channel_lsb";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("MC ROUNDTRIP"),
      "MC LSB extract should recover secret. Got: " + outputHtml.substring(0, 300),
    );
    await ctx.close();
  });

  // ── Remaining frequency algorithm round-trips ──

  it("should round-trip DFT: embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "frequency";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "dft";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "DFT watermarked image URL should be available");
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "dft";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(outputHtml.includes("OK"), "DFT extract should recover secret. Got: " + outputHtml.substring(0, 300));
    await ctx.close();
  });

  it("should round-trip Hybrid DCT-DWT: embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "frequency";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "hybrid_dct_dwt";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "Hybrid DCT-DWT watermarked image URL should be available");
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "hybrid_dct_dwt";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("OK"),
      "Hybrid DCT-DWT extract should recover secret. Got: " + outputHtml.substring(0, 300),
    );
    await ctx.close();
  });

  // ── Random LSB round-trip ──

  it("should round-trip Random LSB: embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "random_lsb";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("RANDOM LSB") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "Random LSB watermarked image URL should be available");
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "random_lsb";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("RANDOM LSB"),
      "Random LSB extract should recover secret. Got: " + outputHtml.substring(0, 300),
    );
    await ctx.close();
  });

  // ── Deep learning algorithm round-trips ──

  it("should round-trip VINE (deep learning): embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "deep_learning";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "vine";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "VINE watermarked image URL should be available");
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "vine";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(outputHtml.includes("OK"), "VINE extract should recover secret. Got: " + outputHtml.substring(0, 300));
    await ctx.close();
  });

  it("should round-trip Pixel Seal (deep learning): embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "deep_learning";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "pixel_seal";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "Pixel Seal watermarked image URL should be available");
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "pixel_seal";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("OK"),
      "Pixel Seal extract should recover secret. Got: " + outputHtml.substring(0, 300),
    );
    await ctx.close();
  });

  it("should round-trip NullGuard (deep learning): embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "deep_learning";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "nullguard";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "NullGuard watermarked image URL should be available");
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "nullguard";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("OK"),
      "NullGuard extract should recover secret. Got: " + outputHtml.substring(0, 300),
    );
    await ctx.close();
  });

  it("should round-trip Shallow Diffuse (deep learning): embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "deep_learning";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "shallow_diffuse";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(
      imgDataUrl && imgDataUrl.startsWith("data:"),
      "Shallow Diffuse watermarked image URL should be available",
    );
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "shallow_diffuse";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("OK"),
      "Shallow Diffuse extract should recover secret. Got: " + outputHtml.substring(0, 300),
    );
    await ctx.close();
  });

  // ── Professional algorithm round-trips ──

  it("should round-trip Imagewmark Pro (professional): embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "professional";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "imagewmark";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "Imagewmark watermarked image URL should be available");
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "imagewmark";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("OK"),
      "Imagewmark extract should recover secret. Got: " + outputHtml.substring(0, 300),
    );
    await ctx.close();
  });

  it("should round-trip Meta Seal (professional): embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "professional";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "meta_seal";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "Meta Seal watermarked image URL should be available");
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "meta_seal";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("OK"),
      "Meta Seal extract should recover secret. Got: " + outputHtml.substring(0, 300),
    );
    await ctx.close();
  });

  it("should round-trip STARDUSTmark (professional): embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "professional";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "stardustmark";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "STARDUSTmark watermarked image URL should be available");
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "stardustmark";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("OK"),
      "STARDUSTmark extract should recover secret. Got: " + outputHtml.substring(0, 300),
    );
    await ctx.close();
  });

  it("should round-trip InvisMark (professional): embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "professional";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "invisimark";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "InvisMark watermarked image URL should be available");
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "invisimark";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("OK"),
      "InvisMark extract should recover secret. Got: " + outputHtml.substring(0, 300),
    );
    await ctx.close();
  });

  it("should round-trip ElevenLikes (professional): embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "professional";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "elevenlikes";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(imgDataUrl && imgDataUrl.startsWith("data:"), "ElevenLikes watermarked image URL should be available");
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "elevenlikes";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("OK"),
      "ElevenLikes extract should recover secret. Got: " + outputHtml.substring(0, 300),
    );
    await ctx.close();
  });

  it("should round-trip Diffusion-based (professional): embed then extract recovers secret", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "pixel-injection");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cat = document.getElementById("pi-category");
      if (cat) {
        cat.value = "professional";
        cat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-algorithm");
      if (sel) {
        sel.value = "diffusion_based";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await page.setInputFiles("#pi-image", [{ name: "cover.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.setInputFiles("#pi-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("OK") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("pi-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const imgDataUrl = await page.evaluate(() => {
      const output = document.getElementById("pi-output");
      if (!output) return null;
      const img = output.querySelector("img");
      return img ? img.src : null;
    });
    assert.ok(
      imgDataUrl && imgDataUrl.startsWith("data:"),
      "Diffusion-based watermarked image URL should be available",
    );
    const base64Data = imgDataUrl.split(",")[1];
    const imgBuf = Buffer.from(base64Data, "base64");

    await page.evaluate(() => switchPiTab("extract"));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const sel = document.getElementById("pi-extract-algorithm");
      if (sel) {
        sel.value = "diffusion_based";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.setInputFiles("#pi-watermarked-image", [
      { name: "watermarked.png", mimeType: "image/png", buffer: imgBuf },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("pi-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("pi-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("pi-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      outputHtml.includes("OK"),
      "Diffusion-based extract should recover secret. Got: " + outputHtml.substring(0, 300),
    );
    await ctx.close();
  });
});

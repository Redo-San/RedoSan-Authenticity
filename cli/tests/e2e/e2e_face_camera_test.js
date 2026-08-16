const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("path");

const PORT = 9897;
const BASE = `http://localhost:${PORT}`;

let browser, server;

before(async () => {
  server = await startServer(PORT);
  browser = await chromium.launch({
    headless: true,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
});
after(async () => {
  if (browser) await browser.close();
  stopServer();
});

async function openFacePage() {
  const ctx = await browser.newContext({
    permissions: ["camera", "microphone"],
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(90000);
  await page.goto(`${BASE}/Style/pages/face-biometric/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const el = document.getElementById("botBlockOverlay");
    if (el) {
      el.style.display = "none";
      el.classList.remove("active");
    }
  });
  await page.click('button[onclick="switchFaceInput(\'camera\')"]');
  await page.waitForTimeout(200);
  return { ctx, page };
}

async function startCamera(page) {
  await page.click("#face-cam-start");
  await page.waitForFunction(
    () => (document.getElementById("face-status") || {}).textContent?.includes("Camera started"),
    null,
    { timeout: 45000 },
  );
}

describe("E2E — Face Biometric (fake camera)", () => {
  it("should start the fake camera and show challenge UI in active mode", async () => {
    const { ctx, page } = await openFacePage();
    try {
      const startBtn = page.locator("#face-cam-start");
      assert.ok((await startBtn.count()) === 1, "Camera start button exists");
      await page.selectOption("#face-liveness-mode", "active");
      await startCamera(page);
      const status = await page.textContent("#face-status");
      assert.ok(status.includes("Camera started"), "Camera should start with fake media stream");

      const captureEnabled = !(await page.isDisabled("#face-cam-capture"));
      const fileDisabled = await page.isDisabled("#face-image");
      assert.ok(captureEnabled, "Capture button enabled while camera active");
      assert.ok(fileDisabled, "File upload disabled while camera active");
      await ctx.close();
    } finally {
      await ctx.close().catch(() => {});
    }
  });

  it("should render challenge instructions in the challenge box", async () => {
    const { ctx, page } = await openFacePage();
    try {
      await page.selectOption("#face-liveness-mode", "active");
      await startCamera(page);
      const probe = await page.evaluate(() => {
        const before = (document.getElementById("face-challenge") || {}).textContent || "";
        window.renderFaceChallenge({ type: "blink", index: 0, total: 2, done: false });
        const after = (document.getElementById("face-challenge") || {}).textContent || "";
        const visible = getComputedStyle(document.getElementById("face-challenge")).display !== "none";
        window.renderFaceChallenge(null);
        const cleared = (document.getElementById("face-challenge") || {}).textContent || "";
        return { before, after, visible, cleared };
      });
      assert.ok(/Blink/i.test(probe.after), "challenge box should show the blink instruction, got: " + probe.after);
      assert.ok(probe.visible, "challenge box should be visible while a challenge is active");
      assert.ok(probe.cleared.length === 0, "challenge box should clear after renderFaceChallenge(null)");
      await ctx.close();
    } finally {
      await ctx.close().catch(() => {});
    }
  });

  it("should stop the camera and re-enable upload", async () => {
    const { ctx, page } = await openFacePage();
    try {
      await page.click("#face-cam-start");
      await startCamera(page);
      await page.click("#face-cam-stop");
      await page.waitForTimeout(800);
      const fileEnabled = !(await page.isDisabled("#face-image"));
      assert.ok(fileEnabled, "File upload re-enabled after camera stop");
      await ctx.close();
    } finally {
      await ctx.close().catch(() => {});
    }
  });

  it("should not have critical console or page errors", async () => {
    const { ctx, page } = await openFacePage();
    try {
      const errors = [];
      page.on("pageerror", (err) => errors.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      await startCamera(page);
      await page.waitForTimeout(1000);
      await ctx.close();
      const critical = errors.filter(
        (e) => !e.includes("404") && !e.includes("Failed to load resource") && !e.includes("media") && !e.includes("WebGL"),
      );
      assert.deepEqual(critical, []);
    } finally {
      await ctx.close().catch(() => {});
    }
  });
});
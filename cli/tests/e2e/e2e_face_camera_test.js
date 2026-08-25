const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("path");

const PORT = 9911;
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

async function withTimeout(promise, ms, label) {
  let timer;
  const guard = new Promise((_res, rej) => {
    timer = setTimeout(() => rej(new Error(label + " timed out after " + ms + "ms")), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

async function openFacePage() {
  const ctx = await browser.newContext({
    permissions: ["camera", "microphone"],
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(90000);
  page.__diag = { console: [], errors: [] };
  page.on("console", (m) => {
    if (page.__diag.console.length < 12)
      page.__diag.console.push(m.type() + ": " + String(m.text()).slice(0, 120));
  });
  page.on("pageerror", (e) => {
    if (page.__diag.errors.length < 8) page.__diag.errors.push(String(e).slice(0, 160));
  });
  await page.goto(`${BASE}/Style/pages/face-biometric/index.html`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const el = document.getElementById("botBlockOverlay");
    if (el) {
      el.style.display = "none";
      el.classList.remove("active");
    }
  });
  // Accept the biometric consent notice so collection entry points unlock.
  const check = page.locator("#face-consent-check");
  if ((await check.count()) === 1) {
    await check.check();
    await page.click("#face-consent-accept");
    await page.waitForFunction(
      () => (document.getElementById("face-consent-panel") || {}).style?.display === "none",
      null,
      { timeout: 15000 },
    );
  }
  // Software authenticator for headless CI so passkey registration cannot
  // hang or fail; silently skipped when the CDP domain is unavailable.
  try {
    const cdp = await withTimeout(ctx.newCDPSession(page), 8000, "newCDPSession");
    await withTimeout(cdp.send("WebAuthn.enable"), 8000, "WebAuthn.enable");
    await withTimeout(
      cdp.send("WebAuthn.addAuthenticator", {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      }),
      8000,
      "WebAuthn.addAuthenticator",
    );
    page.__authenticator = true;
  } catch (_e) {
    page.__authenticator = false;
  }
  // Stage an enrolled passkey reference: the strict generation gate
  // (#388) then behaves like a returning real user. Non-fatal: the
  // capability-aware gate skips passkeys when this cannot be staged.
  try {
    await withTimeout(
      page.evaluate(async function () {
        if (!window.faceRegistry) return "no-registry";
        const existing = await window.faceRegistry.getMeta("passkey");
        if (!existing) {
          await window.faceRegistry.setMeta("passkey", {
            credentialId: "e2e-virtual-passkey",
            name: "E2E Virtual Passkey",
            createdAt: new Date().toISOString(),
          });
        }
        if (typeof window.refreshPasskeyStatus === "function") {
          await window.refreshPasskeyStatus();
        }
        return "staged";
      }),
      12000,
      "stage-passkey-meta",
    );
  } catch (stageErr) {
    console.log("[openFacePage] passkey staging skipped:", String(stageErr.message).slice(0, 120));
  }
  await page.click('button[onclick="switchFaceInput(\'camera\')"]');
  await page.waitForTimeout(200);
  return { ctx, page };
}

async function startCamera(page) {
  await page.click("#face-cam-start");
  let last = "";
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(2000);
    last = await page.evaluate(
      () => (document.getElementById("face-status") || {}).textContent || "",
    );
    console.log(`[cam-diag ${i * 2}s] ${last.slice(0, 90)}`);
    if (last.includes("Camera started")) return;
    if (/error|failed/i.test(last)) break;
  }
  const diag = await page
    .evaluate(() => ({
      status: (document.getElementById("face-status") || {}).textContent,
      hasFaceCameraClass: typeof window.FaceCamera === "function",
      cameraInstance: !!window.faceCamera,
      consentRaw: (window.sessionStorage || {}).getItem
        ? window.sessionStorage.getItem("redoSan.faceConsent")
        : null,
      waAvailable: window.FaceWebauthn
        ? (() => {
            try {
              return window.FaceWebauthn.isAvailable();
            } catch (e) {
              return "throw:" + e.message;
            }
          })()
        : "no-module",
    }))
    .catch((e) => ({ evalErr: String(e) }));
  diag.authenticatorAttached = !!page.__authenticator;
  diag.consoleTail = page.__diag ? page.__diag.console : [];
  diag.pageErrors = page.__diag ? page.__diag.errors : [];
  throw new Error("camera did not start :: " + JSON.stringify(diag));
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
      await page.click("#face-cam-capture");
      await page.waitForFunction(
        () =>
          ((document.getElementById("face-challenge") || {}).textContent || "").length > 0 ||
          /Liveness|challenge/i.test((document.getElementById("face-status") || {}).textContent || ""),
        null,
        { timeout: 30000 },
      );
      await ctx.close();
    } finally {
      await ctx.close().catch(() => {});
    }
  });

  it("should stop the camera and re-enable upload", async () => {
    const { ctx, page } = await openFacePage();
    try {
      await startCamera(page);
      await page.click("#face-cam-stop");
      await page.waitForFunction(
        () => (document.getElementById("face-status") || {}).textContent?.includes("stopped"),
        null,
        { timeout: 15000 },
      );
      const captureDisabled = await page.isDisabled("#face-cam-capture");
      const fileEnabled = !(await page.isDisabled("#face-image"));
      assert.ok(captureDisabled, "Capture button disabled after stop");
      assert.ok(fileEnabled, "File upload re-enabled after stop");
      await ctx.close();
    } finally {
      await ctx.close().catch(() => {});
    }
  });

  it("should not have critical console or page errors", async () => {
    const { ctx, page } = await openFacePage();
    try {
      await startCamera(page);
      const critical = page.__diag.console.filter(
        (c) => c.startsWith("error:") && !/favicon|404/i.test(c),
      );
      assert.deepEqual(critical, [], "no critical console errors");
      assert.deepEqual(page.__diag.errors, [], "no uncaught page errors");
      await ctx.close();
    } finally {
      await ctx.close().catch(() => {});
    }
  });
});

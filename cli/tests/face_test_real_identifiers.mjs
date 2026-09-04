import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imgPath = path.join(
  __dirname,
  "fixtures",
  "face_identifier_test_img.jpg",
);

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();

page.on("console", (msg) => {
  const text = msg.text();
  if (msg.type() === "error") consoleErrors.push(text);
  if (
    text.includes("Human:") ||
    text.includes("BioHash") ||
    text.includes("Fuzzy")
  )
    console.log("CONSOLE " + msg.type() + ": " + text);
});

page.on("pageerror", (err) => {
  pageErrors.push(err.message);
  console.log("PAGE ERROR: " + err.message);
});

await page.goto("http://127.0.0.1:8080/Style/pages/face-biometric/index.html", {
  waitUntil: "networkidle",
  timeout: 30000,
});

console.log("Page loaded, waiting for Human library...");

await page.waitForFunction(() => typeof window.Human !== "undefined", {
  timeout: 15000,
});
await page.waitForFunction(
  () =>
    typeof window.FaceBioHash !== "undefined" &&
    typeof window.FaceFuzzy !== "undefined",
  { timeout: 15000 },
);
console.log(
  "Identifiers loaded: " +
    (await page.evaluate(
      () =>
        typeof window.FaceBioHash !== "undefined" &&
        typeof window.FaceFuzzy !== "undefined",
    )),
);

// Disable bot block overlay for headless test
await page.evaluate(() => {
  var el = document.getElementById("botBlockOverlay");
  if (el) {
    el.style.display = "none";
    el.classList.remove("active");
  }
});

// Accept the biometric consent notice so collection entry points unlock.
const consentCheck = page.locator("#face-consent-check");
if ((await consentCheck.count()) === 1) {
  await consentCheck.check();
  await page.click("#face-consent-accept");
  await page.waitForTimeout(300);
}

await page.waitForTimeout(2000);

async function waitForTrue(fn, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await page.waitForTimeout(500);
  }
  console.log("TIMEOUT waiting for: " + label);
  return false;
}

// ── Initial state: run button disabled ──
const runDisabledInitial = await page.isDisabled("#face-run");
console.log("Run button disabled initially: " + runDisabledInitial);
if (!runDisabledInitial) {
  console.log("FAIL: Generate Identifiers button must start disabled");
}

// ── Camera leg (tab: Capture with Camera) ──
await page.click("button[onclick=\"switchFaceInput('camera')\"]");
await page.waitForTimeout(200);
const camWrapperVisible = await page.evaluate(
  () =>
    document.getElementById("face-capture-wrapper").style.display === "block",
);
const uploadWrapperHidden = await page.evaluate(
  () => document.getElementById("face-upload-wrapper").style.display === "none",
);
console.log("Capture wrapper visible on camera tab: " + camWrapperVisible);
console.log("Upload wrapper hidden on camera tab: " + uploadWrapperHidden);
if (!camWrapperVisible)
  console.log("FAIL: capture wrapper must show on the camera tab");
if (!uploadWrapperHidden)
  console.log("FAIL: upload wrapper must hide on the camera tab");
await page.selectOption("#face-liveness-mode", "off");
await page.click("#face-cam-start");
await waitForTrue(
  async () =>
    ((await page.textContent("#face-status")) || "").includes("Camera started"),
  15000,
  "camera start",
);
console.log("Camera status: " + (await page.textContent("#face-status")));

const fileDisabledWhileCamera = await page.isDisabled("#face-image");
const captureEnabledWhileCamera = !(await page.isDisabled("#face-cam-capture"));
console.log(
  "File input disabled while camera active: " + fileDisabledWhileCamera,
);
console.log(
  "Capture button enabled while camera active: " + captureEnabledWhileCamera,
);
if (!fileDisabledWhileCamera)
  console.log("FAIL: file upload must be disabled while the camera is running");
if (!captureEnabledWhileCamera)
  console.log(
    "FAIL: capture button must be enabled while the camera is running",
  );

// Capture a frame (stages it, does NOT run the pipeline)
await page.click("#face-cam-capture");
await waitForTrue(
  async () => await page.evaluate(() => !!window._facePendingSource),
  10000,
  "camera frame staged",
);
const camStaged = await page.evaluate(() => ({
  source: window._facePendingSource && window._facePendingSource.source,
  fileName: window._facePendingSource && window._facePendingSource.fileName,
}));
console.log("Camera frame staged: " + JSON.stringify(camStaged));
const reportBeforeRun = await page.evaluate(() => !!window._faceReport);
console.log(
  "Report NOT generated on capture (expected false): " + reportBeforeRun,
);
if (reportBeforeRun)
  console.log("FAIL: pipeline must not run on capture alone");

// Label empty → run stays disabled
const runDisabledAfterCapture = await page.isDisabled("#face-run");
console.log(
  "Run button disabled after capture (no label): " + runDisabledAfterCapture,
);
if (!runDisabledAfterCapture)
  console.log("FAIL: run button must need the label field");

await page.fill("#face-label", "Cam Face");
await page.waitForTimeout(200);
const runEnabledAfterLabel = !(await page.isDisabled("#face-run"));
console.log("Run button enabled after label filled: " + runEnabledAfterLabel);
if (!runEnabledAfterLabel)
  console.log("FAIL: run button must enable when label is filled");

// Run the pipeline on the camera frame.
// NOTE: the headless fake camera has no real face, so stage the fixture image
// on the pending canvas (kept as source "camera") to exercise the camera path.
await page.evaluate(async () => {
  const img = new Image();
  img.src =
    "http://127.0.0.1:8080/cli/tests/fixtures/face_identifier_test_img.jpg";
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
  });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext("2d").drawImage(img, 0, 0);
  window._facePendingCanvas = c;
  window._facePendingSource.source = "camera";
});
await page.click("#face-run");
const camReportOk = await waitForTrue(
  async () => await page.evaluate(() => !!window._faceReport),
  90000,
  "camera pipeline report",
);
const camReport = await page.evaluate(() => {
  const r = window._faceReport;
  return r
    ? {
        source: r.source,
        fileName: r.photo && r.photo.fileName,
        facesDetected: r.photo && r.photo.facesDetected,
        liveness: r.liveness,
        registeredId: r.registry && r.registry.registeredId,
        didPrefix: r.did && r.did.did && r.did.did.substring(0, 15),
        signature:
          r.did && r.did.signature ? r.did.signature.substring(0, 12) : null,
        bioHashHex:
          r.biohash && r.biohash.codeHex
            ? r.biohash.codeHex.substring(0, 16)
            : null,
        fuzzyKey: r.fuzzy && r.fuzzy.key ? r.fuzzy.key.substring(0, 12) : null,
      }
    : null;
});
console.log("Camera report: " + JSON.stringify(camReport));
if (!camReportOk) console.log("FAIL: no camera pipeline report");
else if (
  camReport.source !== "camera" ||
  camReport.fileName !== "camera_capture"
)
  console.log("FAIL: camera report source/fileName mismatch");
else if (camReport.liveness !== null)
  console.log("FAIL: liveness off should give null evidence");
else if (!camReport.registeredId)
  console.log("FAIL: auto-register should happen with a label");

// Stop the camera → back to the upload tab
await page.click("#face-cam-stop");
await page.waitForTimeout(300);
await page.click("button[onclick=\"switchFaceInput('upload')\"]");
await page.waitForTimeout(200);
const uploadWrapperVisible = await page.evaluate(
  () =>
    document.getElementById("face-upload-wrapper").style.display === "block",
);
const fileEnabledAfterStop = !(await page.isDisabled("#face-image"));
const captureDisabledAfterStop = await page.isDisabled("#face-cam-capture");
console.log(
  "Upload wrapper visible after switching back: " + uploadWrapperVisible,
);
console.log("File input re-enabled after camera stop: " + fileEnabledAfterStop);
console.log("Capture disabled after camera stop: " + captureDisabledAfterStop);
if (!uploadWrapperVisible)
  console.log("FAIL: upload wrapper must show on the upload tab");
if (!fileEnabledAfterStop)
  console.log("FAIL: file upload must be re-enabled after the camera stops");
if (!captureDisabledAfterStop)
  console.log("FAIL: capture button must be disabled after the camera stops");

// ── File leg (upload → fill label → Generate) ──
await page.fill("#face-label", "");
await page.waitForTimeout(200);
const fileInput = page.locator("#face-image");
await fileInput.setInputFiles(imgPath);
await waitForTrue(
  async () =>
    await page.evaluate(
      () =>
        window._facePendingSource &&
        window._facePendingSource.source === "file",
    ),
  10000,
  "file staged",
);
const fileStaged = await page.evaluate(() => ({
  source: window._facePendingSource && window._facePendingSource.source,
  fileName: window._facePendingSource && window._facePendingSource.fileName,
}));
console.log("File staged: " + JSON.stringify(fileStaged));
const runDisabledAfterFile = await page.isDisabled("#face-run");
console.log(
  "Run button disabled after upload (label empty): " + runDisabledAfterFile,
);
if (!runDisabledAfterFile)
  console.log("FAIL: run button must stay disabled until the label is filled");
const camStartDisabledInFileMode = await page.isDisabled("#face-cam-start");
console.log(
  "Camera start disabled in file mode: " + camStartDisabledInFileMode,
);
if (!camStartDisabledInFileMode)
  console.log("FAIL: camera must be disabled while a photo is picked");

await page.fill("#face-label", "Real Test Face");
await page.waitForTimeout(200);
const runEnabledFile = !(await page.isDisabled("#face-run"));
console.log("Run button enabled (file): " + runEnabledFile);
if (!runEnabledFile) console.log("FAIL: run button must enable for file flow");

await page.click("#face-run");
const fileReportOk = await waitForTrue(
  async () => {
    const r = await page.evaluate(() => window._faceReport);
    return !!(r && r.source === "file");
  },
  90000,
  "file pipeline report",
);
const fileReport = await page.evaluate(() => {
  const r = window._faceReport;
  return r
    ? {
        source: r.source,
        fileName: r.photo && r.photo.fileName,
        facesDetected: r.photo && r.photo.facesDetected,
        confidence: r.photo && r.photo.confidence,
        descriptorDim: r.photo && r.photo.descriptorDim,
        did: r.did && r.did.did,
        algorithm: r.did && r.did.algorithm,
        signature:
          r.did && r.did.signature ? r.did.signature.substring(0, 12) : null,
        signedAt: r.did && r.did.signedAt,
        didDocId: r.did && r.did.document && r.did.document.id,
        vcIssuer:
          r.did &&
          r.did.verifiableCredential &&
          r.did.verifiableCredential.issuer,
        biohashBits: r.biohash && r.biohash.bits,
        biohashHex: r.biohash && r.biohash.codeHex,
        biohashPinAuto: r.biohash && r.biohash.pinAuto,
        fuzzyBits: r.fuzzy && r.fuzzy.bits,
        fuzzyKey: r.fuzzy && r.fuzzy.key,
        registryMatch: r.registry && r.registry.match,
        registeredId: r.registry && r.registry.registeredId,
      }
    : null;
});
console.log("File report: " + JSON.stringify(fileReport));
if (!fileReportOk) console.log("FAIL: no file pipeline report");
else {
  if (
    fileReport.source !== "file" ||
    fileReport.fileName !== "face_identifier_test_img.jpg"
  )
    console.log("FAIL: source/fileName mismatch");
  if (fileReport.facesDetected < 1)
    console.log("FAIL: no face detected in the real photo");
  if (!fileReport.did || !fileReport.did.startsWith("did:key:"))
    console.log("FAIL: DID missing");
  if (fileReport.algorithm !== "Ed25519") console.log("FAIL: DID algorithm");
  if (!fileReport.signature) console.log("FAIL: signature missing");
  if (!fileReport.didDocId || !fileReport.vcIssuer)
    console.log("FAIL: DID document / VC missing");
  if (!fileReport.biohashHex || fileReport.biohashHex.length !== 32)
    console.log("FAIL: BioHash hex must be 32 chars");
  if (fileReport.biohashPinAuto !== true)
    console.log("FAIL: PIN is auto-generated now");
  if (!fileReport.fuzzyKey) console.log("FAIL: Fuzzy key missing");
  if (!fileReport.registeredId)
    console.log("FAIL: auto-register should have run");
}

const doneStatus = await page.textContent("#face-status");
console.log("Final status: " + doneStatus);

// ── Registry list ──
await page.click('button[onclick="listRegisteredFaces()"]');
await page.waitForTimeout(500);
const listCount = await page.evaluate(
  () => document.querySelectorAll("#face-list .face-list-item").length,
);
const faceCountLabel = await page.textContent("#face-count");
console.log("Manage list rows: " + listCount + " | " + faceCountLabel);

// ── Download Results (JSON via modal) ──
await page.click('button[onclick="showDownloadModal()"]');
await page.waitForTimeout(300);
const modalOpen = await page.evaluate(() =>
  document.getElementById("dl-modal").classList.contains("open"),
);
console.log("Download modal open: " + modalOpen);
const dlPromise = page
  .waitForEvent("download", { timeout: 15000 })
  .catch(() => null);
await page.click("button[onclick=\"downloadResult('json')\"]");
await page.waitForTimeout(1200);
const dl = await dlPromise;
console.log("JSON download: " + (dl ? dl.suggestedFilename() : "NO DOWNLOAD"));
if (dl) {
  const f = path.join(__dirname, "face_identifiers_report_dl.json");
  await dl.saveAs(f);
  console.log("Saved: " + f);
}
// downloadResult() closes the modal itself; verify it did.
await page.waitForTimeout(300);
const modalClosed = await page.evaluate(
  () => !document.getElementById("dl-modal").classList.contains("open"),
);
console.log("Modal auto-closed after download: " + modalClosed);
if (!modalClosed) console.log("FAIL: modal should auto-close after download");

// ── Issue Verifiable Credential (replaces removed cert-data button) ──
const vcBtnCount = await page
  .locator('button[onclick="handleFaceIssueCredential()"]')
  .count();
console.log("Issue VC button found: " + (vcBtnCount > 0));
if (vcBtnCount > 0) {
  await page.click('button[onclick="handleFaceIssueCredential()"]');
  await page.waitForTimeout(800);
  const vcData = await page.evaluate(() => !!window._faceCredential);
  console.log("Verifiable credential stored: " + vcData);
  if (!vcData) console.log("FAIL: credential data not stored");
}

// ── Delete + Clear ──
const delButtons = page.locator(
  '#face-list button[onclick^="handleFaceDelete"]',
);
const delCount = await delButtons.count();
console.log("Delete buttons found: " + delCount);
if (delCount > 0) {
  await delButtons.first().click();
  await page.waitForTimeout(800);
  const delStatus = await page.textContent("#face-status");
  console.log("Delete status: " + delStatus);
}
await page.click('button[onclick="listRegisteredFaces()"]');
await page.waitForTimeout(500);
const afterDelete = await page.evaluate(
  () => document.querySelectorAll("#face-list .face-list-item").length,
);
console.log("List rows after delete: " + afterDelete);
page.once("dialog", (d) => d.accept());
await page.click('button[onclick="handleFaceClear()"]');
await page.waitForTimeout(800);
await page.click('button[onclick="listRegisteredFaces()"]');
await page.waitForTimeout(500);
const afterClear = await page.evaluate(
  () => document.querySelectorAll("#face-list .face-list-item").length,
);
console.log("List rows after clear: " + afterClear);

// ── ArcFace ONNX leg (real model via onnxruntime-web) ──
console.log("---- ARC-FACE (ONNX) LEG ----");
await page.selectOption("#face-embedder", "arcface");
const arcChoice = await page.evaluate(() => getFaceEmbedderChoice());
console.log("Embedder choice: " + arcChoice);
if (arcChoice !== "arcface")
  console.log("FAIL: arcface embedder choice must be selected");

const arcLoaded = await page.evaluate(async () => {
  if (typeof FaceONNXEmbedder === "undefined") return "module-missing";
  const ready = FaceONNXEmbedder.isReady();
  if (ready) return "already-ready";
  const ok = await FaceONNXEmbedder.load();
  return ok ? "loaded" : "load-failed";
});
console.log("ArcFace ONNX load: " + arcLoaded);
if (arcLoaded !== "loaded" && arcLoaded !== "already-ready")
  console.log("FAIL: ArcFace ONNX model must load");
const arcBackend = await page.evaluate(() => FaceONNXEmbedder.getBackend());
console.log("ArcFace ONNX backend: " + arcBackend);

// Run the full pipeline with ArcFace selected on the fixture image (upload tab)
await page.click("button[onclick=\"switchFaceInput('upload')\"]");
await page.waitForTimeout(200);
await page.locator("#face-image").setInputFiles(imgPath);
await page.waitForTimeout(400);
await page.fill("#face-label", "ArcFace Real Test");
await waitForTrue(
  async () => !(await page.isDisabled("#face-run")),
  10000,
  "run enabled (arcface)",
);
await page.click("#face-run");
const arcDone = await waitForTrue(
  async () => {
    const st = await page.textContent("#face-status");
    return st && /Done|Error|failed|fallback/i.test(st);
  },
  240000,
  "arcface pipeline done",
);
console.log("ArcFace pipeline finished: " + arcDone);
await page.waitForTimeout(1000);
const arcState = await page.evaluate(async () => {
  const faces = await window.faceRegistry.getAllFaces();
  const last = faces[faces.length - 1];
  return {
    status: (document.getElementById("face-status") || {}).textContent || "",
    version: last ? last.embeddingVersion : null,
    len: last && last.descriptor ? last.descriptor.length : 0,
  };
});
console.log("ArcFace pipeline status: " + arcState.status);
console.log(
  "ArcFace result: version=" + arcState.version + " len=" + arcState.len,
);
if (arcState.version !== "arcface-mbf")
  console.log(
    "FAIL: ArcFace pipeline must produce arcface-mbf embedding version",
  );
if (arcState.len !== 512) console.log("FAIL: ArcFace descriptor must be 512-d");

// ── Summary ──
console.log("---- CONSOLE ERRORS (" + consoleErrors.length + ") ----");
consoleErrors.slice(0, 10).forEach((e) => {
  console.log("[err] " + e.slice(0, 200));
});
console.log("---- PAGE ERRORS (" + pageErrors.length + ") ----");
pageErrors.slice(0, 10).forEach((e) => {
  console.log("[pageerror] " + e.slice(0, 200));
});

await page.screenshot({
  path: path.join(__dirname, "face_identifiers_result.png"),
  fullPage: true,
});
console.log("Screenshot saved");

await browser.close();
console.log("DONE");

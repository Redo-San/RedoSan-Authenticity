import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imgPath = path.join(__dirname, "face_test_img.jpg");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on("console", (msg) => {
  const text = msg.text();
  if (msg.type() === "error" || /error|fail/i.test(text))
    errors.push(msg.type() + ": " + text);
});
page.on("pageerror", (err) => errors.push("pageerror: " + err.message));

await page.goto("http://127.0.0.1:8080/Style/pages/face-biometric/index.html", {
  waitUntil: "networkidle",
  timeout: 30000,
});
console.log("Page loaded");

await page.waitForFunction(() => typeof window.Human !== "undefined", {
  timeout: 15000,
});
console.log("Human loaded: yes");

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

await page.waitForTimeout(1500);

// -- ArcFace (ONNX) real-browser path -----------------------------------------
await page.selectOption("#face-embedder", "arcface");
await page.locator("#face-image").setInputFiles(imgPath);
await page.locator("#face-label").fill("Real ArcFace Test");
await page.waitForFunction(
  () => {
    const b = document.getElementById("face-run");
    return b && !b.disabled;
  },
  null,
  { timeout: 10000 },
);

await page.click("#face-run");
console.log("Clicked Generate Identifiers (arcface)...");

await page.waitForFunction(
  () => {
    const st = document.getElementById("face-status");
    return st && /Done|Error|failed|fallback|error/i.test(st.textContent);
  },
  null,
  { timeout: 300000 },
);
await page.waitForTimeout(1200);

const status = await page.textContent("#face-status");
console.log("STATUS: " + status);

const arc = await page.evaluate(async () => {
  const faces = await window.faceRegistry.getAllFaces();
  const last = faces[faces.length - 1];
  return {
    version: last ? last.embeddingVersion : null,
    len: last && last.descriptor ? last.descriptor.length : 0,
    count: faces.length,
  };
});
console.log("ArcFace: version=" + arc.version + " descriptorLen=" + arc.len);

const arcOk = arc.version === "arcface-mbf" && arc.len === 512;

// -- Human (HSE) fallback path -------------------------------------------------
await page.selectOption("#face-embedder", "human");
await page.locator("#face-label").fill("Real Human Test");
await page.waitForFunction(
  () => {
    const b = document.getElementById("face-run");
    return b && !b.disabled;
  },
  null,
  { timeout: 10000 },
);
await page.click("#face-run");

await page.waitForFunction(
  () => {
    const st = document.getElementById("face-status");
    return st && /Done|Error|failed|fallback|error/i.test(st.textContent);
  },
  null,
  { timeout: 180000 },
);
await page.waitForTimeout(1200);

const hum = await page.evaluate(async () => {
  const faces = await window.faceRegistry.getAllFaces();
  const last = faces[faces.length - 1];
  return {
    version: last ? last.embeddingVersion : null,
    len: last && last.descriptor ? last.descriptor.length : 0,
  };
});
console.log("Human: version=" + hum.version + " descriptorLen=" + hum.len);

const humOk = hum.version === "human-hse" && hum.len > 0;

await page.screenshot({
  path: path.join(__dirname, "face_test_result.png"),
  fullPage: true,
});
console.log("Screenshot saved");

await browser.close();

console.log(
  "CONSOLE MESSAGES (headless WebGL fallbacks expected): " +
    JSON.stringify(errors, null, 2),
);
console.log(
  "RESULT arcface=" +
    (arcOk ? "PASS" : "FAIL") +
    " human=" +
    (humOk ? "PASS" : "FAIL"),
);
if (!arcOk || !humOk) process.exit(1);
console.log("DONE");

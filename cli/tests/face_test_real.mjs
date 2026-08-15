import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imgPath = path.join(__dirname, "face_test_img.jpg");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

page.on("console", (msg) => {
  const text = msg.text();
  if (text.includes("Human: error") || text.includes("face") || text.includes("error") || text.includes("Detection") || text.includes("model"))
    console.log("CONSOLE " + msg.type() + ": " + text);
});

page.on("pageerror", (err) => console.log("PAGE ERROR: " + err.message));

await page.goto("http://127.0.0.1:8080/Style/pages/face-biometric/index.html", {
  waitUntil: "networkidle",
  timeout: 30000,
});

console.log("Page loaded, waiting for Human library...");

// Wait for Human to initialize
await page.waitForFunction(() => typeof window.Human !== "undefined", { timeout: 15000 });
console.log("Human loaded: " + (await page.evaluate(() => window.Human ? "yes" : "no")));

// Disable bot block overlay for headless test
await page.evaluate(() => {
  var el = document.getElementById("botBlockOverlay");
  if (el) { el.style.display = "none"; el.classList.remove("active"); }
});

await page.waitForTimeout(2000);

// Upload the image
const fileInput = page.locator("#face-image");
await fileInput.setInputFiles(imgPath);
console.log("File uploaded");

// Click Detect Face
await page.click('button:has-text("Detect Face")');
console.log("Clicked Detect Face, waiting for result...");

// Wait for status to change from "Loading models..."
let i;
let s;
for (i = 0; i < 60; i++) {
  s = await page.textContent("#face-status");
  if (s !== "Loading models..." && s !== "") { console.log("Status changed after ~" + (i * 1000) + "s: " + s); break; }
  await page.waitForTimeout(1000);
}

const status = await page.textContent("#face-status");
console.log("STATUS: " + status);

// Check if descriptor was stored
const hasDescriptor = await page.evaluate(() => !!window._lastDescriptor);
console.log("Descriptor stored: " + hasDescriptor);

const faceCount = await page.evaluate(() => window._lastFaceCount);
console.log("Faces detected: " + faceCount);

// Take screenshot for verification
await page.screenshot({ path: path.join(__dirname, "face_test_result.png"), fullPage: true });
console.log("Screenshot saved");

await browser.close();
console.log("DONE");

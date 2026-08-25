const fs = require("fs");
const src = fs.readFileSync("Face_Biometric/face_ui.js", "utf8");
const lines = src.split("\n");

// Find hardcoded English in setStatus() calls (not using __())
console.log("=== setStatus with hardcoded EN ===");
lines.forEach((line, i) => {
  if (/setStatus\(/.test(line) && /"[A-Z][a-z]/.test(line) && !/__\(/.test(line)) {
    console.log(`${i + 1}: ${line.trim().slice(0, 130)}`);
  }
});

// Find hardcoded English in innerHTML assignments
console.log("\n=== innerHTML with hardcoded EN ===");
lines.forEach((line, i) => {
  if (/innerHTML\s*[+]?=/.test(line) && /"[A-Z][a-z]{3,}/.test(line) && !/__\(/.test(line) && !/^\/\//.test(line.trim())) {
    console.log(`${i + 1}: ${line.trim().slice(0, 130)}`);
  }
});

// Find hardcoded English in string concatenation for HTML
console.log("\n=== string concat with hardcoded EN text ===");
let inBlock = false, blockStart = 0;
lines.forEach((line, i) => {
  const t = line.trim();
  if (/^\+.*['"][A-Z][a-z]{3,}/.test(t) && !/__\(/.test(t) && !/^\+\s*["']<\/?[a-z]/.test(t)) {
    console.log(`${i + 1}: ${t.slice(0, 130)}`);
  }
});

// Check which face.* keys exist in AR but still have English values
console.log("\n=== face.* keys with English values in AR file ===");
const ar = fs.readFileSync("Style/lang/i18n-data-ar.js", "utf8");
const enKeys = [...src.matchAll(/__\(\s*"([^"]+)"\s*,\s*"/g)].map((m) => m[1]);
const untranslated = [];
for (const key of [...new Set(enKeys)]) {
  const esc = key.replace(/\./g, "\\.");
  const re = new RegExp('"' + esc + '"\\s*:\\s*"([^"]*)"');
  const m = ar.match(re);
  if (!m || /^[A-Z][a-z]+\s[a-z]/.test(m[1])) {
    untranslated.push(key);
  }
}
console.log(`Total __() keys used: ${new Set(enKeys).size}`);
console.log(`Untranslated in AR: ${untranslated.length}`);
untranslated.forEach((k) => console.log("  " + k));

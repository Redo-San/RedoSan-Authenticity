const fs = require("fs");
const FILE = "Face_Biometric/face_ui.js";
let src = fs.readFileSync(FILE, 'utf8');
const lines = src.split("\n");

// Collect all hardcoded setStatus calls
const changes = [];
lines.forEach((line, i) => {
  const m = line.match(/setStatus\(\s*"face-status"\s*,\s*"(?!.*__\()(.*?)"\s*\)/);
  if (!m) return;
  const text = m[1];
  if (/__\(/.test(line)) return; // already wrapped

  // Generate key from text: camelCase slug
  const key = text
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .map((w, idx) => idx === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  changes.push({ lineNum: i + 1, original: line, key: "face.status." + key, text });
});

console.log(`Found ${changes.length} hardcoded setStatus calls to wrap`);
changes.forEach(c => console.log(`  L${c.lineNum}: "${c.text.slice(0, 60)}" -> ${c.key}`));

// Apply replacements
for (const c of changes) {
  const oldStr = `setStatus("face-status", "${c.text}")`;
  const newStr = `setStatus(\n        "face-status",\n        __("${c.key}", "${c.text}")\n      )`;
  src = src.replace(oldStr, newStr);
}

fs.writeFileSync(FILE, src, "utf8");
console.log(`\nApplied ${changes.length} replacements`);

// Output keys for i18n files
console.log("\n=== ADD THESE KEYS TO EN AND AR ===");
changes.forEach(c => {
  const jsonKey = c.key;
  const escText = c.text.replace(/"/g, '\\"');
  console.log(`"${jsonKey}": "${escText}",`);
});

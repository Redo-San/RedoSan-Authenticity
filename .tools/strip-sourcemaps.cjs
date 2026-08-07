"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const files = ["vendor/jspdf.umd.min.js", "vendor/pdf-lib.min.js", "vendor/qrious.min.js", "Converter/ffmpeg.min.js"];

let changed = 0;
for (const rel of files) {
  const f = path.join(root, rel);
  let src = fs.readFileSync(f, "utf8");
  const before = src;
  src = src.replace(/\n?\/\/#\s*sourceMappingURL=[^\n]*/g, "");
  if (src !== before) {
    fs.writeFileSync(f, src, "utf8");
    changed++;
    console.log("STRIPPED: " + rel);
  } else {
    console.log("NO CHANGE: " + rel);
  }
}
console.log("changed=" + changed + " of " + files.length);

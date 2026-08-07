"use strict";
const fs = require("fs");
const path = require("path");

const f = path.join(__dirname, "..", "Style", "i18n.js");
let src = fs.readFileSync(f, "utf8");
let changes = 0;

function replaceBlock(re, replacement, label) {
  const m = src.match(re);
  if (!m) {
    console.log("NOT FOUND: " + label);
    return;
  }
  src = src.replace(re, replacement);
  changes++;
  console.log("REPLACED: " + label);
}

replaceBlock(
  /var alternatives = \{[\s\S]*?\};/,
  "  var alternatives = {\n" +
    "    'en': 'العربية',\n" +
    "    'ar': 'English',\n" +
    "    'fr': 'English',\n" +
    "    'de': 'English',\n" +
    "    'es': 'English',\n" +
    "    'zh': 'English',\n" +
    "    'ja': 'English',\n" +
    "    'ko': 'English'\n" +
    "  };",
  "alternatives map",
);

replaceBlock(
  /var names = \{[\s\S]*?\};/,
  "  var names = {\n" +
    "    'en': 'English',\n" +
    "    'ar': 'العربية',\n" +
    "    'fr': 'Français',\n" +
    "    'de': 'Deutsch',\n" +
    "    'es': 'Español',\n" +
    "    'zh': '中文',\n" +
    "    'ja': '日本語',\n" +
    "    'ko': '한국어'\n" +
    "  };",
  "names map",
);

const commentMatch = src.match(/\/\/ .*?Internationalization.*/);
if (commentMatch) {
  src = src.replace(commentMatch[0], "// ◆◆ Internationalization ◆◆");
  changes++;
  console.log("REPLACED: header comment");
} else {
  console.log("NOT FOUND: header comment");
}

fs.writeFileSync(f, src, "utf8");
console.log("changes=" + changes);

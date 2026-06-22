#!/usr/bin/env node
/**
 * Syncs translation keys from .json files (nested format) to
 * i18n-data-*.js files (flat dot-notation) used by the web UI.
 *
 * The translation bot (translate-i18n.js) only writes to .json files.
 * The browser reads from .js files only. This script bridges the gap.
 *
 * Usage:
 *   node scripts/sync-i18n-json-to-js.js
 */

var fs = require("node:fs");
var path = require("node:path");

var LANG_DIR = path.join(__dirname, "..", "Style", "lang");
var LANGS = ["ar", "de", "es", "fr", "ja", "ko", "zh"];

function flatten(obj, prefix) {
  var result = {};
  for (var key in obj) {
    var p = prefix ? prefix + "." + key : key;
    if (
      typeof obj[key] === "object" &&
      obj[key] !== null &&
      !Array.isArray(obj[key])
    ) {
      Object.assign(result, flatten(obj[key], p));
    } else {
      result[p] = obj[key];
    }
  }
  return result;
}

function jsEscape(str) {
  return str
    .replace(/\\/g, String.raw`\\`)
    .replace(/"/g, String.raw`\"`)
    .replace(/\n/g, String.raw`\n`)
    .replace(/\r/g, String.raw`\r`)
    .replace(/\t/g, String.raw`\t`);
}

for (var i = 0; i < LANGS.length; i++) {
  var lang = LANGS[i];
  var jsonPath = path.join(LANG_DIR, lang + ".json");
  var jsPath = path.join(LANG_DIR, "i18n-data-" + lang + ".js");

  var flat = flatten(JSON.parse(fs.readFileSync(jsonPath, "utf8")), "");

  var jsContent = fs.readFileSync(jsPath, "utf8");
  var start = jsContent.indexOf("{");
  var end = jsContent.lastIndexOf("};");
  if (start === -1 || end === -1) {
    console.error("Cannot parse " + jsPath);
    continue;
  }
  var body = jsContent.slice(start + 1, end);

  // Collect existing keys via simple regex
  var existing = {};
  var re = /^\s*"([^"]+)"\s*:/gm;
  var m;
  while ((m = re.exec(body)) !== null) {
    existing[m[1]] = true;
  }

  var missing = [];
  for (var key in flat) {
    if (!existing[key]) {
      missing.push({ key: key, value: flat[key] });
    }
  }

  if (missing.length === 0) {
    console.log(lang + ": no missing keys");
    continue;
  }

  var insertAt = jsContent.lastIndexOf("};");
  var before = jsContent.slice(0, insertAt);
  var after = jsContent.slice(insertAt);

  var newEntries = missing
    .map(function (e) {
      return '    "' + e.key + '": "' + jsEscape(e.value) + '",';
    })
    .join("\n");

  fs.writeFileSync(jsPath, before + "\n" + newEntries + "\n" + after, "utf8");
  console.log(lang + ": added " + missing.length + " keys");
}

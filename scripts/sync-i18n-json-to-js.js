#!/usr/bin/env node
/**
 * Syncs translation keys from .json files (nested format) to
 * i18n-data-*.js files (flat dot-notation) used by the web UI.
 *
 * The translation bot (translate-i18n.js) only writes to .json files.
 * The browser reads from .js files only. This script bridges the gap.
 *
 * Unlike the previous additive-only approach, this script rebuilds
 * the data object from JSON, so BOTH new keys AND updated values are applied.
 *
 * Usage:
 *   node scripts/sync-i18n-json-to-js.js
 */

var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var LANG_DIR = path.join(__dirname, "..", "Style", "lang");
var LANGS = ["en", "ar", "de", "es", "fr", "ja", "ko", "zh"];

/**
 *
 * @param obj
 * @param prefix
 */
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

/**
 *
 * @param str
 */
function jsEscape(str) {
  return str
    .replace(/\\/g, String.raw`\\`)
    .replace(/"/g, String.raw`\"`)
    .replace(/\n/g, String.raw`\n`)
    .replace(/\r/g, String.raw`\r`)
    .replace(/\t/g, String.raw`\t`);
}

/**
 *
 * @param jsPath
 * @param flat
 * @param lang
 */
function rebuildJS(jsPath, flat, lang) {
  var jsContent = fs.readFileSync(jsPath, "utf8");

  // Find the `=` that assigns the `__I18N_DATA.<lang>` object
  var assignMarker = jsContent.lastIndexOf("__I18N_DATA.");
  if (assignMarker === -1) {
    console.error("Cannot parse " + jsPath + ": no __I18N_DATA. marker");
    return false;
  }
  // From the assignment marker, find the `=` sign, then the opening `{`
  var eqPos = jsContent.indexOf("=", assignMarker);
  if (eqPos === -1) {
    console.error("Cannot parse " + jsPath + ": no = after __I18N_DATA.");
    return false;
  }
  var bracePos = jsContent.indexOf("{", eqPos);
  if (bracePos === -1) {
    console.error("Cannot parse " + jsPath + ": no opening brace found");
    return false;
  }
  // Header: everything up to and including the data object's '{'
  var header = jsContent.slice(0, bracePos + 1);

  // Extract footer: everything from and including the final '};'
  var footerStart = jsContent.lastIndexOf("};");
  if (footerStart === -1) {
    console.error("Cannot parse " + jsPath + ": no closing brace found");
    return false;
  }
  var footer = jsContent.slice(footerStart);

  // Current JS key order (from the committed file) is authoritative so that
  // re-syncing existing keys never reorders them. New keys are appended.
  // This keeps bot-generated diffs minimal (no whole-file reordering noise).
  var existing = {};
  var existingKeys = [];
  try {
    var existingData = {};
    var sandbox = { window: { __I18N_DATA: existingData } };
    vm.runInNewContext(jsContent, sandbox);
    existing = existingData[lang] || {};
    existingKeys = Object.keys(existing);
  } catch (error) {
    console.warn(
      "Could not parse " + jsPath + " for order preservation: " + error.message,
    );
    existing = {};
    existingKeys = [];
  }

  var seen = {};
  var keys = [];
  var i;
  for (i = 0; i < existingKeys.length; i++) {
    var existingKey = existingKeys[i];
    if (existingKey in flat && !seen[existingKey]) {
      keys.push(existingKey);
      seen[existingKey] = true;
    }
  }
  var flatKeys = Object.keys(flat);
  for (i = 0; i < flatKeys.length; i++) {
    var newKey = flatKeys[i];
    if (!seen[newKey]) {
      keys.push(newKey);
      seen[newKey] = true;
    }
  }

  var entries = keys.map(function (key) {
    return '    "' + key + '": "' + jsEscape(flat[key]) + '"';
  });

  fs.writeFileSync(
    jsPath,
    header + "\n" + entries.join(",\n") + "\n" + footer,
    "utf8",
  );
  return true;
}

var hasChanges = false;
for (var i = 0; i < LANGS.length; i++) {
  var lang = LANGS[i];
  var jsonPath = path.join(LANG_DIR, lang + ".json");
  var jsPath = path.join(LANG_DIR, "i18n-data-" + lang + ".js");

  if (!fs.existsSync(jsonPath)) {
    console.log(lang + ": no JSON file, skipping");
    continue;
  }
  if (!fs.existsSync(jsPath)) {
    console.log(lang + ": no JS file, skipping");
    continue;
  }

  var flat = flatten(JSON.parse(fs.readFileSync(jsonPath, "utf8")), "");
  if (rebuildJS(jsPath, flat, lang)) {
    console.log(lang + ": synced " + Object.keys(flat).length + " keys");
    hasChanges = true;
  }
}

if (hasChanges) {
  console.log("\nAll language JS files synced successfully.");
} else {
  console.log("No changes needed.");
}

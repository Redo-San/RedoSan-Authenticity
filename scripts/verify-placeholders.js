#!/usr/bin/env node
var fs = require("node:fs");
var path = require("node:path");
var LANG_DIR = path.join(__dirname, "..", "Style", "lang");

var en = JSON.parse(fs.readFileSync(path.join(LANG_DIR, "en.json"), "utf-8"));

// Flatten English source
var enFlat = {};
(function walk(obj, p) {
  for (var k in obj) {
    var pp = p ? p + "." + k : k;
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k]))
      walk(obj[k], pp);
    else enFlat[pp] = obj[k];
  }
})(en, "");

// Collect all valid {placeholders}
var allValid = [];
for (var k in enFlat) {
  if (typeof enFlat[k] !== "string") continue;
  var m = enFlat[k].match(/\{[^}]+\}/g);
  if (m) allValid = allValid.concat(m);
}
allValid = [...new Set(allValid)];
console.log("Valid placeholders:", allValid);

var LANGS = ["ar", "de", "es", "fr", "ja", "ko", "zh"];
var totalIssues = 0;

for (var l = 0; l < LANGS.length; l++) {
  var lang = LANGS[l];
  var fp = path.join(LANG_DIR, lang + ".json");
  var data = JSON.parse(fs.readFileSync(fp, "utf-8"));
  var flat = {};
  (function walk2(obj, p) {
    for (var k in obj) {
      var pp = p ? p + "." + k : k;
      if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k]))
        walk2(obj[k], pp);
      else flat[pp] = obj[k];
    }
  })(data, "");

  var missing = 0;
  var corrupted = 0;
  for (var key in flat) {
    if (typeof flat[key] !== "string") continue;
    var enVal = enFlat[key];
    if (!enVal || typeof enVal !== "string") continue;
    var enPh = enVal.match(/\{[^}]+\}/g);
    if (!enPh) continue;
    var val = flat[key];
    var transPh = val.match(/\{[^}]+\}/g) || [];

    for (var i = 0; i < enPh.length; i++) {
      if (val.indexOf(enPh[i]) === -1) {
        missing++;
        console.log("  [" + lang + "] MISSING " + enPh[i] + " in key '" + key + "'");
      }
    }
    for (var j = 0; j < transPh.length; j++) {
      if (allValid.indexOf(transPh[j]) === -1) {
        corrupted++;
        console.log("  [" + lang + "] CORRUPTED " + transPh[j] + " in key '" + key + "'");
      }
    }
  }
  if (missing + corrupted > 0) {
    console.log(lang + ": " + missing + " missing, " + corrupted + " corrupted");
    totalIssues += missing + corrupted;
  } else {
    console.log(lang + ": OK");
  }
}
console.log("\nTotal issues: " + totalIssues);
process.exit(totalIssues > 0 ? 1 : 0);

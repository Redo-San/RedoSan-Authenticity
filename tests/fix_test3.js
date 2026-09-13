var fs = require("fs");
var c = fs.readFileSync(
  "cli/tests/e2e/mpa/mpa_voice_biometric_test.js",
  "utf8",
);
var old =
  "var _oldPage = opened.page;\n      try { await _oldPage.close(); } catch (e) {}\n      page = await opened.ctx.newPage();\n      page.setDefaultTimeout(60000);";
var nw =
  'var _oldPage = opened.page;\n      try { await _oldPage.close(); } catch (e) {}\n      page = await opened.ctx.newPage();\n      page.setDefaultTimeout(60000);\n      await page.goto(pageURL(PAGE_ID), { waitUntil: "domcontentloaded" });';
c = c.split(old).join(nw);
fs.writeFileSync("cli/tests/e2e/mpa/mpa_voice_biometric_test.js", c);
console.log("done");

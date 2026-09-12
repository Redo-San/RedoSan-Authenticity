var fs = require("fs");
var c = fs.readFileSync("cli/tests/e2e/mpa_helpers.js", "utf8");
var old = "function ensureServer() {\n  if (started) return Promise.resolve();";
var nw =
  "function ensureServer() {\n  if (started) {\n    var tester = http.request({ host: 'localhost', port: PORT, path: '/', method: 'HEAD' }, function(res) { tester.destroy(); }).on('error', function() {});\n    tester.setTimeout(1000, function() { tester.destroy(); });\n    tester.end();\n    return Promise.resolve();\n  }";
c = c.split(old).join(nw);
fs.writeFileSync("cli/tests/e2e/mpa_helpers.js", c);
console.log("done");

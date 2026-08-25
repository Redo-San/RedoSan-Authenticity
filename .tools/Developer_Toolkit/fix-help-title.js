const fs = require("fs");
let ar = fs.readFileSync("Style/lang/i18n-data-ar.js", "utf8");

// Fix face.help_title: "الوجهية" is wrong adjective form
const re = /("face\.help_title":\s*")[^"]+(")/;
if (re.test(ar)) {
  const newVal = "\u0643\u064A\u0641\u064A\u0629 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0628\u0635\u0645\u0629 \u0627\u0644\u0648\u062C\u0647";
  ar = ar.replace(re, "$1" + newVal + "$2");
  console.log("face.help_title fixed");
}

fs.writeFileSync("Style/lang/i18n-data-ar.js", ar, "utf8");

// verify
const check = fs.readFileSync("Style/lang/i18n-data-ar.js", "utf8");
const m = check.match(/"face\.help_title":\s*"([^"]+)"/);
console.log("now:", m ? m[1] : "?");

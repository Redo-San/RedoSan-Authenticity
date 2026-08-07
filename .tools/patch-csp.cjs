"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const files = [path.join(root, "index.html"), path.join(root, "Style", "pages", "_page_template.html")];
for (const p of fs.readdirSync(path.join(root, "Style", "pages"))) {
  if (p === "_page_template.html") continue;
  const f = path.join(root, "Style", "pages", p, "index.html");
  if (fs.existsSync(f)) files.push(f);
}

const OLD = "; form-action 'none'; object-src 'none'; frame-ancestors 'none'\"";
const NEW = "; form-action 'none'; object-src 'none'\"";

let changed = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const count = src.split(OLD).length - 1;
  if (count > 0) {
    fs.writeFileSync(f, src.split(OLD).join(NEW), "utf8");
    changed += count;
    console.log("PATCHED (" + count + "): " + path.relative(root, f));
  }
}
console.log("changed=" + changed + " of " + files.length);

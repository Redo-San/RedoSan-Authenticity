const fs = require("fs");
const r = JSON.parse(
  fs.readFileSync(".lighthouseci/direct-report.json", "utf8"),
);

const failingIds = [
  "unminified-css",
  "unminified-javascript",
  "image-delivery-insight",
  "network-dependency-tree-insight",
  "render-blocking-insight",
];

for (const id of failingIds) {
  const a = r.audios[id];
  if (!a) continue;
  console.log(`\n=== ${id} (score: ${a.score}) ===`);
  console.log(`Title: ${a.title}`);
  console.log(`Display: ${a.displayValue || "N/A"}`);
  if (a.details && a.details.items) {
    for (const item of a.details.items) {
      console.log(`  - ${JSON.stringify(item).substring(0, 300)}`);
    }
  }
}

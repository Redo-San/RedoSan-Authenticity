"use strict";
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", ".lighthouseci");
const files = fs.readdirSync(dir).filter((f) => /^lhr-\d+\.json$/.test(f));
if (!files.length) {
  console.error("no lhr-*.json in " + dir);
  process.exit(1);
}

function fmtScore(v) {
  if (v === null || v === undefined) return "-";
  return String(Math.round(v * 100));
}

function auditValue(l, id) {
  const a = l.audits[id];
  return a ? a.numericValue : null;
}

const pages = {};
for (const f of files) {
  const l = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const url = (
    l.finalDisplayedUrl ||
    l.requestedUrl ||
    l.finalUrl ||
    "?"
  ).replace(/\/$/, "");
  if (!pages[url]) pages[url] = [];
  pages[url].push({ file: f, l });
}

const rows = [];
for (const [url, runs] of Object.entries(pages)) {
  const best = {
    perf: -1,
    a11y: -1,
    bp: null,
    seo: -1,
    tbt: Infinity,
    lcp: Infinity,
    cls: Infinity,
  };
  const perRun = [];
  for (const { file, l } of runs) {
    const cats = l.categories;
    const tbt = auditValue(l, "total-blocking-time");
    const lcp = auditValue(l, "largest-contentful-paint");
    const cls = auditValue(l, "cumulative-layout-shift");
    const row = {
      file,
      perf: cats.performance ? cats.performance.score : null,
      a11y: cats.accessibility ? cats.accessibility.score : null,
      bp: cats["best-practices"] ? cats["best-practices"].score : null,
      seo: cats.seo ? cats.seo.score : null,
      tbt,
      lcp,
      cls,
    };
    perRun.push(row);
    const m = (v, fn) => (v === null || v === undefined ? 0 : fn(v));
    best.perf = Math.max(
      best.perf,
      m(row.perf, (x) => x),
    );
    best.a11y = Math.max(
      best.a11y,
      m(row.a11y, (x) => x),
    );
    if (row.bp !== null && row.bp !== undefined)
      best.bp = best.bp === null ? row.bp : Math.max(best.bp, row.bp);
    best.seo = Math.max(
      best.seo,
      m(row.seo, (x) => x),
    );
    best.tbt = Math.min(
      best.tbt,
      m(row.tbt, (x) => x),
    );
    best.lcp = Math.min(
      best.lcp,
      m(row.lcp, (x) => x),
    );
    best.cls = Math.min(
      best.cls,
      m(row.cls, (x) => x),
    );
  }
  const label =
    url
      .replace("http://127.0.0.1:8080", "")
      .replace("http://localhost:8080", "") || "/";
  rows.push({ label, best, perRun, runs: runs.length });
}

rows.sort((a, b) => (a.label < b.label ? -1 : 1));

console.log(
  "## Per-page best-of-" +
    rows[0].runs +
    " (LHCI " +
    files.length +
    " reports)",
);
console.log("| Page | Perf | A11y | BP | SEO | TBT(ms) | LCP(ms) | CLS |");
console.log("|------|------|------|----|-----|---------|---------|-----|");
for (const r of rows) {
  console.log(
    "| " +
      r.label +
      " | " +
      fmtScore(r.best.perf) +
      " | " +
      fmtScore(r.best.a11y) +
      " | " +
      fmtScore(r.best.bp) +
      " | " +
      fmtScore(r.best.seo) +
      " | " +
      (r.best.tbt === Infinity ? "-" : r.best.tbt.toFixed(0)) +
      " | " +
      (r.best.lcp === Infinity ? "-" : r.best.lcp.toFixed(0)) +
      " | " +
      (r.best.cls === Infinity ? "-" : r.best.cls.toFixed(3)) +
      " |",
  );
}

console.log("\n## Failed audits per page (binary score<1, incl. a11y/BP)");
const seen = {};
for (const [url, runs] of Object.entries(pages)) {
  const label = url.replace(/https?:\/\/[^/]+/, "") || "/";
  const failed = new Set();
  for (const { l } of runs) {
    for (const [id, a] of Object.entries(l.audits)) {
      if (
        a.score !== null &&
        a.score < 1 &&
        (a.scoreDisplayMode === "binary" || a.scoreDisplayMode === "numeric")
      ) {
        failed.add(
          a.scoreDisplayMode === "binary"
            ? id
            : id + "#" + Math.round(a.numericValue),
        );
      }
    }
  }
  const key = Array.from(failed).sort().join(",");
  if (!seen[key]) seen[key] = new Set();
  seen[key].add(label);
}
for (const [key, labels] of Object.entries(seen)) {
  console.log("[" + Array.from(labels).sort().join(", ") + "] " + key);
}

console.log("\n## CLS per run (both runs per page)");
for (const r of rows) {
  const clsRuns = r.perRun.map((p) =>
    p.cls === null || p.cls === undefined ? "-" : p.cls.toFixed(3),
  );
  const bad = r.perRun.filter((p) => p.cls !== null && p.cls > 0.05).length;
  console.log(
    r.label +
      (bad ? "  <<< " + bad + " bad run(s)" : "") +
      "  [" +
      clsRuns.join(" | ") +
      "]",
  );
}

console.log("\n## errors-in-console unique messages");
const allErrs = new Set();
for (const [url, runs] of Object.entries(pages)) {
  for (const { l } of runs) {
    const e = l.audits["errors-in-console"];
    if (e && e.details && e.details.items) {
      for (const it of e.details.items)
        allErrs.add(
          (it.source || "?") + " :: " + (it.description || "").slice(0, 140),
        );
    }
  }
}
for (const m of Array.from(allErrs).sort()) console.log(m);

console.log("\n## Config (from first report)");
const first = pages[Object.keys(pages)[0]][0].l;
const c = first.configSettings || {};
console.log(
  JSON.stringify(
    {
      formFactor: c.formFactor,
      width: c.screenEmulation && c.screenEmulation.width,
      height: c.screenEmulation && c.screenEmulation.height,
      throttling: c.throttling,
      throttlingMethod: c.throttlingMethod,
      ua: first.environment && first.environment.hostUserAgent,
    },
    null,
    1,
  ),
);

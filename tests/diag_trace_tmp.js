"use strict";
var path = require("node:path");
var chromium = require("playwright").chromium;
var helpers = require("./cli/tests/e2e/mpa_helpers");
var FIX = "cli/tests/fixtures";

process.on("unhandledRejection", function (e) {
  console.log("FATAL", e && e.message);
  process.exit(9);
});
setTimeout(function () {
  console.log("WATCHDOG");
  process.exit(7);
}, 300000);

(async function () {
  console.log("STEP server");
  await helpers.ensureServer();
  var browser = await chromium.launch({ headless: true });
  var opened = await helpers.openPage(browser, "voice-biometric");
  var page = opened.page;
  var ctx = opened.ctx;

  var chunks = [];
  var session = await ctx.newCDPSession(page);

  console.log("STEP tracing-start");
  await session.send("Tracing.start", {
    transferMode: "ReportEvents",
    bufferUsageReportingInterval: 500,
    traceConfig: {
      recordMode: "recordContinuously",
      enableSamplingHeapProfiler: false,
      enableSystrace: false,
      includedCategories: [
        "v8",
        "devtools.timeline",
        "disabled-by-default-v8.cpu_profiler",
      ],
    },
  });
  session.on("Tracing.dataCollected", function (p) {
    if (p && p.value) chunks.push(p.value);
  });
  session.on("Tracing.tracingComplete", function () {
    console.log("TRACING-COMPLETE");
  });

  await page.evaluate(function () {
    var el = document.getElementById("botBlockOverlay");
    if (el) {
      el.style.display = "none";
      el.classList.remove("active");
    }
  });
  await page.evaluate(function () {
    var check = document.getElementById("voice-consent-check");
    if (check) {
      check.checked = true;
      check.dispatchEvent(new Event("change", { bubbles: true }));
    }
    var accept = document.getElementById("voice-consent-accept");
    if (accept) accept.click();
  });
  await page.waitForFunction(
    function () {
      var a = document.getElementById("voice-audio");
      return a && a.disabled === false;
    },
    null,
    { timeout: 15000 },
  );
  console.log("STEP ready");

  await page.setInputFiles("#voice-audio", path.resolve(FIX, "golden_h1a.wav"));
  await page.fill("#voice-label", "ab-trace");
  await page.waitForFunction(
    function () {
      var b = document.getElementById("voice-run");
      return b && !b.disabled;
    },
    null,
    { timeout: 120000 },
  );
  console.log("STEP run");
  await page.click("#voice-run");
  await page.waitForFunction(
    function () {
      var r = window._voiceReport;
      return r && r.quality && !!r.timings;
    },
    null,
    { timeout: 420000 },
  );
  console.log("STEP report-ready (sleeping 5s to capture frozen profile)");
  await page.waitForTimeout(5000);

  var endResult;
  try {
    endResult = await session.send("Tracing.end", {}).catch(function (e) {
      return { hung: true, msg: e.message };
    });
  } catch (e) {
    endResult = { hung: true, msg: e.message };
  }
  console.log("TRACING-END", JSON.stringify(endResult).slice(0, 300));

  // ---- parse ----
  var all = [];
  for (var i = 0; i < chunks.length; i++) all = all.concat(chunks[i]);
  console.log("EVT-total", all.length);
  var cpuPcs = all.filter(function (e) {
    return e && e.name === "ProfileChunk";
  });
  console.log("CHUNKS", cpuPcs.length);

  var nodesById = new Map();
  var samples = [];
  var parentMap = new Map();
  cpuPcs.forEach(function (pc) {
    var d = pc.args && pc.args.data;
    if (!d || !d.cpuProfile) return;
    var prof = d.cpuProfile;
    (prof.nodes || []).forEach(function (n) {
      if (!nodesById.has(n.id)) {
        nodesById.set(n.id, {
          func: n.callFrame.functionName,
          url: n.callFrame.url,
          ln: n.callFrame.lineNumber,
        });
      }
      (n.children || []).forEach(function (cid) {
        if (!parentMap.has(cid)) parentMap.set(cid, n.id);
      });
    });
    samples = samples.concat(prof.samples || []);
  });

  var top = samples.slice(Math.max(0, samples.length - 500));
  var stacks = new Map();
  function stackOf(id) {
    var arr = [];
    var guard = 0;
    while (id != null && guard++ < 500) {
      var m = nodesById.get(id);
      if (m) arr.push((m.func || "") + " @ " + (m.url || "?") + ":" + m.ln);
      var pid = parentMap.get(id);
      if (pid == null || pid === id) break;
      id = pid;
    }
    return arr;
  }
  top.forEach(function (id) {
    var s = stackOf(id).join(" <- ");
    stacks.set(s, (stacks.get(s) || 0) + 1);
  });
  var sorted = Array.from(stacks.entries()).sort(function (a, b) {
    return b[1] - a[1];
  });
  console.log("DISTINCT-STACKS", sorted.length);
  sorted.slice(0, 5).forEach(function (entry) {
    console.log("--- stack x" + entry[1] + " ---");
    console.log(entry[0]);
  });

  await helpers.closePage(ctx, page).catch(function () {});
  await browser.close().catch(function () {});
  console.log("ALL-DONE");
  process.exit(0);
})().catch(function (e) {
  console.log("TOP-FATAL", e && e.message);
  process.exit(8);
});

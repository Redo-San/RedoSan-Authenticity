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

async function raceTimeout(p, ms, tag) {
  var t;
  return Promise.race([
    p,
    new Promise(function (_, rej) {
      t = setTimeout(function () {
        rej(Object.assign(new Error(tag + " TIMEOUT " + ms), { code: "RACE" }));
      }, ms);
    }),
  ]).finally(function () {
    clearTimeout(t);
  });
}

(async function () {
  var NOCOV = process.env.DIAG_NOCOV !== "0";
  console.log("MODE nocov=" + NOCOV);
  await helpers.ensureServer();
  var browser = await chromium.launch({ headless: true });
  var ctx = await browser.newContext({ locale: "en-US" });
  var page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  var errors = [];
  page.on("pageerror", function (e) {
    errors.push(e.message);
  });
  page.on("console", function (msg) {
    if (msg.type() === "error") errors.push(msg.text());
  });
  if (!NOCOV) {
    var cov = require("./cli/tests/e2e/e2e_coverage");
    await cov.startCoverage(page);
  }
  var url = helpers.pageURL("voice-biometric");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);

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
  console.log("STEP input-ready");

  await page.setInputFiles("#voice-audio", path.resolve(FIX, "golden_h1a.wav"));
  await page.fill("#voice-label", "ab-nc");
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
  console.log("STEP report-ready");
  try {
    var alive = await raceTimeout(
      page.evaluate(function () {
        return "alive-" + performance.now();
      }),
      8000,
      "post-eval",
    );
    console.log("POST-RUN-EVAL", alive, "=> MAIN THREAD ALIVE");
  } catch (e) {
    console.log("POST-RUN-EVAL-ERR", e.message.split("\n")[0]);
  }
  console.log("PAGE-ERRORS", JSON.stringify(errors).slice(0, 500));
  await ctx.close().catch(function () {});
  await browser.close().catch(function () {});
  console.log("ALL-DONE");
  process.exit(0);
})().catch(function (e) {
  console.log("TOP-FATAL", e && e.message);
  process.exit(8);
});

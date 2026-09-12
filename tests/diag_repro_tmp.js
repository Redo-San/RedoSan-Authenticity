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
}, 500000);

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
  var THREADS1 = process.env.DIAG_THREADS === "1";
  console.log("MODE threads1=" + THREADS1);
  console.log("STEP server");
  await helpers.ensureServer();
  console.log("STEP browser");
  var browser = await chromium.launch({ headless: true });
  console.log("STEP open");
  var opened = await helpers.openPage(browser, "voice-biometric");
  var ctx = opened.ctx;
  var page = opened.page;

  if (THREADS1) {
    console.log("STEP init-script + reload");
    await ctx.addInitScript(function () {
      Object.defineProperty(window, "ort", {
        configurable: true,
        set: function (v) {
          try {
            if (v && v.env && v.env.wasm) v.env.wasm.numThreads = 1;
          } catch (_e) {}
          Object.defineProperty(window, "ort", {
            configurable: true,
            writable: true,
            value: v,
          });
        },
        get: function () {
          return undefined;
        },
      });
    });
    await page.reload();
    await page.waitForTimeout(1000);
  }

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

  async function runOnce(file, i) {
    await page.evaluate(function () {
      var inp = document.getElementById("voice-audio");
      if (inp) inp.disabled = false;
    });
    await page.setInputFiles("#voice-audio", path.resolve(FIX, file));
    await page.fill("#voice-label", "ab-" + i);
    await page.waitForFunction(
      function () {
        var b = document.getElementById("voice-run");
        return b && !b.disabled;
      },
      null,
      { timeout: 120000 },
    );
    await page.click("#voice-run");
    await page.waitForFunction(
      function () {
        var r = window._voiceReport;
        return r && r.quality && !!r.timings;
      },
      null,
      { timeout: 420000 },
    );
    var alive = await raceTimeout(
      page.evaluate(function () {
        return performance.now();
      }),
      8000,
      "eval-" + i,
    );
    console.log(
      "RUN" + i + " report-eval wall~" + Math.round(alive) + " alive",
    );
  }

  try {
    await runOnce("golden_h1a.wav", 1);
  } catch (e) {
    console.log("RUN1-ERR", e.message.split("\n")[0]);
  }
  await page.waitForTimeout(2000);
  try {
    await raceTimeout(
      page.evaluate(function () {
        return 2;
      }),
      8000,
      "t1",
    );
    console.log("T1-OK");
  } catch (e) {
    console.log("T1-ERR", e.message.split("\n")[0]);
  }

  try {
    await runOnce("golden_h1b.wav", 2);
  } catch (e) {
    console.log("RUN2-ERR", e.message.split("\n")[0]);
  }
  await page.waitForTimeout(2000);
  try {
    await raceTimeout(
      page.evaluate(function () {
        return 3;
      }),
      8000,
      "t2",
    );
    console.log("T2-OK");
  } catch (e) {
    console.log("T2-ERR", e.message.split("\n")[0]);
  }

  try {
    await runOnce("golden_h2.wav", 3);
    console.log("ALL-THREE-COMPLETED");
  } catch (e) {
    console.log("RUN3-ERR", e.message.split("\n")[0]);
  }

  console.log("PAGE-ERRORS", JSON.stringify(opened.errors).slice(0, 800));
  await helpers.closePage(ctx, page).catch(function () {});
  await browser.close().catch(function () {});
  console.log("ALL-DONE");
  process.exit(0);
})().catch(function (e) {
  console.log("TOP-FATAL", e && e.message);
  process.exit(8);
});

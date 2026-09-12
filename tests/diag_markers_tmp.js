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
  await helpers.ensureServer();
  var browser = await chromium.launch({
    channel: "chromium-headless-shell",
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-gpu-compositing",
      "--disable-dev-shm-usage",
    ],
  });
  var ctx = await browser.newContext({ locale: "en-US" });
  var page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  await page.addInitScript(function () {
    try {
      sessionStorage.setItem("musicInteracted", "true");
    } catch (e) {}
    // Prevent ANY audio playback (Chromium #40191510: audio.play() hangs headless)
    var _origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return Promise.resolve();
    };
    var last = null;
    // Prevent IndexedDB deadlock (Chromium #340398745, #40278488) with 5s timeout
    (function () {
      var _origOpen = indexedDB.open;
      indexedDB.open = function (dbName, version) {
        var req = _origOpen.call(this, dbName, version);
        var timer = setTimeout(function () {
          try {
            req.abort();
          } catch (e) {}
        }, 5000);
        req.onsuccess = function () {
          clearTimeout(timer);
        };
        req.onerror = function () {
          clearTimeout(timer);
        };
        req.onblocked = function () {
          try {
            req.abort();
          } catch (e) {}
          clearTimeout(timer);
        };
        return req;
      };
    })();
    Object.defineProperty(window, "ort", {
      configurable: true,
      get: function () {
        return last;
      },
      set: function (v) {
        last = v;
        try {
          if (v && v.env && v.env.wasm) {
            window.__ortEnv = {
              numThreads: v.env.wasm.numThreads,
              proxy: v.env.wasm.proxy,
              wasmPaths: String(v.env.wasm.wasmPaths),
              coIsolated: self.crossOriginIsolated,
            };
            v.env.wasm.numThreads = 1;
          }
          if (v && v.InferenceSession && v.InferenceSession.create) {
            var orig = v.InferenceSession.create.bind(v.InferenceSession);
            v.InferenceSession.create = async function (model, opts) {
              var forced = opts ? (opts.executionProviders || []).slice() : [];
              window.__ortCreateCalls = window.__ortCreateCalls || [];
              try {
                if (opts) opts.executionProviders = ["wasm"];
                else opts = { executionProviders: ["wasm"] };
              } catch (e) {
                window.__ortCreateErr = String(e);
              }
              window.__ortCreateCalls.push(JSON.stringify(forced));
              return orig(model, opts);
            };
          }
        } catch (e) {
          window.__ortEnvErr = String(e);
        }
      },
    });
  });
  var seen = [];
  page.on("console", function (msg) {
    seen.push("[" + msg.type() + "] " + msg.text());
  });
  page.on("pageerror", function (e) {
    seen.push("[pageerror] " + e.message);
  });
  var url = "http://127.0.0.1:9455/Style/pages/voice-biometric/index.html";
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
  await page.evaluate(function () {
    var n = 0;
    window.__tickN = 0;
    window.__tickTimer = setInterval(function () {
      n++;
      window.__tickN = n;
      console.log("[TICK] " + n + "@" + Math.round(performance.now()));
    }, 200);
  });
  // Kill service worker to prevent SW-related deadlock
  await page.evaluate(() =>
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) {
        r.unregister();
      });
    }),
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
  console.log("STEP report-ready");
  // Capture report immediately via waitForFunction return value (before freeze)
  var report = null;
  try {
    var reportJson = await page.waitForFunction(
      function () {
        var r = window._voiceReport;
        if (r && r.quality && !!r.timings) {
          try {
            return JSON.stringify({
              did: r.did,
              quality: r.quality,
              score: r.score,
              embeddingHash: r.embeddingHash,
              hasProvenance: !!r.provenance,
              hasCertificate: !!r.certificate,
              timings: r.timings,
            });
          } catch (e) {
            return "PARSE-FAIL";
          }
        }
        return null;
      },
      null,
      { timeout: 420000 },
    );
    if (reportJson && reportJson !== "PARSE-FAIL") {
      report = JSON.parse(reportJson);
      console.log("CAPTURED-REPORT", JSON.stringify(report).substring(0, 500));
    }
  } catch (e) {
    console.log("CAPTURE-ERR", e.message.split("\n")[0]);
  }
  // Process info via CDP browser session (no page JS evaluation needed)
  try {
    var cdpProcs = browser.newBrowserCDPSession
      ? await browser.newBrowserCDPSession()
      : null;
    if (cdpProcs) {
      var t1 = await cdpProcs.send("Target.getTargets");
      console.log(
        "TARGETS",
        JSON.stringify(
          t1.targetInfos.map(function (t) {
            return [t.type, t.title];
          }),
        ),
      );
      console.log(
        "PROCS-A",
        JSON.stringify(
          (await cdpProcs.send("SystemInfo.getProcessInfo")).processInfo.map(
            function (x) {
              return [x.type, String(x.id), Math.round(x.cpuTime / 1e6)];
            },
          ),
        ),
      );
      await page.waitForTimeout(3000);
      console.log(
        "PROCS-B",
        JSON.stringify(
          (await cdpProcs.send("SystemInfo.getProcessInfo")).processInfo.map(
            function (x) {
              return [x.type, String(x.id), Math.round(x.cpuTime / 1e6)];
            },
          ),
        ),
      );
    } else {
      console.log("PROCS-SKIP (no browser CDP session)");
    }
  } catch (e) {
    console.log("PROCS-ERR", e.message.split("\n")[0]);
  }
  // Cleanup (close without evaluating JS)
  await ctx.close().catch(function () {});
  await browser.close().catch(function () {});
  console.log("ALL-DONE");
  process.exit(0);
})().catch(function (e) {
  console.log("TOP-FATAL", e && e.message);
  process.exit(8);
});

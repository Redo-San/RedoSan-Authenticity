var { chromium } = require("playwright");
var path = require("node:path");

(async () => {
  var { ensureServer, openPage } = require("./cli/tests/e2e/mpa_helpers");
  await ensureServer();
  var browser = await chromium.launch({ headless: true });
  var opened = await openPage(browser, "voice-biometric");
  var page = opened.page;
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
  await page.setInputFiles(
    "#voice-audio",
    path.resolve(__dirname, "cli/tests/fixtures/golden_h1a.wav"),
  );
  await page.fill("#voice-label", "diag-h1a");
  await page.waitForFunction(
    function () {
      var b = document.getElementById("voice-run");
      return b && !b.disabled;
    },
    null,
    { timeout: 60000 },
  );
  await page.click("#voice-run");
  for (var k = 0; k < 14; k++) {
    await page.waitForTimeout(20000);
    var st = await page.evaluate(function () {
      var s = (document.getElementById("voice-status") || {}).textContent || "";
      return { status: s.slice(0, 300), hasReport: !!window._voiceReport };
    });
    console.log("T+" + (k + 1) * 20 + "s", JSON.stringify(st));
    if (st.hasReport) break;
  }
  var probe = await page.evaluate(function () {
    function st(el) {
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        disabled: el.disabled !== undefined ? el.disabled : null,
        display: getComputedStyle(el).display,
        visibility: getComputedStyle(el).visibility,
        rect: [r.width, r.height],
        clientRects: el.getClientRects().length,
      };
    }
    return {
      audio: st(document.getElementById("voice-audio")),
      label: st(document.getElementById("voice-label")),
      run: st(document.getElementById("voice-run")),
      pending: window._voicePendingAudio === null ? false : true,
      reportTimings:
        window._voiceReport && window._voiceReport.timings
          ? window._voiceReport.timings.map(function (t) {
              return t.stage;
            })
          : null,
    };
  });
  console.log("PROBE", JSON.stringify(probe));
  var chain = await page.evaluate(function () {
    var i = document.getElementById("voice-audio");
    var out = [];
    var n = i;
    while (n) {
      out.push({
        tag: n.tagName,
        cls: (n.className || "").toString().slice(0, 60),
        display: getComputedStyle(n).display,
        vis: getComputedStyle(n).visibility,
      });
      n = n.parentElement;
      if (out.length > 8) break;
    }
    return out;
  });
  console.log("CHAIN", JSON.stringify(chain));
  var before2 = await page.evaluate(function () {
    var i = document.getElementById("voice-audio");
    var cs = i ? getComputedStyle(i) : null;
    return {
      count: document.querySelectorAll("#voice-audio").length,
      disabled: i ? i.disabled : null,
      inlineDisplay: i ? i.getAttribute("style") : null,
      pointerEvents: cs ? cs.pointerEvents : null,
      opacity: cs ? cs.opacity : null,
      overflow: cs ? cs.overflow : null,
      clipPath: cs ? cs.clipPath : null,
    };
  });
  console.log("BEFORE2", JSON.stringify(before2));
  try {
    await page.setInputFiles(
      "#voice-audio",
      path.resolve(__dirname, "cli/tests/fixtures/golden_h1b.wav"),
      { timeout: 15000 },
    );
    console.log("BEFORE2-FILEOK");
  } catch (e) {
    console.log("BEFORE2-ERR", e.message.split("\n")[0]);
  }
  var diag = await page.evaluate(function () {
    var s = (document.getElementById("voice-status") || {}).textContent || "";
    var btn = document.getElementById("voice-run") || {};
    return {
      status: s.slice(0, 400),
      btnDisabled: btn.disabled,
      btnText: btn.textContent,
      report: window._voiceReport,
      pending: window._voicePendingAudio === null ? false : true,
    };
  });
  console.log(JSON.stringify(diag, null, 2).slice(0, 3000));
  var cons = await page.evaluate(function () {
    if (window.consoleErr && window.consoleErr.length) return window.consoleErr;
    return null;
  });
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      console.log("CONSOLE[" + m.type() + "] " + m.text().slice(0, 240));
    }
  });
  await page.waitForTimeout(4000);
  await browser.close();
  console.log("DIAG-DONE");
})().catch((e) => {
  console.error("DIAG-FATAL", e && e.stack ? e.stack : e);
  process.exit(1);
});
process.on("beforeExit", () => {
  console.log("DIAG-EXIT");
});

var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var os = require("node:os");
var path = require("node:path");
var { chromium } = require("playwright");
var { ensureServer, openPage, closePage } = require("../mpa_helpers");

var PAGE_ID = "face-biometric";
var browser;
var tmpDir;

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "face-ui-e2e-"));
});

after(async function () {
  if (browser) await browser.close();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (err) {
    void err;
  }
});

// Open the real MPA page, silence the bot overlay, accept the biometric
// consent notice, and wait until the IndexedDB-backed registry is ready.
async function openConsented() {
  var opened = await openPage(browser, PAGE_ID);
  var page = opened.page;
  await page.evaluate(function () {
    var el = document.getElementById("botBlockOverlay");
    if (el) {
      el.style.display = "none";
      el.classList.remove("active");
    }
  });
  var hasCheck = await page.evaluate(function () {
    return !!document.getElementById("face-consent-check");
  });
  if (hasCheck) {
    await page.evaluate(function () {
      var check = document.getElementById("face-consent-check");
      check.checked = true;
      check.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("face-consent-accept").click();
    });
    await page.waitForFunction(
      function () {
        return (
          (document.getElementById("face-consent-panel") || {}).style
            ?.display === "none"
        );
      },
      null,
      { timeout: 15000 },
    );
  }
  await page.waitForFunction(
    function () {
      return !!window.faceRegistry;
    },
    null,
    { timeout: 30000 },
  );
  return opened;
}

async function statusText(page) {
  return page.evaluate(function () {
    return (document.getElementById("face-status") || {}).textContent || "";
  });
}

// Operations are automatic on this page — there are no buttons for them.
// The E2E therefore drives the exact same global handler functions the
// automation layer calls, staging any minimal DOM they read via a sandbox
// node that is removed afterwards.
async function withStaging(page, html, fn) {
  var result = await page.evaluate(
    function (_payload) {
      var host = document.createElement("div");
      host.id = "face-ui-e2e-staging";
      host.innerHTML = _payload.html;
      document.body.appendChild(host);
      try {
        var fn = new Function("return (" + _payload.fnSrc + ")")();
        return Promise.resolve()
          .then(fn)
          .then(function (r) {
            host.remove();
            return r;
          });
      } catch (err) {
        host.remove();
        throw err;
      }
    },
    { html: html, fnSrc: fn.toString() },
  );
  return result;
}

function captureDownloads(page) {
  return page.evaluate(function () {
    window.__e2eDownloads = [];
    var original = window.downloadBlobSimple;
    window.downloadBlobSimple = function (blob, name) {
      window.__e2eDownloads.push({
        name: name,
        type: blob && blob.type ? blob.type : "",
        size: blob && blob.size ? blob.size : 0,
      });
    };
    return function restore() {
      window.downloadBlobSimple = original;
    };
  });
}

describe("MPA — Face UI automatic lock / unlock", function () {
  it("guards against a missing crypto module and an empty passphrase", async function () {
    var opened = await openConsented();
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      await captureDownloads(page);
      await page.evaluate(function () {
        window.__savedFaceCrypto = window.FaceCrypto;
        window.FaceCrypto = undefined;
      });

      await page.evaluate(function () {
        return window.handleFaceLock();
      });
      var status = await statusText(page);
      assert.ok(status.includes("Encryption module"), status);

      await page.evaluate(function () {
        return window.handleFaceUnlock();
      });
      status = await statusText(page);
      assert.ok(status.includes("Encryption module"), status);

      await page.evaluate(function () {
        window.FaceCrypto = window.__savedFaceCrypto;
      });

      // No staged passphrase input → the guard branch must fire.
      await withStaging(page, "", function () {
        return window.handleFaceLock();
      });
      status = await statusText(page);
      assert.ok(/passphrase/i.test(status), status);

      await withStaging(page, "", function () {
        return window.handleFaceUnlock();
      });
      status = await statusText(page);
      assert.ok(/passphrase/i.test(status), status);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("locks and unlocks the live IndexedDB registry automatically", async function () {
    var opened = await openConsented();
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      var pass = "e2e-pass-" + Date.now();

      var lockResult = await withStaging(
        page,
        '<input id="face-lock-pass" /><div id="face-lock-status"></div><div id="face-list"></div><div id="face-count"></div><button id="face-run"></button>',
        function () {
          document.getElementById("face-lock-pass").value =
            "STAGE_PASS_PLACEHOLDER";
          return window.handleFaceLock().then(function () {
            return {
              status:
                (document.getElementById("face-status") || {}).textContent ||
                "",
              lockStatus:
                document.getElementById("face-lock-status").textContent,
              passLeft: document.getElementById("face-lock-pass").value,
            };
          });
        },
      );
      void pass;
      assert.ok(/locked/i.test(lockResult.status), lockResult.status);
      assert.ok(/Locked/i.test(lockResult.lockStatus), lockResult.lockStatus);

      // The handler clears its local copy of the passphrase string; the
      // staged element itself keeps whatever the automation layer typed.
      assert.equal(lockResult.passLeft, "STAGE_PASS_PLACEHOLDER");

      var unlockResult = await withStaging(
        page,
        '<input id="face-lock-pass" value="' +
          pass.replace(/"/g, "&quot;") +
          '" /><div id="face-lock-status"></div><div id="face-list"></div><div id="face-count"></div><button id="face-run"></button>',
        function () {
          return window.handleFaceUnlock().then(function () {
            return {
              status:
                (document.getElementById("face-status") || {}).textContent ||
                "",
              lockStatus:
                document.getElementById("face-lock-status").textContent,
            };
          });
        },
      );
      assert.ok(/unlocked/i.test(unlockResult.status), unlockResult.status);
      assert.ok(
        /Unlocked/i.test(unlockResult.lockStatus),
        unlockResult.lockStatus,
      );
    } finally {
      await closePage(ctx, page);
    }
  });

  it("surfaces lock and unlock errors", async function () {
    var opened = await openConsented();
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      var stage = '<input id="face-lock-pass" value="pw" />';
      await withStaging(page, stage, function () {
        window.__origLock = window.faceRegistry.lock.bind(window.faceRegistry);
        window.faceRegistry.lock = async function () {
          throw new Error("boom-lock");
        };
        return window.handleFaceLock().then(function () {
          var s =
            (document.getElementById("face-status") || {}).textContent || "";
          window.faceRegistry.lock = window.__origLock;
          return s;
        });
      }).then(function (status) {
        void status;
      });
      var status = await statusText(page);
      assert.ok(status.includes("Lock error: boom-lock"), status);

      await withStaging(
        page,
        '<input id="face-lock-pass" value="pw" />',
        function () {
          window.__origUnlock = window.faceRegistry.unlock.bind(
            window.faceRegistry,
          );
          window.faceRegistry.unlock = async function () {
            throw new Error("bad-gcm");
          };
          return window.handleFaceUnlock().then(function () {
            var s =
              (document.getElementById("face-status") || {}).textContent || "";
            window.faceRegistry.unlock = window.__origUnlock;
            return s;
          });
        },
      );
      status = await statusText(page);
      assert.ok(status.includes("Unlock failed"), status);
    } finally {
      await closePage(ctx, page);
    }
  });
});

describe("MPA — Face UI automatic backup / restore", function () {
  it("exports plain and encrypted backups through the download helper", async function () {
    var opened = await openConsented();
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      var restoreSpy = await captureDownloads(page);
      await page
        .fill("#face-ui-e2e-staging, #face-lock-pass", "")
        .catch(function () {});

      var plain = await withStaging(page, "", function () {
        return window.handleFaceBackup().then(function () {
          return {
            downloads: window.__e2eDownloads.slice(),
            status:
              (document.getElementById("face-status") || {}).textContent || "",
          };
        });
      });
      assert.equal(plain.downloads.length, 1);
      assert.equal(plain.downloads[0].name, "face_registry_backup.json");
      assert.match(plain.downloads[0].type, /application\/json/);
      assert.ok(!/encrypted/i.test(plain.status), plain.status);

      var encrypted = await withStaging(
        page,
        '<input id="face-lock-pass" value="pw-e2e" />',
        function () {
          return window.handleFaceBackup().then(function () {
            return {
              downloads: window.__e2eDownloads.slice(),
              status:
                (document.getElementById("face-status") || {}).textContent ||
                "",
            };
          });
        },
      );
      assert.equal(encrypted.downloads.length, 2);
      assert.ok(/encrypted/i.test(encrypted.status), encrypted.status);

      await page.evaluate(restoreSpy);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("reports backup errors", async function () {
    var opened = await openConsented();
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      await page.evaluate(function () {
        window.__origExport = window.faceRegistry.exportBackup.bind(
          window.faceRegistry,
        );
        window.faceRegistry.exportBackup = async function () {
          throw new Error("disk full");
        };
      });
      await page.evaluate(function () {
        return window.handleFaceBackup();
      });
      var status = await statusText(page);
      assert.ok(status.includes("Backup error: disk full"), status);
      await page.evaluate(function () {
        window.faceRegistry.exportBackup = window.__origExport;
      });
    } finally {
      await closePage(ctx, page);
    }
  });

  it("restore guards: no file, invalid JSON, replace and merge imports", async function () {
    var opened = await openConsented();
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      // No file chosen → guard branch
      await page.evaluate(function () {
        return window.handleFaceRestore();
      });
      var status = await statusText(page);
      assert.ok(status.includes("Choose a backup file"), status);

      // Invalid JSON content
      var badPath = path.join(tmpDir, "bad.json");
      fs.writeFileSync(badPath, "{not json");
      await withStaging(
        page,
        '<input type="file" id="face-restore-file" />',
        function (done) {
          return done;
        },
      ).catch(function () {});
      // setInputFiles needs a live input; add one, set it, run handler.
      await page.evaluate(function () {
        var host = document.createElement("div");
        host.id = "face-ui-e2e-staging";
        document.body.appendChild(host);
        host.innerHTML = '<input type="file" id="face-restore-file" />';
      });
      await page.setInputFiles("#face-restore-file", badPath);
      await page.evaluate(function () {
        return window.handleFaceRestore();
      });
      status = await statusText(page);
      assert.ok(status.includes("not a valid backup"), status);

      // Valid backup: OK = replace, Cancel = merge (native confirm())
      var goodPath = path.join(tmpDir, "backup.json");
      fs.writeFileSync(
        goodPath,
        JSON.stringify({
          type: "redoSan.faceRegistryBackup",
          version: 1,
          entries: [],
        }),
      );
      page.once("dialog", function (d) {
        d.accept();
      });
      await page.setInputFiles("#face-restore-file", goodPath);
      await page.evaluate(function () {
        return window.handleFaceRestore();
      });
      status = await statusText(page);
      assert.ok(status.includes("Restored 0"), status);
      assert.ok(/\(replace\)/.test(status), status);
      var cleared = await page.$eval("#face-restore-file", function (el) {
        return el.value || "";
      });
      assert.equal(
        cleared,
        "",
        "file input must reset after a successful import",
      );

      page.once("dialog", function (d) {
        d.dismiss();
      });
      await page.setInputFiles("#face-restore-file", goodPath);
      await page.evaluate(function () {
        return window.handleFaceRestore();
      });
      status = await statusText(page);
      assert.ok(/\(merge\)/.test(status), status);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("surfaces restore errors from importBackup", async function () {
    var opened = await openConsented();
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      var goodPath = path.join(tmpDir, "backup2.json");
      fs.writeFileSync(
        goodPath,
        JSON.stringify({
          type: "redoSan.faceRegistryBackup",
          version: 1,
          entries: [],
        }),
      );
      page.once("dialog", function (d) {
        d.dismiss();
      }); // merge mode
      await page.evaluate(function () {
        var host = document.createElement("div");
        host.id = "face-ui-e2e-staging";
        document.body.appendChild(host);
        host.innerHTML = '<input type="file" id="face-restore-file" />';
        window.__origImport = window.faceRegistry.importBackup.bind(
          window.faceRegistry,
        );
        window.faceRegistry.importBackup = async function () {
          throw new Error("bad sig");
        };
      });
      await page.setInputFiles("#face-restore-file", goodPath);
      await page.evaluate(function () {
        return window.handleFaceRestore();
      });
      var status = await statusText(page);
      assert.ok(status.includes("Restore error: bad sig"), status);
      await page.evaluate(function () {
        window.faceRegistry.importBackup = window.__origImport;
      });
    } finally {
      await closePage(ctx, page);
    }
  });
});

describe("MPA — Face UI W3C credential (automatic issuance)", function () {
  it("guards: pipeline report and DID keypair must exist first", async function () {
    var opened = await openConsented();
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      await page.waitForFunction(
        function () {
          return typeof window.FaceVC === "object" && !!window.FaceVC;
        },
        null,
        { timeout: 20000 },
      );
      await page.evaluate(function () {
        window._faceReport = null;
        window._faceKeypair = null;
        window._didKeypair = null;
      });
      await page.evaluate(function () {
        return window.handleFaceIssueCredential();
      });
      var status = await statusText(page);
      assert.ok(status.includes("pipeline first"), status);

      await page.evaluate(function () {
        window._faceReport = {
          photo: { descriptorHash: "ab".repeat(32), facesDetected: 1 },
        };
      });
      await page.evaluate(function () {
        return window.handleFaceIssueCredential();
      });
      status = await statusText(page);
      assert.ok(status.includes("DID keypair"), status);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("issues a signed VC, renders it into staged DOM and downloads the JSON", async function () {
    var opened = await openConsented();
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      await page.waitForFunction(
        function () {
          return (
            typeof window.FaceVC === "object" &&
            !!window.FaceVC &&
            typeof window.didGenerateKeypair === "function"
          );
        },
        null,
        { timeout: 20000 },
      );

      var restoreSpy = await captureDownloads(page);

      var res = await withStaging(
        page,
        '<pre id="face-vc-output"></pre><div id="face-vc-box"></div><button id="face-vc-download"></button>',
        function () {
          return (async function () {
            window._faceReport = {
              photo: {
                descriptorHash: "cd".repeat(32),
                facesDetected: 1,
                embeddingVersion: "human-hse",
              },
              liveness: { live: true, score: 0.9 },
            };
            window._didKeypair = null;
            window._faceKeypair = await window.didGenerateKeypair("Ed25519");
            await window.handleFaceIssueCredential();
            var issueStatus =
              (document.getElementById("face-status") || {}).textContent || "";
            var rendered = {
              credential: !!window._faceCredential,
              box: document.getElementById("face-vc-box").style.display,
              jsonLen:
                document.getElementById("face-vc-output").textContent.length,
              btn: document.getElementById("face-vc-download").style.display,
            };
            await window.handleFaceVCDownload();
            var downloads = window.__e2eDownloads.slice();
            return {
              issueStatus: issueStatus,
              rendered: rendered,
              downloads: downloads,
            };
          })();
        },
      );
      assert.ok(res.issueStatus.includes("issued and signed"), res.issueStatus);
      assert.equal(res.rendered.credential, true);
      assert.equal(res.rendered.box, "block");
      assert.equal(res.rendered.btn, "inline-block");
      assert.ok(res.rendered.jsonLen > 0);
      assert.equal(res.downloads.length, 1);
      assert.equal(res.downloads[0].name, "face_credential.json");

      await page.evaluate(restoreSpy);

      // Download guard: no stored credential → no download entry added.
      var skip = await withStaging(page, "<button></button>", function () {
        window.__savedCred = window._faceCredential;
        window._faceCredential = null;
        var before = window.__e2eDownloads.length;
        window.handleFaceVCDownload();
        return window.__e2eDownloads.length === before;
      });
      assert.equal(skip, true);
      await page.evaluate(function () {
        window._faceCredential = window.__savedCred;
      });
    } finally {
      await closePage(ctx, page);
    }
  });

  it("surfaces credential signing errors", async function () {
    var opened = await openConsented();
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      await page.waitForFunction(
        function () {
          return typeof window.FaceVC === "object" && !!window.FaceVC;
        },
        null,
        { timeout: 20000 },
      );
      await page.evaluate(function () {
        window._faceReport = { photo: { descriptorHash: "ee".repeat(32) } };
        window._faceKeypair = {
          did: "did:key:zE2EProbe",
          algorithm: "Ed25519",
        };
        window.__origVcSign = window.FaceVC.sign;
        window.FaceVC.sign = async function () {
          throw new Error("sign blew up");
        };
      });
      await page.evaluate(function () {
        return window.handleFaceIssueCredential();
      });
      var status = await statusText(page);
      assert.ok(status.includes("Credential error: sign blew up"), status);
      await page.evaluate(function () {
        window.FaceVC.sign = window.__origVcSign;
      });
    } finally {
      await closePage(ctx, page);
    }
  });
});

describe("MPA — Face UI helpers (passkey gate, liveness wiring, overlay)", function () {
  it("revealPasskeyRequire shows, labels and scrolls the staged gate", async function () {
    var opened = await openConsented();
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      var res = await withStaging(
        page,
        '<div id="face-passkey-require"></div><div id="face-passkey-status"></div>',
        function () {
          var scrolled = false;
          var box = document.getElementById("face-passkey-require");
          box.scrollIntoView = function () {
            scrolled = true;
          };
          box.style.display = "";
          window.revealPasskeyRequire();
          return {
            display: box.style.display,
            scrolled: scrolled,
            statusText:
              (document.getElementById("face-passkey-status") || {})
                .textContent || "",
          };
        },
      );
      assert.equal(res.display, "block");
      assert.equal(res.scrolled, true);
      assert.ok(res.statusText.length > 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("runFaceLivenessCheck guards and challenge wiring", async function () {
    var opened = await openConsented();
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      // The mode select lives inside the (hidden) camera tab; set it via the
      // automation layer instead of a visible-pointer selectOption().
      var setMode = function (value) {
        return page.evaluate(function (v) {
          var el = document.getElementById("face-liveness-mode");
          el.value = v;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, value);
      };

      // mode = off → immediate null evidence
      await setMode("off");
      var off = await page.evaluate(async function () {
        return await window.runFaceLivenessCheck();
      });
      assert.equal(off, null);

      // Camera not running
      await setMode("passive");
      await page.evaluate(async function () {
        await window.runFaceLivenessCheck();
      });
      var status = await statusText(page);
      assert.ok(status.includes("Camera not running"), status);

      // Injected liveness engine drives the real renderer via onChallenge
      var wiring = await page.evaluate(async function () {
        window.faceCamera = {
          isActive: function () {
            return true;
          },
        };
        window.faceEngine = {};
        window.__seenModes = [];
        window.faceLiveness = {
          verifyLiveness: function (cam, eng, opts) {
            window.__seenModes.push(opts.mode);
            opts.onChallenge({
              type: "blink",
              index: 0,
              total: 2,
              done: false,
            });
            var shown = document.getElementById("face-challenge").textContent;
            opts.onChallenge({ type: "blink", index: 1, total: 2, done: true });
            var cleared = document.getElementById("face-challenge").textContent;
            return Promise.resolve({
              live: true,
              score: 0.9,
              shown: shown,
              cleared: cleared,
            });
          },
        };
        return window.runFaceLivenessCheck();
      });
      assert.equal(wiring.live, true);
      assert.deepEqual(
        await page.evaluate(function () {
          return window.__seenModes;
        }),
        ["passive"],
      );
      assert.ok(
        /Blink/i.test(wiring.shown || ""),
        "challenge text should render",
      );
      assert.equal(wiring.cleared, "", "done challenge clears the box");

      // Thrown verification errors land in the status line
      var errStatus = await page.evaluate(async function () {
        window.faceLiveness = {
          verifyLiveness: function () {
            throw new Error("cam died");
          },
        };
        await window.runFaceLivenessCheck();
        return (document.getElementById("face-status") || {}).textContent || "";
      });
      assert.ok(errStatus.includes("Liveness error: cam died"), errStatus);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("faceOverlayTick throttles, schedules via rAF and releases busy state", async function () {
    var opened = await openConsented();
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      var res = await page.evaluate(async function () {
        var calls = 0;
        var resolvers = [];
        var originalDetect = window.faceOverlayDetectAndDraw;
        var originalRaf = window.requestAnimationFrame;
        window.faceOverlayDetectAndDraw = function () {
          calls++;
          return new Promise(function (resolve, reject) {
            resolvers.push({ resolve: resolve, reject: reject });
          });
        };
        window.requestAnimationFrame = function (cb) {
          // capture only — no automatic refiring between our explicit ticks
          return 0;
        };
        window._faceOverlayRunning = true;
        window._faceOverlayLast = 0;
        window._faceOverlayBusy = false;

        window.faceOverlayTick(500); // ≥200ms since last → detection starts
        var afterDue = { calls: calls, busy: window._faceOverlayBusy };

        resolvers[0].resolve();
        await new Promise(function (r) {
          setTimeout(r, 10);
        });

        window.faceOverlayTick(560); // throttled (<200ms since last)
        var afterThrottle = { calls: calls };

        window.faceOverlayTick(900); // due again
        resolvers[1].reject(new Error("draw fail"));
        await new Promise(function (r) {
          setTimeout(r, 10);
        });
        var busyAfterReject = window._faceOverlayBusy;

        window._faceOverlayRunning = false;
        window.faceOverlayTick(5000); // stopped → ignored
        var afterStopped = { calls: calls };

        window.faceOverlayDetectAndDraw = originalDetect;
        window.requestAnimationFrame = originalRaf;
        return {
          afterDue: afterDue,
          afterThrottle: afterThrottle,
          afterSecond: { calls: calls },
          busyAfterReject: busyAfterReject,
          afterStopped: afterStopped,
        };
      });
      assert.equal(res.afterDue.calls, 1);
      assert.equal(res.afterDue.busy, true);
      assert.equal(res.afterThrottle.calls, 1);
      assert.equal(res.afterSecond.calls, 2);
      assert.equal(
        res.busyAfterReject,
        false,
        "rejecting detection must release busy",
      );
      assert.equal(res.afterStopped.calls, 2);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("progress overlay can be rebuilt from scratch and show() degrades safely", async function () {
    var opened = await openConsented();
    var ctx = opened.ctx;
    var page = opened.page;
    try {
      var res = await page.evaluate(function () {
        var ids = [
          "face-progress-overlay",
          "face-progress-title",
          "face-progress-text",
          "face-progress-bar",
          "face-progress-pct",
        ];
        ids.forEach(function (id) {
          var el = document.getElementById(id);
          if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        // With every ref gone, ensure() rebuilds the overlay from scratch.
        var overlay = window.faceProgressEnsure();
        var rebuilt = !!overlay && document.body.contains(overlay);

        // While getElementById keeps failing for progress ids, show() must
        // bail out silently both before AND after its ensure() attempt.
        var originalGet = document.getElementById.bind(document);
        var savedOverlay = window._faceProgressOverlay;
        window._faceProgressOverlay = null;
        document.getElementById = function (id) {
          if (String(id).indexOf("face-progress") === 0) return null;
          return originalGet(id);
        };
        var threw = false;
        try {
          window.faceProgressShow("E2E", "rebuilding");
        } catch (err) {
          threw = true;
        }
        document.getElementById = originalGet;
        window._faceProgressOverlay = savedOverlay;
        return { rebuilt: rebuilt, threw: threw };
      });
      assert.equal(
        res.rebuilt,
        true,
        "overlay should be recreated when absent",
      );
      assert.equal(res.threw, false, "show() must not throw without refs");
    } finally {
      await closePage(ctx, page);
    }
  });
});

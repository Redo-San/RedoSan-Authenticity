var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var os = require("node:os");
var path = require("node:path");
var { chromium } = require("playwright");
var {
  ensureServer,
  openPage,
  closePage,
  checkNoErrors,
  pageURL,
} = require("../mpa_helpers");

var PAGE_ID = "voice-biometric";
var FIX = path.resolve(__dirname, "../../fixtures");
var REAL = process.env.REDOSAN_VOICE_E2E_REAL === "1";
var REPORT_DIR = path.resolve(__dirname, "../../../test-results");
var browser;
var tmpDir;
var opened;
var savedState;

before(async function () {
  await ensureServer();
  browser = await chromium.launch({
    headless: true,
    args: ["--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox"],
  });
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "voice-e2e-"));
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
});

after(async function () {
  if (opened) await closePage(opened.ctx, opened.page).catch(function () {});
  if (browser) await browser.close().catch(function () {});
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (err) {
    void err;
  }
});

function arrayBufferToBase64(buffer) {
  var bytes = new Uint8Array(buffer);
  var binary = "";
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  var binary = atob(base64);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function serializeForStorage(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof ArrayBuffer) {
    return { __type: "ArrayBuffer", data: arrayBufferToBase64(obj) };
  }
  if (obj instanceof Uint8Array) {
    return { __type: "Uint8Array", data: arrayBufferToBase64(obj.buffer) };
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeForStorage);
  }
  if (typeof obj === "object") {
    var result = {};
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = serializeForStorage(obj[key]);
      }
    }
    return result;
  }
  return obj;
}

function deserializeFromStorage(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj && obj.__type === "ArrayBuffer") {
    return base64ToArrayBuffer(obj.data);
  }
  if (obj && obj.__type === "Uint8Array") {
    return new Uint8Array(base64ToArrayBuffer(obj.data));
  }
  if (Array.isArray(obj)) {
    return obj.map(deserializeFromStorage);
  }
  if (typeof obj === "object") {
    var result = {};
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = deserializeFromStorage(obj[key]);
      }
    }
    return result;
  }
  return obj;
}

async function backupIndexedDBToLocalStorage(page) {
  await page.evaluate(async function () {
    var dbs = await indexedDB.databases();
    for (var i = 0; i < dbs.length; i++) {
      var dbInfo = dbs[i];
      if (dbInfo.name === "VoiceRegistryDB") {
        var db = await new Promise(function (resolve, reject) {
          var req = indexedDB.open(dbInfo.name, dbInfo.version);
          req.onsuccess = function () {
            resolve(req.result);
          };
          req.onerror = function () {
            reject(req.error);
          };
        });

        var tx = db.transaction(
          ["templates", "consent", "auth", "meta"],
          "readonly",
        );
        var result = {};
        var storeNames = ["templates", "consent", "auth", "meta"];

        for (var j = 0; j < storeNames.length; j++) {
          var store = tx.objectStore(storeNames[j]);
          var req = store.getAll();
          await new Promise(function (resolve) {
            req.onsuccess = function () {
              // Serialize Uint8Array to base64 for storage
              result[storeNames[j]] = req.result.map(function (r) {
                var copy = {};
                for (var key in r) {
                  if (r[key] instanceof Uint8Array) {
                    copy[key] = {
                      __type: "Uint8Array",
                      data: btoa(String.fromCharCode.apply(null, r[key])),
                    };
                  } else {
                    copy[key] = r[key];
                  }
                }
                return copy;
              });
              resolve();
            };
            req.onerror = function () {
              resolve();
            };
          });
        }

        localStorage.setItem(
          "__VoiceRegistryDB_backup__",
          JSON.stringify(result),
        );
        db.close();
        break;
      }
    }
  });
}

async function restoreIndexedDBFromLocalStorage(page) {
  await page.evaluate(async function () {
    var backup = localStorage.getItem("__VoiceRegistryDB_backup__");
    if (!backup) return;

    var data = JSON.parse(backup);
    var req = indexedDB.open("VoiceRegistryDB", 2);

    req.onsuccess = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains("templates")) return;

      var tx = db.transaction(
        ["templates", "consent", "auth", "meta"],
        "readwrite",
      );
      var storeNames = ["templates", "consent", "auth", "meta"];

      for (var i = 0; i < storeNames.length; i++) {
        var store = tx.objectStore(storeNames[i]);
        store.clear();
        if (data[storeNames[i]]) {
          data[storeNames[i]].forEach(function (r) {
            var copy = {};
            for (var key in r) {
              if (r[key] && r[key].__type === "Uint8Array") {
                // Convert base64 back to Uint8Array
                var binary = atob(r[key].data);
                var bytes = new Uint8Array(binary.length);
                for (var k = 0; k < binary.length; k++) {
                  bytes[k] = binary.charCodeAt(k);
                }
                copy[key] = bytes;
              } else {
                copy[key] = r[key];
              }
            }
            store.put(copy);
          });
        }

        tx.oncomplete = function () {
          console.log("[RESTORE] IndexedDB restored from localStorage");
        };
        tx.onerror = function () {
          console.log("[RESTORE] IndexedDB restore error");
        };
      }
      req.onerror = function () {
        console.log("[RESTORE] IndexedDB open error");
      };
    };
  });
}

async function saveState() {
  if (opened && opened.ctx) {
    await backupIndexedDBToLocalStorage(opened.page);
    console.log("[STATE] IndexedDB backed up to localStorage");

    try {
      var state = await opened.ctx.storageState({ indexedDB: true });
      if (state.origins) {
        var hasIndexedDB = false;
        state.origins.forEach(function (origin) {
          if (origin.indexedDB && Object.keys(origin.indexedDB).length > 0) {
            hasIndexedDB = true;
          }
        });
        if (hasIndexedDB) {
          savedState = state;
          console.log("[STATE] storageState succeeded with IndexedDB");
          return;
        }
      }
      console.log("[STATE] storageState returned no IndexedDB data");
    } catch (err) {
      console.log("[STATE] storageState failed: " + (err.message || err));
    }
    // Fallback: manual backup
    savedState = await manualBackupIndexedDB();
  }
}

async function manualBackupIndexedDB() {
  if (!opened || !opened.page) return null;
  var page = opened.page;
  var indexedDBData = await page
    .evaluate(async function () {
      return new Promise(function (resolve) {
        var req = indexedDB.open("VoiceRegistryDB", 2);
        req.onsuccess = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains("templates")) {
            resolve({});
            return;
          }
          var tx = db.transaction(
            ["templates", "consent", "auth", "meta"],
            "readonly",
          );
          var tmplStore = tx.objectStore("templates");
          var consentStore = tx.objectStore("consent");
          var authStore = tx.objectStore("auth");
          var metaStore = tx.objectStore("meta");
          var tmplReq = tmplStore.getAll();
          var consentReq = consentStore.getAll();
          var authReq = authStore.getAll();
          var metaReq = metaStore.getAll();
          var result = { templates: [], consent: [], auth: [], meta: [] };
          tmplReq.onsuccess = function () {
            result.templates = tmplReq.result.map(function (r) {
              var copy = Object.assign({}, r);
              if (r.code && r.code.buffer) {
                var bytes = new Uint8Array(
                  r.code.buffer,
                  r.code.byteOffset,
                  r.code.byteLength,
                );
                var binary = "";
                for (var i = 0; i < bytes.length; i++)
                  binary += String.fromCharCode(bytes[i]);
                copy.code = btoa(binary);
              }
              return copy;
            });
            consentReq.onsuccess = function () {
              result.consent = consentReq.result;
              authReq.onsuccess = function () {
                result.auth = authReq.result;
                metaReq.onsuccess = function () {
                  result.meta = metaReq.result;
                  resolve(result);
                };
              };
            };
          };
        };
        req.onerror = function () {
          resolve({});
        };
      });
    })
    .catch(function () {
      return {};
    });

  var state = await opened.ctx.storageState();
  if (indexedDBData && Object.keys(indexedDBData).length > 0) {
    if (!state.origins) state.origins = [];
    var origin = state.origins.find(function (o) {
      return o.origin === "http://localhost:9455";
    });
    if (!origin) {
      origin = {
        origin: "http://localhost:9455",
        localStorage: [],
        cookies: [],
      };
      state.origins.push(origin);
    }
    origin.indexedDB = { VoiceRegistryDB: indexedDBData };
  }
  return state;
}

async function restoreIndexedDBFromState(page, state) {
  if (!state || !state.origins) return;
  var origin = state.origins.find(function (o) {
    return o.origin === "http://localhost:9455";
  });
  if (origin && origin.indexedDB && origin.indexedDB.VoiceRegistryDB) {
    var data = origin.indexedDB.VoiceRegistryDB;
    // Convert base64 back to Uint8Array
    if (data.templates) {
      data.templates.forEach(function (r) {
        if (r.code && typeof r.code === "string") {
          var binary = atob(r.code);
          var bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);
          r.code = bytes;
        }
      });
    }
    await page
      .evaluate(function (d) {
        return new Promise(function (resolve) {
          var req = indexedDB.open("VoiceRegistryDB", 2);
          req.onsuccess = function () {
            var db = req.result;
            if (!db.objectStoreNames.contains("templates")) {
              resolve();
              return;
            }
            var tx = db.transaction(
              ["templates", "consent", "auth", "meta"],
              "readwrite",
            );
            var tmplStore = tx.objectStore("templates");
            var consentStore = tx.objectStore("consent");
            var authStore = tx.objectStore("auth");
            var metaStore = tx.objectStore("meta");
            tmplStore.clear();
            consentStore.clear();
            authStore.clear();
            metaStore.clear();
            (d.templates || []).forEach(function (r) {
              tmplStore.put(r);
            });
            (d.consent || []).forEach(function (r) {
              consentStore.put(r);
            });
            (d.auth || []).forEach(function (r) {
              authStore.put(r);
            });
            (d.meta || []).forEach(function (r) {
              metaStore.put(r);
            });
            tx.oncomplete = function () {
              resolve();
            };
            tx.onerror = function () {
              resolve();
            };
          };
          req.onerror = function () {
            resolve();
          };
        });
      }, data)
      .catch(function () {});
  } else {
    await restoreIndexedDBFromLocalStorage(page);
  }
}

async function openConsented() {
  var errors = [];
  if (opened) {
    await saveState();
    await closePage(opened.ctx, opened.page).catch(function () {});
  }

  if (savedState) {
    opened = await browser.newContext({ storageState: savedState });
  } else {
    opened = await browser.newContext({ locale: "en-US" });
  }

  var page = await opened.newPage();
  opened.page = page;
  opened.errors = errors;
  page.setDefaultTimeout(300000);

  page.on("pageerror", function (e) {
    errors.push(e.message);
  });
  page.on("console", function (msg) {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto(pageURL(PAGE_ID), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  await page
    .evaluate(function () {
      var el = document.getElementById("botBlockOverlay");
      if (el) {
        el.style.display = "none";
        el.classList.remove("active");
      }
    })
    .catch(function () {});

  await page
    .evaluate(function () {
      var check = document.getElementById("voice-consent-check");
      if (check) {
        check.checked = true;
        check.dispatchEvent(new Event("change", { bubbles: true }));
      }
      var accept = document.getElementById("voice-consent-accept");
      if (accept) accept.click();
    })
    .catch(function () {});

  if (savedState && savedState.origins) {
    var origin = savedState.origins.find(function (o) {
      return o.origin === "http://localhost:9455";
    });
    if (origin && origin.indexedDB && origin.indexedDB.VoiceRegistryDB) {
      var data = origin.indexedDB.VoiceRegistryDB;
      // Convert base64 back to Uint8Array
      if (data.templates) {
        data.templates.forEach(function (r) {
          if (r.code && typeof r.code === "string") {
            var binary = atob(r.code);
            var bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++)
              bytes[i] = binary.charCodeAt(i);
            r.code = bytes;
          }
        });
      }
      await page
        .evaluate(function (d) {
          return new Promise(function (resolve) {
            var req = indexedDB.open("VoiceRegistryDB", 2);
            req.onsuccess = function () {
              var db = req.result;
              if (!db.objectStoreNames.contains("templates")) {
                resolve();
                return;
              }
              var tx = db.transaction(
                ["templates", "consent", "auth", "meta"],
                "readwrite",
              );
              var tmplStore = tx.objectStore("templates");
              var consentStore = tx.objectStore("consent");
              var authStore = tx.objectStore("auth");
              var metaStore = tx.objectStore("meta");
              tmplStore.clear();
              consentStore.clear();
              authStore.clear();
              metaStore.clear();
              (d.templates || []).forEach(function (r) {
                tmplStore.put(r);
              });
              (d.consent || []).forEach(function (r) {
                consentStore.put(r);
              });
              (d.auth || []).forEach(function (r) {
                authStore.put(r);
              });
              (d.meta || []).forEach(function (r) {
                metaStore.put(r);
              });
              tx.oncomplete = function () {
                resolve();
              };
              tx.onerror = function () {
                resolve();
              };
            };
            req.onerror = function () {
              resolve();
            };
          });
        }, data)
        .catch(function () {});
    }
    console.log("[RESTORE] IndexedDB restored");
  }

  await page.waitForFunction(
    function () {
      var a = document.getElementById("voice-audio");
      return a && a.disabled === false;
    },
    null,
    { timeout: 300000 },
  );

  return opened;
}

async function dumpRegistry(page) {
  return page
    .evaluate(async function () {
      return new Promise(function (resolve) {
        var req = indexedDB.open("VoiceRegistryDB", 2);
        req.onsuccess = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains("templates")) {
            resolve({ templates: [], consent: [], auth: [], meta: [] });
            return;
          }
          var tx = db.transaction(
            ["templates", "consent", "auth", "meta"],
            "readonly",
          );
          var tmplStore = tx.objectStore("templates");
          var consentStore = tx.objectStore("consent");
          var authStore = tx.objectStore("auth");
          var metaStore = tx.objectStore("meta");
          var tmplReq = tmplStore.getAll();
          var consentReq = consentStore.getAll();
          var authReq = authStore.getAll();
          var metaReq = metaStore.getAll();
          tmplReq.onsuccess = function () {
            consentReq.onsuccess = function () {
              authReq.onsuccess = function () {
                metaReq.onsuccess = function () {
                  resolve({
                    templates: tmplReq.result,
                    consent: consentReq.result,
                    auth: authReq.result,
                    meta: metaReq.result,
                  });
                };
              };
            };
          };
        };
        req.onerror = function () {
          resolve({ templates: [], consent: [], auth: [], meta: [] });
        };
      });
    })
    .catch(function () {
      return { templates: [], consent: [], auth: [], meta: [] };
    });
}

function engineState(page) {
  return page
    .evaluate(function () {
      var eng = window._voiceEngine;
      if (!eng && typeof buildVoiceEngine === "function") {
        eng = buildVoiceEngine();
      }
      var emb = eng && eng._embedder ? eng._embedder : null;
      return {
        built: !!eng,
        embedderOk:
          !!emb &&
          (emb === window.VoiceONNXEmbedder ||
            emb === window.VoiceWavlmEmbedder),
        version: emb ? emb.VERSION : null,
        dim: emb ? emb.DIMS : null,
        inputKind: emb ? emb.INPUT_KIND : null,
        inputName: emb ? emb.INPUT_NAME : null,
        outputName: emb ? emb.OUTPUT_NAME : null,
        hint:
          (document.getElementById("voice-embedder-hint") || {}).textContent ||
          "",
      };
    })
    .catch(function () {
      return { built: false, embedderOk: false };
    });
}

async function selectEmbedder(page, value) {
  return page.evaluate(function (v) {
    var sel = document.getElementById("voice-embedder");
    sel.value = v;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function runFile(page, file, label) {
  await page
    .waitForFunction(
      function () {
        var i = document.getElementById("voice-audio");
        return i !== null;
      },
      null,
      { timeout: 30000 },
    )
    .catch(function () {});

  await page.setInputFiles("#voice-audio", path.join(FIX, file));
  await page.fill("#voice-label", label || "");

  await page.waitForFunction(
    function () {
      var b = document.getElementById("voice-run");
      return b && !b.disabled;
    },
    null,
    { timeout: 600000 },
  );

  var t0 = Date.now();
  await page.click("#voice-run");

  var reportJson = await page.waitForFunction(
    function () {
      var r = window._voiceReport;
      if (r && r.quality && !!r.timings) {
        try {
          return JSON.stringify(r);
        } catch (e) {
          return null;
        }
      }
      return null;
    },
    null,
    { timeout: 600000 },
  );

  var report = reportJson ? JSON.parse(reportJson) : null;
  var wallMs = Date.now() - t0;
  return { report, wallMs };
}

function sumTimings(report) {
  var sum = 0;
  (report.timings || []).forEach(function (t) {
    sum += t.ms;
  });
  return sum;
}
function procTimings(report) {
  var sum = 0;
  (report.timings || []).forEach(function (t) {
    if (t.stage !== "load") sum += t.ms;
  });
  return sum;
}

describe("mpa voice-biometric page shell", function () {
  it("loads standalone and exposes the embedder switch", async function () {
    opened = await openConsented();
    checkNoErrors(opened.errors, PAGE_ID);
    var page = opened.page;
    var shell = await page.evaluate(function () {
      var sel = document.getElementById("voice-embedder");
      return {
        standalone: document.documentElement.dataset.standalone,
        active: !!document
          .getElementById("page-" + "voice-biometric")
          .classList.contains("active"),
        options: Array.prototype.slice.call(sel.options).map(function (o) {
          return o.value;
        }),
        selected: sel.value,
        hint:
          (document.getElementById("voice-embedder-hint") || {}).textContent ||
          "",
        duration:
          (document.querySelector('[data-i18n="voice.hint.duration"]') || {})
            .textContent || "",
        wavlm: {
          version: window.VoiceWavlmEmbedder
            ? window.VoiceWavlmEmbedder.VERSION
            : null,
          dim: window.VoiceWavlmEmbedder
            ? window.VoiceWavlmEmbedder.DIMS
            : null,
          inputKind: window.VoiceWavlmEmbedder
            ? window.VoiceWavlmEmbedder.INPUT_KIND
            : null,
          inputName: window.VoiceWavlmEmbedder
            ? window.VoiceWavlmEmbedder.INPUT_NAME
            : null,
          outputName: window.VoiceWavlmEmbedder
            ? window.VoiceWavlmEmbedder.OUTPUT_NAME
            : null,
          sha: window.VoiceWavlmEmbedder
            ? (window.VoiceWavlmEmbedder.MODEL_SHA256 || "").slice(0, 12)
            : null,
        },
      };
    });
    assert.equal(shell.standalone, PAGE_ID);
    assert.equal(shell.active, true);
    assert.deepEqual(shell.options, ["ecapa", "wavlm"]);
    assert.equal(shell.selected, "ecapa");
    assert.match(shell.hint, /~83 MB/);
    assert.match(shell.duration, /2-10 seconds/);
    assert.equal(shell.wavlm.version, "wavlm-base-plus-sv");
    assert.equal(shell.wavlm.dim, 512);
    assert.equal(shell.wavlm.inputKind, "waveform");
    assert.equal(shell.wavlm.inputName, "input_values");
    assert.equal(shell.wavlm.outputName, "embeddings");
    assert.equal(shell.wavlm.sha, "c491174cc96b");
  });
});

describe("mpa voice-biometric embedder wiring", function () {
  it("honors the select and rebuilds the engine without network", async function () {
    if (!opened) opened = await openConsented();
    var page = opened.page;
    var dflt = await engineState(page);
    assert.equal(dflt.version, "ecapa-tdnn");
    assert.equal(dflt.dim, 192);
    assert.match(dflt.hint, /~83 MB/);
    await selectEmbedder(page, "wavlm");
    var wav = await engineState(page);
    assert.equal(wav.version, "wavlm-base-plus-sv");
    assert.equal(wav.dim, 512);
    assert.equal(wav.inputKind, "waveform");
    assert.equal(wav.inputName, "input_values");
    assert.equal(wav.outputName, "embeddings");
    assert.equal(wav.embedderOk, true);
    assert.match(wav.hint, /~102 MB/);
    await selectEmbedder(page, "ecapa");
    var back = await engineState(page);
    assert.equal(back.version, "ecapa-tdnn");
    assert.equal(back.dim, 192);
    assert.equal(back.embedderOk, true);
    assert.match(back.hint, /~83 MB/);
  });
});

describe("mpa voice-biometric real-ONNX pipeline", function () {
  it(
    "runs golden fixtures, records timing and the v1-vs-v2 discriminates",
    {
      skip:
        !REAL && "set REDOSAN_VOICE_E2E_REAL=1 for the online measured pass",
    },
    async function () {
      opened = await openConsented();
      var page = opened.page;
      var t = {};
      var r1, h1b, h2, song, silence, rw;

      process.stderr.write(
        "[DUMP] Before h1a: " + JSON.stringify(await dumpRegistry(page)) + "\n",
      );

      var h1aEcapa = await runFile(page, "golden_h1a.wav", "e2e-h1a");
      process.stderr.write(
        "[DUMP] After h1a: " + JSON.stringify(await dumpRegistry(page)) + "\n",
      );
      await saveState();
      process.stderr.write("[STATE] After h1a state saved\n");

      opened = await openConsented();
      page = opened.page;
      process.stderr.write(
        "[DUMP] After h1a restore: " +
          JSON.stringify(await dumpRegistry(page)) +
          "\n",
      );

      r1 = h1aEcapa.report;
      assert.equal(r1.quality.gate, "PASS");
      assert.match(r1.speaker.embeddingHash, /^[0-9a-f]{64}$/);
      assert.equal(r1.speaker.embeddingModel, "ecapa-tdnn");
      assert.equal(r1.speaker.embeddingDim, 192);
      assert.ok(r1.registry.registeredId > 0, "registeredId numeric");
      assert.equal(r1.speaker.decision, "NO_MATCH", "first enrolment");
      assert.match(r1.template.codeSha256, /^[0-9a-f]{64}$/);
      assert.match(r1.template.pinFingerprint, /^[0-9a-f]{64}$/);
      assert.match(r1.did.did, /^did:key:/);
      assert.ok(r1.timings.length >= 7, "stages timed");
      assert.ok(
        procTimings(r1) < 60000,
        "process <60s, got " + procTimings(r1),
      );
      assert.equal(r1.timings[0].stage, "audio", "audio stage first");
      assert.equal(r1.timings[1].stage, "load", "load stage second");

      var h1b = await runFile(page, "golden_h1b.wav", "e2e-h1b");
      process.stderr.write(
        "[DUMP] After h1b: " + JSON.stringify(await dumpRegistry(page)) + "\n",
      );
      await saveState();
      opened = await openConsented();
      page = opened.page;
      process.stderr.write(
        "[DUMP] After h1b restore: " +
          JSON.stringify(await dumpRegistry(page)) +
          "\n",
      );
      assert.equal(h1b.report.quality.gate, "PASS");
      assert.equal(h1b.report.speaker.decision, "MATCH", "same speaker");
      assert.ok(
        h1b.report.speaker.similarity >= 0.7,
        "cross-utterance cos >= 0.7, got " + h1b.report.speaker.similarity,
      );

      var h2 = await runFile(page, "golden_h2.wav", "e2e-h2");
      process.stderr.write(
        "[DUMP] After h2: " + JSON.stringify(await dumpRegistry(page)) + "\n",
      );
      await saveState();
      opened = await openConsented();
      page = opened.page;
      process.stderr.write(
        "[DUMP] After h2 restore: " +
          JSON.stringify(await dumpRegistry(page)) +
          "\n",
      );
      assert.equal(h2.report.quality.gate, "PASS");
      assert.equal(h2.report.speaker.decision, "NO_MATCH", "different speaker");
      if (h2.report.speaker.similarity !== null) {
        assert.ok(
          h2.report.speaker.similarity < 0.7,
          "cross-speaker cos < 0.7, got " + h2.report.speaker.similarity,
        );
      }

      var song = await runFile(page, "golden_song.wav", "e2e-song");
      process.stderr.write(
        "[DUMP] After song: " + JSON.stringify(await dumpRegistry(page)) + "\n",
      );
      await saveState();
      opened = await openConsented();
      page = opened.page;
      process.stderr.write(
        "[DUMP] After song restore: " +
          JSON.stringify(await dumpRegistry(page)) +
          "\n",
      );
      var lowConfidence = song.report.limitations.some(function (l) {
        return /low.?confidence/i.test(l);
      });
      assert.ok(
        song.report.quality.gate === "FAIL" || lowConfidence,
        "song rejected or flagged, gate=" +
          song.report.quality.gate +
          " lowConfidence=" +
          lowConfidence,
      );

      var silence = await runFile(page, "silence.wav", "e2e-silence");
      process.stderr.write(
        "[DUMP] After silence: " +
          JSON.stringify(await dumpRegistry(page)) +
          "\n",
      );
      await saveState();
      opened = await openConsented();
      page = opened.page;
      process.stderr.write(
        "[DUMP] After silence restore: " +
          JSON.stringify(await dumpRegistry(page)) +
          "\n",
      );
      assert.equal(silence.report.quality.gate, "FAIL", "silence gated out");

      await selectEmbedder(page, "wavlm");
      var wavHeavy = await runFile(page, "golden_h1a.wav", "e2e-h1a-wavlm");
      process.stderr.write(
        "[DUMP] After wavlm: " +
          JSON.stringify(await dumpRegistry(page)) +
          "\n",
      );
      await saveState();
      opened = await openConsented();
      page = opened.page;
      process.stderr.write(
        "[DUMP] After wavlm restore: " +
          JSON.stringify(await dumpRegistry(page)) +
          "\n",
      );
      rw = wavHeavy.report;
      assert.equal(rw.quality.gate, "PASS");
      assert.equal(rw.speaker.embeddingModel, "wavlm-base-plus-sv");
      assert.equal(rw.speaker.embeddingDim, 512);
      assert.notEqual(rw.speaker.embeddingHash, r1.speaker.embeddingHash);
      assert.ok(
        procTimings(rw) < 120000,
        "wavlm process <120s, got " + procTimings(rw),
      );

      var out = {
        runAt: new Date().toISOString(),
        ecapa: {
          h1a: {
            embeddingHash: r1.speaker.embeddingHash,
            codeSha256: r1.template.codeSha256,
            pinFingerprint: r1.template.pinFingerprint,
            embedMagnitude: r1.speaker.embedMagnitude,
            registeredId: r1.registry.registeredId,
            timings: r1.timings,
            wallMs: h1aEcapa.wallMs,
          },
          h1b: {
            similarity: h1b.report.speaker.similarity,
            decision: h1b.report.speaker.decision,
            embedMagnitude: h1b.report.speaker.embedMagnitude,
            timings: h1b.report.timings,
            wallMs: h1b.wallMs,
          },
          h2: {
            similarity: h2.report.speaker.similarity,
            decision: h2.report.speaker.decision,
            timings: h2.report.timings,
            wallMs: h2.wallMs,
          },
          songGate: song.report.quality.gate,
          songMagnitude: song.report.speaker.embedMagnitude,
        },
        wavlm: {
          h1a: {
            embeddingHash: rw.speaker.embeddingHash,
            embedMagnitude: rw.speaker.embedMagnitude,
            timings: rw.timings,
            wallMs: wavHeavy.wallMs,
          },
        },
      };
      fs.writeFileSync(
        path.join(REPORT_DIR, "voice-e2e.json"),
        JSON.stringify(out, null, 2),
      );
    },
  );
});

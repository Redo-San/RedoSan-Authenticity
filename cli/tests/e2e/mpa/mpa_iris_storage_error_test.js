var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var { chromium } = require("playwright");
var { ensureServer, openPage, closePage } = require("../mpa_helpers");

var PAGE_ID = "iris-biometric";
var browser;

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("Iris Storage — IDB error handlers", function () {
  it("should trigger _openDB reject by mocking IDB.open to fail", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var errorCaught = await page.evaluate(async function () {
        var origOpen = indexedDB.open.bind(indexedDB);
        indexedDB.open = function () {
          var failReq = {
            result: undefined,
            error: new Error("Mocked DB open failure"),
          };
          setTimeout(function () {
            if (failReq.onerror) failReq.onerror({ target: failReq });
          }, 10);
          return failReq;
        };
        try {
          var storage = new window.IrisStorage();
          storage._db = null;
          await storage._openDB();
          indexedDB.open = origOpen;
          return false;
        } catch (e) {
          indexedDB.open = origOpen;
          return e.message.includes("IndexedDB open failed");
        }
      });
      assert.ok(errorCaught, "_openDB should catch mocked error");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should trigger save req.onerror by mocking store.put to fail", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        localStorage.setItem("iris_consent", "1");
      });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var errorCaught = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        var db = await storage._openDB();
        var origTrans = db.transaction.bind(db);

        db.transaction = function () {
          var tx = origTrans.apply(null, arguments);
          var origStore = tx.objectStore.bind(tx);
          tx.objectStore = function (name) {
            var store = origStore(name);
            store.put = function () {
              var failReq = { readyState: "pending", error: null };
              failReq.onerror = null;
              setTimeout(function () {
                failReq.error = new Error("Mocked put failure");
                if (failReq.onerror) failReq.onerror({ target: failReq });
              }, 10);
              return failReq;
            };
            return store;
          };
          return tx;
        };

        try {
          await storage.save({
            id: "mock-save",
            label: "x",
            leftCode: new Uint8Array([1]),
            leftMask: new Uint8Array([2]),
          });
          return false;
        } catch (e) {
          return e.message.includes("Save failed");
        }
      });
      assert.ok(errorCaught, "save should catch mocked put error");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should trigger load req.onerror by mocking store.get to fail", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        localStorage.setItem("iris_consent", "1");
      });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var errorCaught = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        var db = await storage._openDB();
        var origTrans = db.transaction.bind(db);

        db.transaction = function () {
          var tx = origTrans.apply(null, arguments);
          var origStore = tx.objectStore.bind(tx);
          tx.objectStore = function (name) {
            var store = origStore(name);
            store.get = function () {
              var failReq = { readyState: "pending", error: null };
              failReq.onerror = null;
              setTimeout(function () {
                failReq.error = new Error("Mocked get failure");
                if (failReq.onerror) failReq.onerror({ target: failReq });
              }, 10);
              return failReq;
            };
            return store;
          };
          return tx;
        };

        try {
          await storage.load("test-id");
          return false;
        } catch (e) {
          return e.message.includes("Load failed");
        }
      });
      assert.ok(errorCaught, "load should catch mocked get error");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should trigger list req.onerror by mocking cursor.openCursor to fail", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        localStorage.setItem("iris_consent", "1");
      });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var errorCaught = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        var db = await storage._openDB();
        var origTrans = db.transaction.bind(db);

        db.transaction = function () {
          var tx = origTrans.apply(null, arguments);
          var origStore = tx.objectStore.bind(tx);
          tx.objectStore = function (name) {
            var store = origStore(name);
            store.openCursor = function () {
              var failReq = { readyState: "pending", error: null };
              failReq.onerror = null;
              setTimeout(function () {
                failReq.error = new Error("Mocked cursor failure");
                if (failReq.onerror) failReq.onerror({ target: failReq });
              }, 10);
              return failReq;
            };
            return store;
          };
          return tx;
        };

        try {
          await storage.list();
          return false;
        } catch (e) {
          return e.message.includes("List failed");
        }
      });
      assert.ok(errorCaught, "list should catch mocked cursor error");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should trigger delete req.onerror by mocking store.delete to fail", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        localStorage.setItem("iris_consent", "1");
      });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var errorCaught = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        var db = await storage._openDB();
        var origTrans = db.transaction.bind(db);

        db.transaction = function () {
          var tx = origTrans.apply(null, arguments);
          var origStore = tx.objectStore.bind(tx);
          tx.objectStore = function (name) {
            var store = origStore(name);
            store.delete = function () {
              var failReq = { readyState: "pending", error: null };
              failReq.onerror = null;
              setTimeout(function () {
                failReq.error = new Error("Mocked delete failure");
                if (failReq.onerror) failReq.onerror({ target: failReq });
              }, 10);
              return failReq;
            };
            return store;
          };
          return tx;
        };

        try {
          await storage.delete("test-id");
          return false;
        } catch (e) {
          return e.message.includes("Delete failed");
        }
      });
      assert.ok(errorCaught, "delete should catch mocked delete error");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should trigger count req.onerror by mocking store.count to fail", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        localStorage.setItem("iris_consent", "1");
      });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var errorCaught = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        var db = await storage._openDB();
        var origTrans = db.transaction.bind(db);

        db.transaction = function () {
          var tx = origTrans.apply(null, arguments);
          var origStore = tx.objectStore.bind(tx);
          tx.objectStore = function (name) {
            var store = origStore(name);
            store.count = function () {
              var failReq = { readyState: "pending", error: null };
              failReq.onerror = null;
              setTimeout(function () {
                failReq.error = new Error("Mocked count failure");
                if (failReq.onerror) failReq.onerror({ target: failReq });
              }, 10);
              return failReq;
            };
            return store;
          };
          return tx;
        };

        try {
          await storage.count();
          return false;
        } catch (e) {
          return e.message.includes("Count failed");
        }
      });
      assert.ok(errorCaught, "count should catch mocked count error");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should trigger clear req.onerror by mocking store.clear to fail", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        localStorage.setItem("iris_consent", "1");
      });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var errorCaught = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        var db = await storage._openDB();
        var origTrans = db.transaction.bind(db);

        db.transaction = function () {
          var tx = origTrans.apply(null, arguments);
          var origStore = tx.objectStore.bind(tx);
          tx.objectStore = function (name) {
            var store = origStore(name);
            store.clear = function () {
              var failReq = { readyState: "pending", error: null };
              failReq.onerror = null;
              setTimeout(function () {
                failReq.error = new Error("Mocked clear failure");
                if (failReq.onerror) failReq.onerror({ target: failReq });
              }, 10);
              return failReq;
            };
            return store;
          };
          return tx;
        };

        try {
          await storage.clear();
          return false;
        } catch (e) {
          return e.message.includes("Clear failed");
        }
      });
      assert.ok(errorCaught, "clear should catch mocked clear error");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should trigger exportAllRecords req.onerror by mocking cursor to fail", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () {
        localStorage.setItem("iris_consent", "1");
      });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var errorCaught = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        var db = await storage._openDB();
        var origTrans = db.transaction.bind(db);

        db.transaction = function () {
          var tx = origTrans.apply(null, arguments);
          var origStore = tx.objectStore.bind(tx);
          tx.objectStore = function (name) {
            var store = origStore(name);
            store.openCursor = function () {
              var failReq = { readyState: "pending", error: null };
              failReq.onerror = null;
              setTimeout(function () {
                failReq.error = new Error("Mocked export cursor failure");
                if (failReq.onerror) failReq.onerror({ target: failReq });
              }, 10);
              return failReq;
            };
            return store;
          };
          return tx;
        };

        try {
          await storage.exportAllRecords();
          return false;
        } catch (e) {
          return e.message.includes("Export failed");
        }
      });
      assert.ok(
        errorCaught,
        "exportAllRecords should catch mocked cursor error",
      );
    } finally {
      await closePage(ctx, page);
    }
  });
});

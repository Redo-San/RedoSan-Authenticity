// ── IndexedDB polyfill — extends base setup for storage tests ──
require("./setup");

const _idbData = {};
let _idbShouldFail = false;

function fireAsync(fn) {
  setTimeout(fn, 0);
}

function fakeReq(result) {
  const r = { onsuccess: null, onerror: null, result };
  fireAsync(() => {
    if (r.onsuccess) r.onsuccess({ target: r });
  });
  return r;
}

function fakeStore(name, txObj) {
  return {
    createIndex() {},
    put(record) {
      if (record && record.id) {
        if (!_idbData[name]) _idbData[name] = {};
        _idbData[name][record.id] = record;
      }
      if (txObj) txObj._puts++;
      return fakeReq(undefined);
    },
    get(id) {
      return fakeReq((_idbData[name] || {})[id] || undefined);
    },
    delete(id) {
      if (_idbData[name]) delete _idbData[name][id];
      return fakeReq(undefined);
    },
    clear() {
      _idbData[name] = {};
      return fakeReq(undefined);
    },
    count() {
      return fakeReq(Object.keys(_idbData[name] || {}).length);
    },
    openCursor() {
      const entries = Object.values(_idbData[name] || {});
      let idx = 0;
      const r = { onsuccess: null, onerror: null, result: null };
      function deliver() {
        if (idx < entries.length) {
          const cur = entries[idx];
          idx++;
          r.result = { value: cur, continue: deliver };
          if (r.onsuccess) r.onsuccess({ target: r });
        } else {
          r.result = null;
          if (r.onsuccess) r.onsuccess({ target: r });
        }
      }
      fireAsync(deliver);
      return r;
    },
    getAll() {
      return fakeReq(Object.values(_idbData[name] || {}));
    },
  };
}

function _makeDbResult() {
  return {
    objectStoreNames: {
      contains() {
        return false;
      },
    },
    createObjectStore(storeName) {
      return fakeStore(storeName);
    },
    transaction(storeName, mode) {
      const tx = {
        objectStore() {
          return fakeStore(storeName, tx);
        },
        oncomplete: null,
        onerror: null,
        _puts: 0,
      };
      fireAsync(() => {
        if (tx.oncomplete) tx.oncomplete();
      });
      return tx;
    },
  };
}

global.indexedDB = {
  open() {
    const dbResult = _makeDbResult();
    const req = {
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: null,
    };
    if (_idbShouldFail) {
      fireAsync(() => {
        if (req.onerror)
          req.onerror({
            target: { error: new Error("Mocked DB open failure") },
          });
      });
    } else {
      fireAsync(() => {
        if (req.onupgradeneeded)
          req.onupgradeneeded({ target: { result: dbResult } });
      });
      fireAsync(() => {
        req.result = dbResult;
        if (req.onsuccess) req.onsuccess({ target: req });
      });
    }
    return req;
  },
  deleteDatabase() {
    return fakeReq(undefined);
  },
};

// Expose internals for tests that need to control IDB behavior
globalThis._idbShouldFail = _idbShouldFail;
Object.defineProperty(globalThis, "_idbShouldFail", {
  get() {
    return _idbShouldFail;
  },
  set(v) {
    _idbShouldFail = v;
  },
});

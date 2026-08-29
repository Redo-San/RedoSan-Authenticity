/* c8 ignore start */
(function () {
  if (
    typeof window !== "undefined" &&
    window.location &&
    window.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      window.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();
/* c8 ignore stop */
// ── Iris Storage: local template storage via IndexedDB ──

var IRIS_DB_NAME = "RedoSanIrisBiometric";
var IRIS_DB_VERSION = 1;
var IRIS_STORE_NAME = "irisTemplates";

/**
 * @class
 * Wraps IndexedDB for iris template storage.
 * All data stays local — never transmitted to any server.
 *
 * Encryption (mirrors Face_Biometric/face_registry lock): when a vault key is
 * set, codes/masks/quality are sealed into an AES-GCM envelope (PBKDF2-derived
 * key via FaceCrypto). Only {id,label,enrolledAt} stay in cleartext so the
 * gallery list still renders while codes stay encrypted at rest.
 */
function IrisStorage() {
  this._db = null;
  this._vaultKey = null;
}

/**
 * Set the session vault key used to seal templates at rest.
 * @param {CryptoKey|null} key
 */
IrisStorage.prototype.setVaultKey = function (key) {
  this._vaultKey = key || null;
};

/**
 * Whether a vault key is set for this session.
 * @returns {boolean}
 */
IrisStorage.prototype.hasVaultKey = function () {
  return !!this._vaultKey;
};

/**
 * Open (or create) the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
IrisStorage.prototype._openDB = function () {
  var self, request;
  if (this._db) return Promise.resolve(this._db);

  // eslint-disable-next-line unicorn/no-this-assignment
  self = this;
  return new Promise(function (resolve, reject) {
    request = indexedDB.open(IRIS_DB_NAME, IRIS_DB_VERSION);

    request.onupgradeneeded = function (event) {
      var db = event.target.result;
      if (!db.objectStoreNames.contains(IRIS_STORE_NAME)) {
        var store = db.createObjectStore(IRIS_STORE_NAME, { keyPath: "id" });
        store.createIndex("enrolledAt", "enrolledAt", { unique: false });
        store.createIndex("label", "label", { unique: false });
      }
    };

    request.onsuccess = function (event) {
      self._db = event.target.result;
      resolve(self._db);
    };

    request.onerror = function (event) {
      reject(new Error("IndexedDB open failed: " + (event.target.error || "Unknown")));
    };
  });
};

/**
 * Store an iris template.
 * @param {object} template
 * @param {string} template.id - unique identifier (e.g., UUID)
 * @param {string} [template.label] - human-readable label
 * @param {Uint8Array} template.leftCode - left eye IrisCode
 * @param {Uint8Array} template.leftMask - left eye mask
 * @param {Uint8Array} template.rightCode - right eye IrisCode (optional)
 * @param {Uint8Array} template.rightMask - right eye mask (optional)
 * @param {object} [template.quality] - quality metrics
 * @param {string} [template.did] - DID identifier (if linked)
 * @returns {Promise<string>} the template id
 */
IrisStorage.prototype.save = async function (template) {
  var db, tx, store, iv, enc, payload, record;

  if (!template || !template.id) {
    throw new Error("Template must have an id");
  }
  if (!template.leftCode) {
    throw new Error("Template must include left eye IrisCode");
  }

  db = await this._openDB();
  tx = db.transaction(IRIS_STORE_NAME, "readwrite");
  store = tx.objectStore(IRIS_STORE_NAME);

  record = {
    id: template.id,
    label: template.label || "",
    enrolledAt: template.enrolledAt || Date.now(),
    updatedAt: Date.now(),
    did: template.did || null,
    eyeSide: template.eyeSide === "left" || template.eyeSide === "right" ? template.eyeSide : "unknown",
  };

  if (this._vaultKey) {
    if (typeof FaceCrypto === "undefined" || !FaceCrypto.encryptWithKey) {
      throw new Error("FaceCrypto must be loaded to encrypt iris templates");
    }
    payload = {
      leftCode: Array.from(template.leftCode),
      leftMask: Array.from(template.leftMask),
      rightCode: template.rightCode ? Array.from(template.rightCode) : null,
      rightMask: template.rightMask ? Array.from(template.rightMask) : null,
      quality: template.quality || null,
      eyeSide: record.eyeSide,
      formatVersion: 1,
    };
    iv = FaceCrypto.generateSalt(12);
    enc = await FaceCrypto.encryptWithKey(this._vaultKey, iv, payload);
    record.enc = { alg: "AES-GCM", v: 1, iv: enc.iv, cipher: enc.cipher };
  } else {
    // Legacy plaintext path (unlocked vault)
    record.leftCode = Array.from(template.leftCode);
    record.leftMask = Array.from(template.leftMask);
    record.rightCode = template.rightCode ? Array.from(template.rightCode) : null;
    record.rightMask = template.rightMask ? Array.from(template.rightMask) : null;
    record.quality = template.quality || null;
  }

  return new Promise(function (resolve, reject) {
    var req = store.put(record);
    req.onsuccess = function () {
      resolve(template.id);
    };
    req.onerror = function (event) {
      reject(new Error("Save failed: " + (event.target.error || "Unknown")));
    };
  });
};

/**
 * Rehydrate codes/masks from either an AES-GCM envelope or legacy arrays.
 * @private
 * @param {object} record
 * @returns {Promise<object|null>}
 */
IrisStorage.prototype._rehydrate = async function (record) {
  var payload;

  if (!record) return null;

  if (record.enc) {
    if (!this._vaultKey) {
      throw new Error("Template is encrypted — unlock the vault first");
    }
    if (typeof FaceCrypto === "undefined" || !FaceCrypto.decryptWithKey) {
      throw new Error("FaceCrypto must be loaded to decrypt iris templates");
    }
    try {
      payload = await FaceCrypto.decryptWithKey(this._vaultKey, record.enc);
    } catch {
      // Wrong/unavailable key for this record — leave codes undecrypted so a
      // single incompatible record never breaks the whole pipeline.
      record.decryptError = true;
      return record;
    }
    record.leftCode = new Uint8Array(payload.leftCode);
    record.leftMask = new Uint8Array(payload.leftMask);
    record.rightCode = payload.rightCode ? new Uint8Array(payload.rightCode) : null;
    record.rightMask = payload.rightMask ? new Uint8Array(payload.rightMask) : null;
    record.quality = payload.quality || null;
    record.eyeSide = payload.eyeSide || record.eyeSide || "unknown";
  } else {
    // Convert arrays back to Uint8Arrays
    record.leftCode = new Uint8Array(record.leftCode);
    record.leftMask = new Uint8Array(record.leftMask);
    if (record.rightCode) record.rightCode = new Uint8Array(record.rightCode);
    if (record.rightMask) record.rightMask = new Uint8Array(record.rightMask);
  }

  if (record.eyeSide !== "left" && record.eyeSide !== "right") {
    record.eyeSide = "unknown";
  }

  return record;
};

/**
 * Load a template by id.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
IrisStorage.prototype.load = async function (id) {
  var db, tx, store, self;

  // eslint-disable-next-line unicorn/no-this-assignment
  self = this;
  db = await this._openDB();
  tx = db.transaction(IRIS_STORE_NAME, "readonly");
  store = tx.objectStore(IRIS_STORE_NAME);

  return new Promise(function (resolve, reject) {
    var req = store.get(id);
    req.onsuccess = function (event) {
      self
        ._rehydrate(event.target.result)
        .then(function (record) {
          resolve(record || null);
        })
        .catch(reject);
    };
    req.onerror = function (event) {
      reject(new Error("Load failed: " + (event.target.error || "Unknown")));
    };
  });
};

/**
 * List all stored templates (id, label, enrolledAt only — no codes).
 * @returns {Promise<Array<{id: string, label: string, enrolledAt: number}>>}
 */
IrisStorage.prototype.list = async function () {
  var db, tx, store;

  db = await this._openDB();
  tx = db.transaction(IRIS_STORE_NAME, "readonly");
  store = tx.objectStore(IRIS_STORE_NAME);

  return new Promise(function (resolve, reject) {
    var req = store.openCursor();
    var results = [];

    req.onsuccess = function (event) {
      var cursor = event.target.result;
      if (cursor) {
        results.push({
          id: cursor.value.id,
          label: cursor.value.label || "",
          enrolledAt: cursor.value.enrolledAt,
          eyeSide: cursor.value.eyeSide || "unknown",
        });
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = function (event) {
      reject(new Error("List failed: " + (event.target.error || "Unknown")));
    };
  });
};

/**
 * Delete a template by id.
 * @param {string} id
 * @returns {Promise<void>}
 */
IrisStorage.prototype.delete = async function (id) {
  var db, tx, store;

  db = await this._openDB();
  tx = db.transaction(IRIS_STORE_NAME, "readwrite");
  store = tx.objectStore(IRIS_STORE_NAME);

  return new Promise(function (resolve, reject) {
    var req = store.delete(id);
    req.onsuccess = function () {
      resolve();
    };
    req.onerror = function (event) {
      reject(new Error("Delete failed: " + (event.target.error || "Unknown")));
    };
  });
};

/**
 * Count stored templates.
 * @returns {Promise<number>}
 */
IrisStorage.prototype.count = async function () {
  var db, tx, store;

  db = await this._openDB();
  tx = db.transaction(IRIS_STORE_NAME, "readonly");
  store = tx.objectStore(IRIS_STORE_NAME);

  return new Promise(function (resolve, reject) {
    var req = store.count();
    req.onsuccess = function (event) {
      resolve(event.target.result);
    };
    req.onerror = function (event) {
      reject(new Error("Count failed: " + (event.target.error || "Unknown")));
    };
  });
};

/**
 * Clear all stored templates.
 * @returns {Promise<void>}
 */
IrisStorage.prototype.clear = async function () {
  var db, tx, store;

  db = await this._openDB();
  tx = db.transaction(IRIS_STORE_NAME, "readwrite");
  store = tx.objectStore(IRIS_STORE_NAME);

  return new Promise(function (resolve, reject) {
    var req = store.clear();
    req.onsuccess = function () {
      resolve();
    };
    req.onerror = function (event) {
      reject(new Error("Clear failed: " + (event.target.error || "Unknown")));
    };
  });
};

/**
 * Import raw records (e.g. from exportAllRecords) preserving AES-GCM
 * envelopes as-is — no re-encryption, no decryption required.
 * @param {Array<object>} records
 * @returns {Promise<number>} imported count
 */
IrisStorage.prototype.importRecords = async function (records) {
  var db, tx, store, i;

  if (!Array.isArray(records)) throw new Error("records must be an array");

  db = await this._openDB();
  tx = db.transaction(IRIS_STORE_NAME, "readwrite");
  store = tx.objectStore(IRIS_STORE_NAME);

  for (i = 0; i < records.length; i++) {
    var rec = records[i];
    if (!rec || !rec.id) continue;
    // Normalize legacy plaintext fields back to arrays
    if (!rec.enc && Array.isArray(rec.leftCode)) {
      rec.leftCode = Array.from(rec.leftCode);
      rec.leftMask = Array.from(rec.leftMask);
    }
    store.put(rec);
  }

  return new Promise(function (resolve, reject) {
    tx.oncomplete = function () {
      resolve(records.length);
    };
    tx.onerror = function (event) {
      reject(new Error("Import failed: " + (event.target.error || "Unknown")));
    };
  });
};

/**
 * Export ALL raw records (including AES-GCM envelopes when the vault is
 * locked) as a portable encrypted backup.
 * @returns {Promise<Array<object>>}
 */
IrisStorage.prototype.exportAllRecords = async function () {
  var db, tx, store;

  db = await this._openDB();
  tx = db.transaction(IRIS_STORE_NAME, "readonly");
  store = tx.objectStore(IRIS_STORE_NAME);

  return new Promise(function (resolve, reject) {
    var req = store.openCursor();
    var results = [];

    req.onsuccess = function (event) {
      var cursor = event.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = function (event) {
      reject(new Error("Export failed: " + (event.target.error || "Unknown")));
    };
  });
};

/**
 * Export a template as a portable JSON string.
 * @param {string} id
 * @returns {Promise<string|null>}
 */
IrisStorage.prototype.exportTemplate = async function (id) {
  var template;
  template = await this.load(id);
  if (!template) return null;
  return JSON.stringify({
    format: "redosan-iris-v1",
    exportedAt: Date.now(),
    template: template,
  });
};

/**
 * Import a template from a JSON string.
 * @param {string} jsonString
 * @returns {Promise<string>} the imported template id
 */
IrisStorage.prototype.importTemplate = async function (jsonString) {
  var data, template;

  data = JSON.parse(jsonString);
  if (!data || data.format !== "redosan-iris-v1" || !data.template) {
    throw new Error("Invalid iris template format");
  }

  template = data.template;
  // Ensure Uint8Arrays
  template.leftCode = new Uint8Array(template.leftCode);
  template.leftMask = new Uint8Array(template.leftMask);
  if (template.rightCode) template.rightCode = new Uint8Array(template.rightCode);
  if (template.rightMask) template.rightMask = new Uint8Array(template.rightMask);

  await this.save(template);
  return template.id;
};

// Expose on window for browser usage
if (typeof window !== "undefined") {
  window.IrisStorage = IrisStorage;
}

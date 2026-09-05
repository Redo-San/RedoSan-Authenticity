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
// ── Face Registry: storage, CRUD, matching ──

/**
 * IndexedDB-backed store (default for browser)
 * @param dbName
 */
function IDBStore(dbName) {
  this._dbName = dbName || "FaceRegistry";
  this._db = null;
}

/**
 * @param {IDBRequest} request
 * @returns {Promise}
 */
function _idb(request) {
  return new Promise(function (resolve, reject) {
    request.onsuccess = function () {
      resolve(request.result);
    };
    request.onerror = function () {
      reject(request.error);
    };
  });
}

/**
 * @returns {Promise<void>}
 */
IDBStore.prototype.open = async function () {
  if (this._db) return;
  var req = indexedDB.open(this._dbName, 2);
  req.onupgradeneeded = function (e) {
    var db, store;
    db = e.target.result;
    if (!db.objectStoreNames.contains("faces")) {
      store = db.createObjectStore("faces", {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("label", "label", { unique: false });
      store.createIndex("created", "created", { unique: false });
    }
    if (!db.objectStoreNames.contains("meta")) {
      db.createObjectStore("meta", { keyPath: "key" });
    }
  };
  this._db = await _idb(req);
};

/**
 * @param {object} entry
 * @returns {Promise<number>}
 */
IDBStore.prototype.add = async function (entry) {
  var db = this._db;
  var tx = db.transaction("faces", "readwrite");
  return _idb(tx.objectStore("faces").add(entry));
};

/**
 * @param {number} id
 * @returns {Promise<object|null>}
 */
IDBStore.prototype.get = async function (id) {
  var tx = this._db.transaction("faces", "readonly");
  var result = await _idb(tx.objectStore("faces").get(id));
  return result || null;
};

/**
 * @returns {Promise<Array>}
 */
IDBStore.prototype.getAll = async function () {
  var tx = this._db.transaction("faces", "readonly");
  return _idb(tx.objectStore("faces").getAll());
};

/**
 * @param {string} indexName
 * @param {string} value
 * @returns {Promise<Array>}
 */
IDBStore.prototype.findByIndex = async function (indexName, value) {
  var tx = this._db.transaction("faces", "readonly");
  var index = tx.objectStore("faces").index(indexName);
  var results = [];
  var request = index.openCursor(IDBKeyRange.only(value));
  var cursor = await _idb(request);
  while (cursor) {
    results.push(cursor.value);
    cursor.continue();
    cursor = await _idb(request);
  }
  return results;
};

/**
 * @param {object} entry
 * @returns {Promise<void>}
 */
IDBStore.prototype.put = async function (entry) {
  var tx = this._db.transaction("faces", "readwrite");
  await _idb(tx.objectStore("faces").put(entry));
};

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
IDBStore.prototype.remove = async function (id) {
  var tx = this._db.transaction("faces", "readwrite");
  await _idb(tx.objectStore("faces").delete(id));
};

/**
 * @returns {Promise<number>}
 */
IDBStore.prototype.count = async function () {
  var tx = this._db.transaction("faces", "readonly");
  return _idb(tx.objectStore("faces").count());
};

/**
 * @returns {Promise<void>}
 */
IDBStore.prototype.clear = async function () {
  var tx = this._db.transaction("faces", "readwrite");
  await _idb(tx.objectStore("faces").clear());
};

/**
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
IDBStore.prototype.putMeta = async function (key, value) {
  var tx = this._db.transaction("meta", "readwrite");
  await _idb(tx.objectStore("meta").put({ key: key, value: value }));
};

/**
 * @param {string} key
 * @returns {Promise<*>}
 */
IDBStore.prototype.getMeta = async function (key) {
  var tx = this._db.transaction("meta", "readonly");
  var row = await _idb(tx.objectStore("meta").get(key));
  return row ? row.value : null;
};

/**
 * @param {string} key
 * @returns {Promise<void>}
 */
IDBStore.prototype.removeMeta = async function (key) {
  var tx = this._db.transaction("meta", "readwrite");
  await _idb(tx.objectStore("meta").delete(key));
};

// ─────────────────────────────────────

/**
 * Face registry with pluggable storage
 * @param {object} [options]
 * @param {object} [options.store] Custom store (defaults to IDBStore)
 * @param {string} [options.dbName] Database name (used with default IDBStore)
 */
function FaceRegistry(options) {
  options = options || {};
  this._store = options.store || new IDBStore(options.dbName);
  this._opened = false;
}

/**
 * Retention window for registry entries (biometric templates). Aligned with
 * the BIPA retention cap (740 ILCS 14/15: destroy within 3 years of the last
 * interaction) and GDPR Art 5(1)(e) storage limitation. Entries are purged
 * automatically when open() runs; the UI discloses this policy and allows
 * deletion at any time.
 */
FaceRegistry.RETENTION_MS = 3 * 365 * 24 * 60 * 60 * 1000;

/**
 * @returns {Promise<void>}
 */
FaceRegistry.prototype.open = async function () {
  if (this._opened) return;
  await this._store.open();
  this._opened = true;
  this._lastPurgedCount = await this._purgeExpired();
};

/**
 * Delete every entry whose last update (fallback: creation) is older than
 * FaceRegistry.RETENTION_MS. Idempotent; never throws.
 * @returns {Promise<number>} number of purged entries
 */
FaceRegistry.prototype._purgeExpired = async function () {
  var all, now, cutoff, i, e, t, removed;
  try {
    all = await this._store.getAll();
  } catch (e) {
    return 0;
  }
  now = Date.now();
  cutoff = now - FaceRegistry.RETENTION_MS;
  removed = 0;
  for (i = 0; i < all.length; i++) {
    e = all[i];
    if (!e || e.id === undefined) continue;
    t =
      e.updated instanceof Date
        ? e.updated.getTime()
        : e.created instanceof Date
          ? e.created.getTime()
          : now;
    /* c8 ignore next 1 -- both fallbacks yield a finite timestamp */
    if (isNaN(t)) t = now;
    if (t < cutoff) {
      try {
        await this._store.remove(e.id);
        removed++;
      } catch (err) {
        // keep going — one failing entry must not block the purge
      }
    }
  }
  return removed;
};

/**
 * Run the retention purge on demand (also runs automatically on open()).
 * @returns {Promise<number>} number of purged entries
 */
FaceRegistry.prototype.purgeExpired = async function () {
  if (!this._opened) {
    await this.open();
    return this._lastPurgedCount || 0;
  }
  return this._purgeExpired();
};

/**
 * @param {string} label
 * @param {Float32Array} descriptor
 * @param {object} [metadata]
 * @returns {Promise<number>}
 */
FaceRegistry.prototype.addFace = async function (label, descriptor, metadata) {
  var meta, sealed;
  await this.open();
  meta = metadata || {};
  sealed = await this._sealFace({
    label: String(label),
    descriptor: descriptor,
    metadata: meta,
    embeddingVersion: meta.embeddingVersion || "human-hse",
    did: "",
    created: new Date(),
    updated: new Date(),
  });
  return this._store.add(sealed);
};

/**
 * @param {number} id
 * @returns {Promise<object|null>}
 */
FaceRegistry.prototype.getFace = async function (id) {
  await this.open();
  return this._unsealEntry(await this._store.get(id));
};

/**
 * @param {string} label
 * @returns {Promise<Array>}
 */
FaceRegistry.prototype.findByLabel = async function (label) {
  await this.open();
  return this._store.findByIndex("label", String(label));
};

/**
 * @returns {Promise<Array>}
 */
FaceRegistry.prototype.getAllFaces = async function () {
  var all, i, out;
  await this.open();
  all = await this._store.getAll();
  out = [];
  for (i = 0; i < all.length; i++) {
    out.push(await this._unsealEntry(all[i]));
  }
  return out;
};

/**
 * @param {number} id
 * @param {object} data
 * @returns {Promise<boolean>}
 */
FaceRegistry.prototype.updateFace = async function (id, data) {
  await this.open();
  var existing = await this._store.get(id);
  if (!existing) return false;
  // Unseal first so descriptor/metadata edits persist through re-encryption.
  var base = await this._unsealEntry(existing);
  for (var key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key) && key !== "id") {
      base[key] = data[key];
    }
  }
  base.updated = new Date();
  await this._store.put(await this._sealFace(base));
  return true;
};

/**
 * @param {number} id
 * @returns {Promise<boolean>}
 */
FaceRegistry.prototype.deleteFace = async function (id) {
  await this.open();
  var existing = await this._store.get(id);
  if (!existing) return false;
  await this._store.remove(id);
  return true;
};

/**
 * @param {Float32Array} descriptor
 * @param {number} [threshold]
 * @param {string} [embeddingVersion] Only compare entries with this embedding version
 * @returns {Promise<{match: object|null, distance: number}>}
 */
FaceRegistry.prototype.findMatch = async function (
  descriptor,
  threshold,
  embeddingVersion,
) {
  if (
    typeof FaceEngine === "undefined" ||
    typeof FaceEngine.compareDescriptors !== "function"
  ) {
    throw new TypeError("FaceEngine must be loaded to use findMatch");
  }
  if (threshold === undefined) threshold = 0.6;
  var all = await this.getAllFaces();
  // getAllFaces() already unseals; locked entries carry no descriptor.
  all = all.filter(function (entry) {
    return entry && entry.descriptor;
  });
  return FaceEngine.matchInRegistry(
    descriptor,
    all,
    threshold,
    embeddingVersion,
  );
};

/**
 * @returns {Promise<number>}
 */
FaceRegistry.prototype.getSize = async function () {
  await this.open();
  return this._store.count();
};

/**
 * @returns {Promise<void>}
 */
FaceRegistry.prototype.clear = async function () {
  await this.open();
  await this._store.clear();
};

// ── Automatic PRF-based encryption (AES-GCM, key derived from WebAuthn PRF) ──
// The vault key is a non-extractable AES-GCM CryptoKey derived from the
// passkey's PRF output (HKDF-SHA256). It is set for the session after the
// passkey step-up and used to transparently seal descriptors at rest — no
// passphrase required (automatic). This replaces the old manual lock/unlock
// flow. Falls back to plaintext storage when no vault key is available
// (documented degradation, e.g. WebAuthn/PRF unavailable). Aligns with
// ISO/IEC 24745:2022 (confidentiality) and NIST SP 800-63B (biometric
// template protection SHALL be implemented).

FaceRegistry.prototype.setVaultKey = function (key) {
  this._vaultKey = key || null;
};

FaceRegistry.prototype.getVaultKey = function () {
  return this._vaultKey || null;
};

FaceRegistry.prototype.hasVaultKey = function () {
  return !!this._vaultKey;
};

/**
 * Seal face fields into a stored entry. With a vault key, the sensitive
 * payload (descriptor + metadata) is AES-GCM encrypted; the label stays
 * plaintext so lists remain browsable. Without a vault key, returns the
 * fields unchanged (plaintext fallback).
 * @param {object} fields
 * @returns {Promise<object>}
 */
FaceRegistry.prototype._sealFace = async function (fields) {
  var payload, env;
  if (
    !this._vaultKey ||
    typeof FaceWebauthn === "undefined" ||
    typeof FaceWebauthn.encryptJSON !== "function"
  ) {
    return fields;
  }
  payload = {
    label: fields.label,
    descriptor: _descriptorToArray(fields.descriptor),
    metadata: fields.metadata || null,
    embeddingVersion: fields.embeddingVersion || null,
    did: fields.did || "",
  };
  env = await FaceWebauthn.encryptJSON(this._vaultKey, payload);
  var out = {
    label: fields.label,
    created: fields.created,
    updated: fields.updated,
    encrypted: {
      alg: "AES-GCM",
      version: 1,
      kdf: { name: "PRF" },
      iv: env.iv,
      cipher: env.ct,
    },
  };
  if (fields.id !== undefined) out.id = fields.id;
  return out;
};

/**
 * Unseal a stored entry for use. PRF-encrypted entries are decrypted when the
 * session vault key is present; otherwise the entry is returned locked
 * (label only, no descriptor). PBKDF2-locked entries (manual) are always
 * returned locked here (decryption requires the passphrase).
 * @param {object} entry
 * @returns {Promise<object>}
 */
FaceRegistry.prototype._unsealEntry = async function (entry) {
  var payload;
  if (!entry || !entry.encrypted) return entry;
  if (entry.encrypted.kdf && entry.encrypted.kdf.name === "PRF") {
    if (!this._vaultKey) {
      return {
        id: entry.id,
        label: entry.label,
        created: entry.created,
        updated: entry.updated,
        encrypted: entry.encrypted,
        locked: true,
      };
    }
    try {
      payload = await FaceWebauthn.decryptJSON(this._vaultKey, {
        iv: entry.encrypted.iv,
        ct: entry.encrypted.cipher,
      });
    } catch (e) {
      return {
        id: entry.id,
        label: entry.label,
        created: entry.created,
        updated: entry.updated,
        encrypted: entry.encrypted,
        locked: true,
      };
    }
    return {
      id: entry.id,
      label: payload.label !== undefined ? payload.label : entry.label,
      descriptor: new Float32Array(payload.descriptor || []),
      metadata: payload.metadata || null,
      embeddingVersion: payload.embeddingVersion || null,
      did: payload.did || "",
      created: entry.created,
      updated: entry.updated,
    };
  }
  // PBKDF2 (manual lock) — locked without the passphrase.
  return {
    id: entry.id,
    label: entry.label,
    created: entry.created,
    updated: entry.updated,
    encrypted: entry.encrypted,
    locked: true,
  };
};

/**
 * Encrypt every plaintext entry in place with the current vault key. Returns
 * the number of entries sealed. No-op (0) when no vault key is set.
 * @returns {Promise<number>}
 */
FaceRegistry.prototype.sealAllPlaintext = async function () {
  var all, i, e, sealed, n;
  if (!this._vaultKey) return 0;
  await this.open();
  all = await this._store.getAll();
  n = 0;
  for (i = 0; i < all.length; i++) {
    e = all[i];
    if (e.encrypted) continue;
    if (e.descriptor === undefined && e.label === undefined) continue;
    sealed = await this._sealFace({
      id: e.id,
      label: e.label,
      descriptor: e.descriptor,
      metadata: e.metadata,
      embeddingVersion: e.embeddingVersion,
      did: e.did,
      created: e.created,
      updated: e.updated,
    });
    await this._store.put(sealed);
    n++;
  }
  return n;
};

/**
 * Store a registry-level metadata value (e.g. the WebAuthn passkey reference).
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
FaceRegistry.prototype.setMeta = async function (key, value) {
  await this.open();
  await this._store.putMeta(key, value);
};

/**
 * @param {string} key
 * @returns {Promise<*>}
 */
FaceRegistry.prototype.getMeta = async function (key) {
  await this.open();
  return this._store.getMeta(key);
};

/**
 * @param {string} key
 * @returns {Promise<void>}
 */
FaceRegistry.prototype.removeMeta = async function (key) {
  await this.open();
  await this._store.removeMeta(key);
};

// ── Privacy: encryption (AES-GCM + PBKDF2 via FaceCrypto) ──

/**
 * @param {object|Float32Array} d
 * @returns {Array}
 */
function _descriptorToArray(d) {
  if (!d) return [];
  if (d.__f32 && Array.isArray(d.data)) return d.data;
  if (Array.isArray(d)) return d;
  if (typeof d.length === "number") return Array.from(d);
  return [];
}

/**
 * Encrypt all plaintext entries in place (migration path: plaintext → cipher).
 * One session key is derived for the whole lock operation; every entry gets a
 * fresh IV. The label stays plaintext so the list stays browsable.
 * @param {string} passphrase
 * @returns {Promise<number>} number of entries encrypted
 */
FaceRegistry.prototype.lock = async function (passphrase) {
  var all, i, e, envelope, locked, salt, key, iv;
  await this.open();
  if (
    typeof FaceCrypto === "undefined" ||
    typeof FaceCrypto.deriveKey !== "function"
  ) {
    throw new TypeError("FaceCrypto must be loaded to lock the registry");
  }
  all = await this._store.getAll();
  salt = FaceCrypto.generateSalt(16);
  key = await FaceCrypto.deriveKey(passphrase, salt);
  for (i = 0; i < all.length; i++) {
    e = all[i];
    if (e.encrypted) continue;
    iv = FaceCrypto.generateSalt(12);
    envelope = await FaceCrypto.encryptWithKey(key, iv, {
      label: e.label,
      descriptor: _descriptorToArray(e.descriptor),
      metadata: e.metadata || null,
      embeddingVersion: e.embeddingVersion || null,
      did: e.did || "",
    });
    locked = {
      id: e.id,
      label: e.label,
      created: e.created,
      updated: new Date(),
      encrypted: {
        alg: "AES-GCM",
        version: 1,
        kdf: {
          name: "PBKDF2",
          hash: "SHA-256",
          iterations: FaceCrypto.KDF_ITERATIONS,
        },
        salt: FaceCrypto.bytesToBase64(salt),
        iv: envelope.iv,
        cipher: envelope.cipher,
      },
    };
    await this._store.put(locked);
  }
  return all.filter(function (e) {
    return !e.encrypted;
  }).length;
};

/**
 * Decrypt all encrypted entries in place. Wrong passphrase or tampered data
 * throws (AES-GCM authentication failure) — nothing is modified then.
 * @param {string} passphrase
 * @returns {Promise<number>} number of entries decrypted
 */
FaceRegistry.prototype.unlock = async function (passphrase) {
  var all, i, e, plain;
  await this.open();
  if (
    typeof FaceCrypto === "undefined" ||
    typeof FaceCrypto.decryptJSON !== "function"
  ) {
    throw new TypeError("FaceCrypto must be loaded to unlock the registry");
  }
  all = await this._store.getAll();
  for (i = 0; i < all.length; i++) {
    e = all[i];
    if (!e.encrypted) continue;
    plain = await FaceCrypto.decryptJSON(passphrase, e.encrypted);
    await this._store.put({
      id: e.id,
      label: plain.label !== undefined ? plain.label : e.label,
      descriptor: new Float32Array(plain.descriptor || []),
      metadata: plain.metadata || null,
      embeddingVersion: plain.embeddingVersion || null,
      did: plain.did || "",
      created: e.created,
      updated: new Date(),
    });
  }
  return all.filter(function (e) {
    return !!e.encrypted;
  }).length;
};

/**
 * @returns {Promise<boolean>} true when any entry is encrypted
 */
FaceRegistry.prototype.isLocked = async function () {
  var all, self;
  await this.open();
  all = await this._store.getAll();
  self = this;
  return all.some(function (e) {
    // PRF-encrypted entries are considered unlocked when the session vault
    // key is available; only un-decryptable entries count as locked.
    return (
      !!e.encrypted &&
      !(e.encrypted.kdf && e.encrypted.kdf.name === "PRF" && self._vaultKey)
    );
  });
};

// ── Backup / restore ──

/**
 * Export the registry as a portable JSON object. With a passphrase every
 * entry is encrypted individually; without one, entries are exported as-is
 * (only allowed when nothing is locked).
 * @param {string|null} [passphrase]
 * @returns {Promise<object>}
 */
FaceRegistry.prototype.exportBackup = async function (passphrase) {
  var all, i, e, out, salt, key, iv, envelope, payload;
  await this.open();
  all = await this._store.getAll();
  out = {
    type: "redoSan.faceRegistryBackup",
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: [],
  };
  salt = passphrase ? FaceCrypto.generateSalt(16) : null;
  key = passphrase ? await FaceCrypto.deriveKey(passphrase, salt) : null;
  for (i = 0; i < all.length; i++) {
    e = all[i];
    if (key) {
      // Need the plaintext payload; decrypt if currently encrypted.
      if (e.encrypted) {
        if (e.encrypted.kdf && e.encrypted.kdf.name === "PRF") {
          if (!this._vaultKey)
            throw new Error(
              "Registry is locked — export requires the passkey session",
            );
          payload = await FaceWebauthn.decryptJSON(this._vaultKey, {
            iv: e.encrypted.iv,
            ct: e.encrypted.cipher,
          });
        } else if (e.encrypted.kdf && e.encrypted.kdf.name === "PBKDF2") {
          /* c8 ignore next 2 -- this branch only runs when a passphrase exists */
          if (!passphrase)
            throw new Error("Backup is encrypted — requires a passphrase");
          payload = await FaceCrypto.decryptJSON(passphrase, e.encrypted);
        } else {
          throw new Error("Unsupported encryption on entry");
        }
      } else {
        payload = {
          label: e.label,
          descriptor: _descriptorToArray(e.descriptor),
          metadata: e.metadata || null,
          embeddingVersion: e.embeddingVersion || null,
          did: e.did || "",
        };
      }
      iv = FaceCrypto.generateSalt(12);
      envelope = await FaceCrypto.encryptWithKey(key, iv, {
        label: payload.label,
        descriptor: payload.descriptor || [],
        metadata: payload.metadata || null,
        embeddingVersion: payload.embeddingVersion || null,
        did: payload.did || "",
      });
      out.entries.push({
        id: e.id,
        created: e.created,
        updated: e.updated,
        encrypted: {
          alg: "AES-GCM",
          version: 1,
          kdf: {
            name: "PBKDF2",
            hash: "SHA-256",
            iterations: FaceCrypto.KDF_ITERATIONS,
          },
          salt: FaceCrypto.bytesToBase64(salt),
          iv: envelope.iv,
          cipher: envelope.cipher,
        },
      });
    } else if (e.encrypted) {
      // No passphrase: PRF ciphertext can stay encrypted, but a PBKDF2 entry
      // cannot be exported without its passphrase.
      if (e.encrypted.kdf && e.encrypted.kdf.name === "PRF") {
        if (this._vaultKey) {
          payload = await FaceWebauthn.decryptJSON(this._vaultKey, {
            iv: e.encrypted.iv,
            ct: e.encrypted.cipher,
          });
          out.entries.push({
            id: e.id,
            label: payload.label,
            descriptor: payload.descriptor || [],
            metadata: payload.metadata || null,
            embeddingVersion: payload.embeddingVersion || null,
            did: payload.did || "",
            created: e.created,
            updated: e.updated,
          });
        } else {
          out.entries.push({
            id: e.id,
            label: e.label,
            created: e.created,
            updated: e.updated,
            encrypted: e.encrypted,
          });
        }
      } else {
        throw new Error("Registry is locked — export requires a passphrase");
      }
    } else {
      out.entries.push({
        id: e.id,
        label: e.label,
        descriptor: _descriptorToArray(e.descriptor),
        metadata: e.metadata || null,
        embeddingVersion: e.embeddingVersion || null,
        did: e.did || "",
        created: e.created,
        updated: e.updated,
      });
    }
  }
  return out;
};

/**
 * Import a backup. `mode` "replace" clears the registry first; "merge" keeps
 * existing entries. Encrypted backups need the passphrase used on export.
 * @param {object} backup
 * @param {string|null} [passphrase]
 * @param {string} [mode]
 * @returns {Promise<number>} number of entries imported
 */
FaceRegistry.prototype.importBackup = async function (
  backup,
  passphrase,
  mode,
) {
  var i, e, entries, plain, count, salt, key, iv;
  await this.open();
  if (
    !backup ||
    backup.type !== "redoSan.faceRegistryBackup" ||
    !Array.isArray(backup.entries)
  ) {
    throw new TypeError("Invalid backup file");
  }
  if (mode !== "replace") mode = "merge";
  if (mode === "replace") await this._store.clear();
  entries = backup.entries;
  count = 0;
  for (i = 0; i < entries.length; i++) {
    e = entries[i];
    if (e.encrypted) {
      if (e.encrypted.kdf && e.encrypted.kdf.name === "PRF") {
        if (this._vaultKey) {
          plain = await FaceWebauthn.decryptJSON(this._vaultKey, {
            iv: e.encrypted.iv,
            ct: e.encrypted.cipher,
          });
          await this._store.add(
            await this._sealFace({
              label: plain.label !== undefined ? plain.label : "Imported",
              descriptor: new Float32Array(plain.descriptor || []),
              metadata: plain.metadata || null,
              embeddingVersion: plain.embeddingVersion || null,
              did: plain.did || "",
              created: new Date(e.created || Date.now()),
              updated: new Date(),
            }),
          );
        } else {
          // No session vault key yet — keep the PRF ciphertext locked.
          await this._store.add({
            label: e.label !== undefined ? e.label : "Imported",
            created: new Date(e.created || Date.now()),
            updated: new Date(),
            encrypted: e.encrypted,
          });
        }
        count++;
      } else {
        if (!passphrase)
          throw new Error("Backup is encrypted — import requires a passphrase");
        plain = await FaceCrypto.decryptJSON(passphrase, e.encrypted);
        await this._store.add({
          label: plain.label !== undefined ? plain.label : "Imported",
          descriptor: new Float32Array(plain.descriptor || []),
          metadata: plain.metadata || null,
          embeddingVersion: plain.embeddingVersion || null,
          did: plain.did || "",
          created: new Date(e.created || Date.now()),
          updated: new Date(),
        });
        count++;
      }
    } else {
      await this._store.add({
        label: e.label !== undefined ? e.label : "Imported",
        descriptor: new Float32Array(e.descriptor || []),
        metadata: e.metadata || null,
        embeddingVersion: e.embeddingVersion || null,
        did: e.did || "",
        created: new Date(e.created || Date.now()),
        updated: new Date(),
      });
      count++;
    }
  }
  return count;
};

/* c8 ignore start */
if (typeof window !== "undefined") {
  window.FaceRegistry = FaceRegistry;
  window.IDBStore = IDBStore;
}
/* c8 ignore stop */

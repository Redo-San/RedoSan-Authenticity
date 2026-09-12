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
// ── Voice Registry: consent-ledgered storage of PROTECTED voice templates ──
// Only protected templates (VoiceTemplateProtection codes) are stored — raw
// voice descriptors never leave the matcher. GDPR-first enrolment gate
// (Art 9(2)(a) explicit consent) plus a retention purge aligned with the BIPA
// 3-year cap (740 ILCS 14/15: destroy within 3 years of the last interaction)
// and GDPR Art 5(1)(e) storage limitation. Authentication claims are throttled
// per NIST SP 800-63B-3 §5.2.3 (max 5 consecutive failures, ≥30 s exponential
// cooldown). See notes/B6-*.md decision points D6-D, D6-E, D6-F.

/**
 * IndexedDB-backed store (default for browser).
 * Object stores: templates (keyPath id, autoIncrement; indexes label,
 * keyFingerprint, lastInteraction), consent (keyPath label), auth (keyPath
 * label), meta (keyPath key).
 * @param {string} [dbName]
 */
function VoiceIDBStore(dbName) {
  this._dbName = dbName || "VoiceRegistryDB";
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

/** @returns {Promise<void>} */
VoiceIDBStore.prototype.open = async function () {
  if (this._db) return;
  var req = indexedDB.open(this._dbName, 2);
  req.onupgradeneeded = function (e) {
    var db, store;
    db = e.target.result;
    if (!db.objectStoreNames.contains("templates")) {
      store = db.createObjectStore("templates", {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("label", "label", { unique: false });
      store.createIndex("keyFingerprint", "keyFingerprint", { unique: false });
      store.createIndex("lastInteraction", "lastInteraction", {
        unique: false,
      });
    }
    if (!db.objectStoreNames.contains("consent")) {
      db.createObjectStore("consent", { keyPath: "label" });
    }
    if (!db.objectStoreNames.contains("auth")) {
      db.createObjectStore("auth", { keyPath: "label" });
    }
    if (!db.objectStoreNames.contains("meta")) {
      db.createObjectStore("meta", { keyPath: "key" });
    }
  };
  this._db = await _idb(req);
};

/** @returns {IDBObjectStore} */
VoiceIDBStore.prototype._rw = function (name) {
  return this._db.transaction(name, "readwrite").objectStore(name);
};

/** @returns {IDBObjectStore} */
VoiceIDBStore.prototype._ro = function (name) {
  return this._db.transaction(name, "readonly").objectStore(name);
};

/** @param {object} entry @returns {Promise<number>} */
VoiceIDBStore.prototype.addTemplate = async function (entry) {
  return _idb(this._rw("templates").add(entry));
};

/** @param {number} id @returns {Promise<object|null>} */
VoiceIDBStore.prototype.getTemplate = async function (id) {
  var r = await _idb(this._ro("templates").get(id));
  return r || null;
};

/** @returns {Promise<Array>} */
VoiceIDBStore.prototype.getAllTemplates = async function () {
  return _idb(this._ro("templates").getAll());
};

/** @param {object} entry @returns {Promise<void>} */
VoiceIDBStore.prototype.putTemplate = async function (entry) {
  await _idb(this._rw("templates").put(entry));
};

/**
 * @param {string} label
 * @returns {Promise<Array>}
 */
VoiceIDBStore.prototype.findByLabel = async function (label) {
  var store = this._ro("templates");
  var index = store.index("label");
  var results = [];
  var request = index.openCursor(IDBKeyRange.only(label));
  var cursor = await _idb(request);
  while (cursor) {
    results.push(cursor.value);
    cursor.continue();
    cursor = await _idb(request);
  }
  return results;
};

/** @param {number} id @returns {Promise<void>} */
VoiceIDBStore.prototype.removeTemplate = async function (id) {
  await _idb(this._rw("templates").delete(id));
};

/** @returns {Promise<void>} */
VoiceIDBStore.prototype.clearTemplates = async function () {
  await _idb(this._rw("templates").clear());
};

/** @returns {Promise<number>} */
VoiceIDBStore.prototype.countTemplates = async function () {
  return _idb(this._ro("templates").count());
};

/** @param {object} row @returns {Promise<void>} */
VoiceIDBStore.prototype.putConsent = async function (row) {
  await _idb(this._rw("consent").put(row));
};

/** @param {string} label @returns {Promise<object|null>} */
VoiceIDBStore.prototype.getConsent = async function (label) {
  var r = await _idb(this._ro("consent").get(label));
  return r || null;
};

/** @returns {Promise<void>} */
VoiceIDBStore.prototype.clearConsent = async function () {
  await _idb(this._rw("consent").clear());
};

/** @param {object} row @returns {Promise<void>} */
VoiceIDBStore.prototype.putAuth = async function (row) {
  await _idb(this._rw("auth").put(row));
};

/** @param {string} label @returns {Promise<object|null>} */
VoiceIDBStore.prototype.getAuth = async function (label) {
  var r = await _idb(this._ro("auth").get(label));
  return r || null;
};

/** @returns {Promise<void>} */
VoiceIDBStore.prototype.clearAuth = async function () {
  await _idb(this._rw("auth").clear());
};

/**
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
VoiceIDBStore.prototype.putMeta = async function (key, value) {
  await _idb(this._rw("meta").put({ key: key, value: value }));
};

/** @param {string} key @returns {Promise<*>} */
VoiceIDBStore.prototype.getMeta = async function (key) {
  var row = await _idb(this._ro("meta").get(key));
  return row ? row.value : null;
};

/** @param {string} key @returns {Promise<void>} */
VoiceIDBStore.prototype.removeMeta = async function (key) {
  await _idb(this._rw("meta").delete(key));
};

// ─────────────────────────────────────

/**
 * Voice registry with pluggable storage.
 * @param {object} [options]
 * @param {object} [options.store] Custom store (defaults to VoiceIDBStore)
 * @param {string} [options.dbName] Database name (default VoiceRegistryDB)
 */
function VoiceRegistry(options) {
  options = options || {};
  this._store = options.store || new VoiceIDBStore(options.dbName);
  this._opened = false;
}

/** Schema tag recorded on every stored template row. */
VoiceRegistry.SCHEMA = "voice-registry-v1";

/**
 * Retention window for stored protected templates. Aligned with the BIPA cap
 * (740 ILCS 14/15: destroy within 3 years of the individual's last interaction,
 * whichever occurs first) and GDPR Art 5(1)(e) storage limitation.
 */
VoiceRegistry.RETENTION_MS = 3 * 365 * 24 * 60 * 60 * 1000;

/**
 * Notice version of the consent panel text shown at the last grant
 * (GDPR Art 30(1)(c) record frame; ISO/IEC 29184:2020 notice identity).
 * Bump when the notice text/purposes change — archived consent rows keep
 * the version they were granted under.
 */
VoiceRegistry.CONSENT_POLICY_VERSION = 1;

/**
 * Data categories recorded on each consent row (GDPR Art 30(1)(c): "the
 * categories of personal data"; BIPA §15(b) written release scope). Only
 * protected (cancellable) templates are ever stored — the raw voiceprint
 * descriptor never leaves the matcher.
 */
VoiceRegistry.CONSENT_DATA_CATEGORIES = [
  "voiceprint-protected-template",
  "enrollment-purpose-label",
  "authentication-activity-timestamps",
];

/**
 * Biometric attempt policy (NIST SP 800-63B-3 §5.2.3): no more than 5
 * consecutive failed attempts (10 with PAD — this module targets 5, no PAD).
 */
VoiceRegistry.MAX_FAILED = 5;

/**
 * Lockout delay for the MAX_FAILED-th failure; doubles exponentially for each
 * further failure (SP 800-63B-3 §5.2.3 requires a delay of at least 30 s that
 * increases exponentially, or disabling the mechanism).
 */
VoiceRegistry.BASE_LOCK_MS = 30000;

/** @returns {Promise<void>} */
VoiceRegistry.prototype.open = async function () {
  if (this._opened) return;
  await this._store.open();
  this._opened = true;
  this._lastPurgedCount = await this._purgeExpired();
};

/**
 * @param {string} label
 * @param {string} purpose
 * @param {object} [opts]
 * @param {number} [opts.retentionMs]
 * @returns {Promise<object>} consent row
 */
VoiceRegistry.prototype.grantConsent = async function (label, purpose, opts) {
  var row;
  opts = opts || {};
  if (typeof label !== "string" || label.length === 0)
    throw new TypeError("A consent label is required.");
  row = {
    label: label,
    purpose: purpose || "voice-biometric-authentication",
    noticeVersion: opts.noticeVersion || VoiceRegistry.CONSENT_POLICY_VERSION,
    dataCategories: VoiceRegistry.CONSENT_DATA_CATEGORIES,
    grantedAt: new Date(),
    retention: opts.retentionMs || VoiceRegistry.RETENTION_MS,
    status: "active",
  };
  await this._store.putConsent(row);
  return row;
};

/**
 * @param {string} label
 * @returns {Promise<object|null>}
 */
VoiceRegistry.prototype.getConsent = async function (label) {
  return this._store.getConsent(label);
};

/**
 * Withdraw consent: mark the ledger row withdrawn and erase every template of
 * the label (GDPR Art 17 right to erasure — processing must stop).
 * @param {string} label
 * @returns {Promise<object|null>} the revoked consent row
 */
VoiceRegistry.prototype.withdrawConsent = async function (label) {
  var row, records, i;
  row = await this._store.getConsent(label);
  if (!row) return null;
  row.status = "withdrawn";
  row.withdrawnAt = new Date();
  await this._store.putConsent(row);
  records = await this.getByLabel(label);
  for (i = 0; i < records.length; i++) {
    await this._store.removeTemplate(records[i].id);
  }
  return row;
};

/**
 * @param {string} label
 * @returns {Promise<void>} throws TypeError unless consent is active
 */
VoiceRegistry.prototype._requireConsent = async function (label) {
  var row = await this._store.getConsent(label);
  if (!row || row.status !== "active")
    throw new TypeError(
      "Explicit consent (GDPR Art 9(2)(a)) is required before enrolling a voice template.",
    );
};

/**
 * Store a protected (cancellable) template for a labelled speaker.
 * @param {string} label
 * @param {{code: Uint8Array, bits: number, params: object, keyFingerprint: string}} template
 *   Result of VoiceTemplateProtection.generate — the raw descriptor must never
 *   be passed here.
 * @param {object} [metadata]
 * @returns {Promise<number>} record id
 */
VoiceRegistry.prototype.add = async function (label, template, metadata) {
  if (!template || !template.code)
    throw new TypeError("A protected template (code) is required.");
  await this._requireConsent(label);
  var record = {
    label: label,
    schema: VoiceRegistry.SCHEMA,
    code: template.code,
    bits: template.bits,
    params: template.params || undefined,
    keyFingerprint: template.keyFingerprint,
    metadata: metadata || {},
    created: new Date(),
    updated: new Date(),
    lastInteraction: new Date(),
  };
  return this._store.addTemplate(record);
};

/**
 * @param {number} id
 * @returns {Promise<object|null>}
 */
VoiceRegistry.prototype.get = async function (id) {
  return this._store.getTemplate(id);
};

/**
 * @param {string} label
 * @returns {Promise<Array>}
 */
VoiceRegistry.prototype.getByLabel = async function (label) {
  return this._store.findByLabel(label);
};

/**
 * @returns {Promise<Array>}
 */
VoiceRegistry.prototype.getAll = async function () {
  return this._store.getAllTemplates();
};

/**
 * Update operational fields (metadata, lastInteraction) of a record. Identity
 * fields (id, label, code, params, keyFingerprint) can never be changed.
 * @param {number} id
 * @param {{metadata?: object, lastInteraction?: Date}} data
 * @returns {Promise<object>}
 */
VoiceRegistry.prototype.update = async function (id, data) {
  var record = await this._store.getTemplate(id);
  if (!record) throw new Error("Template record not found: " + id);
  if (data && Object.prototype.hasOwnProperty.call(data, "metadata"))
    record.metadata = data.metadata || {};
  if (
    data &&
    Object.prototype.hasOwnProperty.call(data, "lastInteraction") &&
    data.lastInteraction instanceof Date
  )
    record.lastInteraction = data.lastInteraction;
  record.updated = new Date();
  await this._store.putTemplate(record);
  return record;
};

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
VoiceRegistry.prototype.remove = async function (id) {
  return this._store.removeTemplate(id);
};

/**
 * Full device wipe: templates + consent ledger + attempt counters + meta.
 * @returns {Promise<void>}
 */
VoiceRegistry.prototype.clear = async function () {
  await this._store.clearTemplates();
  await this._store.clearConsent();
  await this._store.clearAuth();
  await this._store.removeMeta("__voice_registry_meta");
};

/**
 * Match a protected code against every stored template (pure scan; attempt
 * accounting lives in authenticate()).
 * @param {Uint8Array} query PACKED PROTECTED CODE — never a raw descriptor
 * @param {number} [threshold=0.7]
 * @returns {Promise<{match: object|null, similarity: number, distance: number}>}
 */
VoiceRegistry.prototype.findMatch = async function (query, threshold) {
  var all = await this._store.getAllTemplates();
  var registry = all.map(function (r) {
    return { code: r.code, label: r.label, record: r };
  });
  var res;
  if (typeof VoiceTemplateProtection === "undefined")
    throw new Error("VoiceTemplateProtection is required for matching.");
  res = VoiceTemplateProtection.match(query, registry, threshold);
  return {
    match: res.match && res.match.record ? res.match.record : null,
    similarity: res.similarity,
    distance: res.distance,
  };
};

/**
 * Throttled claim authentication: enforce the NIST biometric lockout policy
 * for the claimed label, then match only against that speaker's templates.
 * Success resets the attempt counter and records a new last interaction
 * (BIPA three-year clock restarts). Failure records the attempt.
 * @param {Uint8Array} query Protected code query
 * @param {string} label Claimed speaker label
 * @param {number} [threshold=0.7]
 * @param {number} [now] time for deterministic lockout tests
 * @returns {Promise<{ok: boolean, reason?: string, match?: object,
 *   similarity?: number, remainingMs?: number}>}
 */
VoiceRegistry.prototype.authenticate = async function (
  query,
  label,
  threshold,
  now,
) {
  var lock, records, res, i, best, bestSim;
  if (typeof threshold === "undefined" || threshold === null) threshold = 0.7;
  if (typeof now === "undefined") now = Date.now();
  lock = await this.checkLockout(label, now);
  if (lock.locked)
    return { ok: false, reason: "locked", remainingMs: lock.remainingMs };
  records = await this.getByLabel(label);
  if (!records || records.length === 0) return { ok: false, reason: "unknown" };
  if (typeof VoiceTemplateProtection === "undefined")
    throw new Error("VoiceTemplateProtection is required for matching.");
  best = null;
  bestSim = -1;
  for (i = 0; i < records.length; i++) {
    res = VoiceTemplateProtection.match(
      query,
      [{ code: records[i].code, label: label, record: records[i] }],
      threshold,
    );
    if (res.match && res.similarity > bestSim) {
      bestSim = res.similarity;
      best = records[i];
    }
  }
  if (!best) {
    await this.recordFailure(label, now);
    return { ok: false, reason: "no-match", similarity: bestSim };
  }
  await this.resetAttempts(label);
  await this.update(best.id, { lastInteraction: new Date(now) });
  return { ok: true, match: best, similarity: bestSim };
};

/**
 * @param {string} label
 * @returns {Promise<object>} auth row (defaults to a fresh empty counter)
 */
VoiceRegistry.prototype.getAuth = async function (label) {
  var row = await this._store.getAuth(label);
  return row || { label: label, failed: 0, lockUntil: null };
};

/**
 * Record a failed attempt for a claimed label. After MAX_FAILED consecutive
 * failures the label is locked for BASE_LOCK_MS * 2^(failures - MAX_FAILED)
 * (30 s, then 60 s, 120 s, ...). @param {string} label
 * @param {number} [now]
 * @returns {Promise<object>} updated auth row
 */
VoiceRegistry.prototype.recordFailure = async function (label, now) {
  var auth, cooldown;
  if (typeof now === "undefined") now = Date.now();
  auth = await this.getAuth(label);
  auth.failed = (auth.failed || 0) + 1;
  if (auth.failed >= VoiceRegistry.MAX_FAILED) {
    cooldown =
      VoiceRegistry.BASE_LOCK_MS *
      Math.pow(2, auth.failed - VoiceRegistry.MAX_FAILED);
    auth.lockUntil = new Date(now + cooldown);
  } else {
    auth.lockUntil = null;
  }
  await this._store.putAuth(auth);
  return auth;
};

/**
 * @param {string} label
 * @param {number} [now]
 * @returns {Promise<void>}
 */
VoiceRegistry.prototype.resetAttempts = async function (label) {
  await this._store.putAuth({
    label: label,
    failed: 0,
    lockUntil: null,
  });
};

/**
 * NIST-style lockout check. An expired lock expires and self-resets.
 * @param {string} label
 * @param {number} [now]
 * @returns {Promise<{locked: boolean, failed: number, remainingMs: number}>}
 */
VoiceRegistry.prototype.checkLockout = async function (label, now) {
  var auth;
  if (typeof now === "undefined") now = Date.now();
  auth = await this._store.getAuth(label);
  if (!auth) return { locked: false, failed: 0, remainingMs: 0 };
  if (auth.lockUntil instanceof Date && now < auth.lockUntil.getTime()) {
    return {
      locked: true,
      failed: auth.failed,
      remainingMs: auth.lockUntil.getTime() - now,
    };
  }
  if (auth.lockUntil instanceof Date) {
    await this.resetAttempts(label);
    return { locked: false, failed: 0, remainingMs: 0 };
  }
  return { locked: false, failed: auth.failed || 0, remainingMs: 0 };
};

/**
 * Retain templates only within the BIPA three-year window measured from each
 * record's last interaction. Runs automatically on open().
 * @param {number} [now]
 * @returns {Promise<number>} number of purged entries
 */
VoiceRegistry.prototype.purgeExpired = async function (now) {
  if (!this._opened) {
    await this.open();
    return this._lastPurgedCount || 0;
  }
  return this._purgeExpired(now);
};

/** @param {number} [now] @returns {Promise<number>} */
VoiceRegistry.prototype._purgeExpired = async function (now) {
  var all, cutoff, i, e, t, removed;
  if (typeof now === "undefined") now = Date.now();
  try {
    all = await this._store.getAllTemplates();
  } catch (_e) {
    return 0;
  }
  cutoff = now - VoiceRegistry.RETENTION_MS;
  removed = 0;
  for (i = 0; i < all.length; i++) {
    e = all[i];
    if (!e || e.id === undefined) continue;
    t =
      e.lastInteraction instanceof Date
        ? e.lastInteraction.getTime()
        : e.updated instanceof Date
          ? e.updated.getTime()
          : e.created instanceof Date
            ? e.created.getTime()
            : now;
    /* c8 ignore next 1 -- fallback yields a finite timestamp */
    if (isNaN(t)) t = now;
    if (t < cutoff) {
      try {
        await this._store.removeTemplate(e.id);
        removed++;
      } catch (_err) {
        // keep going — one failing entry must not block the purge
      }
    }
  }
  return removed;
};

/**
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
VoiceRegistry.prototype.putMeta = async function (key, value) {
  return this._store.putMeta(key, value);
};

/** @param {string} key @returns {Promise<*>} */
VoiceRegistry.prototype.getMeta = async function (key) {
  return this._store.getMeta(key);
};

/** @param {string} key @returns {Promise<void>} */
VoiceRegistry.prototype.removeMeta = async function (key) {
  return this._store.removeMeta(key);
};

/* c8 ignore start */
if (typeof window !== "undefined") window.VoiceRegistry = VoiceRegistry;
if (typeof module !== "undefined" && module.exports)
  module.exports = VoiceRegistry;
/* c8 ignore stop */

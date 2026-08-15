/* c8 ignore start */
(function(){if(typeof window!=='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
/* c8 ignore stop */
// ── Face Registry: storage, CRUD, matching ──

/**
 * IndexedDB-backed store (default for browser)
 * @param dbName
 */
function IDBStore(dbName) {
    this._dbName = dbName || 'FaceRegistry';
    this._db = null;
}

/**
 * @param {IDBRequest} request
 * @returns {Promise}
 */
function _idb(request) {
    return new Promise(function (resolve, reject) {
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error); };
    });
}

/**
 * @returns {Promise<void>}
 */
IDBStore.prototype.open = async function () {
    if (this._db) return;
    var req = indexedDB.open(this._dbName, 1);
    req.onupgradeneeded = function (e) {
        var db, store;
        db = e.target.result;
        if (!db.objectStoreNames.contains('faces')) {
            store = db.createObjectStore('faces', { keyPath: 'id', autoIncrement: true });
            store.createIndex('label', 'label', { unique: false });
            store.createIndex('created', 'created', { unique: false });
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
    var tx = db.transaction('faces', 'readwrite');
    return _idb(tx.objectStore('faces').add(entry));
};

/**
 * @param {number} id
 * @returns {Promise<object|null>}
 */
IDBStore.prototype.get = async function (id) {
    var tx = this._db.transaction('faces', 'readonly');
    var result = await _idb(tx.objectStore('faces').get(id));
    return result || null;
};

/**
 * @returns {Promise<Array>}
 */
IDBStore.prototype.getAll = async function () {
    var tx = this._db.transaction('faces', 'readonly');
    return _idb(tx.objectStore('faces').getAll());
};

/**
 * @param {string} indexName
 * @param {string} value
 * @returns {Promise<Array>}
 */
IDBStore.prototype.findByIndex = async function (indexName, value) {
    var tx = this._db.transaction('faces', 'readonly');
    var index = tx.objectStore('faces').index(indexName);
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
    var tx = this._db.transaction('faces', 'readwrite');
    await _idb(tx.objectStore('faces').put(entry));
};

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
IDBStore.prototype.remove = async function (id) {
    var tx = this._db.transaction('faces', 'readwrite');
    await _idb(tx.objectStore('faces').delete(id));
};

/**
 * @returns {Promise<number>}
 */
IDBStore.prototype.count = async function () {
    var tx = this._db.transaction('faces', 'readonly');
    return _idb(tx.objectStore('faces').count());
};

/**
 * @returns {Promise<void>}
 */
IDBStore.prototype.clear = async function () {
    var tx = this._db.transaction('faces', 'readwrite');
    await _idb(tx.objectStore('faces').clear());
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
 * @returns {Promise<void>}
 */
FaceRegistry.prototype.open = async function () {
    if (this._opened) return;
    await this._store.open();
    this._opened = true;
};

/**
 * @param {string} label
 * @param {Float32Array} descriptor
 * @param {object} [metadata]
 * @returns {Promise<number>}
 */
FaceRegistry.prototype.addFace = async function (label, descriptor, metadata) {
    var meta;
    await this.open();
    meta = metadata || {};
    return this._store.add({
        label: String(label),
        descriptor: descriptor,
        metadata: meta,
        embeddingVersion: meta.embeddingVersion || 'human-hse',
        did: '',
        created: new Date(),
        updated: new Date(),
    });
};

/**
 * @param {number} id
 * @returns {Promise<object|null>}
 */
FaceRegistry.prototype.getFace = async function (id) {
    await this.open();
    return this._store.get(id);
};

/**
 * @param {string} label
 * @returns {Promise<Array>}
 */
FaceRegistry.prototype.findByLabel = async function (label) {
    await this.open();
    return this._store.findByIndex('label', String(label));
};

/**
 * @returns {Promise<Array>}
 */
FaceRegistry.prototype.getAllFaces = async function () {
    await this.open();
    return this._store.getAll();
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
    for (var key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key) && key !== 'id') {
            existing[key] = data[key];
        }
    }
    existing.updated = new Date();
    await this._store.put(existing);
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
FaceRegistry.prototype.findMatch = async function (descriptor, threshold, embeddingVersion) {
    if (typeof FaceEngine === 'undefined' || typeof FaceEngine.compareDescriptors !== 'function') {
        throw new TypeError('FaceEngine must be loaded to use findMatch');
    }
    if (threshold === undefined) threshold = 0.6;
    var all = await this.getAllFaces();
    return FaceEngine.matchInRegistry(descriptor, all, threshold, embeddingVersion);
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

/* c8 ignore start */
if (typeof window !== 'undefined') {
    window.FaceRegistry = FaceRegistry;
    window.IDBStore = IDBStore;
}
/* c8 ignore stop */

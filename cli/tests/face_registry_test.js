const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills for GPL check
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };

// Set up fake-indexeddb for IDBStore tests
const { indexedDB, IDBKeyRange } = require("fake-indexeddb");
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

// Load face_engine.js first (needed by findMatch)
const engineSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_engine.js"),
  "utf8",
);
vm.runInThisContext(engineSrc, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_engine.js") });

// Load face_registry.js
const registrySrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_registry.js"),
  "utf8",
);
vm.runInThisContext(registrySrc, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_registry.js") });

// Load face_crypto.js (registry lock/unlock/backup)
const cryptoSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_crypto.js"),
  "utf8",
);
vm.runInThisContext(cryptoSrc, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_crypto.js") });

// ── In-memory store for testing ──

let _nextId = 1;
let _dbSeq = 0;
function _testDbName() {
  return "TestDB_" + (++_dbSeq);
}

function _storeEntry(entry, id) {
  return {
    id: id,
    label: entry.label,
    descriptor: entry.descriptor instanceof Float32Array
      ? { __f32: true, data: Array.from(entry.descriptor) }
      : entry.descriptor,
    metadata: entry.metadata,
    embeddingVersion: entry.embeddingVersion,
    did: entry.did,
    created: entry.created instanceof Date
      ? { __d: true, v: entry.created.toISOString() }
      : entry.created,
    updated: entry.updated instanceof Date
      ? { __d: true, v: entry.updated.toISOString() }
      : entry.updated,
    encrypted: entry.encrypted,
  };
}

function _restoreEntry(obj) {
  return {
    id: obj.id,
    label: obj.label,
    descriptor: obj.descriptor && obj.descriptor.__f32
      ? new Float32Array(obj.descriptor.data)
      : obj.descriptor,
    metadata: obj.metadata,
    embeddingVersion: obj.embeddingVersion,
    did: obj.did,
    created: obj.created && obj.created.__d
      ? new Date(obj.created.v)
      : obj.created,
    updated: obj.updated && obj.updated.__d
      ? new Date(obj.updated.v)
      : obj.updated,
    encrypted: obj.encrypted,
  };
}

function InMemoryStore() {
  this._entries = [];
  this._meta = {};
  this._opened = false;
}

InMemoryStore.prototype.open = async function () {
  this._opened = true;
};

InMemoryStore.prototype.add = async function (entry) {
  const copy = _storeEntry(entry, _nextId++);
  this._entries.push(copy);
  return copy.id;
};

InMemoryStore.prototype.get = async function (id) {
  const found = this._entries.find(function (e) { return e.id === id; });
  return found ? _restoreEntry(found) : null;
};

InMemoryStore.prototype.getAll = async function () {
  return this._entries.map(_restoreEntry);
};

InMemoryStore.prototype.findByIndex = async function (indexName, value) {
  return this._entries
    .filter(function (e) { return e[indexName] === value; })
    .map(_restoreEntry);
};

InMemoryStore.prototype.put = async function (entry) {
  const idx = this._entries.findIndex(function (e) { return e.id === entry.id; });
  if (idx !== -1) this._entries[idx] = _storeEntry(entry, entry.id);
};

InMemoryStore.prototype.remove = async function (id) {
  this._entries = this._entries.filter(function (e) { return e.id !== id; });
};

InMemoryStore.prototype.count = async function () {
  return this._entries.length;
};

InMemoryStore.prototype.clear = async function () {
  this._entries = [];
};

InMemoryStore.prototype.putMeta = async function (key, value) {
  this._meta[key] = value;
};

InMemoryStore.prototype.getMeta = async function (key) {
  return Object.prototype.hasOwnProperty.call(this._meta, key) ? this._meta[key] : null;
};

InMemoryStore.prototype.removeMeta = async function (key) {
  delete this._meta[key];
};

// ── Helper ──

/** @returns {Float32Array} */
function makeDescriptor(values) {
  const arr = new Float32Array(128);
  for (let i = 0; i < 128 && i < values.length; i++) arr[i] = values[i];
  return arr;
}

/** @returns {Float32Array} */
function randomDescriptor() {
  const arr = new Float32Array(128);
  for (let i = 0; i < 128; i++) arr[i] = Math.random() * 2 - 1;
  return arr;
}

/** @returns {{store: InMemoryStore, reg: object}} */
function freshRegistry() {
  _nextId = 1;
  const store = new InMemoryStore();
  const reg = new FaceRegistry({ store: store });
  return { store, reg };
}

// ──────────────────────────────────────────

describe("FaceRegistry — constructor and open", () => {
  it("should create instance with default store", () => {
    const reg = new FaceRegistry();
    assert.ok(reg instanceof FaceRegistry);
    assert.ok(reg._store instanceof IDBStore);
  });

  it("should create instance with custom store", () => {
    const store = new InMemoryStore();
    const reg = new FaceRegistry({ store: store });
    assert.equal(reg._store, store);
  });

  it("should not throw on open()", async () => {
    const { reg } = freshRegistry();
    await reg.open();
    assert.ok(reg._opened);
  });

  it("should be idempotent on second open()", async () => {
    const { reg } = freshRegistry();
    await reg.open();
    const before = reg._opened;
    await reg.open();
    assert.equal(reg._opened, before);
  });
});

describe("FaceRegistry — retention purge", () => {
  it("removes entries last touched more than RETENTION_MS ago", async () => {
    const { reg, store } = freshRegistry();
    const old = Date.now() - FaceRegistry.RETENTION_MS - 60 * 1000;
    await store.open();
    const idOld = await store.add({
      label: "ghost",
      descriptor: makeDescriptor([1]),
      created: new Date(old),
      updated: new Date(old),
    });
    const idFresh = await store.add({
      label: "alice",
      descriptor: makeDescriptor([2]),
      created: new Date(),
      updated: new Date(),
    });
    const purged = await reg.purgeExpired();
    assert.equal(purged, 1);
    assert.equal(await store.get(idOld), null);
    assert.notEqual(await store.get(idFresh), null);
  });

  it("purges expired entries automatically on open()", async () => {
    const { reg, store } = freshRegistry();
    const old = Date.now() - FaceRegistry.RETENTION_MS - 1;
    await store.open();
    const id = await store.add({
      label: "ghost",
      descriptor: makeDescriptor([3]),
      created: new Date(old),
      updated: new Date(old),
    });
    await reg.open();
    assert.equal(await store.get(id), null);
  });

  it("keeps entries within the 3-year window (BIPA: from last interaction)", async () => {
    const { reg, store } = freshRegistry();
    const t = Date.now() - FaceRegistry.RETENTION_MS + 60 * 1000;
    await store.open();
    await store.add({
      label: "keep",
      descriptor: makeDescriptor([4]),
      created: new Date(t),
      updated: new Date(t),
    });
    const purged = await reg.purgeExpired();
    assert.equal(purged, 0);
    assert.equal(await store.count(), 1);
  });

  it("keeps entries without timestamps and never throws", async () => {
    const { reg, store } = freshRegistry();
    await store.open();
    await store.add({ label: "x", descriptor: makeDescriptor([5]) });
    const purged = await reg.purgeExpired();
    assert.equal(purged, 0);
    assert.equal(await store.count(), 1);
  });
});

describe("FaceRegistry — addFace and getFace", () => {
  it("should add a face and return numeric id", async () => {
    const { reg } = freshRegistry();
    const id = await reg.addFace("alice", randomDescriptor());
    assert.equal(typeof id, "number");
    assert.ok(id > 0);
  });

  it("should retrieve a face by id with all fields", async () => {
    const { reg } = freshRegistry();
    const desc = makeDescriptor([0.1, 0.2, 0.3]);
    const id = await reg.addFace("alice", desc, { source: "upload" });
    const face = await reg.getFace(id);
    assert.notEqual(face, null);
    assert.equal(face.label, "alice");
    assert.equal(face.metadata.source, "upload");
    assert.equal(face.did, "");
    assert.ok(face.created instanceof Date);
    assert.ok(face.updated instanceof Date);
    assert.equal(face.descriptor.length, 128);
    assert.ok(Math.abs(face.descriptor[0] - 0.1) < 0.001, "descriptor[0] should be ~0.1");
    assert.ok(Math.abs(face.descriptor[1] - 0.2) < 0.001, "descriptor[1] should be ~0.2");
  });

  it("should return null for non-existent id", async () => {
    const { reg } = freshRegistry();
    const face = await reg.getFace(9999);
    assert.equal(face, null);
  });

  it("should preserve label with spaces", async () => {
    const { reg } = freshRegistry();
    const id = await reg.addFace("  spaced label  ", randomDescriptor());
    const face = await reg.getFace(id);
    assert.equal(face.label, "  spaced label  ");
  });
});

describe("FaceRegistry — getAllFaces", () => {
  it("should return empty array for empty registry", async () => {
    const { reg } = freshRegistry();
    const all = await reg.getAllFaces();
    assert.equal(all.length, 0);
  });

  it("should return all added faces", async () => {
    const { reg } = freshRegistry();
    await reg.addFace("alice", randomDescriptor());
    await reg.addFace("bob", randomDescriptor());
    await reg.addFace("carol", randomDescriptor());
    const all = await reg.getAllFaces();
    assert.equal(all.length, 3);
    const labels = all.map(function (f) { return f.label; }).sort();
    assert.deepEqual(labels, ["alice", "bob", "carol"]);
  });
});

describe("FaceRegistry — findByLabel", () => {
  it("should find faces by exact label", async () => {
    const { reg } = freshRegistry();
    await reg.addFace("alice", randomDescriptor());
    await reg.addFace("alice", randomDescriptor());
    await reg.addFace("bob", randomDescriptor());
    const results = await reg.findByLabel("alice");
    assert.equal(results.length, 2);
    results.forEach(function (f) { assert.equal(f.label, "alice"); });
  });

  it("should return empty array for unmatched label", async () => {
    const { reg } = freshRegistry();
    await reg.addFace("alice", randomDescriptor());
    const results = await reg.findByLabel("nobody");
    assert.equal(results.length, 0);
  });
});

describe("FaceRegistry — updateFace", () => {
  it("should update fields", async () => {
    const { reg } = freshRegistry();
    const id = await reg.addFace("old", randomDescriptor(), { source: "init" });
    const ok = await reg.updateFace(id, { label: "new", did: "did:key:abc" });
    assert.equal(ok, true);
    const face = await reg.getFace(id);
    assert.equal(face.label, "new");
    assert.equal(face.did, "did:key:abc");
    assert.equal(face.metadata.source, "init");
  });

  it("should update updated timestamp", async () => {
    const { reg } = freshRegistry();
    const id = await reg.addFace("alice", randomDescriptor());
    const before = await reg.getFace(id);
    const beforeMs = before.updated.getTime();
    await new Promise(function (r) { setTimeout(r, 5); });
    await reg.updateFace(id, { label: "alice2" });
    const after = await reg.getFace(id);
    const afterMs = after.updated.getTime();
    assert.ok(afterMs >= beforeMs, "timestamp should advance");
  });

  it("should return false for non-existent id", async () => {
    const { reg } = freshRegistry();
    const ok = await reg.updateFace(9999, { label: "nobody" });
    assert.equal(ok, false);
  });

  it("should not overwrite id field", async () => {
    const { reg } = freshRegistry();
    const id = await reg.addFace("alice", randomDescriptor());
    await reg.updateFace(id, { id: 999, label: "bob" });
    const face = await reg.getFace(id);
    assert.equal(face.id, id);
    assert.notEqual(face.id, 999);
  });
});

describe("FaceRegistry — deleteFace", () => {
  it("should remove face by id", async () => {
    const { reg } = freshRegistry();
    const id = await reg.addFace("alice", randomDescriptor());
    assert.notEqual(await reg.getFace(id), null);
    const ok = await reg.deleteFace(id);
    assert.equal(ok, true);
    assert.equal(await reg.getFace(id), null);
  });

  it("should return false for non-existent id", async () => {
    const { reg } = freshRegistry();
    const ok = await reg.deleteFace(9999);
    assert.equal(ok, false);
  });
});

describe("FaceRegistry — getSize", () => {
  it("should return 0 for empty registry", async () => {
    const { reg } = freshRegistry();
    assert.equal(await reg.getSize(), 0);
  });

  it("should return correct count", async () => {
    const { reg } = freshRegistry();
    await reg.addFace("a", randomDescriptor());
    await reg.addFace("b", randomDescriptor());
    await reg.addFace("c", randomDescriptor());
    assert.equal(await reg.getSize(), 3);
  });

  it("should decrease after deletion", async () => {
    const { reg } = freshRegistry();
    const id = await reg.addFace("a", randomDescriptor());
    await reg.addFace("b", randomDescriptor());
    await reg.deleteFace(id);
    assert.equal(await reg.getSize(), 1);
  });
});

describe("FaceRegistry — clear", () => {
  it("should remove all entries", async () => {
    const { reg } = freshRegistry();
    await reg.addFace("a", randomDescriptor());
    await reg.addFace("b", randomDescriptor());
    await reg.clear();
    assert.equal(await reg.getSize(), 0);
    assert.equal((await reg.getAllFaces()).length, 0);
  });

  it("should be idempotent", async () => {
    const { reg } = freshRegistry();
    await reg.clear();
    assert.equal(await reg.getSize(), 0);
  });
});

describe("FaceRegistry — findMatch", () => {
  it("should find exact match", async () => {
    const { reg } = freshRegistry();
    const desc = makeDescriptor(new Array(128).fill(0.5));
    await reg.addFace("target", desc);
    await reg.addFace("other", randomDescriptor());
    const result = await reg.findMatch(desc, 0.6);
    assert.notEqual(result.match, null);
    assert.equal(result.match.label, "target");
    assert.equal(result.distance, 0);
  });

  it("should find closest match", async () => {
    const { reg } = freshRegistry();
    const ref = makeDescriptor(new Array(128).fill(0.5));
    const close = makeDescriptor(
      Array.from({ length: 128 }, function (_, i) { return 0.5 + Math.sin(i) * 0.01; }),
    );
    await reg.addFace("far", randomDescriptor());
    await reg.addFace("close", close);
    await reg.addFace("exact", ref);
    const result = await reg.findMatch(ref, 0.6);
    assert.equal(result.match.label, "exact");
  });

  it("should return null when no match within threshold", async () => {
    const { reg } = freshRegistry();
    const desc = makeDescriptor(new Array(128).fill(0.5));
    for (let i = 0; i < 5; i++) {
      const far = new Float32Array(128);
      for (let j = 0; j < 128; j++) far[j] = (j % 2 === 0 ? 1 : -1) * (i + 1);
      await reg.addFace("far_" + i, far);
    }
    const result = await reg.findMatch(desc, 0.1);
    assert.equal(result.match, null);
    assert.ok(result.distance > 0.1);
  });

  it("should use default threshold of 0.6", async () => {
    const { reg } = freshRegistry();
    const desc = makeDescriptor(new Array(128).fill(0.5));
    await reg.addFace("match", desc);
    const result = await reg.findMatch(desc);
    assert.notEqual(result.match, null);
    assert.equal(typeof result.distance, "number");
  });

  it("should throw if FaceEngine is missing", async () => {
    const origCompare = FaceEngine.compareDescriptors;
    delete FaceEngine.compareDescriptors;
    try {
      const { reg } = freshRegistry();
      await reg.addFace("x", randomDescriptor());
      await assert.rejects(
        function () { return reg.findMatch(randomDescriptor()); },
        /FaceEngine must be loaded|must be loaded/,
      );
    } finally {
      FaceEngine.compareDescriptors = origCompare;
    }
  });

  it("should only match entries with the requested embeddingVersion", async () => {
    const { reg } = freshRegistry();
    const desc = makeDescriptor(new Array(128).fill(0.5));
    await reg.addFace("arcface-only", desc, { embeddingVersion: "arcface-mbf" });
    const result = await reg.findMatch(desc, 0.6, "human-hse");
    assert.equal(result.match, null);
  });

  it("should match same-version entries when filter is given", async () => {
    const { reg } = freshRegistry();
    const desc = makeDescriptor(new Array(128).fill(0.5));
    await reg.addFace("hse-match", desc, { embeddingVersion: "human-hse" });
    await reg.addFace("arcface-other", randomDescriptor(), { embeddingVersion: "arcface-mbf" });
    const result = await reg.findMatch(desc, 0.6, "human-hse");
    assert.notEqual(result.match, null);
    assert.equal(result.match.label, "hse-match");
  });
});

describe("FaceRegistry ? embeddingVersion storage", () => {
  it("should default to human-hse when no metadata given", async () => {
    const { reg } = freshRegistry();
    const id = await reg.addFace("alice", randomDescriptor());
    const face = await reg.getFace(id);
    assert.equal(face.embeddingVersion, "human-hse");
  });

  it("should store the embeddingVersion from metadata", async () => {
    const { reg } = freshRegistry();
    const id = await reg.addFace("alice", randomDescriptor(), { embeddingVersion: "arcface-mbf" });
    const face = await reg.getFace(id);
    assert.equal(face.embeddingVersion, "arcface-mbf");
  });

  it("should keep embeddingVersion inside metadata too", async () => {
    const { reg } = freshRegistry();
    const id = await reg.addFace("alice", randomDescriptor(), { embeddingVersion: "arcface-mbf", source: "upload" });
    const face = await reg.getFace(id);
    assert.equal(face.metadata.embeddingVersion, "arcface-mbf");
    assert.equal(face.metadata.source, "upload");
  });
});

describe("FaceRegistry — descriptor persistence", () => {
  it("should preserve Float32Array values", async () => {
    const { reg } = freshRegistry();
    const desc = new Float32Array(128);
    for (let i = 0; i < 128; i++) desc[i] = Math.sin(i) * 0.5;
    const id = await reg.addFace("sin", desc);
    const face = await reg.getFace(id);
    assert.ok(face.descriptor instanceof Float32Array);
    for (let i = 0; i < 128; i++) {
      assert.ok(Math.abs(face.descriptor[i] - desc[i]) < 0.001, "Mismatch at " + i);
    }
  });

  it("should handle 20 entries without data loss", async () => {
    const { reg } = freshRegistry();
    const count = 20;
    for (let i = 0; i < count; i++) {
      await reg.addFace("person_" + i, randomDescriptor());
    }
    assert.equal(await reg.getSize(), count);
    const all = await reg.getAllFaces();
    assert.equal(all.length, count);
  });

  it("should handle empty registry operations", async () => {
    const { reg } = freshRegistry();
    assert.equal(await reg.getSize(), 0);
    assert.deepEqual(await reg.getAllFaces(), []);
    assert.equal(await reg.getFace(1), null);
    assert.equal(await reg.deleteFace(1), false);
    assert.equal(await reg.updateFace(1, {}), false);
  });
});

// ── IDBStore tests (requires fake-indexeddb) ──

describe("IDBStore — IndexedDB-backed storage", () => {
  it("should open database and create object store", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    assert.ok(store._db, "db should be set");
    assert.ok(store._db.objectStoreNames.contains("faces"), "faces store should exist");
  });

  it("should be idempotent on second open", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    const db1 = store._db;
    await store.open();
    assert.equal(store._db, db1, "db reference should not change");
  });

  it("should add entry and return id", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    const id = await store.add({ label: "test", descriptor: new Float32Array(2), created: new Date(), updated: new Date() });
    assert.equal(typeof id, "number");
    assert.ok(id > 0);
  });

  it("should get entry by id", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    const entry = { label: "alice", descriptor: new Float32Array([0.1, 0.2]), created: new Date(), updated: new Date() };
    const id = await store.add(entry);
    const result = await store.get(id);
    assert.notEqual(result, null);
    assert.equal(result.label, "alice");
  });

  it("should return null for non-existent id", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    const result = await store.get(9999);
    assert.equal(result, null);
  });

  it("should getAll entries", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    await store.add({ label: "a", descriptor: new Float32Array(2), created: new Date(), updated: new Date() });
    await store.add({ label: "b", descriptor: new Float32Array(2), created: new Date(), updated: new Date() });
    const all = await store.getAll();
    assert.equal(all.length, 2);
  });

  it("should return empty array from getAll when empty", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    const all = await store.getAll();
    assert.deepEqual(all, []);
  });

  it("should findByIndex", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    await store.add({ label: "alice", descriptor: new Float32Array(2), created: new Date(), updated: new Date() });
    await store.add({ label: "alice", descriptor: new Float32Array(2), created: new Date(), updated: new Date() });
    await store.add({ label: "bob", descriptor: new Float32Array(2), created: new Date(), updated: new Date() });
    const results = await store.findByIndex("label", "alice");
    assert.equal(results.length, 2);
    results.forEach(function (r) { assert.equal(r.label, "alice"); });
  });

  it("should return empty array from findByIndex when no match", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    const results = await store.findByIndex("label", "nobody");
    assert.deepEqual(results, []);
  });

  it("should put (update) existing entry", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    const entry = { label: "old", descriptor: new Float32Array(2), created: new Date(), updated: new Date() };
    const id = await store.add(entry);
    await store.put({ id: id, label: "updated", descriptor: new Float32Array(2), created: new Date(), updated: new Date() });
    const result = await store.get(id);
    assert.equal(result.label, "updated");
  });

  it("should remove entry by id", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    const id = await store.add({ label: "delete-me", descriptor: new Float32Array(2), created: new Date(), updated: new Date() });
    await store.remove(id);
    const result = await store.get(id);
    assert.equal(result, null);
  });

  it("should count entries", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    assert.equal(await store.count(), 0);
    await store.add({ label: "a", descriptor: new Float32Array(2), created: new Date(), updated: new Date() });
    assert.equal(await store.count(), 1);
    await store.add({ label: "b", descriptor: new Float32Array(2), created: new Date(), updated: new Date() });
    assert.equal(await store.count(), 2);
  });

  it("should clear all entries", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    await store.add({ label: "a", descriptor: new Float32Array(2), created: new Date(), updated: new Date() });
    await store.add({ label: "b", descriptor: new Float32Array(2), created: new Date(), updated: new Date() });
    await store.clear();
    assert.equal(await store.count(), 0);
  });
});

describe("IDBStore — FaceRegistry integration", () => {
  it("should work as default store for FaceRegistry", async () => {
    const reg = new FaceRegistry({ dbName: "IntTest_" + Date.now() });
    await reg.open();
    const id = await reg.addFace("integration", new Float32Array(128));
    const face = await reg.getFace(id);
    assert.equal(face.label, "integration");
    assert.equal(await reg.getSize(), 1);
    await reg.clear();
    assert.equal(await reg.getSize(), 0);
  });

  it("should support update and delete with IDBStore", async () => {
    const reg = new FaceRegistry({ dbName: "IntTest2_" + Date.now() });
    await reg.open();
    const id = await reg.addFace("update-me", new Float32Array(128));
    const ok = await reg.updateFace(id, { label: "updated" });
    assert.equal(ok, true);
    const face = await reg.getFace(id);
    assert.equal(face.label, "updated");
    const deleted = await reg.deleteFace(id);
    assert.equal(deleted, true);
    assert.equal(await reg.getFace(id), null);
  });

  it("should find by label with IDBStore", async () => {
    const reg = new FaceRegistry({ dbName: "IntTest3_" + Date.now() });
    await reg.open();
    await reg.addFace("bob", new Float32Array(128));
    await reg.addFace("bob", new Float32Array(128));
    await reg.addFace("alice", new Float32Array(128));
    const results = await reg.findByLabel("bob");
    assert.equal(results.length, 2);
  });
});

// ── Privacy: lock / unlock / backup ──

const LOCK_PASS = "lock-passphrase-test";

function makeRegistry() {
  return new FaceRegistry({ store: new InMemoryStore() });
}

describe("FaceRegistry — lock", () => {
  it("should encrypt plaintext entries in place and report the count", async () => {
    const reg = makeRegistry();
    await reg.open();
    await reg.addFace("alice", makeDescriptor([1, 2, 3]), { embeddingVersion: "human-hse" });
    await reg.addFace("bob", makeDescriptor([4, 5, 6]));
    const n = await reg.lock(LOCK_PASS);
    assert.equal(n, 2);
    assert.equal(await reg.isLocked(), true);
    const faces = await reg.getAllFaces();
    assert.equal(faces.length, 2);
    for (const f of faces) {
      assert.equal(f.descriptor, undefined);
      assert.ok(f.encrypted && f.encrypted.alg === "AES-GCM" && f.encrypted.cipher);
      assert.ok(f.label, "label stays plaintext for the list");
    }
  });

  it("should not double-encrypt already encrypted entries", async () => {
    const reg = makeRegistry();
    await reg.open();
    await reg.addFace("alice", makeDescriptor([1, 2, 3]));
    await reg.lock(LOCK_PASS);
    const again = await reg.lock(LOCK_PASS);
    assert.equal(again, 0);
  });

  it("should hide locked entries from findMatch", async () => {
    const reg = makeRegistry();
    await reg.open();
    await reg.addFace("alice", makeDescriptor([0.5, 0.5]));
    await reg.lock(LOCK_PASS);
    const m = await reg.findMatch(makeDescriptor([0.5, 0.5]), 0.5, undefined);
    assert.equal(m.match, null);
  });
});

describe("FaceRegistry — unlock", () => {
  it("should restore descriptors with the right passphrase", async () => {
    const reg = makeRegistry();
    await reg.open();
    const desc = makeDescriptor([1, 2, 3]);
    await reg.addFace("alice", desc, { embeddingVersion: "human-hse" });
    await reg.lock(LOCK_PASS);
    const n = await reg.unlock(LOCK_PASS);
    assert.equal(n, 1);
    assert.equal(await reg.isLocked(), false);
    const faces = await reg.getAllFaces();
    assert.equal(faces.length, 1);
    assert.ok(faces[0].descriptor instanceof Float32Array);
    assert.deepEqual(Array.from(faces[0].descriptor), Array.from(desc));
    assert.equal(faces[0].embeddingVersion, "human-hse");
    assert.equal(faces[0].encrypted, undefined);
  });

  it("should reject the wrong passphrase and keep entries locked", async () => {
    const reg = makeRegistry();
    await reg.open();
    await reg.addFace("alice", makeDescriptor([1, 2, 3]));
    await reg.lock(LOCK_PASS);
    await assert.rejects(reg.unlock("wrong-passphrase"));
    assert.equal(await reg.isLocked(), true);
    const faces = await reg.getAllFaces();
    assert.ok(faces[0].encrypted);
  });
});

describe("FaceRegistry — exportBackup/importBackup", () => {
  it("should export plaintext backup and import with merge", async () => {
    const reg = makeRegistry();
    await reg.open();
    await reg.addFace("alice", makeDescriptor([1, 2, 3]));
    const backup = await reg.exportBackup(null);
    assert.equal(backup.type, "redoSan.faceRegistryBackup");
    assert.equal(backup.entries.length, 1);
    assert.equal(backup.entries[0].label, "alice");

    const reg2 = makeRegistry();
    await reg2.open();
    await reg2.addFace("bob", makeDescriptor([9, 9, 9]));
    const imported = await reg2.importBackup(backup, null, "merge");
    assert.equal(imported, 1);
    assert.equal((await reg2.getAllFaces()).length, 2);
    const imported2 = await reg2.importBackup(backup, null, "replace");
    assert.equal(imported2, 1);
    assert.equal((await reg2.getAllFaces()).length, 1);
  });

it("should export encrypted backup and restore with the passphrase", async () => {
    const reg = makeRegistry();
    await reg.open();
    const id = await reg.addFace("alice", makeDescriptor([1, 2, 3]), { embeddingVersion: "human-hse" });
    await reg.updateFace(id, { did: "did:key:z6Mkxx" });
    const backup = await reg.exportBackup(LOCK_PASS);
    assert.ok(backup.entries[0].encrypted);
    assert.equal(backup.entries[0].label, undefined, "label is inside the envelope");

    const reg2 = makeRegistry();
    await reg2.open();
const n = await reg2.importBackup(backup, LOCK_PASS, "merge");
    assert.equal(n, 1);
    const faces = await reg2.getAllFaces();
    assert.equal(faces[0].label, "alice");
    assert.deepEqual(Array.from(faces[0].descriptor).slice(0, 3), [1, 2, 3]);
    assert.equal(faces[0].embeddingVersion, "human-hse");
    assert.equal(faces[0].did, "did:key:z6Mkxx");
  });

  it("should refuse plaintext export while locked and reject wrong passphrase import", async () => {
    const reg = makeRegistry();
    await reg.open();
    await reg.addFace("alice", makeDescriptor([1, 2, 3]));
    await reg.lock(LOCK_PASS);
    await assert.rejects(reg.exportBackup(null), /requires a passphrase/);

    const backup = await reg.exportBackup(LOCK_PASS);
    const reg2 = makeRegistry();
    await reg2.open();
    await assert.rejects(reg2.importBackup(backup, "wrong-pass", "merge"));
    assert.equal(await reg2.getSize(), 0);
  });

it("should reject invalid backup files", async () => {
    const reg = makeRegistry();
    await reg.open();
    await assert.rejects(reg.importBackup({ type: "nope" }, null, "merge"), /Invalid backup file/);
    await assert.rejects(reg.importBackup(null, null, "merge"), /Invalid backup file/);
  });
});

// ── FaceRegistry — meta store (passkey reference etc.) ──

describe("FaceRegistry — setMeta/getMeta/removeMeta", () => {
  it("should store, read and remove a meta value", async () => {
    const reg = makeRegistry();
    await reg.open();
    assert.equal(await reg.getMeta("passkey"), null);
    await reg.setMeta("passkey", { credentialId: "abc-123", name: "abc-123…", createdAt: "2026-01-01T00:00:00.000Z" });
    const passkey = await reg.getMeta("passkey");
    assert.equal(passkey.credentialId, "abc-123");
    await reg.removeMeta("passkey");
    assert.equal(await reg.getMeta("passkey"), null);
  });

  it("should overwrite an existing key", async () => {
    const reg = makeRegistry();
    await reg.open();
    await reg.setMeta("passkey", { credentialId: "one" });
    await reg.setMeta("passkey", { credentialId: "two" });
    assert.equal((await reg.getMeta("passkey")).credentialId, "two");
  });

  it("should work with the IndexedDB store and survive reopen", async () => {
    const dbName = "MetaTest_" + Date.now();
    const reg = new FaceRegistry({ dbName: dbName });
    await reg.open();
    await reg.setMeta("passkey", { credentialId: "idb-1", name: "idb key" });
    const reg2 = new FaceRegistry({ dbName: dbName });
    await reg2.open();
    const passkey = await reg2.getMeta("passkey");
    assert.equal(passkey.credentialId, "idb-1");
    await reg2.removeMeta("passkey");
    assert.equal(await reg2.getMeta("passkey"), null);
  });
});

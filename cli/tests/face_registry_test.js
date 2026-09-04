const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills for GPL check
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};

// Set up fake-indexeddb for IDBStore tests
const { indexedDB, IDBKeyRange } = require("fake-indexeddb");
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

// Load face_engine.js first (needed by findMatch)
const engineSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_engine.js"),
  "utf8",
);
vm.runInThisContext(engineSrc, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Face_Biometric",
    "face_engine.js",
  ),
});

// Load face_registry.js
const registrySrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_registry.js"),
  "utf8",
);
vm.runInThisContext(registrySrc, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Face_Biometric",
    "face_registry.js",
  ),
});

// Load face_crypto.js (registry lock/unlock/backup)
const cryptoSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_crypto.js"),
  "utf8",
);
vm.runInThisContext(cryptoSrc, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Face_Biometric",
    "face_crypto.js",
  ),
});

// ── In-memory store for testing ──

let _nextId = 1;
let _dbSeq = 0;
function _testDbName() {
  return "TestDB_" + ++_dbSeq;
}

function _storeEntry(entry, id) {
  return {
    id: id,
    label: entry.label,
    descriptor:
      entry.descriptor instanceof Float32Array
        ? { __f32: true, data: Array.from(entry.descriptor) }
        : entry.descriptor,
    metadata: entry.metadata,
    embeddingVersion: entry.embeddingVersion,
    did: entry.did,
    created:
      entry.created instanceof Date
        ? { __d: true, v: entry.created.toISOString() }
        : entry.created,
    updated:
      entry.updated instanceof Date
        ? { __d: true, v: entry.updated.toISOString() }
        : entry.updated,
    encrypted: entry.encrypted,
  };
}

function _restoreEntry(obj) {
  return {
    id: obj.id,
    label: obj.label,
    descriptor:
      obj.descriptor && obj.descriptor.__f32
        ? new Float32Array(obj.descriptor.data)
        : obj.descriptor,
    metadata: obj.metadata,
    embeddingVersion: obj.embeddingVersion,
    did: obj.did,
    created:
      obj.created && obj.created.__d ? new Date(obj.created.v) : obj.created,
    updated:
      obj.updated && obj.updated.__d ? new Date(obj.updated.v) : obj.updated,
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
  const found = this._entries.find(function (e) {
    return e.id === id;
  });
  return found ? _restoreEntry(found) : null;
};

InMemoryStore.prototype.getAll = async function () {
  return this._entries.map(_restoreEntry);
};

InMemoryStore.prototype.findByIndex = async function (indexName, value) {
  return this._entries
    .filter(function (e) {
      return e[indexName] === value;
    })
    .map(_restoreEntry);
};

InMemoryStore.prototype.put = async function (entry) {
  const idx = this._entries.findIndex(function (e) {
    return e.id === entry.id;
  });
  if (idx !== -1) this._entries[idx] = _storeEntry(entry, entry.id);
};

InMemoryStore.prototype.remove = async function (id) {
  this._entries = this._entries.filter(function (e) {
    return e.id !== id;
  });
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
  return Object.prototype.hasOwnProperty.call(this._meta, key)
    ? this._meta[key]
    : null;
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
    assert.ok(
      Math.abs(face.descriptor[0] - 0.1) < 0.001,
      "descriptor[0] should be ~0.1",
    );
    assert.ok(
      Math.abs(face.descriptor[1] - 0.2) < 0.001,
      "descriptor[1] should be ~0.2",
    );
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
    const labels = all
      .map(function (f) {
        return f.label;
      })
      .sort();
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
    results.forEach(function (f) {
      assert.equal(f.label, "alice");
    });
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
    await new Promise(function (r) {
      setTimeout(r, 5);
    });
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
      Array.from({ length: 128 }, function (_, i) {
        return 0.5 + Math.sin(i) * 0.01;
      }),
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
      await assert.rejects(function () {
        return reg.findMatch(randomDescriptor());
      }, /FaceEngine must be loaded|must be loaded/);
    } finally {
      FaceEngine.compareDescriptors = origCompare;
    }
  });

  it("should only match entries with the requested embeddingVersion", async () => {
    const { reg } = freshRegistry();
    const desc = makeDescriptor(new Array(128).fill(0.5));
    await reg.addFace("arcface-only", desc, {
      embeddingVersion: "arcface-mbf",
    });
    const result = await reg.findMatch(desc, 0.6, "human-hse");
    assert.equal(result.match, null);
  });

  it("should match same-version entries when filter is given", async () => {
    const { reg } = freshRegistry();
    const desc = makeDescriptor(new Array(128).fill(0.5));
    await reg.addFace("hse-match", desc, { embeddingVersion: "human-hse" });
    await reg.addFace("arcface-other", randomDescriptor(), {
      embeddingVersion: "arcface-mbf",
    });
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
    const id = await reg.addFace("alice", randomDescriptor(), {
      embeddingVersion: "arcface-mbf",
    });
    const face = await reg.getFace(id);
    assert.equal(face.embeddingVersion, "arcface-mbf");
  });

  it("should keep embeddingVersion inside metadata too", async () => {
    const { reg } = freshRegistry();
    const id = await reg.addFace("alice", randomDescriptor(), {
      embeddingVersion: "arcface-mbf",
      source: "upload",
    });
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
      assert.ok(
        Math.abs(face.descriptor[i] - desc[i]) < 0.001,
        "Mismatch at " + i,
      );
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
    assert.ok(
      store._db.objectStoreNames.contains("faces"),
      "faces store should exist",
    );
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
    const id = await store.add({
      label: "test",
      descriptor: new Float32Array(2),
      created: new Date(),
      updated: new Date(),
    });
    assert.equal(typeof id, "number");
    assert.ok(id > 0);
  });

  it("should get entry by id", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    const entry = {
      label: "alice",
      descriptor: new Float32Array([0.1, 0.2]),
      created: new Date(),
      updated: new Date(),
    };
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
    await store.add({
      label: "a",
      descriptor: new Float32Array(2),
      created: new Date(),
      updated: new Date(),
    });
    await store.add({
      label: "b",
      descriptor: new Float32Array(2),
      created: new Date(),
      updated: new Date(),
    });
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
    await store.add({
      label: "alice",
      descriptor: new Float32Array(2),
      created: new Date(),
      updated: new Date(),
    });
    await store.add({
      label: "alice",
      descriptor: new Float32Array(2),
      created: new Date(),
      updated: new Date(),
    });
    await store.add({
      label: "bob",
      descriptor: new Float32Array(2),
      created: new Date(),
      updated: new Date(),
    });
    const results = await store.findByIndex("label", "alice");
    assert.equal(results.length, 2);
    results.forEach(function (r) {
      assert.equal(r.label, "alice");
    });
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
    const entry = {
      label: "old",
      descriptor: new Float32Array(2),
      created: new Date(),
      updated: new Date(),
    };
    const id = await store.add(entry);
    await store.put({
      id: id,
      label: "updated",
      descriptor: new Float32Array(2),
      created: new Date(),
      updated: new Date(),
    });
    const result = await store.get(id);
    assert.equal(result.label, "updated");
  });

  it("should remove entry by id", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    const id = await store.add({
      label: "delete-me",
      descriptor: new Float32Array(2),
      created: new Date(),
      updated: new Date(),
    });
    await store.remove(id);
    const result = await store.get(id);
    assert.equal(result, null);
  });

  it("should count entries", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    assert.equal(await store.count(), 0);
    await store.add({
      label: "a",
      descriptor: new Float32Array(2),
      created: new Date(),
      updated: new Date(),
    });
    assert.equal(await store.count(), 1);
    await store.add({
      label: "b",
      descriptor: new Float32Array(2),
      created: new Date(),
      updated: new Date(),
    });
    assert.equal(await store.count(), 2);
  });

  it("should clear all entries", async () => {
    const store = new IDBStore(_testDbName());
    await store.open();
    await store.add({
      label: "a",
      descriptor: new Float32Array(2),
      created: new Date(),
      updated: new Date(),
    });
    await store.add({
      label: "b",
      descriptor: new Float32Array(2),
      created: new Date(),
      updated: new Date(),
    });
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
    await reg.addFace("alice", makeDescriptor([1, 2, 3]), {
      embeddingVersion: "human-hse",
    });
    await reg.addFace("bob", makeDescriptor([4, 5, 6]));
    const n = await reg.lock(LOCK_PASS);
    assert.equal(n, 2);
    assert.equal(await reg.isLocked(), true);
    const faces = await reg.getAllFaces();
    assert.equal(faces.length, 2);
    for (const f of faces) {
      assert.equal(f.descriptor, undefined);
      assert.ok(
        f.encrypted && f.encrypted.alg === "AES-GCM" && f.encrypted.cipher,
      );
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
    const id = await reg.addFace("alice", makeDescriptor([1, 2, 3]), {
      embeddingVersion: "human-hse",
    });
    await reg.updateFace(id, { did: "did:key:z6Mkxx" });
    const backup = await reg.exportBackup(LOCK_PASS);
    assert.ok(backup.entries[0].encrypted);
    assert.equal(
      backup.entries[0].label,
      undefined,
      "label is inside the envelope",
    );

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
    await assert.rejects(
      reg.importBackup({ type: "nope" }, null, "merge"),
      /Invalid backup file/,
    );
    await assert.rejects(
      reg.importBackup(null, null, "merge"),
      /Invalid backup file/,
    );
  });
});

// ── FaceRegistry — meta store (passkey reference etc.) ──

describe("FaceRegistry — setMeta/getMeta/removeMeta", () => {
  it("should store, read and remove a meta value", async () => {
    const reg = makeRegistry();
    await reg.open();
    assert.equal(await reg.getMeta("passkey"), null);
    await reg.setMeta("passkey", {
      credentialId: "abc-123",
      name: "abc-123…",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
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

// ── Coverage: retention purge arms ──

describe("FaceRegistry — retention purge", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const OLD = Date.now() - 4 * 365 * DAY;

  it("returns 0 when getAll fails", async () => {
    const reg = new FaceRegistry({
      store: {
        open: async function () {},
        getAll: async function () {
          throw new Error("db gone");
        },
        remove: async function () {},
      },
    });
    await reg.open();
    assert.equal(reg._lastPurgedCount, 0);
  });

  it("honors date precedence and skips malformed entries", async () => {
    const store = new InMemoryStore();
    store._entries.push(
      {},
      { label: "no-id" },
      { id: 1, updated: new Date(OLD) }, // updated too old → purge
      { id: 2, created: new Date(OLD) }, // created fallback → purge
      { id: 3 }, // no dates → now → keep
      { id: 4, updated: "not-a-date", created: new Date(OLD) }, // NaN guard → created
      { id: 5, updated: "junk", created: "junk" }, // both NaN → now → keep
      { id: 6, updated: new Date() }, // fresh → keep
    );
    const reg = new FaceRegistry({ store });
    assert.equal(await reg.purgeExpired(), 3);
    const ids = (await store.getAll())
      .map(function (e) {
        return e.id;
      })
      .filter(function (id) {
        return id !== undefined;
      })
      .sort();
    assert.deepEqual(ids, [3, 5, 6]);
  });

  it("keeps purging when one removal throws", async () => {
    let calls = 0;
    const store = new InMemoryStore();
    store._entries.push(
      { id: 1, updated: new Date(OLD) },
      { id: 2, updated: new Date(OLD) },
    );
    store.remove = async function (id) {
      calls++;
      if (calls === 1) throw new Error("locked row");
      return InMemoryStore.prototype.remove.call(store, id);
    };
    const reg = new FaceRegistry({ store });
    assert.equal(await reg.purgeExpired(), 1);
  });

  it("opens automatically from purgeExpired when not opened yet", async () => {
    const store = new InMemoryStore();
    const reg = new FaceRegistry({ store });
    assert.equal(await reg.purgeExpired(), 0);
    assert.equal(reg._opened, true);
    assert.equal(
      await reg.purgeExpired(),
      0,
      "second call takes the opened path",
    );
  });

  it("surfaces storage errors from _idb (request.onerror)", async () => {
    const store = new IDBStore("ErrDB_" + Date.now());
    await store.open();
    await store.add({ id: 5, label: "first" });
    await assert.rejects(
      store.add({ id: 5, label: "dup" }),
      /ConstraintError|KeyAlready|already/i,
    );
  });
});

// ── Coverage: vault key + PRF sealing ──

const waSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_webauthn.js"),
  "utf8",
);
vm.runInThisContext(waSrc, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Face_Biometric",
    "face_webauthn.js",
  ),
});
const REAL_WA = globalThis.FaceWebauthn;

async function prfEnvelope(key, payload) {
  const env = await REAL_WA.encryptJSON(key, payload);
  return {
    alg: "AES-GCM",
    version: 1,
    kdf: { name: "PRF" },
    iv: env.iv,
    cipher: env.ct,
  };
}

async function pbkdf2Envelope(passphrase, payload) {
  const salt = FaceCrypto.generateSalt(16);
  const key = await FaceCrypto.deriveKey(passphrase, salt);
  const iv = FaceCrypto.generateSalt(12);
  const env = await FaceCrypto.encryptWithKey(key, iv, payload);
  return {
    alg: "AES-GCM",
    version: 1,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: FaceCrypto.KDF_ITERATIONS,
    },
    salt: FaceCrypto.bytesToBase64(salt),
    iv: env.iv,
    cipher: env.cipher,
  };
}

describe("FaceRegistry — vault key accessors", () => {
  it("set/get/has round-trip and tolerate clearing", () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    assert.equal(reg.hasVaultKey(), false);
    assert.equal(reg.getVaultKey(), null);
    const fakeKey = {};
    reg.setVaultKey(fakeKey);
    assert.equal(reg.getVaultKey(), fakeKey);
    assert.equal(reg.hasVaultKey(), true);
    reg.setVaultKey(null);
    assert.equal(reg.hasVaultKey(), false);
  });
});

describe("FaceRegistry — PRF seal/unseal", () => {
  let reg, key;

  beforeEach(async function () {
    reg = new FaceRegistry({ store: new InMemoryStore() });
    key = await REAL_WA.deriveVaultKey(new Uint8Array(32).fill(9));
    reg.setVaultKey(key);
  });

  it("falls back to plaintext fields when FaceWebauthn is missing", async () => {
    globalThis.FaceWebauthn = undefined;
    try {
      const sealed = await reg._sealFace({ label: "A", descriptor: [1] });
      assert.equal(sealed.encrypted, undefined);
    } finally {
      globalThis.FaceWebauthn = REAL_WA;
    }
  });

  it("seals with a vault key and preserves the id", async () => {
    const sealed = await reg._sealFace({
      id: 42,
      label: "Artist",
      descriptor: new Float32Array([0.5, -0.5]),
      metadata: { note: "x" },
      embeddingVersion: "human-hse",
      did: "did:key:z",
      created: new Date(),
      updated: new Date(),
    });
    assert.equal(sealed.id, 42);
    assert.equal(sealed.label, "Artist");
    assert.equal(sealed.descriptor, undefined);
    assert.equal(sealed.encrypted.kdf.name, "PRF");
  });

  it("round-trips a face through addFace/getFace with the vault key", async () => {
    const id = await reg.addFace("RoundTrip", new Float32Array([0.5, -0.25]), {
      tag: 1,
    });
    const face = await reg.getFace(id);
    assert.equal(face.label, "RoundTrip");
    assert.deepEqual(Array.from(face.descriptor), [0.5, -0.25]);
    assert.deepEqual(face.metadata, { tag: 1 });
  });

  it("returns locked entries without the vault key", async () => {
    const id = await reg.addFace("Secret", new Float32Array([1]));
    const raw = await reg._store.get(id);
    const orphan = new FaceRegistry({ store: reg._store }); // no vault key
    const locked = await orphan.getFace(id);
    assert.equal(locked.locked, true);
    assert.equal(locked.descriptor, undefined);
    assert.equal(locked.encrypted, raw.encrypted);
  });

  it("returns locked entries when decryption fails", async () => {
    const id = await reg.addFace("Secret", new Float32Array([1]));
    const wrong = new FaceRegistry({ store: reg._store });
    wrong.setVaultKey(await REAL_WA.deriveVaultKey(new Uint8Array(32).fill(1)));
    const locked = await wrong.getFace(id);
    assert.equal(locked.locked, true);
  });

  it("fills defaults for sparse decrypted payloads", async () => {
    const env = await prfEnvelope(key, { descriptor: [3, 4] });
    const out = await reg._unsealEntry({
      id: 7,
      label: "Fallback",
      encrypted: env,
    });
    assert.equal(out.label, "Fallback");
    assert.deepEqual(Array.from(out.descriptor), [3, 4]);
    assert.equal(out.metadata, null);
    assert.equal(out.embeddingVersion, null);
    assert.equal(out.did, "");

    const bare = await prfEnvelope(key, {});
    const out2 = await reg._unsealEntry({ id: 9, label: "B", encrypted: bare });
    assert.deepEqual(Array.from(out2.descriptor), []);
  });

  it("keeps PBKDF2-locked entries locked regardless of the vault key", async () => {
    const env = await pbkdf2Envelope("pw", { descriptor: [1] });
    const out = await reg._unsealEntry({ id: 8, label: "L", encrypted: env });
    assert.equal(out.locked, true);
  });
});

describe("FaceRegistry — sealAllPlaintext", () => {
  it("is a no-op without a vault key", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    assert.equal(await reg.sealAllPlaintext(), 0);
  });

  it("seals only plaintext entries that carry data", async () => {
    const key = await REAL_WA.deriveVaultKey(new Uint8Array(32).fill(5));
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    reg.setVaultKey(key);
    await reg.open();
    const store = reg._store;
    store._entries.push(
      {
        id: 1,
        label: "Plain",
        descriptor: new Float32Array([1, 2]),
        metadata: { m: 1 },
        embeddingVersion: "human-hse",
        did: "",
        created: new Date(),
        updated: new Date(),
      },
      { id: 2, updated: new Date() },
      {
        id: 3,
        label: "Already",
        created: new Date(),
        updated: new Date(),
        encrypted: { kdf: { name: "PRF" }, iv: "x", cipher: "y" },
      },
    );
    assert.equal(await reg.sealAllPlaintext(), 1);
    const sealedRow = store._entries.find(function (e) {
      return e.id === 1;
    });
    assert.ok(sealedRow.encrypted, "plaintext row must now be sealed");
  });
});

describe("FaceRegistry — lock/unlock (PBKDF2)", () => {
  it("throws when FaceCrypto is unavailable", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    const saved = globalThis.FaceCrypto;
    globalThis.FaceCrypto = undefined;
    try {
      await assert.rejects(reg.lock("pw"), /FaceCrypto must be loaded/);
      await assert.rejects(reg.unlock("pw"), /FaceCrypto must be loaded/);
    } finally {
      globalThis.FaceCrypto = saved;
    }
  });

  it("locks plaintext rows, reports the count, then unlocks them", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    await reg._store.add({
      label: "One",
      descriptor: new Float32Array([1, 2]),
      metadata: null,
      embeddingVersion: "human-hse",
      did: "",
      created: new Date(),
      updated: new Date(),
    });
    await reg._store.add({
      label: "Two",
      descriptor: new Float32Array([3]),
      created: new Date(),
      updated: new Date(),
    });
    // a pre-locked PBKDF2 row (same passphrase) must be left alone by lock()
    const preEnv = await pbkdf2Envelope("secret", {
      label: "Pre",
      descriptor: [9],
    });
    await reg._store.add({
      label: "Pre",
      created: new Date(),
      updated: new Date(),
      encrypted: preEnv,
    });

    assert.equal(await reg.isLocked(), true);
    assert.equal(await reg.lock("secret"), 2);
    assert.equal(await reg.isLocked(), true);

    await assert.rejects(reg.unlock("wrong"), /OperationError|decrypt/i);
    assert.equal(await reg.unlock("secret"), 3);
    assert.equal(await reg.isLocked(), false);
    const faces = await reg.getAllFaces();
    const one = faces.find(function (f) {
      return f.label === "One";
    });
    assert.deepEqual(Array.from(one.descriptor), [1, 2]);
  });

  it("unlocks sparse payloads using stored fallbacks", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    const env = await pbkdf2Envelope("pw", { descriptor: [7] }); // no label/metadata/did
    const newId = await reg._store.add({
      label: "KeepLabel",
      created: new Date(),
      updated: new Date(),
      encrypted: env,
    });
    const plainId = await reg._store.add({
      label: "NeverLocked",
      descriptor: new Float32Array([1]),
      created: new Date(),
      updated: new Date(),
    });
    assert.equal(await reg.unlock("pw"), 1, "plaintext rows are skipped");
    const row = await reg._store.get(newId);
    assert.equal(row.label, "KeepLabel");
    assert.deepEqual(Array.from(row.descriptor), [7]);
    assert.equal(row.metadata, null);
    assert.equal(row.did, "");

    // a locked payload without a descriptor falls back to an empty one
    const noDescEnv = await pbkdf2Envelope("pw", { label: "NoDesc" });
    const noDescId = await reg._store.add({
      label: "Whatever",
      created: new Date(),
      updated: new Date(),
      encrypted: noDescEnv,
    });
    assert.equal(await reg.unlock("pw"), 1);
    const noDescRow = await reg._store.get(noDescId);
    assert.equal(noDescRow.label, "NoDesc");
    assert.deepEqual(Array.from(noDescRow.descriptor), []);
    void plainId;
  });

  it("treats PRF rows as unlocked only with the session vault key", async () => {
    const key = await REAL_WA.deriveVaultKey(new Uint8Array(32).fill(3));
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    const env = await prfEnvelope(key, { descriptor: [1] });
    await reg._store.add({
      label: "PrfRow",
      created: new Date(),
      updated: new Date(),
      encrypted: env,
    });
    assert.equal(await reg.isLocked(), true, "no vault key yet");
    reg.setVaultKey(key);
    assert.equal(await reg.isLocked(), false, "vault key unlocks PRF rows");
  });
});

describe("FaceRegistry — exportBackup", () => {
  it("exports plaintext rows as-is when no passphrase is given", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    await reg._store.add({
      label: "Plain",
      descriptor: new Float32Array([1, 2]),
      metadata: { a: 1 },
      embeddingVersion: "human-hse",
      did: "",
      created: new Date(),
      updated: new Date(),
    });
    const backup = await reg.exportBackup();
    assert.equal(backup.type, "redoSan.faceRegistryBackup");
    assert.equal(backup.entries.length, 1);
    assert.equal(backup.entries[0].encrypted, undefined);
    assert.deepEqual(backup.entries[0].descriptor, [1, 2]);
  });

  it("passes raw __f32/array descriptors through unchanged", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    // Bypass serialization so _descriptorToArray sees genuine raw shapes.
    reg._store.getAll = async function () {
      return [
        {
          id: 1,
          label: "F32",
          descriptor: { __f32: true, data: [9, 8] },
          created: new Date(),
          updated: new Date(),
        },
        {
          id: 2,
          label: "BadF32",
          descriptor: { __f32: true, data: "nope" },
          created: new Date(),
          updated: new Date(),
        },
        {
          id: 3,
          label: "Arr",
          descriptor: [7, 6],
          created: new Date(),
          updated: new Date(),
        },
        { id: 4, label: "None", created: new Date(), updated: new Date() },
        {
          id: 5,
          label: "Junk",
          descriptor: {},
          created: new Date(),
          updated: new Date(),
        },
      ];
    };
    const backup = await reg.exportBackup();
    assert.deepEqual(backup.entries[0].descriptor, [9, 8]);
    assert.deepEqual(backup.entries[1].descriptor, []);
    assert.deepEqual(backup.entries[2].descriptor, [7, 6]);
    assert.deepEqual(backup.entries[3].descriptor, []);
    assert.deepEqual(backup.entries[4].descriptor, []);
  });

  it("encrypts every entry when a passphrase is supplied", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    await reg.addFace("Enc", new Float32Array([5]));
    // bare row without metadata/embedding/descriptor exercises payload defaults
    await reg._store._entries.push({
      id: 50,
      label: "Bare",
      created: new Date(),
      updated: new Date(),
    });
    const backup = await reg.exportBackup("passphrase");
    assert.equal(backup.entries.length, 2);
    for (const entry of backup.entries) {
      assert.ok(entry.encrypted.cipher);
    }
  });

  it("re-encrypts PBKDF2 rows when exporting with their passphrase", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    const env = await pbkdf2Envelope("pw", {
      label: "Locked",
      descriptor: [4],
    });
    await reg._store.add({
      id: 11,
      label: "Locked",
      created: new Date(),
      updated: new Date(),
      encrypted: env,
    });
    const backup = await reg.exportBackup("pw");
    assert.ok(
      backup.entries[0].encrypted.cipher !== env.cipher,
      "fresh envelope per export",
    );
    const target = new FaceRegistry({ store: new InMemoryStore() });
    assert.equal(await target.importBackup(backup, "pw"), 1);
    const all = await target.getAllFaces();
    assert.equal(all[0].label, "Locked");
  });

  it("decrypts PRF rows during a passphrase export using the vault key", async () => {
    const key = await REAL_WA.deriveVaultKey(new Uint8Array(32).fill(9));
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    reg.setVaultKey(key);
    await reg.open();
    const env = await prfEnvelope(key, {}); // sparse payload → export defaults kick in
    await reg._store.add({
      id: 21,
      label: "PrfRow",
      created: new Date(),
      updated: new Date(),
      encrypted: env,
    });
    const backup = await reg.exportBackup("any-pw");
    assert.ok(backup.entries[0].encrypted.cipher);
  });

  it("refuses a passphrase export of PRF rows without a vault key", async () => {
    const key = await REAL_WA.deriveVaultKey(new Uint8Array(32).fill(9));
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    const env = await prfEnvelope(key, { descriptor: [1] });
    await reg._store.add({
      id: 22,
      label: "X",
      created: new Date(),
      updated: new Date(),
      encrypted: env,
    });
    await assert.rejects(reg.exportBackup("pw"), /passkey session/);
  });

  it("refuses unsupported encryption formats", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    await reg._store.add({
      id: 23,
      label: "Weird",
      created: new Date(),
      updated: new Date(),
      encrypted: { kdf: { name: "ROT13" } },
    });
    await assert.rejects(reg.exportBackup("pw"), /Unsupported encryption/);
  });

  it("refuses exporting locked PBKDF2 rows without a passphrase", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    const env = await pbkdf2Envelope("pw", { descriptor: [] });
    await reg._store.add({
      id: 24,
      label: "L",
      created: new Date(),
      updated: new Date(),
      encrypted: env,
    });
    await assert.rejects(reg.exportBackup(), /requires a passphrase/);
  });

  it("exports PRF rows decrypted with a vault key, or as ciphertext without one", async () => {
    const key = await REAL_WA.deriveVaultKey(new Uint8Array(32).fill(9));
    const fullEnv = await prfEnvelope(key, {
      label: "P",
      descriptor: [1],
      metadata: { m: 1 },
      embeddingVersion: "v9",
      did: "did:key:z",
    });
    const bareEnv = await prfEnvelope(key, {});

    const unlockedReg = new FaceRegistry({ store: new InMemoryStore() });
    unlockedReg.setVaultKey(key);
    await unlockedReg.open();
    await unlockedReg._store.add({
      id: 31,
      label: "P",
      created: new Date(),
      updated: new Date(),
      encrypted: fullEnv,
    });
    await unlockedReg._store.add({
      id: 33,
      label: "Bare",
      created: new Date(),
      updated: new Date(),
      encrypted: bareEnv,
    });
    const openBackup = await unlockedReg.exportBackup();
    assert.equal(openBackup.entries[0].encrypted, undefined);
    assert.deepEqual(openBackup.entries[0].descriptor, [1]);
    assert.equal(openBackup.entries[0].embeddingVersion, "v9");
    assert.deepEqual(openBackup.entries[0].metadata, { m: 1 });
    assert.equal(openBackup.entries[0].did, "did:key:z");
    assert.deepEqual(openBackup.entries[1].descriptor, []);
    assert.equal(openBackup.entries[1].metadata, null);
    assert.equal(openBackup.entries[1].embeddingVersion, null);
    assert.equal(openBackup.entries[1].did, "");

    const lockedReg = new FaceRegistry({ store: new InMemoryStore() });
    await lockedReg.open();
    await lockedReg._store.add({
      id: 32,
      label: "P",
      created: new Date(),
      updated: new Date(),
      encrypted: fullEnv,
    });
    const cipherBackup = await lockedReg.exportBackup();
    assert.equal(cipherBackup.entries[0].encrypted.kdf.name, "PRF");
  });
});

describe("FaceRegistry — importBackup", () => {
  function makeBackup(entries) {
    return { type: "redoSan.faceRegistryBackup", version: 1, entries };
  }

  it("rejects malformed backups", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    await assert.rejects(reg.importBackup(null), /Invalid backup/);
    await assert.rejects(
      reg.importBackup({ type: "nope", entries: [] }),
      /Invalid backup/,
    );
    await assert.rejects(
      reg.importBackup(makeBackup("not-array")),
      /Invalid backup/,
    );
  });

  it("imports plaintext rows with defaults in merge mode", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    const n = await reg.importBackup(
      makeBackup([{}, { label: "Named", descriptor: [1] }]),
    );
    assert.equal(n, 2);
    const faces = await reg.getAllFaces();
    const imported = faces.find(function (f) {
      return f.label === "Imported";
    });
    assert.ok(imported, "missing labels fall back to Imported");
    assert.deepEqual(Array.from(imported.descriptor), []);
  });

  it("clears the registry first in replace mode", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    await reg.addFace("Old", new Float32Array([1]));
    await reg.importBackup(
      makeBackup([{ label: "New", descriptor: [] }]),
      null,
      "replace",
    );
    const faces = await reg.getAllFaces();
    assert.equal(faces.length, 1);
    assert.equal(faces[0].label, "New");
  });

  it("reseals PRF rows when a vault key is available", async () => {
    const key = await REAL_WA.deriveVaultKey(new Uint8Array(32).fill(9));
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    reg.setVaultKey(key);
    await reg.open();
    const env = await prfEnvelope(key, {
      label: "Prf",
      descriptor: [3],
      metadata: null,
      embeddingVersion: null,
      did: "",
    });
    // a label-less payload exercises the "Imported" fallback on reseal
    const bareEnv = await prfEnvelope(key, {}); // no label/descriptor → full reseal defaults
    const n = await reg.importBackup(
      makeBackup([
        { encrypted: env, created: new Date().toISOString() },
        { encrypted: bareEnv }, // no created → Date.now() fallback
      ]),
    );
    assert.equal(n, 2);
    const faces = await reg.getAllFaces();
    assert.equal(faces[0].label, "Prf");
    assert.deepEqual(Array.from(faces[0].descriptor), [3]);
    assert.equal(faces[1].label, "Imported");
    assert.deepEqual(Array.from(faces[1].descriptor), []);
  });

  it("stores PRF ciphertext untouched without a vault key", async () => {
    const key = await REAL_WA.deriveVaultKey(new Uint8Array(32).fill(9));
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    const env = await prfEnvelope(key, { label: "Hidden", descriptor: [1] });
    const n = await reg.importBackup(
      makeBackup([{ label: "Hidden", encrypted: env }, { encrypted: env }]),
    );
    assert.equal(n, 2);
    const rows = await reg._store.getAll();
    assert.equal(
      rows.filter(function (r) {
        return r.encrypted && r.encrypted.kdf.name === "PRF";
      }).length,
      2,
    );
    assert.equal(
      rows.some(function (r) {
        return r.label === "Imported";
      }),
      true,
    );
  });

  it("requires a passphrase for PBKDF2 rows", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    const env = await pbkdf2Envelope("pw", { label: "L", descriptor: [1] });
    await assert.rejects(
      reg.importBackup(makeBackup([{ encrypted: env }])),
      /import requires a passphrase/,
    );
  });

  it("decrypts PBKDF2 rows with sparse payloads", async () => {
    const reg = new FaceRegistry({ store: new InMemoryStore() });
    await reg.open();
    const env = await pbkdf2Envelope("pw", { descriptor: [8] });
    const namedEnv = await pbkdf2Envelope("pw", {
      label: "Named",
      metadata: null,
      embeddingVersion: null,
      did: "",
    }); // no descriptor
    const n = await reg.importBackup(
      makeBackup([{ encrypted: env }, { encrypted: namedEnv }]),
      "pw",
    );
    assert.equal(n, 2);
    const faces = await reg.getAllFaces();
    assert.equal(faces[0].label, "Imported");
    assert.deepEqual(Array.from(faces[0].descriptor), [8]);
    assert.equal(faces[0].metadata, null);
    assert.equal(faces[1].label, "Named");
    assert.deepEqual(Array.from(faces[1].descriptor), []);
  });
});

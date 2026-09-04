require("./setup-idb");
const test = require("node:test");
const assert = require("node:assert");

// ═══════════════════════════════════════════════════════════════
// iris_storage.js — full CRUD lifecycle
// ═══════════════════════════════════════════════════════════════

test("IrisStorage: constructor and vault key", () => {
  const store = new ISt();
  assert.ok(store);
  assert.equal(store.hasVaultKey(), false);
});

test("IrisStorage.setVaultKey: sets key", () => {
  const store = new ISt();
  store.setVaultKey({ type: "secret" });
  assert.equal(store.hasVaultKey(), true);
  store.setVaultKey(null);
  assert.equal(store.hasVaultKey(), false);
});

test("IrisStorage.save: throws without id", async () => {
  const store = new ISt();
  try {
    await store.save({ leftCode: new Uint8Array(10) });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("id"));
  }
});

test("IrisStorage.save: throws without leftCode", async () => {
  const store = new ISt();
  try {
    await store.save({ id: "test-1" });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("IrisCode"));
  }
});

test("IrisStorage.save: saves plaintext template", async () => {
  const store = new ISt();
  const tpl = {
    id: "save-1",
    label: "test eye",
    leftCode: new Uint8Array([1, 2, 3]),
    leftMask: new Uint8Array([4, 5, 6]),
  };
  const id = await store.save(tpl);
  assert.equal(id, "save-1");
});

test("IrisStorage.save: saves with right eye data", async () => {
  const store = new ISt();
  const tpl = {
    id: "save-2",
    leftCode: new Uint8Array([1, 2]),
    leftMask: new Uint8Array([3, 4]),
    rightCode: new Uint8Array([5, 6]),
    rightMask: new Uint8Array([7, 8]),
    quality: { score: 90 },
    eyeSide: "left",
  };
  const id = await store.save(tpl);
  assert.equal(id, "save-2");
});

test("IrisStorage.load: retrieves saved template", async () => {
  const store = new ISt();
  await store.save({
    id: "load-1",
    leftCode: new Uint8Array([10, 20]),
    leftMask: new Uint8Array([30]),
  });
  const loaded = await store.load("load-1");
  assert.ok(loaded);
  assert.equal(loaded.id, "load-1");
  assert.ok(loaded.leftCode instanceof Uint8Array);
  assert.ok(loaded.leftMask instanceof Uint8Array);
});

test("IrisStorage.load: returns null for missing id", async () => {
  const store = new ISt();
  const loaded = await store.load("nonexistent");
  assert.equal(loaded, null);
});

test("IrisStorage.list: returns saved entries", async () => {
  const store = new ISt();
  await store.save({
    id: "list-1",
    label: "a",
    leftCode: new Uint8Array(2),
    leftMask: new Uint8Array(2),
  });
  await store.save({
    id: "list-2",
    label: "b",
    leftCode: new Uint8Array(2),
    leftMask: new Uint8Array(2),
  });
  const items = await store.list();
  assert.ok(Array.isArray(items));
  assert.ok(items.length >= 2);
  const ids = items.map(function (x) {
    return x.id;
  });
  assert.ok(ids.includes("list-1"));
  assert.ok(ids.includes("list-2"));
});

test("IrisStorage.delete: removes a template", async () => {
  const store = new ISt();
  await store.save({
    id: "del-1",
    leftCode: new Uint8Array(1),
    leftMask: new Uint8Array(1),
  });
  await store.delete("del-1");
  const loaded = await store.load("del-1");
  assert.equal(loaded, null);
});

test("IrisStorage.count: returns count", async () => {
  const store = new ISt();
  await store.save({
    id: "cnt-1",
    leftCode: new Uint8Array(1),
    leftMask: new Uint8Array(1),
  });
  await store.save({
    id: "cnt-2",
    leftCode: new Uint8Array(1),
    leftMask: new Uint8Array(1),
  });
  const n = await store.count();
  assert.ok(n >= 2);
});

test("IrisStorage.clear: removes all entries", async () => {
  const store = new ISt();
  await store.save({
    id: "clr-1",
    leftCode: new Uint8Array(1),
    leftMask: new Uint8Array(1),
  });
  await store.clear();
  const n = await store.count();
  assert.equal(n, 0);
});

test("IrisStorage.importRecords: imports array", async () => {
  const store = new ISt();
  const records = [
    { id: "imp-1", leftCode: [1, 2], leftMask: [3, 4], label: "imported" },
  ];
  const count = await store.importRecords(records);
  assert.equal(count, 1);
});

test("IrisStorage.importRecords: throws on non-array", async () => {
  const store = new ISt();
  try {
    await store.importRecords("not-array");
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("array"));
  }
});

test("IrisStorage.importRecords: skips records without id", async () => {
  const store = new ISt();
  const count = await store.importRecords([{ label: "no-id" }]);
  assert.equal(count, 1);
});

test("IrisStorage.exportAllRecords: returns saved records", async () => {
  const store = new ISt();
  await store.save({
    id: "exp-1",
    leftCode: new Uint8Array([1]),
    leftMask: new Uint8Array([2]),
  });
  const exported = await store.exportAllRecords();
  assert.ok(Array.isArray(exported));
  assert.ok(exported.length >= 1);
});

test("IrisStorage.exportTemplate: exports as JSON", async () => {
  const store = new ISt();
  await store.save({
    id: "json-1",
    leftCode: new Uint8Array([1, 2]),
    leftMask: new Uint8Array([3]),
  });
  const json = await store.exportTemplate("json-1");
  assert.ok(json);
  const data = JSON.parse(json);
  assert.equal(data.format, "redosan-iris-v1");
  assert.equal(data.template.id, "json-1");
});

test("IrisStorage.exportTemplate: returns null for missing", async () => {
  const store = new ISt();
  const json = await store.exportTemplate("nope");
  assert.equal(json, null);
});

test("IrisStorage.importTemplate: imports JSON string", async () => {
  const store = new ISt();
  const tpl = { id: "imp-json-1", leftCode: [10, 20], leftMask: [30, 40] };
  const json = JSON.stringify({
    format: "redosan-iris-v1",
    exportedAt: Date.now(),
    template: tpl,
  });
  const id = await store.importTemplate(json);
  assert.equal(id, "imp-json-1");
  const loaded = await store.load("imp-json-1");
  assert.ok(loaded);
  assert.ok(loaded.leftCode instanceof Uint8Array);
});

test("IrisStorage.importTemplate: throws on bad format", async () => {
  const store = new ISt();
  try {
    await store.importTemplate(JSON.stringify({ format: "bad" }));
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("format"));
  }
});

test("IrisStorage.load: rehydrates record with eyeSide normalization", async () => {
  const store = new ISt();
  await store.save({
    id: "eye-1",
    leftCode: new Uint8Array([1]),
    leftMask: new Uint8Array([2]),
    eyeSide: "right",
  });
  const loaded = await store.load("eye-1");
  assert.ok(loaded);
  assert.equal(loaded.eyeSide, "right");
});

test("IrisStorage.load: rehydrates unknown eyeSide", async () => {
  const store = new ISt();
  await store.save({
    id: "eye-2",
    leftCode: new Uint8Array([1]),
    leftMask: new Uint8Array([2]),
    eyeSide: "bad",
  });
  const loaded = await store.load("eye-2");
  assert.ok(loaded);
  assert.equal(loaded.eyeSide, "unknown");
});

test("IrisStorage._rehydrate: null record returns null", async () => {
  const store = new ISt();
  const result = await store._rehydrate(null);
  assert.equal(result, null);
});

test("IrisStorage.save: throws when FaceCrypto missing with vault key", async () => {
  const store = new ISt();
  store.setVaultKey("fake-key");
  try {
    await store.save({
      id: "vault-1",
      leftCode: new Uint8Array(1),
      leftMask: new Uint8Array(1),
    });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("FaceCrypto"));
  }
});

test("IrisStorage._rehydrate: throws when vault locked and enc record", async () => {
  const store = new ISt();
  try {
    await store._rehydrate({ id: "enc-1", enc: { alg: "AES-GCM" } });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("unlock"));
  }
});

test("IrisStorage._rehydrate: throws when FaceCrypto missing for enc record", async () => {
  const store = new ISt();
  store.setVaultKey("fake-key");
  try {
    await store._rehydrate({ id: "enc-2", enc: { alg: "AES-GCM" } });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("FaceCrypto"));
  }
});

test("IrisStorage._openDB: returns cached db", async () => {
  const store = new ISt();
  const db1 = await store._openDB();
  const db2 = await store._openDB();
  assert.equal(db1, db2);
});

// ═══════════════════════════════════════════════════════════════
// iris_storage.js — more _rehydrate branches
// ═══════════════════════════════════════════════════════════════
test("IrisStorage._rehydrate: legacy plaintext with right eye", async () => {
  const store = new ISt();
  const rec = {
    id: "leg-1",
    eyeSide: "left",
    leftCode: [1, 2, 3],
    leftMask: [4, 5, 6],
    rightCode: [7, 8, 9],
    rightMask: [10, 11, 12],
  };
  const result = await store._rehydrate(rec);
  assert.ok(result);
  assert.ok(result.leftCode instanceof Uint8Array);
  assert.ok(result.rightCode instanceof Uint8Array);
});

test("IrisStorage._rehydrate: legacy plaintext without right eye", async () => {
  const store = new ISt();
  const rec = {
    id: "leg-2",
    eyeSide: "right",
    leftCode: [1, 2, 3],
    leftMask: [4, 5, 6],
  };
  const result = await store._rehydrate(rec);
  assert.ok(result);
  assert.equal(result.leftCode.length, 3);
});

test("IrisStorage._rehydrate: invalid eyeSide normalizes to unknown", async () => {
  const store = new ISt();
  const rec = {
    id: "leg-3",
    eyeSide: "center",
    leftCode: [1, 2, 3],
    leftMask: [4, 5, 6],
  };
  const result = await store._rehydrate(rec);
  assert.equal(result.eyeSide, "unknown");
});

test("IrisStorage.save: saves with quality and did", async () => {
  const store = new ISt();
  const id = await store.save({
    id: "qual-1",
    leftCode: new Uint8Array([1, 2, 3]),
    leftMask: new Uint8Array([4, 5, 6]),
    quality: { score: 85 },
    did: "did:key:z123",
    eyeSide: "left",
  });
  assert.equal(id, "qual-1");
  const loaded = await store.load("qual-1");
  assert.ok(loaded);
  assert.equal(loaded.did, "did:key:z123");
});

test("IrisStorage.importTemplate: valid with right eye", async () => {
  const store = new ISt();
  const template = {
    id: "imp-1",
    leftCode: Array.from(new Uint8Array([1, 2, 3])),
    leftMask: Array.from(new Uint8Array([4, 5, 6])),
    rightCode: Array.from(new Uint8Array([7, 8, 9])),
    rightMask: Array.from(new Uint8Array([10, 11, 12])),
    eyeSide: "unknown",
  };
  const json = JSON.stringify({
    format: "redosan-iris-v1",
    exportedAt: Date.now(),
    template,
  });
  const id = await store.importTemplate(json);
  assert.equal(id, "imp-1");
});

// ═══════════════════════════════════════════════════════════════
// iris_storage.js additional paths
// ═══════════════════════════════════════════════════════════════
test("ISt.list: empty", async () => {
  const store = new ISt();
  const r = await store.list();
  assert.ok(Array.isArray(r));
});

test("ISt.count: empty", async () => {
  const store = new ISt();
  const r = await store.count();
  assert.equal(typeof r, "number");
});

test("ISt.clear: empty", async () => {
  const store = new ISt();
  await store.clear();
});

test("ISt.exportAllRecords: empty", async () => {
  const store = new ISt();
  const r = await store.exportAllRecords();
  assert.ok(Array.isArray(r));
  assert.equal(r.length, 0);
});

test("ISt.importRecords: empty", async () => {
  const store = new ISt();
  await store.importRecords([]);
});

test("ISt.importRecords: with valid record", async () => {
  const store = new ISt();
  const record = {
    template: {
      code: new Uint8Array(64).fill(1),
      mask: new Uint8Array(64).fill(1),
    },
    metadata: { eyeSide: "left" },
  };
  await store.importRecords([record]);
});

test("ISt.save: normal", async () => {
  const store = new ISt();
  const template = {
    id: "test-1",
    code: new Uint8Array(64).fill(0xab),
    mask: new Uint8Array(64).fill(0xff),
    leftCode: new Uint8Array(64).fill(0xab),
    leftMask: new Uint8Array(64).fill(0xff),
    eyeSide: "right",
    label: "test",
    enrolledAt: Date.now(),
  };
  const r = await store.save(template);
  assert.ok(r);
  assert.equal(r, "test-1");
});

test("ISt.load: non-existent id", async () => {
  const store = new ISt();
  const r = await store.load("nonexistent-id");
  assert.equal(r, null);
});

test("ISt.delete: non-existent id", async () => {
  const store = new ISt();
  await store.delete("nonexistent-id");
});

test("ISt.exportTemplate: non-existent id", async () => {
  const store = new ISt();
  const r = await store.exportTemplate("nonexistent-id");
  assert.equal(r, null);
});

// ═══════════════════════════════════════════════════════════════
// iris_storage.js: IDB open error handler
// ═══════════════════════════════════════════════════════════════
test("ISt._openDB: onerror handler fires when DB open fails", async () => {
  _idbShouldFail = true;
  try {
    const store = new ISt();
    await assert.rejects(async () => {
      const db = await store._openDB();
      if (db && db.close) db.close();
    }, /IndexedDB open failed/);
  } finally {
    _idbShouldFail = false;
  }
});

// ═══════════════════════════════════════════════════════════════
// iris_storage.js: importRecords with enc record triggers rehydrate error
// ═══════════════════════════════════════════════════════════════
test("ISt.importRecords: enc record triggers rehydrate error path", async () => {
  const store = new ISt();
  const record = { id: "enc-imp", enc: { alg: "AES-GCM" }, label: "encrypted" };
  await store.importRecords([record]);
  const raw = await new Promise((resolve) => {
    const req = indexedDB.open(IRIS_DB_NAME, IRIS_DB_VERSION);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(IRIS_STORE_NAME, "readonly");
      const s = tx.objectStore(IRIS_STORE_NAME);
      const g = s.get("enc-imp");
      g.onsuccess = () => resolve(g.result);
      g.onerror = () => resolve(null);
    };
  });
  assert.ok(raw);
  assert.ok(raw.enc);
  assert.equal(raw.label, "encrypted");
});

// ═══════════════════════════════════════════════════════════════
// iris_storage.js: IDB onerror for all methods
// ═══════════════════════════════════════════════════════════════
test("ISt._openDB: onerror", async () => {
  _idbShouldFail = true;
  try {
    const store = new ISt();
    await assert.rejects(async () => {
      const db = await store._openDB();
      if (db && db.close) db.close();
    }, /IndexedDB open failed/);
  } finally {
    _idbShouldFail = false;
  }
});

// ═══════════════════════════════════════════════════════════════
// iris_storage.js: FaceCrypto check
// ═══════════════════════════════════════════════════════════════
test("ISt.save: FaceCrypto missing → throw", async () => {
  const origFC = global.FaceCrypto;
  delete global.FaceCrypto;
  try {
    const store = new ISt();
    store.setVaultKey(new Uint8Array(32).fill(42));
    await assert.rejects(async () => {
      await store.save({
        id: "fc-test",
        leftCode: new Uint8Array(64).fill(1),
        leftMask: new Uint8Array(64).fill(1),
        eyeSide: "left",
        enrolledAt: Date.now(),
        label: "test",
      });
    }, /FaceCrypto must be loaded/);
  } finally {
    global.FaceCrypto = origFC;
  }
});

// ═══════════════════════════════════════════════════════════════
// iris_storage.js: FaceCrypto rehydrate check
// ═══════════════════════════════════════════════════════════════
test("ISt._rehydrate: FaceCrypto missing → throw for encrypted record", async () => {
  const origFC = global.FaceCrypto;
  global.FaceCrypto = {
    encryptWithKey: async (key, iv, data) => ({
      iv: new Uint8Array(12),
      cipher: new Uint8Array(32),
    }),
    decryptWithKey: async (key, data) => ({
      leftCode: [1, 2],
      leftMask: [3, 4],
      eyeSide: "left",
    }),
    generateSalt: (n) => new Uint8Array(n),
  };
  try {
    const store = new ISt();
    store.setVaultKey(new Uint8Array(32).fill(42));
    await store.save({
      id: "fc-enc-test",
      leftCode: new Uint8Array(64).fill(1),
      leftMask: new Uint8Array(64).fill(1),
      eyeSide: "left",
      enrolledAt: Date.now(),
      label: "enc-test",
    });
  } finally {
    global.FaceCrypto = origFC;
  }
  const origFC2 = global.FaceCrypto;
  delete global.FaceCrypto;
  try {
    const store = new ISt();
    store.setVaultKey(new Uint8Array(32).fill(42));
    await assert.rejects(async () => {
      await store.load("fc-enc-test");
    }, /FaceCrypto must be loaded/);
  } finally {
    global.FaceCrypto = origFC2;
  }
});

// ── ISt.save: with right eye data → rightCode/rightMask stored (L129-130) ──
test("ISt.save: with right eye data → rightCode/rightMask stored (L129-130)", async () => {
  const store = new ISt();
  await store.save({
    id: "re-test-2",
    leftCode: new Uint8Array(64).fill(1),
    leftMask: new Uint8Array(64).fill(1),
    rightCode: new Uint8Array(64).fill(2),
    rightMask: new Uint8Array(64).fill(3),
    eyeSide: "right",
    enrolledAt: Date.now(),
    label: "right-eye",
  });
  const loaded = await store.load("re-test-2");
  assert.ok(loaded);
  assert.ok(loaded.rightCode);
  assert.ok(loaded.rightMask);
});

// ── ISt._rehydrate: with rightCode, rightMask, quality, eyeSide (L186-189) ──
test("ISt._rehydrate: record with all fields → rightCode, rightMask, quality, eyeSide (L186-189)", async () => {
  const store = new ISt();
  await store.save({
    id: "full-rehydrate-2",
    leftCode: new Uint8Array([1, 2]),
    leftMask: new Uint8Array([3, 4]),
    rightCode: new Uint8Array([5, 6]),
    rightMask: new Uint8Array([7, 8]),
    quality: 85,
    eyeSide: "right",
    enrolledAt: Date.now(),
    label: "full",
  });
  const loaded = await store.load("full-rehydrate-2");
  assert.ok(loaded);
  assert.equal(loaded.eyeSide, "right");
  assert.equal(loaded.quality, 85);
  assert.ok(loaded.rightCode instanceof Uint8Array);
  assert.ok(loaded.rightMask instanceof Uint8Array);
});

// ── ISt.list: returns eyeSide from cursor (L257) ──
test("ISt.list: returns eyeSide from cursor (L257)", async () => {
  const store = new ISt();
  await store.save({
    id: "list-eye-2",
    leftCode: new Uint8Array(4).fill(1),
    leftMask: new Uint8Array(4).fill(1),
    eyeSide: "left",
    enrolledAt: Date.now(),
    label: "list",
  });
  const list = await store.list();
  assert.ok(list.length > 0);
  const item = list.find((e) => e.id === "list-eye-2");
  assert.ok(item);
  assert.equal(item.eyeSide, "left");
});

// ── ISt.list: default eyeSide when missing (L257) ──
test("ISt.list: default eyeSide when missing (L257)", async () => {
  const store = new ISt();
  await store.save({
    id: "list-noeye",
    leftCode: new Uint8Array(4).fill(1),
    leftMask: new Uint8Array(4).fill(1),
    enrolledAt: Date.now(),
    label: "noeye",
  });
  const list = await store.list();
  const item = list.find((e) => e.id === "list-noeye");
  assert.ok(item);
  assert.equal(item.eyeSide, "unknown");
});

// ── ISt.load: FaceCrypto encrypt → decrypt round-trip (L186-189) ──
test("ISt.load: FaceCrypto encrypt+decrypt round-trip with rightCode (L186-189)", async () => {
  const origFC = global.FaceCrypto;
  global.FaceCrypto = {
    encryptWithKey: async (_key, _iv, payload) => ({
      iv: new Uint8Array(12),
      cipher: Buffer.from(JSON.stringify(payload)),
    }),
    decryptWithKey: async (_key, enc) => JSON.parse(enc.cipher.toString()),
    generateSalt: (n) => new Uint8Array(n),
  };
  try {
    const store = new ISt();
    store.setVaultKey(new Uint8Array(32).fill(42));
    await store.save({
      id: "fc-rt",
      leftCode: new Uint8Array([1]),
      leftMask: new Uint8Array([2]),
      rightCode: new Uint8Array([3]),
      rightMask: new Uint8Array([4]),
      quality: 90,
      eyeSide: "right",
      enrolledAt: Date.now(),
      label: "rt",
    });
    const loaded = await store.load("fc-rt");
    assert.ok(loaded);
    assert.equal(loaded.eyeSide, "right");
    assert.equal(loaded.quality, 90);
    assert.ok(loaded.rightCode);
    assert.ok(loaded.rightMask);
  } finally {
    global.FaceCrypto = origFC;
  }
});

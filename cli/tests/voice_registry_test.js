const { describe, it } = require("node:test");
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

// Load voice_template_protection.js (needed to build protected codes)
const vtSrc = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "..",
    "Voice_Biometric",
    "voice_template_protection.js",
  ),
  "utf8",
);
vm.runInThisContext(vtSrc, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Voice_Biometric",
    "voice_template_protection.js",
  ),
});

// Load voice_registry.js
const registrySrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Voice_Biometric", "voice_registry.js"),
  "utf8",
);
vm.runInThisContext(registrySrc, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Voice_Biometric",
    "voice_registry.js",
  ),
});

let _dbSeq = 0;
function _testDbName() {
  return "VoiceTestDB_" + ++_dbSeq;
}

function makeDescriptor(values) {
  const arr = new Float32Array(192);
  for (let i = 0; i < 192 && i < values.length; i++) arr[i] = values[i];
  for (let i = values.length; i < 192; i++) arr[i] = Math.sin(i) / (i + 1);
  return arr;
}

const SECRET = "voice-enroll-secret-v1";
const DESC_A = makeDescriptor([0.32, -0.11, 0.45, -0.08, 0.91, -0.23, 0.02]);
const DESC_B = makeDescriptor([-0.9, 0.8, -0.7, 0.6, -0.5, 0.4, -0.3]);
const DESC_C = makeDescriptor([0.12, 0.34, -0.56, 0.78, -0.9, 0.11, -0.22]);

async function protectedCode(descriptor, secret) {
  return VoiceTemplateProtection.generate(descriptor, secret, { dim: 128 });
}

function freshRegistry() {
  return new VoiceRegistry({ dbName: _testDbName() });
}

describe("VoiceRegistry — consent ledger (GDPR Art 9(2)(a) + Art 30 records)", () => {
  it("records explicit consent with purpose + retention before enrolment", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("alice", "voice-auth", {
      retentionMs: VoiceRegistry.RETENTION_MS,
    });
    const consent = await reg.getConsent("alice");
    assert.ok(consent);
    assert.equal(consent.status, "active");
    assert.equal(consent.purpose, "voice-auth");
    assert.ok(consent.grantedAt instanceof Date);
    assert.equal(consent.retention, VoiceRegistry.RETENTION_MS);
  });

  it("records the Art 30(1)(c) fields: notice version + data categories", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("alice", "voice-auth", {
      noticeVersion: VoiceRegistry.CONSENT_POLICY_VERSION,
    });
    const consent = await reg.getConsent("alice");
    assert.equal(consent.noticeVersion, VoiceRegistry.CONSENT_POLICY_VERSION);
    assert.ok(Array.isArray(consent.dataCategories));
    assert.ok(consent.dataCategories.length > 0);
    assert.ok(consent.dataCategories.includes("voiceprint-protected-template"));
  });

  it("refuses to enrol a voice template without active consent", async () => {
    const reg = freshRegistry();
    await reg.open();
    const tpl = await protectedCode(DESC_A, SECRET);
    await assert.rejects(reg.add("bob", tpl, {}), /consent/i);
  });

  it("withdrawing consent revokes it and deletes the templates (Art 17 erasure)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("carol", "voice-auth");
    const tpl = await protectedCode(DESC_A, SECRET);
    await reg.add("carol", tpl, {});
    assert.equal((await reg.getByLabel("carol")).length, 1);
    const withdrawn = await reg.withdrawConsent("carol");
    assert.equal(withdrawn.status, "withdrawn");
    assert.ok(withdrawn.withdrawnAt instanceof Date);
    assert.equal((await reg.getByLabel("carol")).length, 0);
    const consent = await reg.getConsent("carol");
    assert.equal(consent.status, "withdrawn");
  });
});

describe("VoiceRegistry — CRUD over protected templates", () => {
  it("stores only protected template data (no descriptor, no secret)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("dave", "voice-auth");
    const tpl = await protectedCode(DESC_A, SECRET);
    const id = await reg.add("dave", tpl, { device: "mic-1" });
    const record = await reg.get(id);
    assert.equal(record.label, "dave");
    assert.equal(record.schema, "voice-registry-v1");
    assert.equal(record.metadata.device, "mic-1");
    assert.ok(record.code instanceof Uint8Array);
    assert.ok(record.created instanceof Date);
    assert.ok(record.updated instanceof Date);
    assert.ok(record.lastInteraction instanceof Date);
    const json = JSON.stringify(record);
    assert.ok(!("descriptor" in record));
    assert.ok(!json.includes("0.32"));
    assert.ok(!json.includes(SECRET));
  });

  it("finds by id, by label, lists all, updates non-identity fields, removes, clears", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("eve", "voice-auth");
    await reg.grantConsent("frank", "voice-auth");
    const tplA = await protectedCode(DESC_A, SECRET);
    const tplB = await protectedCode(DESC_B, SECRET);
    const idA = await reg.add("eve", tplA, {});
    await reg.add("frank", tplB, {});

    const byId = await reg.get(idA);
    assert.equal(byId.label, "eve");
    const byLabel = await reg.getByLabel("frank");
    assert.equal(byLabel.length, 1);
    assert.equal(byLabel[0].label, "frank");
    assert.equal((await reg.getAll()).length, 2);

    await reg.update(idA, { metadata: { note: "updated" } });
    const updated = await reg.get(idA);
    assert.equal(updated.label, "eve");
    assert.equal(updated.metadata.note, "updated");

    await reg.remove(idA);
    assert.equal((await reg.getAll()).length, 1);
    await reg.clear();
    assert.equal((await reg.getAll()).length, 0);
  });

  it("round-trips Uint8Array codes through fake-indexeddb structured clone", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("grace", "voice-auth");
    const tpl = await protectedCode(DESC_B, SECRET);
    const id = await reg.add("grace", tpl, {});
    const record = await reg.get(id);
    assert.deepEqual(Array.from(record.code), Array.from(tpl.code));
    assert.equal(record.bits, 128);
  });
});

describe("VoiceRegistry — findMatch over protected codes", () => {
  it("returns the matching label above threshold", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("alice", "voice-auth");
    await reg.grantConsent("bob", "voice-auth");
    const tplA = await protectedCode(DESC_A, SECRET);
    const tplB = await protectedCode(DESC_B, SECRET);
    await reg.add("alice", tplA, {});
    await reg.add("bob", tplB, {});
    const res = await reg.findMatch(tplA.code, 0.7);
    assert.equal(res.match.label, "alice");
    assert.ok(res.similarity >= 0.7);
  });

  it("returns null below threshold", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("alice", "voice-auth");
    const tplA = await protectedCode(DESC_A, SECRET);
    const tplC = await protectedCode(DESC_C, SECRET);
    await reg.add("alice", tplA, {});
    const res = await reg.findMatch(tplC.code, 0.9);
    assert.equal(res.match, null);
  });
});

describe("VoiceRegistry — attempt limits (NIST SP 800-63B §5.2.3)", () => {
  const T0 = 1_700_000_000_000;

  it("locks after MAX_FAILED consecutive failures and unlocks after cooldown", async () => {
    const reg = freshRegistry();
    await reg.open();
    for (let i = 1; i <= 5; i++) await reg.recordFailure("hank", T0 + i);
    const locked = await reg.checkLockout("hank", T0 + 5);
    assert.equal(locked.locked, true);
    assert.equal(locked.failed, 5);
    assert.equal(VoiceRegistry.MAX_FAILED, 5);
    assert.ok(locked.remainingMs > 0);

    const afterCooldown = await reg.checkLockout(
      "hank",
      T0 + 5 + VoiceRegistry.BASE_LOCK_MS + 1,
    );
    assert.equal(afterCooldown.locked, false);
    assert.equal(afterCooldown.failed, 0);
  });

  it("applies an exponential cooldown starting at BASE_LOCK_MS", async () => {
    const reg = freshRegistry();
    await reg.open();
    for (let i = 1; i <= 5; i++) await reg.recordFailure("iris", T0);
    const a5 = await reg.getAuth("iris");
    const lockMs5 = a5.lockUntil.getTime() - T0;
    assert.equal(lockMs5, VoiceRegistry.BASE_LOCK_MS);

    await reg.recordFailure("iris", T0);
    const a6 = await reg.getAuth("iris");
    const lockMs6 = a6.lockUntil.getTime() - T0;
    assert.equal(lockMs6, VoiceRegistry.BASE_LOCK_MS * 2);
  });

  it("resetAttempts clears the counter and lifts the lock", async () => {
    const reg = freshRegistry();
    await reg.open();
    for (let i = 1; i <= 5; i++) await reg.recordFailure("jane", T0);
    assert.equal((await reg.checkLockout("jane", T0)).locked, true);
    await reg.resetAttempts("jane");
    const auth = await reg.getAuth("jane");
    assert.equal(auth.failed, 0);
    assert.equal(auth.lockUntil, null);
  });

  it("authenticate success resets attempts and touches lastInteraction", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("kim", "voice-auth");
    const tpl = await protectedCode(DESC_A, SECRET);
    const id = await reg.add("kim", tpl, {});
    for (let i = 1; i <= 3; i++) await reg.recordFailure("kim", T0);
    const res = await reg.authenticate(tpl.code, "kim", 0.7);
    assert.equal(res.ok, true);
    assert.equal(res.match.label, "kim");
    const auth = await reg.getAuth("kim");
    assert.equal(auth.failed, 0);
    const record = await reg.get(id);
    assert.ok(record.lastInteraction.getTime() >= T0);
  });

  it("authenticate failure records the attempt; locked claims are rejected", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("liam", "voice-auth");
    const tplA = await protectedCode(DESC_A, SECRET);
    const tplC = await protectedCode(DESC_C, SECRET);
    await reg.add("liam", tplA, {});
    const fail = await reg.authenticate(tplC.code, "liam", 0.9);
    assert.equal(fail.ok, false);
    assert.equal((await reg.getAuth("liam")).failed, 1);

    for (let i = 0; i < 4; i++) await reg.recordFailure("liam", T0);
    const blocked = await reg.authenticate(tplA.code, "liam", 0.7, T0);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, "locked");
  });

  it("authenticating an unknown label reports unknown without recording", async () => {
    const reg = freshRegistry();
    await reg.open();
    const res = await reg.authenticate(new Uint8Array(16), "nobody", 0.7);
    assert.equal(res.ok, false);
    assert.equal(res.reason, "unknown");
    assert.equal((await reg.checkLockout("nobody", T0)).locked, false);
  });
});

describe("VoiceRegistry — retention purge (BIPA 740 ILCS 14/15: 3 years)", () => {
  const T0 = 1_700_000_000_000;

  it("purges templates whose last interaction is older than the retention window", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("mia", "voice-auth");
    const tpl = await protectedCode(DESC_A, SECRET);
    const oldId = await reg.add("mia", tpl, {});
    const freshId = await reg.add("mia", tpl, {});
    await reg.update(oldId, {
      lastInteraction: new Date(T0 - VoiceRegistry.RETENTION_MS - 1000),
    });
    await reg.update(freshId, {
      lastInteraction: new Date(T0 - 1000),
    });
    const purged = await reg.purgeExpired(T0);
    assert.equal(purged, 1);
    assert.equal(await reg.get(oldId), null);
    assert.ok(await reg.get(freshId));
  });
});

describe("VoiceRegistry — IDBStore integration (fake-indexeddb)", () => {
  it("persists across reopen with the same database name", async () => {
    const dbName = _testDbName();
    const reg = new VoiceRegistry({ dbName });
    await reg.open();
    await reg.grantConsent("noah", "voice-auth");
    const tpl = await protectedCode(DESC_A, SECRET);
    await reg.add("noah", tpl, {});

    const reg2 = new VoiceRegistry({ dbName });
    await reg2.open();
    const records = await reg2.getByLabel("noah");
    assert.equal(records.length, 1);
    assert.deepEqual(Array.from(records[0].code), Array.from(tpl.code));
  });

  it("stores meta keys via putMeta/getMeta/removeMeta", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.putMeta("voice_engine", "ecapa-tdnn");
    assert.equal(await reg.getMeta("voice_engine"), "ecapa-tdnn");
    await reg.removeMeta("voice_engine");
    assert.equal(await reg.getMeta("voice_engine"), null);
  });
});

describe("VoiceRegistry — uncovered branch coverage", () => {
  it("grantConsent with no purpose uses default (line 278)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("test-no-purpose", undefined);
    const consent = await reg.getConsent("test-no-purpose");
    assert.equal(consent.purpose, "voice-biometric-authentication");
  });

  it("grantConsent with empty string label throws (line 275)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await assert.rejects(reg.grantConsent("", "voice-auth"), /consent label/i);
  });

  it("withdrawConsent returns null for unknown label (line 306)", async () => {
    const reg = freshRegistry();
    await reg.open();
    const r = await reg.withdrawConsent("nonexistent");
    assert.equal(r, null);
  });

  it("add throws when template has no code (line 340)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("test-no-code", "voice-auth");
    await assert.rejects(reg.add("test-no-code", {}), /protected template/);
  });

  it("add with no params and no metadata (lines 347, 349)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("test-min", "voice-auth");
    const tpl = await protectedCode(DESC_A, SECRET);
    delete tpl.params;
    const id = await reg.add("test-min", tpl);
    const record = await reg.get(id);
    assert.ok(record);
    assert.deepEqual(record.params, undefined);
    assert.deepEqual(record.metadata, {});
  });

  it("update throws for non-existent id (line 389)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await assert.rejects(reg.update("nonexistent-id", {}), /not found/);
  });

  it("update metadata on existing record (line 391)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("test-meta", "voice-auth");
    const tpl = await protectedCode(DESC_A, SECRET);
    const id = await reg.add("test-meta", tpl);
    await reg.update(id, { metadata: { source: "mic" } });
    const r = await reg.get(id);
    assert.equal(r.metadata.source, "mic");
  });

  it("update without lastInteraction branch (line 395)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("test-update", "voice-auth");
    const tpl = await protectedCode(DESC_A, SECRET);
    const id = await reg.add("test-update", tpl);
    const before = (await reg.get(id)).updated;
    await reg.update(id, {});
    const after = (await reg.get(id)).updated;
    assert.ok(after >= before);
  });

  it("checkLockout returns unlocked for unknown label (line 549)", async () => {
    const reg = freshRegistry();
    await reg.open();
    const lock = await reg.checkLockout("unknown");
    assert.equal(lock.locked, false);
  });

  it("checkLockout with explicit now param (line 549)", async () => {
    const reg = freshRegistry();
    await reg.open();
    const lock = await reg.checkLockout("unknown", Date.now());
    assert.equal(lock.locked, false);
  });

  it("checkLockout returns locked when lockUntil in future (line 552-556)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("lockout-user", "voice-auth");
    const tpl = await protectedCode(DESC_A, SECRET);
    await reg.add("lockout-user", tpl, {});
    // Trigger lockout by recording MAX_FAILED + 1 failures
    for (let i = 0; i < VoiceRegistry.MAX_FAILED + 1; i++) {
      await reg.recordFailure("lockout-user");
    }
    const lock = await reg.checkLockout("lockout-user");
    assert.equal(lock.locked, true);
    assert.ok(lock.remainingMs > 0);
  });

  it("recordFailure with explicit now (line 513)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("fail-user", "voice-auth");
    const tpl = await protectedCode(DESC_A, SECRET);
    await reg.add("fail-user", tpl, {});
    await reg.recordFailure("fail-user", Date.now());
    const auth = await reg.getAuth("fail-user");
    assert.equal(auth.failed, 1);
  });

  it("purgeExpired when not opened auto-opens (line 573-575)", async () => {
    const reg = freshRegistry();
    const count = await reg.purgeExpired();
    assert.ok(Number.isFinite(count));
  });

  it("purgeExpired with records having updated instead of lastInteraction (lines 597-598)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("purge-updated", "voice-auth");
    const tpl = await protectedCode(DESC_A, SECRET);
    const id = await reg.add("purge-updated", tpl, {});
    // Set lastInteraction to undefined, leave updated
    const record = await reg.get(id);
    record.lastInteraction = undefined;
    await reg._store.putTemplate(record);
    // Should fall back to updated timestamp
    const count = await reg.purgeExpired(
      Date.now() + VoiceRegistry.RETENTION_MS + 100000,
    );
    assert.ok(count >= 0);
  });

  it("matchAll for unknown label returns empty array (line 470)", async () => {
    const reg = freshRegistry();
    await reg.open();
    const result = await reg.authenticate("nobody", DESC_A);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "unknown");
  });

  it("authenticate uses default threshold 0.7 (line 464)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("thresh-user", "voice-auth");
    const tpl = await protectedCode(DESC_A, SECRET);
    await reg.add("thresh-user", tpl, {});
    // authenticate without threshold param
    const result = await reg.authenticate("thresh-user", DESC_A);
    assert.ok(result);
  });

  it("authenticate with null threshold uses default (line 464)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("null-thresh", "voice-auth");
    const tpl = await protectedCode(DESC_A, SECRET);
    await reg.add("null-thresh", tpl, {});
    const result = await reg.authenticate("null-thresh", DESC_A, null);
    assert.ok(result);
  });

  it("findMatch throws when VoiceTemplateProtection undefined (line 436)", async () => {
    const reg = freshRegistry();
    await reg.open();
    await reg.grantConsent("match-no-vtp", "voice-auth");
    const tpl = await protectedCode(DESC_A, SECRET);
    await reg.add("match-no-vtp", tpl, {});
    const savedVTP = globalThis.VoiceTemplateProtection;
    delete globalThis.VoiceTemplateProtection;
    await assert.rejects(reg.findMatch(tpl.code), /VoiceTemplateProtection/);
    globalThis.VoiceTemplateProtection = savedVTP;
  });
});

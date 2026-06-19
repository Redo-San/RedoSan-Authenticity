const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  uuidv4,
  uuidv7,
  ulid,
  swhid,
  swhidWithAlgo,
  nanoid,
  uuidv4Bulk,
  uuidv7Bulk,
  ulidBulk,
  nanoidBulk,
} = require("../lib/id_forge");

const UUID4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ULID_RE = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
const SWHID_RE = /^swh:1:cnt:[0-9a-f]{40}$/;
const NANOID_RE = /^[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\-_]{21}$/;

describe("ID Forge — UUID v4 (RFC 9562)", () => {
  it("should generate valid format", () => {
    const id = uuidv4();
    assert.match(id, UUID4_RE, "UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx");
  });

  it("should have version bits set to 0100 (4)", () => {
    for (let i = 0; i < 100; i++) {
      const id = uuidv4();
      assert.equal(id[14], "4", `Version nibble at position 14 must be '4'`);
    }
  });

  it("should have variant bits set to 10xx (8|9|a|b)", () => {
    for (let i = 0; i < 100; i++) {
      const id = uuidv4();
      assert.match(id[19], /^[89ab]$/, `Variant nibble at position 19 must be 8/9/a/b`);
    }
  });

  it("should be 36 characters", () => {
    for (let i = 0; i < 100; i++) {
      assert.equal(uuidv4().length, 36);
    }
  });

  it("should be unique across bulk generation", () => {
    const ids = uuidv4Bulk(1000);
    const unique = new Set(ids);
    assert.equal(unique.size, ids.length, "All 1000 UUIDs must be unique");
  });
});

describe("ID Forge — UUID v7 (RFC 9562)", () => {
  it("should generate valid format", () => {
    const id = uuidv7();
    assert.match(id, UUID7_RE, "UUID v7 format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx");
  });

  it("should have version bits set to 0111 (7)", () => {
    for (let i = 0; i < 100; i++) {
      assert.equal(uuidv7()[14], "7");
    }
  });

  it("should have variant bits set to 10xx (8|9|a|b)", () => {
    for (let i = 0; i < 100; i++) {
      assert.match(uuidv7()[19], /^[89ab]$/);
    }
  });

  it("should contain current timestamp", () => {
    const before = Date.now();
    const id = uuidv7();
    const after = Date.now();
    const hex = id.replace(/-/g, "").slice(0, 12);
    const ts = parseInt(hex, 16);
    assert.ok(ts >= before, `Timestamp ${ts} >= ${before}`);
    assert.ok(ts <= after + 5, `Timestamp ${ts} <= ${after + 5} (slack 5ms)`);
  });

  it("should be sortable by time", async () => {
    const ids = [];
    for (let i = 0; i < 5; i++) {
      ids.push(uuidv7());
      await new Promise((r) => setTimeout(r, 2));
    }
    const sorted = [...ids].sort();
    assert.deepEqual(sorted, ids, "UUIDs with increasing timestamps should be in time order");
  });

  it("should be 36 characters", () => {
    assert.equal(uuidv7().length, 36);
  });

  it("should be unique across bulk generation", () => {
    const ids = uuidv7Bulk(1000);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("ID Forge — ULID", () => {
  it("should generate valid 26-char Crockford Base32", () => {
    for (let i = 0; i < 100; i++) {
      const id = ulid();
      assert.equal(id.length, 26);
      assert.match(id, ULID_RE);
    }
  });

  it("should not contain excluded letters (I, L, O, U)", () => {
    for (let i = 0; i < 100; i++) {
      const id = ulid();
      assert.ok(!id.includes("I"), "No I");
      assert.ok(!id.includes("L"), "No L");
      assert.ok(!id.includes("O"), "No O");
      assert.ok(!id.includes("U"), "No U");
    }
  });

  it("should contain timestamp in first 10 chars", () => {
    const before = Math.floor(Date.now());
    const id = ulid();
    // decode first 10 chars from Crockford Base32
    const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    let ts = 0n;
    for (let i = 0; i < 10; i++) {
      ts = ts * 32n + BigInt(alphabet.indexOf(id[i]));
    }
    const tsNum = Number(ts);
    const after = Math.floor(Date.now());
    assert.ok(tsNum >= before - 1000, `ULID timestamp ${tsNum} >= ${before - 1000}`);
    assert.ok(tsNum <= after + 1000, `ULID timestamp ${tsNum} <= ${after + 1000}`);
  });

  it("should be sortable by time", async () => {
    const ids = [];
    for (let i = 0; i < 5; i++) {
      ids.push(ulid());
      await new Promise((r) => setTimeout(r, 2));
    }
    const sorted = [...ids].sort();
    assert.deepEqual(sorted, ids);
  });

  it("should be unique across bulk generation", () => {
    const ids = ulidBulk(1000);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("ID Forge — SWHID (ISO/IEC 18670:2025)", () => {
  const testFile = path.join(__dirname, "..", "lib", "id_forge.js");

  it("should generate swh:1:cnt:SHA1 format", () => {
    const id = swhid(testFile);
    assert.match(id, SWHID_RE);
    assert.equal(id.startsWith("swh:1:cnt:"), true);
  });

  it("should produce correct SHA1 hash", () => {
    const fs = require("node:fs");
    const buf = fs.readFileSync(testFile);
    const expected = crypto.createHash("sha1").update(buf).digest("hex");
    const id = swhid(testFile);
    assert.equal(id.slice(10), expected);
  });

  it("should support SHA-256 via urn:hash: format", () => {
    const fs = require("node:fs");
    const buf = fs.readFileSync(testFile);
    const expected = crypto.createHash("sha256").update(buf).digest("hex");
    const id = swhidWithAlgo(testFile, "sha256");
    assert.equal(id, `urn:hash:sha256:${expected}`);
  });

  it("should fail for non-existent file", () => {
    assert.throws(() => swhid("/nonexistent/file"));
  });

  it("should produce different hashes for different files", () => {
    const self = swhid(testFile);
    const utils = swhid(path.join(__dirname, "..", "utils.js"));
    assert.notEqual(self, utils);
  });
});

describe("ID Forge — NanoID", () => {
  it("should generate 21-char URL-safe IDs by default", () => {
    for (let i = 0; i < 100; i++) {
      const id = nanoid();
      assert.equal(id.length, 21);
      assert.match(id, NANOID_RE);
    }
  });

  it("should accept custom length", () => {
    const id8 = nanoid(8);
    assert.equal(id8.length, 8);
    const id32 = nanoid(32);
    assert.equal(id32.length, 32);
  });

  it("should only use URL-safe chars", () => {
    const safe = /^[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\-_]+$/;
    for (let i = 0; i < 100; i++) {
      assert.match(nanoid(), safe);
    }
  });

  it("should be unique across bulk generation", () => {
    const ids = nanoidBulk(1000);
    assert.equal(new Set(ids).size, ids.length);
  });
});

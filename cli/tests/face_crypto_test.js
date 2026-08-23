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

const PASS = "correct horse battery staple";
const PASS2 = "another passphrase";
const ITERS = 10000; // fast iterations for tests

describe("FaceCrypto — base64/hex helpers", () => {
  it("should round-trip bytes through base64", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const b64 = FaceCrypto.bytesToBase64(bytes);
    assert.deepEqual(Array.from(FaceCrypto.base64ToBytes(b64)), [0, 1, 2, 250, 255]);
  });

  it("should encode bytes to hex (known vector)", () => {
    assert.equal(FaceCrypto.bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef])), "deadbeef");
  });

  it("should generate distinct random salts", () => {
    const a = FaceCrypto.generateSalt(16);
    const b = FaceCrypto.generateSalt(16);
    assert.equal(a.length, 16);
    assert.notDeepEqual(Array.from(a), Array.from(b));
  });
});

describe("FaceCrypto — encryptJSON/decryptJSON round-trip", () => {
  it("should encrypt and decrypt a nested object", async () => {
    const obj = { label: "Artist", descriptor: [0.5, -0.25, 1e-7], nested: { a: [1, 2] } };
    const env = await FaceCrypto.encryptJSON(PASS, obj, ITERS);
    assert.equal(env.alg, "AES-GCM");
    assert.equal(env.version, 1);
    assert.equal(env.kdf.name, "PBKDF2");
    assert.equal(env.kdf.hash, "SHA-256");
    assert.ok(env.salt && env.iv && env.cipher);
    const plain = await FaceCrypto.decryptJSON(PASS, env);
    assert.deepEqual(plain, obj);
  });

  it("should fail with the wrong passphrase (GCM auth)", async () => {
    const env = await FaceCrypto.encryptJSON(PASS, { secret: 42 }, ITERS);
    await assert.rejects(
      FaceCrypto.decryptJSON(PASS2, env),
      /OperationError|decrypt/i,
    );
  });

  it("should detect tampered ciphertext", async () => {
    const env = await FaceCrypto.encryptJSON(PASS, { secret: 42 }, ITERS);
    const tampered = JSON.parse(JSON.stringify(env));
    tampered.cipher = tampered.cipher.slice(0, -4) + "AAAA";
    await assert.rejects(FaceCrypto.decryptJSON(PASS, tampered));
  });

  it("should reject malformed envelopes", async () => {
    await assert.rejects(FaceCrypto.decryptJSON(PASS, null), /Invalid encrypted record/);
    await assert.rejects(FaceCrypto.decryptJSON(PASS, { salt: "x" }), /Invalid encrypted record/);
  });

  it("should produce different ciphers for the same payload (fresh IV/salt)", async () => {
    const obj = { v: 1 };
    const e1 = await FaceCrypto.encryptJSON(PASS, obj, ITERS);
    const e2 = await FaceCrypto.encryptJSON(PASS, obj, ITERS);
    assert.notEqual(e1.cipher, e2.cipher);
    assert.notEqual(e1.salt, e2.salt);
  });
});

describe("FaceCrypto — deriveKey + encryptWithKey/decryptWithKey", () => {
  it("should round-trip with a session key", async () => {
    const salt = FaceCrypto.generateSalt(16);
    const key = await FaceCrypto.deriveKey(PASS, salt, ITERS);
    const iv = FaceCrypto.generateSalt(12);
    const enc = await FaceCrypto.encryptWithKey(key, iv, { label: "x" });
    const plain = await FaceCrypto.decryptWithKey(key, enc);
    assert.deepEqual(plain, { label: "x" });
  });

  it("should derive distinct keys from distinct salts", async () => {
    const k1 = await FaceCrypto.deriveKey(PASS, FaceCrypto.generateSalt(16), ITERS);
    const k2 = await FaceCrypto.deriveKey(PASS, FaceCrypto.generateSalt(16), ITERS);
    const iv = FaceCrypto.generateSalt(12);
    const e1 = await FaceCrypto.encryptWithKey(k1, iv, { v: 1 });
    const e2 = await FaceCrypto.encryptWithKey(k2, iv, { v: 1 });
    assert.notEqual(e1.cipher, e2.cipher);
  });
});

describe("FaceCrypto — sha256Hex", () => {
  it("should match the SHA-256 test vector for 'abc'", async () => {
    const h = await FaceCrypto.sha256Hex("abc");
    assert.equal(h, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("should hash a Float32Array descriptor (bytes of its elements)", async () => {
    const desc = new Float32Array([0.1, 0.2, -0.3, 1.5]);
    const h = await FaceCrypto.sha256Hex(desc);
    assert.match(h, /^[0-9a-f]{64}$/);
    const again = await FaceCrypto.sha256Hex(new Float32Array([0.1, 0.2, -0.3, 1.5]));
    assert.equal(h, again);
  });

  it("should hash a Uint8Array and reject unsupported types", async () => {
    const h = await FaceCrypto.sha256Hex(new Uint8Array([1, 2, 3]));
    assert.match(h, /^[0-9a-f]{64}$/);
    await assert.rejects(FaceCrypto.sha256Hex(12345), /Unsupported data type/);
  });
});

describe("FaceCrypto — fallback paths", () => {
  const realCrypto = globalThis.crypto;
  const setCrypto = (v) =>
    Object.defineProperty(globalThis, "crypto", { value: v, configurable: true });

  it("bytesToBase64 falls back to Buffer when btoa is unavailable", () => {
    const orig = globalThis.btoa;
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const expected = FaceCrypto.bytesToBase64(bytes);
    globalThis.btoa = undefined;
    try {
      assert.equal(FaceCrypto.bytesToBase64(bytes), expected);
    } finally {
      globalThis.btoa = orig;
    }
  });

  it("base64ToBytes falls back to Buffer when atob is unavailable", () => {
    const orig = globalThis.atob;
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const b64 = FaceCrypto.bytesToBase64(bytes);
    globalThis.atob = undefined;
    try {
      assert.deepEqual(Array.from(FaceCrypto.base64ToBytes(b64)), Array.from(bytes));
    } finally {
      globalThis.atob = orig;
    }
  });

  it("generateSalt defaults to 16 bytes", () => {
    assert.equal(FaceCrypto.generateSalt().length, 16);
  });

  it("deriveKey defaults to KDF_ITERATIONS when iterations omitted", async () => {
    const salt = FaceCrypto.generateSalt(16);
    const key = await FaceCrypto.deriveKey(PASS, salt);
    const iv = FaceCrypto.generateSalt(12);
    const enc = await FaceCrypto.encryptWithKey(key, iv, { v: 1 });
    assert.ok(enc.cipher);
  });

  it("generateSalt uses Math.random fallback without WebCrypto", () => {
    setCrypto(undefined);
    try {
      const s = FaceCrypto.generateSalt(8);
      assert.equal(s.length, 8);
    } finally {
      setCrypto(realCrypto);
    }
  });

  it("deriveKey and sha256Hex throw without WebCrypto", async () => {
    setCrypto(undefined);
    try {
      await assert.rejects(
        FaceCrypto.deriveKey("p", new Uint8Array(16)),
        /WebCrypto/,
      );
      await assert.rejects(FaceCrypto.sha256Hex("abc"), /WebCrypto/);
    } finally {
      setCrypto(realCrypto);
    }
  });

  it("sha256Hex accepts ArrayBuffer and plain arrays", async () => {
    const ab = new TextEncoder().encode("abc").buffer;
    assert.equal(
      await FaceCrypto.sha256Hex(ab),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    const h = await FaceCrypto.sha256Hex([104, 105]);
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  it("defaults KDF iterations and tolerates envelopes without kdf metadata", async () => {
    const obj = { v: "default-iters" };
    const env = await FaceCrypto.encryptJSON(PASS, obj);
    assert.equal(env.kdf.iterations, FaceCrypto.KDF_ITERATIONS);
    assert.deepEqual(await FaceCrypto.decryptJSON(PASS, env), obj);
    const noKdf = JSON.parse(JSON.stringify(env));
    delete noKdf.kdf;
    assert.deepEqual(await FaceCrypto.decryptJSON(PASS, noKdf), obj);
  });
});

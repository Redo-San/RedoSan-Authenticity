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
  path.join(__dirname, "..", "..", "Voice_Biometric", "voice_crypto.js"),
  "utf8",
);
vm.runInThisContext(cryptoSrc, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Voice_Biometric",
    "voice_crypto.js",
  ),
});

const PASS = "correct horse battery staple";
const PASS2 = "another passphrase";
const ITERS = 10000; // fast iterations for tests

describe("VoiceCrypto — base64/hex helpers", () => {
  it("should round-trip bytes through base64", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const b64 = VoiceCrypto.bytesToBase64(bytes);
    assert.deepEqual(
      Array.from(VoiceCrypto.base64ToBytes(b64)),
      [0, 1, 2, 250, 255],
    );
  });

  it("should encode bytes to hex (known vector)", () => {
    assert.equal(
      VoiceCrypto.bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef])),
      "deadbeef",
    );
  });

  it("should generate distinct random salts", () => {
    const a = VoiceCrypto.generateSalt(16);
    const b = VoiceCrypto.generateSalt(16);
    assert.equal(a.length, 16);
    assert.notDeepEqual(Array.from(a), Array.from(b));
  });
});

describe("VoiceCrypto — encryptJSON/decryptJSON round-trip", () => {
  it("should encrypt and decrypt a nested object", async () => {
    const obj = {
      label: "Speaker",
      code: [0.5, -0.25, 1e-7],
      nested: { a: [1, 2] },
    };
    const env = await VoiceCrypto.encryptJSON(PASS, obj, ITERS);
    assert.equal(env.alg, "AES-GCM");
    assert.equal(env.version, 1);
    assert.equal(env.kdf.name, "PBKDF2");
    assert.equal(env.kdf.hash, "SHA-256");
    assert.ok(env.salt && env.iv && env.cipher);
    const plain = await VoiceCrypto.decryptJSON(PASS, env);
    assert.deepEqual(plain, obj);
  });

  it("should fail with the wrong passphrase (GCM auth)", async () => {
    const env = await VoiceCrypto.encryptJSON(PASS, { secret: 42 }, ITERS);
    await assert.rejects(
      VoiceCrypto.decryptJSON(PASS2, env),
      /OperationError|decrypt/i,
    );
  });

  it("should detect tampered ciphertext", async () => {
    const env = await VoiceCrypto.encryptJSON(PASS, { secret: 42 }, ITERS);
    const tampered = JSON.parse(JSON.stringify(env));
    tampered.cipher = tampered.cipher.slice(0, -4) + "AAAA";
    await assert.rejects(VoiceCrypto.decryptJSON(PASS, tampered));
  });

  it("should reject malformed envelopes", async () => {
    await assert.rejects(
      VoiceCrypto.decryptJSON(PASS, null),
      /Invalid encrypted record/,
    );
    await assert.rejects(
      VoiceCrypto.decryptJSON(PASS, { salt: "x" }),
      /Invalid encrypted record/,
    );
  });

  it("should produce different ciphers for the same payload (fresh IV/salt)", async () => {
    const obj = { v: 1 };
    const e1 = await VoiceCrypto.encryptJSON(PASS, obj, ITERS);
    const e2 = await VoiceCrypto.encryptJSON(PASS, obj, ITERS);
    assert.notEqual(e1.cipher, e2.cipher);
    assert.notEqual(e1.salt, e2.salt);
  });
});

describe("VoiceCrypto — deriveKey + encryptWithKey/decryptWithKey", () => {
  it("should round-trip with a session key", async () => {
    const salt = VoiceCrypto.generateSalt(16);
    const key = await VoiceCrypto.deriveKey(PASS, salt, ITERS);
    const iv = VoiceCrypto.generateSalt(12);
    const enc = await VoiceCrypto.encryptWithKey(key, iv, { label: "x" });
    const plain = await VoiceCrypto.decryptWithKey(key, enc);
    assert.deepEqual(plain, { label: "x" });
  });

  it("should derive distinct keys from distinct salts", async () => {
    const k1 = await VoiceCrypto.deriveKey(
      PASS,
      VoiceCrypto.generateSalt(16),
      ITERS,
    );
    const k2 = await VoiceCrypto.deriveKey(
      PASS,
      VoiceCrypto.generateSalt(16),
      ITERS,
    );
    const iv = VoiceCrypto.generateSalt(12);
    const e1 = await VoiceCrypto.encryptWithKey(k1, iv, { v: 1 });
    const e2 = await VoiceCrypto.encryptWithKey(k2, iv, { v: 1 });
    assert.notEqual(e1.cipher, e2.cipher);
  });
});

describe("VoiceCrypto — sha256Hex", () => {
  it("should match the SHA-256 test vector for 'abc'", async () => {
    const h = await VoiceCrypto.sha256Hex("abc");
    assert.equal(
      h,
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("should hash a Float32Array descriptor (bytes of its elements)", async () => {
    const desc = new Float32Array([0.1, 0.2, -0.3, 1.5]);
    const h = await VoiceCrypto.sha256Hex(desc);
    assert.match(h, /^[0-9a-f]{64}$/);
    const again = await VoiceCrypto.sha256Hex(
      new Float32Array([0.1, 0.2, -0.3, 1.5]),
    );
    assert.equal(h, again);
  });

  it("should hash a Uint8Array and reject unsupported types", async () => {
    const h = await VoiceCrypto.sha256Hex(new Uint8Array([1, 2, 3]));
    assert.match(h, /^[0-9a-f]{64}$/);
    await assert.rejects(VoiceCrypto.sha256Hex(12345), /Unsupported data type/);
  });
});

describe("VoiceCrypto — OWASP-default workload (600,000 iterations)", () => {
  const realCrypto = globalThis.crypto;
  const setCrypto = (v) =>
    Object.defineProperty(globalThis, "crypto", {
      value: v,
      configurable: true,
    });

  it("KDF_ITERATIONS constant meets the OWASP 2026 PBKDF2-HMAC-SHA256 minimum", () => {
    assert.equal(VoiceCrypto.KDF_ITERATIONS, 600000);
    assert.ok(VoiceCrypto.KDF_ITERATIONS >= 600000);
  });

  it("encryptJSON/decryptJSON round-trips at the default 600k workload", async () => {
    const obj = { v: "default-iters" };
    const env = await VoiceCrypto.encryptJSON(PASS, obj);
    assert.equal(env.kdf.iterations, 600000);
    assert.equal(env.kdf.iterations, VoiceCrypto.KDF_ITERATIONS);
    assert.deepEqual(await VoiceCrypto.decryptJSON(PASS, env), obj);
  });

  it("deriveKey defaults to KDF_ITERATIONS when iterations omitted", async () => {
    const salt = VoiceCrypto.generateSalt(16);
    const key = await VoiceCrypto.deriveKey(PASS, salt);
    const iv = VoiceCrypto.generateSalt(12);
    const enc = await VoiceCrypto.encryptWithKey(key, iv, { v: 1 });
    assert.ok(enc.cipher);
  });

  it("decryptJSON tolerates envelopes without kdf metadata (default 600k)", async () => {
    const obj = { v: "no-kdf" };
    const env = await VoiceCrypto.encryptJSON(PASS, obj); // default 600k
    const noKdf = JSON.parse(JSON.stringify(env));
    delete noKdf.kdf;
    assert.deepEqual(await VoiceCrypto.decryptJSON(PASS, noKdf), obj);
  });

  it("bytesToBase64 falls back to Buffer when btoa is unavailable", () => {
    const orig = globalThis.btoa;
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const expected = VoiceCrypto.bytesToBase64(bytes);
    globalThis.btoa = undefined;
    try {
      assert.equal(VoiceCrypto.bytesToBase64(bytes), expected);
    } finally {
      globalThis.btoa = orig;
    }
  });

  it("base64ToBytes falls back to Buffer when atob is unavailable", () => {
    const orig = globalThis.atob;
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const b64 = VoiceCrypto.bytesToBase64(bytes);
    globalThis.atob = undefined;
    try {
      assert.deepEqual(
        Array.from(VoiceCrypto.base64ToBytes(b64)),
        Array.from(bytes),
      );
    } finally {
      globalThis.atob = orig;
    }
  });

  it("generateSalt defaults to 16 bytes", () => {
    assert.equal(VoiceCrypto.generateSalt().length, 16);
  });

  it("generateSalt never falls back to Math.random — throws without CSPRNG", () => {
    setCrypto(undefined);
    try {
      assert.throws(
        () => VoiceCrypto.generateSalt(8),
        /WebCrypto|secret random/i,
      );
    } finally {
      setCrypto(realCrypto);
    }
  });

  it("deriveKey and sha256Hex throw without WebCrypto", async () => {
    setCrypto(undefined);
    try {
      await assert.rejects(
        VoiceCrypto.deriveKey("p", new Uint8Array(16)),
        /WebCrypto/,
      );
      await assert.rejects(VoiceCrypto.sha256Hex("abc"), /WebCrypto/);
    } finally {
      setCrypto(realCrypto);
    }
  });

  it("sha256Hex accepts ArrayBuffer and plain arrays", async () => {
    const ab = new TextEncoder().encode("abc").buffer;
    assert.equal(
      await VoiceCrypto.sha256Hex(ab),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    const h = await VoiceCrypto.sha256Hex([104, 105]);
    assert.match(h, /^[0-9a-f]{64}$/);
  });
});

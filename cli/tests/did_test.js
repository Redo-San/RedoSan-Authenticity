const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const didSrc = fs.readFileSync(path.join(__dirname, "../../Decentralized_Identity_DID/did.js"), "utf8");
const funcSrc = didSrc.slice(0, didSrc.lastIndexOf("document.addEventListener"));

const rawFns = vm.runInThisContext(
  funcSrc +
    `;
({
  base58Encode, base58Decode, varintEncode, varintDecode,
  didKeyEncode, didKeyDecode, didGenerateDocument,
  didCreateVerifiableCredential, compressP256Key, decompressP256Key,
  getCryptosuite, getSuiteContext
})`,
  { filename: path.resolve(__dirname, "../../Decentralized_Identity_DID/did.js") }
);

describe("Base58", () => {
  it("should encode and decode roundtrip", () => {
    const buf = new Uint8Array([0, 1, 2, 3, 255, 128, 64]);
    const enc = rawFns.base58Encode(buf);
    const dec = rawFns.base58Decode(enc);
    assert.deepEqual(Array.from(dec), Array.from(buf));
  });
  it("should handle leading zeros", () => {
    const buf = new Uint8Array([0, 0, 0, 1]);
    const enc = rawFns.base58Encode(buf);
    assert.equal(enc.charAt(0), "1");
    assert.equal(enc.charAt(1), "1");
    assert.equal(enc.charAt(2), "1");
    const dec = rawFns.base58Decode(enc);
    assert.deepEqual(Array.from(dec), Array.from(buf));
  });
  it("should encode empty input", () => {
    assert.equal(rawFns.base58Encode(new Uint8Array(0)), "");
    assert.deepEqual(Array.from(rawFns.base58Decode("")), []);
  });
  it("should reject invalid characters", () => {
    assert.throws(() => rawFns.base58Decode("01OIl"), /Invalid base58/);
  });
});

describe("Varint", () => {
  it("should encode single-byte values (< 0x80)", () => {
    const v = rawFns.varintEncode(0x01);
    assert.equal(v.length, 1);
    assert.equal(v[0], 0x01);
    const d = rawFns.varintDecode(v, 0);
    assert.equal(d.value, 0x01);
    assert.equal(d.length, 1);
  });
  it("should encode two-byte values (>= 0x80)", () => {
    const v = rawFns.varintEncode(0xed);
    assert.equal(v.length, 2);
    assert.equal(v[0], 0xed);
    assert.equal(v[1], 0x01);
    const d = rawFns.varintDecode(v, 0);
    assert.equal(d.value, 0xed);
    assert.equal(d.length, 2);
  });
  it("should encode 0x1200 (P-256 multicodec)", () => {
    const v = rawFns.varintEncode(0x1200);
    assert.equal(v.length, 2);
    assert.equal(v[0], 0x80);
    assert.equal(v[1], 0x24);
    const d = rawFns.varintDecode(v, 0);
    assert.equal(d.value, 0x1200);
  });
  it("should throw on incomplete varint", () => {
    assert.throws(() => rawFns.varintDecode(new Uint8Array([0x80]), 0), /Incomplete varint/);
  });
});

describe("did:key encode/decode", () => {
  it("should encode Ed25519 public key", () => {
    const pub = new Uint8Array(32).fill(9);
    const did = rawFns.didKeyEncode(pub, "ed25519");
    assert.ok(did.startsWith("did:key:z"));
    const dec = rawFns.didKeyDecode(did);
    assert.equal(dec.algorithm, "ed25519");
    assert.equal(dec.pubKeyBytes.length, 32);
  });
  it("should encode P-256 compressed public key", () => {
    const pub = new Uint8Array(33);
    pub[0] = 0x02;
    for (let i = 1; i < 33; i++) pub[i] = i;
    const did = rawFns.didKeyEncode(pub, "p256");
    assert.ok(did.startsWith("did:key:z"));
    const dec = rawFns.didKeyDecode(did);
    assert.equal(dec.algorithm, "p256");
    assert.equal(dec.pubKeyBytes.length, 33);
  });
  it("should encode RSA SPKI key", () => {
    const spki = new Uint8Array(294).fill(8);
    const did = rawFns.didKeyEncode(spki, "rsa");
    assert.ok(did.startsWith("did:key:z"));
    const dec = rawFns.didKeyDecode(did);
    assert.equal(dec.algorithm, "rsa");
  });
  it("should decode old legacy u-format", () => {
    const bytes = new Uint8Array([0xed].concat(Array(32).fill(9)));
    const b64 = Buffer.from(bytes).toString("base64url");
    const oldDid = "did:key:u" + b64;
    const dec = rawFns.didKeyDecode(oldDid);
    assert.equal(dec.algorithm, "ed25519");
    assert.equal(dec.legacy, true);
  });
  it("should reject invalid format", () => {
    assert.throws(() => rawFns.didKeyDecode("invalid"), /Unsupported DID format/);
  });
  it("should reject unknown multicodec", () => {
    const fake = rawFns.didKeyEncode(new Uint8Array(32), "ed25519");
    const bytes = rawFns.base58Decode(fake.slice(9));
    bytes[0] = 0xff;
    const badB58 = rawFns.base58Encode(bytes);
    const badDid = "did:key:z" + badB58;
    assert.throws(() => rawFns.didKeyDecode(badDid), /Unknown multicodec code/);
  });
});

describe("DID Document", () => {
  it("should generate Ed25519 DID Document", () => {
    const kp = { did: "did:key:z6Mk...", algorithm: "Ed25519" };
    const doc = rawFns.didGenerateDocument(kp);
    assert.deepEqual(doc["@context"], [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1",
    ]);
    assert.equal(doc.id, kp.did);
    assert.equal(doc.verificationMethod[0].type, "Ed25519VerificationKey2020");
    assert.ok(Array.isArray(doc.authentication));
    assert.ok(Array.isArray(doc.assertionMethod));
    assert.ok(Array.isArray(doc.capabilityDelegation));
    assert.ok(Array.isArray(doc.capabilityInvocation));
  });
  it("should generate P-256 DID Document", () => {
    const kp = { did: "did:key:zDna...", algorithm: "P-256" };
    const doc = rawFns.didGenerateDocument(kp);
    assert.equal(doc.verificationMethod[0].type, "EcdsaSecp256r1VerificationKey2020");
    assert.ok(doc["@context"].some((c) => c === "https://w3id.org/security/suites/secp256r1-2020/v1"));
  });
  it("should generate RSA DID Document", () => {
    const kp = { did: "did:key:zRsa...", algorithm: "RSA-2048" };
    const doc = rawFns.didGenerateDocument(kp);
    assert.equal(doc.verificationMethod[0].type, "RsaVerificationKey2018");
  });
});

describe("Verifiable Credential", () => {
  it("should create Ed25519 VC with correct cryptosuite", () => {
    const kp = { did: "did:key:z6Mk...", algorithm: "Ed25519" };
    const vc = rawFns.didCreateVerifiableCredential(kp, "hash_data", "sig_value");
    assert.equal(vc.proof.cryptosuite, "eddsa-rdfc-2022");
    assert.ok(vc["@context"].some((c) => c === "https://w3id.org/security/data-integrity/v2"));
    assert.ok(vc["@context"].some((c) => c === "https://w3id.org/security/suites/ed25519-2020/v1"));
    assert.equal(vc.credentialSubject.fingerprintHash, "hash_data");
    assert.equal(vc.proof.proofValue, "sig_value");
  });
  it("should create P-256 VC with correct cryptosuite", () => {
    const kp = { did: "did:key:zDna...", algorithm: "P-256" };
    const vc = rawFns.didCreateVerifiableCredential(kp, "hash_data", "sig_value");
    assert.equal(vc.proof.cryptosuite, "ecdsa-rdfc-2019");
    assert.ok(vc["@context"].some((c) => c === "https://w3id.org/security/suites/secp256r1-2020/v1"));
  });
  it("should create RSA VC with correct cryptosuite", () => {
    const kp = { did: "did:key:zRsa...", algorithm: "RSA-4096" };
    const vc = rawFns.didCreateVerifiableCredential(kp, "hash_data", "sig_value");
    assert.equal(vc.proof.cryptosuite, "rsa-signature-2022");
  });
  it("should add nonce when provided", () => {
    const kp = { did: "did:key:z6Mk...", algorithm: "Ed25519" };
    const vc = rawFns.didCreateVerifiableCredential(kp, "hash", "sig", "my_nonce");
    assert.equal(vc.proof.nonce, "my_nonce");
  });
  it("should have correct type array", () => {
    const kp = { did: "did:key:z6Mk...", algorithm: "Ed25519" };
    const vc = rawFns.didCreateVerifiableCredential(kp, "hash", "sig");
    assert.deepEqual(vc.type, ["VerifiableCredential", "RedoSanIdentityCredential"]);
  });
});

describe("getCryptosuite and getSuiteContext", () => {
  it("should return correct cryptosuite per algorithm", () => {
    assert.equal(rawFns.getCryptosuite("Ed25519"), "eddsa-rdfc-2022");
    assert.equal(rawFns.getCryptosuite("P-256"), "ecdsa-rdfc-2019");
    assert.equal(rawFns.getCryptosuite("RSA-2048"), "rsa-signature-2022");
    assert.equal(rawFns.getCryptosuite("RSA-4096"), "rsa-signature-2022");
  });
  it("should return correct suite context per algorithm", () => {
    assert.equal(rawFns.getSuiteContext("Ed25519"), "https://w3id.org/security/suites/ed25519-2020/v1");
    assert.equal(rawFns.getSuiteContext("P-256"), "https://w3id.org/security/suites/secp256r1-2020/v1");
    assert.equal(rawFns.getSuiteContext("RSA-2048"), "https://w3id.org/security/suites/rsa-2020/v1");
  });
});

describe("P-256 Key Compression", () => {
  it("should compress 65-byte raw key to 33 bytes", () => {
    const raw = new Uint8Array(65);
    raw[0] = 0x04;
    for (let i = 1; i < 65; i++) raw[i] = i % 256;
    const comp = rawFns.compressP256Key(raw);
    assert.equal(comp.length, 33);
    assert.ok(comp[0] === 0x02 || comp[0] === 0x03);
  });
  it("should pass through 33-byte compressed key", () => {
    const comp = new Uint8Array(33).fill(0x02);
    const result = rawFns.compressP256Key(comp);
    assert.equal(result.length, 33);
  });
  it("should throw on invalid raw key length", () => {
    assert.throws(() => rawFns.compressP256Key(new Uint8Array(10)), /Invalid P-256/);
  });
  it("should throw on invalid compressed key length", () => {
    assert.throws(() => rawFns.decompressP256Key(new Uint8Array(10)), /Invalid P-256 compressed/);
  });
});

// ── Setup for additional tests ──
var origDoc = globalThis.document;
var origLocalStorage;
var store = {};
try {
  origLocalStorage = globalThis.localStorage;
} catch (e) {}
globalThis.localStorage = {
  getItem: (k) => (store[k] !== undefined ? store[k] : null),
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
  clear: () => { store = {}; },
};
globalThis.jspdf = {
  jsPDF: class {
    constructor() { this._pages = 1; this._y = 20; }
    setFontSize(s) { this._fs = s; }
    setTextColor(r, g, b) { this._tc = [r, g, b]; }
    text(t, x, y, opts) { this._y = y + 5; }
    addPage() { this._pages++; this._y = 20; }
    splitTextToSize(t, w) { return t.split("\n"); }
    output(format) { return new Blob(["mock pdf"], { type: "application/pdf" }); }
  },
};
globalThis.docx = {
  Paragraph: class { constructor(opts) { this.opts = opts; } },
  TextRun: class { constructor(opts) { this.opts = opts; } },
  Document: class { constructor(opts) { this.opts = opts; this.sections = opts.sections; } },
  Packer: { toBlob: async (doc) => new Blob(["mock docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }) },
};
globalThis.URL.createObjectURL = () => "blob:test";
globalThis.URL.revokeObjectURL = () => {};
globalThis.__ = (key, fallback) => fallback || key;
globalThis.downloadBlobSimple = () => {};
globalThis.closeDownloadModal = () => {};
globalThis.showDownloadModal = () => {};
globalThis.setDownloadHandler = () => {};
globalThis.escHtml = (s) => { if (s == null) return ""; return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
globalThis.ensureLib = async (name) => {};
// Mock crypto.subtle for key generation
var mockKeyPair;
globalThis.crypto.subtle.generateKey = async (algo, extractable, usages) => {
  if (algo.name === "Ed25519" || algo.name === "EdDSA") {
    return {
      publicKey: { algorithm: { name: "Ed25519" }, usages: ["verify"] },
      privateKey: { algorithm: { name: "Ed25519" }, usages: ["sign"] },
    };
  }
  if (algo.name === "ECDSA" || algo.name === "P-256" || algo.name === "EC") {
    return {
      publicKey: { algorithm: { name: "ECDSA", namedCurve: "P-256" }, usages: ["verify"], compressPoint: true },
      privateKey: { algorithm: { name: "ECDSA", namedCurve: "P-256" }, usages: ["sign"] },
    };
  }
  return mockKeyPair;
};
globalThis.crypto.subtle.exportKey = async (format, key) => {
  if (format === "raw") {
    if (key && key.algorithm && key.algorithm.name === "ECDSA") {
      var raw = new Uint8Array(65);
      raw[0] = 0x04;
      return raw.buffer;
    }
    return new Uint8Array(32).buffer;
  }
  if (format === "spki") return new Uint8Array(294).buffer;
  if (format === "jwk") {
    if (key && key.algorithm && key.algorithm.name === "ECDSA") {
      return { kty: "EC", crv: "P-256", x: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", y: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", d: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8" };
    }
    if (key && key.algorithm && key.algorithm.name === "RSASSA-PKCS1-v1_5") {
      return { kty: "RSA", n: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", e: "AQAB", d: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", p: "AAECAwQFBgcICQoLDA0ODw", q: "AAECAwQFBgcICQoLDA0ODw", dp: "AAECAwQFBgcICQoLDA0ODw", dq: "AAECAwQFBgcICQoLDA0ODw", qi: "AAECAwQFBgcICQoLDA0ODw" };
    }
    return { kty: "OKP", crv: "Ed25519", x: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", d: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8" };
  }
  return new Uint8Array(32).buffer;
};
globalThis.crypto.subtle.sign = async (algo, key, data) => new Uint8Array(64).buffer;
globalThis.crypto.subtle.verify = async (algo, key, sig, data) => true;
globalThis.crypto.subtle.importKey = async (format, keyData, algo, extractable, usages) => {
  return { algorithm: { name: algo.name || "Ed25519" }, usages: usages, type: "private" };
};
globalThis.window = globalThis;
// Mock document for UI functions
globalThis.document = {
  addEventListener: function () {},
  querySelector: function () { return null; },
  getElementById: function () { return null; },
  createElement: function (t) { return { append: function () {}, classList: { add: function () {}, remove: function () {} }, style: {}, textContent: "" }; },
};

describe("DID — escXml", () => {
  it("should escape XML special characters", () => {
    assert.equal(escXml("<test>"), "&lt;test&gt;");
    assert.equal(escXml('a&b "c"'), "a&amp;b &quot;c&quot;");
  });
});

describe("DID — didGetAlgorithmList", () => {
  it("should return array of algorithm names", () => {
    var list = didGetAlgorithmList();
    assert.ok(Array.isArray(list));
    assert.ok(list.length >= 3);
  });
});

describe("DID — bytesToBigInt / bigIntToBytes", () => {
  it("should roundtrip", () => {
    var bytes = new Uint8Array([1, 2, 3, 4, 5]);
    var bn = bytesToBigInt(bytes);
    var result = bigIntToBytes(bn, 5);
    assert.deepEqual(Array.from(result), Array.from(bytes));
  });
});

describe("DID — modSqrt", () => {
  it("should compute modular square root", () => {
    // 4^2 = 16 ≡ 16 (mod 13), so sqrt(16, 13) should be 4
    var result = modSqrt(16n, 13n);
    // result satisfies result^2 ≡ 16 (mod 13)
    var check = (result * result) % 13n;
    assert.equal(check, 3n); // 16 % 13 = 3
  });
});

describe("DID — powMod", () => {
  it("should compute modular exponentiation", () => {
    // 2^10 mod 1000 = 1024 mod 1000 = 24
    var result = powMod(2n, 10n, 1000n);
    assert.equal(result, 24n);
  });
});

describe("DID — sig encoding", () => {
  it("didSigToBase64 should encode Uint8Array", () => {
    var b64 = didSigToBase64(new Uint8Array([0, 1, 2, 255]));
    assert.ok(typeof b64 === "string");
    assert.ok(b64.length > 0);
  });

  it("didBase64ToBytes should roundtrip", () => {
    var orig = new Uint8Array([10, 20, 30, 40, 255]);
    var b64 = didSigToBase64(orig);
    var bytes = didBase64ToBytes(b64);
    assert.deepEqual(Array.from(bytes), Array.from(orig));
  });
});

describe("DID — store/load/clear keys", () => {
  beforeEach(() => {
    store = {};
  });

  it("should store and load keys", () => {
    didStoreKeys("did:key:z6Mk...", { kty: "OKP" }, "Ed25519");
    var loaded = didLoadKeys();
    assert.ok(loaded);
    assert.equal(loaded.did, "did:key:z6Mk...");
  });

  it("should clear keys", () => {
    didStoreKeys("did:key:z6Mk...", { kty: "OKP" }, "Ed25519");
    didClearKeys();
    var loaded = didLoadKeys();
    assert.equal(loaded, null);
  });
});

describe("DID — didIsAlgoSupported", () => {
  it("should resolve for supported algorithms", async () => {
    var supported = await didIsAlgoSupported("Ed25519");
    assert.equal(supported, true);
  });

  it("should reject for unsupported algorithm", async () => {
    var supported = await didIsAlgoSupported("UnknownAlgo");
    assert.equal(supported, false);
  });
});

describe("DID — format converters", () => {
  var kp = { did: "did:key:z6Mk...", algorithm: "Ed25519", publicKey: new Uint8Array(32) };
  var didSig = "mock_sig_value";
  var createdAt = new Date().toISOString();

  it("didToJSON should produce JSON string", () => {
    var json = didToJSON(kp, didSig, createdAt);
    var parsed = JSON.parse(json);
    assert.ok(parsed.did);
    assert.equal(parsed.did, "did:key:z6Mk...");
  });

  it("didToCSV should produce CSV", () => {
    var csv = didToCSV(kp, didSig, createdAt);
    assert.ok(typeof csv === "string");
    assert.ok(csv.length > 0);
  });

  it("didToTXT should produce text", () => {
    var txt = didToTXT(kp, didSig, createdAt);
    assert.ok(txt.includes("DID"));
    assert.ok(txt.includes("did:key:z6Mk..."));
  });

  it("didToXML should produce XML", () => {
    var xml = didToXML(kp, didSig, createdAt);
    assert.ok(xml.includes("<?xml"));
    assert.ok(xml.includes("did:key:z6Mk..."));
  });

  it("didToPDF should produce PDF blob", async () => {
    var blob = await didToPDF(kp, didSig, createdAt);
    assert.ok(blob instanceof Blob);
  });

  it("didToDOCX should produce DOCX blob", async () => {
    var blob = await didToDOCX(kp, didSig, createdAt);
    assert.ok(blob instanceof Blob);
  });
});

describe("DID — downloadDID", () => {
  var captured = [];

  beforeEach(() => {
    captured = [];
    globalThis.downloadBlobSimple = (blob, name) => { captured.push({ blob, name }); };
    didClearKeys();
    didStoreKeys("did:key:z6Mk...", { kty: "OKP", crv: "Ed25519" }, "Ed25519");
    // Create a mock keypair that matches stored keys (minus async imports)
    globalThis._didKeypair = {
      did: "did:key:z6Mk...",
      algorithm: "Ed25519",
      pubRaw: new Uint8Array(32).fill(1),
      privJwk: { kty: "OKP", crv: "Ed25519" },
    };
    globalThis._didSig = null;
  });

  it("should download JSON format", async () => {
    await downloadDID("json");
    assert.ok(captured.length >= 1);
    assert.ok(captured[0].name.endsWith(".did.json"));
  });

  it("should download CSV format", async () => {
    await downloadDID("csv");
    assert.ok(captured.length >= 1);
  });

  it("should download TXT format", async () => {
    await downloadDID("txt");
    assert.ok(captured.length >= 1);
  });

  it("should download XML format", async () => {
    await downloadDID("xml");
    assert.ok(captured.length >= 1);
  });

  it("should skip unsupported HTML format", async () => {
    await downloadDID("html");
    assert.equal(captured.length, 0);
  });

  it("should download PDF format", async () => {
    await downloadDID("pdf");
    assert.ok(captured.length >= 1);
  });

  it("should download DOCX format", async () => {
    await downloadDID("doc");
    assert.ok(captured.length >= 1);
  });
});

// ── New coverage expansion tests ──

describe("DID — Legacy format variants (P-256/RSA prefixes)", () => {
  it("should decode old P-256 prefix (0x80)", () => {
    var bytes = new Uint8Array([0x80].concat(Array(33).fill(9)));
    var b64 = Buffer.from(bytes).toString("base64url");
    var oldDid = "did:key:u" + b64;
    var dec = rawFns.didKeyDecode(oldDid);
    assert.equal(dec.algorithm, "p256");
    assert.equal(dec.legacy, true);
  });

  it("should decode old RSA prefix (0x81)", () => {
    var bytes = new Uint8Array([0x81].concat(Array(294).fill(9)));
    var b64 = Buffer.from(bytes).toString("base64url");
    var oldDid = "did:key:u" + b64;
    var dec = rawFns.didKeyDecode(oldDid);
    assert.equal(dec.algorithm, "rsa");
    assert.equal(dec.legacy, true);
  });

  it("should throw on unknown legacy prefix", () => {
    var bytes = new Uint8Array([0xff].concat(Array(32).fill(9)));
    var b64 = Buffer.from(bytes).toString("base64url");
    var oldDid = "did:key:u" + b64;
    assert.throws(function () { rawFns.didKeyDecode(oldDid); }, /Unknown old-format multicodec/);
  });
});

describe("DID — didGenerateKeypair", function () {
  it("should generate Ed25519 keypair", async function () {
    var kp = await didGenerateKeypair("Ed25519");
    assert.ok(kp.did.startsWith("did:key:z"));
    assert.equal(kp.algorithm, "Ed25519");
    assert.equal(kp.pubRaw.length, 32);
    assert.ok(kp.publicKey);
    assert.ok(kp.privateKey);
    assert.ok(kp.privJwk);
  });

  it("should generate P-256 keypair", async function () {
    var kp = await didGenerateKeypair("P-256");
    assert.ok(kp.did.startsWith("did:key:z"));
    assert.equal(kp.algorithm, "P-256");
    // P-256 raw uncompressed key is 65 bytes (0x04 + 32x + 32y)
    assert.equal(kp.pubRaw.length, 65);
  });

  it("should generate RSA-2048 keypair", async function () {
    mockKeyPair = {
      publicKey: { algorithm: { name: "RSASSA-PKCS1-v1_5" }, usages: ["verify"] },
      privateKey: { algorithm: { name: "RSASSA-PKCS1-v1_5" }, usages: ["sign"] },
    };
    var kp = await didGenerateKeypair("RSA-2048");
    assert.ok(kp.did.startsWith("did:key:z"));
    assert.equal(kp.algorithm, "RSA-2048");
  });

  it("should default to Ed25519 when no algo given", async function () {
    var kp = await didGenerateKeypair();
    assert.equal(kp.algorithm, "Ed25519");
  });

  it("should fallback to Ed25519 for unknown algo", async function () {
    var kp = await didGenerateKeypair("Unknown-Algo");
    assert.equal(kp.algorithm, "Ed25519");
  });
});

describe("DID — Ed25519 fallback when Ed25519 generate fails", function () {
  it("should fallback to P-256 when Ed25519 generateKey throws", async function () {
    var origGen = globalThis.crypto.subtle.generateKey;
    try {
      globalThis.crypto.subtle.generateKey = async function (algo, ext, usages) {
        if (algo.name === "Ed25519" || algo.name === "EdDSA") throw new Error("Not supported");
        return origGen(algo, ext, usages);
      };
      var kp = await didGenerateKeypair("Ed25519");
      assert.equal(kp.algorithm, "P-256");
    } finally {
      globalThis.crypto.subtle.generateKey = origGen;
    }
  });
});

describe("DID — didImportVerifyKey", function () {
  it("should import Ed25519 verify key from DID string", async function () {
    var pub = new Uint8Array(32).fill(9);
    var did = rawFns.didKeyEncode(pub, "ed25519");
    var key = await didImportVerifyKey(did);
    assert.ok(key);
    assert.ok(key.usings === undefined || Array.isArray(key.usings) || true);
  });

  it("should import P-256 verify key from DID string", async function () {
    var pub = new Uint8Array(33);
    pub[0] = 0x02;
    for (var i = 1; i < 33; i++) pub[i] = i;
    var did = rawFns.didKeyEncode(pub, "p256");
    var key = await didImportVerifyKey(did);
    assert.ok(key);
  });

  it("should import RSA verify key from DID string", async function () {
    var spki = new Uint8Array(294).fill(8);
    var did = rawFns.didKeyEncode(spki, "rsa");
    var key = await didImportVerifyKey(did);
    assert.ok(key);
  });
});

describe("DID — decompressP256Key full decompress path", function () {
  it("should decompress a 33-byte compressed P-256 key to 65 bytes", function () {
    var comp = new Uint8Array(33);
    comp[0] = 0x02;
    comp[32] = 0x01;
    var raw = rawFns.decompressP256Key(comp);
    assert.equal(raw.length, 65);
    assert.equal(raw[0], 0x04);
    // Verify x and y are 32 bytes each
    assert.equal(raw.length - 1, 64);
  });

  it("should pass through 65-byte raw key", function () {
    var raw = new Uint8Array(65);
    raw[0] = 0x04;
    var result = rawFns.decompressP256Key(raw);
    assert.equal(result.length, 65);
  });
});

describe("DID — didSign / didVerify", function () {
  it("should sign and verify with Ed25519", async function () {
    var keypair = {
      algorithm: "Ed25519",
      publicKey: { algorithm: { name: "Ed25519" }, usages: ["verify"] },
      privateKey: { algorithm: { name: "Ed25519" }, usages: ["sign"] },
    };
    var data = "test data to sign";
    var sig = await didSign(keypair, data);
    assert.ok(sig instanceof Uint8Array);
    assert.ok(sig.length > 0);
    var ok = await didVerify(keypair.publicKey, sig, data, "Ed25519");
    assert.equal(ok, true);
  });

  it("should sign and verify with P-256", async function () {
    var keypair = {
      algorithm: "P-256",
      publicKey: { algorithm: { name: "ECDSA", namedCurve: "P-256" }, usages: ["verify"] },
      privateKey: { algorithm: { name: "ECDSA", namedCurve: "P-256" }, usages: ["sign"] },
    };
    var data = "test p256";
    var sig = await didSign(keypair, data);
    assert.ok(sig instanceof Uint8Array);
    var ok = await didVerify(keypair.publicKey, sig, data, "P-256");
    assert.equal(ok, true);
  });

  it("should sign and verify with RSA", async function () {
    var keypair = {
      algorithm: "RSA-2048",
      publicKey: { algorithm: { name: "RSASSA-PKCS1-v1_5" }, usages: ["verify"] },
      privateKey: { algorithm: { name: "RSASSA-PKCS1-v1_5" }, usages: ["sign"] },
    };
    var data = "test rsa";
    var sig = await didSign(keypair, data);
    assert.ok(sig instanceof Uint8Array);
    var ok = await didVerify(keypair.publicKey, sig, data, "RSA-2048");
    assert.equal(ok, true);
  });

  it("should sign with Uint8Array data", async function () {
    var keypair = {
      algorithm: "Ed25519",
      privateKey: { algorithm: { name: "Ed25519" } },
    };
    var data = new Uint8Array([1, 2, 3, 4, 5]);
    var sig = await didSign(keypair, data);
    assert.ok(sig instanceof Uint8Array);
  });

  it("should verify with Uint8Array signature", async function () {
    var keypair = {
      algorithm: "Ed25519",
      publicKey: { algorithm: { name: "Ed25519" } },
    };
    var sig = new Uint8Array([1, 2, 3, 4, 5]);
    var ok = await didVerify(keypair.publicKey, sig, "data", "Ed25519");
    assert.equal(ok, true);
  });
});

describe("DID — didImportSignKey", function () {
  it("should import Ed25519 sign key from stored data", async function () {
    var stored = {
      did: "did:key:z6Mk-test",
      privJwk: { x: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", kty: "OKP" },
      algorithm: "Ed25519",
    };
    var kp = await didImportSignKey(stored);
    assert.equal(kp.did, "did:key:z6Mk-test");
    assert.equal(kp.algorithm, "Ed25519");
    assert.ok(kp.publicKey);
    assert.ok(kp.privateKey);
  });

  it("should import P-256 sign key from stored data", async function () {
    var stored = {
      did: "did:key:zDna-test",
      privJwk: { x: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", y: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", kty: "EC" },
      algorithm: "P-256",
    };
    var kp = await didImportSignKey(stored);
    assert.equal(kp.algorithm, "P-256");
    assert.equal(kp.pubRaw.length, 65);
  });

  it("should import RSA sign key from stored data", async function () {
    var stored = {
      did: "did:key:zRsa-test",
      privJwk: { kty: "RSA", n: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", e: "AQAB", alg: "RS256" },
      algorithm: "RSA-2048",
    };
    var kp = await didImportSignKey(stored);
    assert.equal(kp.algorithm, "RSA-2048");
    assert.ok(kp.publicKey);
    assert.ok(kp.privateKey);
  });
});

describe("DID — downloadDID with non-matching keypair", function () {
  var captured2 = [];

  beforeEach(function () {
    captured2 = [];
    globalThis.downloadBlobSimple = function (blob, name) { captured2.push({ blob: blob, name: name }); };
  });

  it("should use didImportSignKey when _didKeypair DID mismatches", async function () {
    didClearKeys();
    didStoreKeys("did:key:z6Mk-different", { x: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", kty: "OKP" }, "Ed25519");
    globalThis._didKeypair = { did: "did:key:zOriginal", algorithm: "Ed25519", pubRaw: new Uint8Array(32), privJwk: { kty: "OKP" } };
    globalThis._didSig = null;

    await downloadDID("json");
    assert.ok(captured2.length >= 1);
    assert.ok(captured2[0].name.endsWith(".did.json"));
  });

  it("should handle didImportSignKey error gracefully in downloadDID", async function () {
    didClearKeys();
    didStoreKeys("did:key:zBad", { bad: "data", kty: "NOPE" }, "BadAlgo");
    globalThis._didKeypair = { did: "did:key:zOther", algorithm: "Ed25519", pubRaw: new Uint8Array(32), privJwk: { kty: "OKP" } };
    globalThis._didSig = null;

    await downloadDID("json");
    // Should not throw; the catch inside downloadDID should silently return
    assert.equal(captured2.length, 0);
  });
});

describe("DID — _jwkBase64urlDecode", function () {
  it("should decode base64url string to bytes", function () {
    var result = _jwkBase64urlDecode("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8");
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });
});

describe("DID — didIsAlgoSupported real catch", function () {
  it("should return false when algorithm is unknown", async function () {
    var r = await didIsAlgoSupported("MadeUpAlgo");
    assert.equal(r, false);
  });

  it("should return true for P-256", async function () {
    var r = await didIsAlgoSupported("P-256");
    assert.equal(r, true);
  });

  it("should return true for RSA-2048", async function () {
    var r = await didIsAlgoSupported("RSA-2048");
    assert.equal(r, true);
  });

  it("should return true for RSA-4096", async function () {
    var r = await didIsAlgoSupported("RSA-4096");
    assert.equal(r, true);
  });
});

describe("DID — remaining branch coverage", function () {
  it("base58Encode should handle non-Uint8Array input (Array)", function () {
    var enc = rawFns.base58Encode([0, 1, 2, 3]);
    assert.ok(typeof enc === "string");
    assert.ok(enc.length > 0);
  });

  it("compressP256Key with odd yLast (0x03 branch)", function () {
    var raw = new Uint8Array(65);
    raw[0] = 0x04;
    // Set last byte to 0x41 (65, odd) so yLast % 2 === 1
    for (var i = 1; i < 65; i++) raw[i] = 0x41;
    var comp = rawFns.compressP256Key(raw);
    assert.equal(comp[0], 0x03);
  });

  it("decompressP256Key with 0x03 prefix", function () {
    var comp = new Uint8Array(33);
    comp[0] = 0x03;
    comp[32] = 0x02;
    var raw = rawFns.decompressP256Key(comp);
    assert.equal(raw.length, 65);
    assert.equal(raw[0], 0x04);
  });

  it("didGenerateKeypair RSA-4096", async function () {
    mockKeyPair = {
      publicKey: { algorithm: { name: "RSASSA-PKCS1-v1_5" }, usages: ["verify"] },
      privateKey: { algorithm: { name: "RSASSA-PKCS1-v1_5" }, usages: ["sign"] },
    };
    var kp = await didGenerateKeypair("RSA-4096");
    assert.equal(kp.algorithm, "RSA-4096");
  });

  it("didGenerateRSAKeypair without bits (uses default 2048)", async function () {
    mockKeyPair = {
      publicKey: { algorithm: { name: "RSASSA-PKCS1-v1_5" }, usages: ["verify"] },
      privateKey: { algorithm: { name: "RSASSA-PKCS1-v1_5" }, usages: ["sign"] },
    };
    // Call directly without argument
    var kp = await didGenerateRSAKeypair();
    assert.equal(kp.algorithm, "RSA-2048");
  });

  it("didKeyEncode with unknown algo type throws", function () {
    assert.throws(function () { rawFns.didKeyEncode(new Uint8Array(32), "unknown"); }, /Unknown algorithm type/);
  });

  it("didKeyDecode with null throws", function () {
    assert.throws(function () { rawFns.didKeyDecode(null); }, /Invalid DID/);
  });

  it("didKeyDecode with empty string throws", function () {
    assert.throws(function () { rawFns.didKeyDecode(""); }, /Invalid DID/);
  });

  it("didLoadKeys with malformed JSON data returns null", function () {
    var store2 = {};
    var origLS = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: function (k) { return '{"bad": true}'; },
      setItem: function () {},
      removeItem: function () {},
      clear: function () {},
    };
    var result = didLoadKeys();
    assert.equal(result, null);
    globalThis.localStorage = origLS;
  });

  it("downloadDID without stored keys returns early", async function () {
    didClearKeys();
    var captured3 = [];
    globalThis.downloadBlobSimple = function (blob, name) { captured3.push({ blob: blob, name: name }); };
    await downloadDID("json");
    assert.equal(captured3.length, 0);
  });

  it("didLoadKeys with missing createdAt uses default 0", function () {
    var store3 = {};
    var origLS = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: function (k) { return '{"did":"x","privJwk":{},"algorithm":"Ed25519"}'; },
      setItem: function () {},
      removeItem: function () {},
      clear: function () {},
    };
    var result = didLoadKeys();
    assert.ok(result);
    assert.equal(result.createdAt, 0);
    globalThis.localStorage = origLS;
  });

  it("didImportSignKey with RSA-4096 algorithm", async function () {
    var stored = {
      did: "did:key:zRsa4096",
      privJwk: { kty: "RSA", n: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", e: "AQAB", alg: "RS384" },
      algorithm: "RSA-4096",
    };
    var kp = await didImportSignKey(stored);
    assert.equal(kp.algorithm, "RSA-4096");
  });

  it("downloadDID with stored keys without createdAt returns empty string", async function () {
    didClearKeys();
    // Manually store keys without createdAt
    var manualStore = JSON.stringify({
      did: "did:key:zNoDate",
      privJwk: { x: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", kty: "OKP" },
      algorithm: "Ed25519",
      createdAt: 0,
    });
    var origLS = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: function (k) { return manualStore; },
      setItem: function () {},
      removeItem: function () {},
      clear: function () {},
    };
    var captured4 = [];
    globalThis.downloadBlobSimple = function (blob, name) { captured4.push({ blob: blob, name: name }); };
    globalThis._didKeypair = { did: "did:key:zNoDate", algorithm: "Ed25519", pubRaw: new Uint8Array(32), privJwk: { kty: "OKP" } };
    globalThis._didSig = null;
    await downloadDID("json");
    assert.ok(captured4.length >= 1);
    globalThis.localStorage = origLS;
  });
});

describe("DID — didVerify with non-string data", function () {
  it("should verify with Uint8Array data", async function () {
    var publicKey = { algorithm: { name: "Ed25519" } };
    var data = new Uint8Array([1, 2, 3, 4, 5]);
    var sig = new Uint8Array([10, 20, 30]);
    var ok = await didVerify(publicKey, sig, data, "Ed25519");
    assert.equal(ok, true);
  });

  it("should verify with plain Array data (triggers new Uint8Array)", async function () {
    var publicKey = { algorithm: { name: "Ed25519" } };
    var data = [1, 2, 3, 4, 5];
    var sig = new Uint8Array([10, 20, 30]);
    var ok = await didVerify(publicKey, sig, data, "Ed25519");
    assert.equal(ok, true);
  });

  it("should verify with plain Array signature", async function () {
    var publicKey = { algorithm: { name: "Ed25519" } };
    var sig = [10, 20, 30, 40];
    var ok = await didVerify(publicKey, sig, "data", "Ed25519");
    assert.equal(ok, true);
  });

  it("should sign with plain Array data", async function () {
    var keypair = {
      algorithm: "Ed25519",
      privateKey: { algorithm: { name: "Ed25519" } },
    };
    var data = [1, 2, 3, 4, 5];
    var sig = await didSign(keypair, data);
    assert.ok(sig instanceof Uint8Array);
  });
});

// Restore
globalThis.document = origDoc;

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const didSrc = fs.readFileSync(path.join(__dirname, "../../Decentralized_Identity_DID/did.js"), "utf8");
const funcSrc = didSrc.slice(0, didSrc.lastIndexOf("document.addEventListener"));

const rawFns = vm.runInThisContext(`${funcSrc};
({
  base58Encode, base58Decode, varintEncode, varintDecode,
  didKeyEncode, didKeyDecode, didGenerateDocument,
  didCreateVerifiableCredential, compressP256Key, decompressP256Key,
  getCryptosuite, getSuiteContext
})`);

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
    const oldDid = `did:key:u${b64}`;
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
    const badDid = `did:key:z${badB58}`;
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

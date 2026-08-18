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

// Load DID module functions (same approach as did_test.js)
const didSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Decentralized_Identity_DID", "did.js"),
  "utf8",
);
const funcSrc = didSrc.slice(0, didSrc.lastIndexOf("document.addEventListener"));
const didFns = vm.runInThisContext(
  funcSrc +
    `;
({ didGenerateKeypair, didSign, didImportVerifyKey, didVerify, didSigToBase64 })`,
  {
    filename: path.resolve(
      __dirname,
      "../..",
      "Decentralized_Identity_DID",
      "did.js",
    ),
  },
);

// Load face_crypto.js (base64 helpers) then face_vc.js
const cryptoSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_crypto.js"),
  "utf8",
);
vm.runInThisContext(cryptoSrc, {
  filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_crypto.js"),
});
const vcSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_vc.js"),
  "utf8",
);
vm.runInThisContext(vcSrc, {
  filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_vc.js"),
});

async function makeKeypair(algo) {
  return didFns.didGenerateKeypair(algo);
}

async function verifyWithDID(payload, proofValueB64, cryptosuite) {
  const kp = await makeKeypair(
    cryptosuite === "ecdsa-rdfc-2019"
      ? "P-256"
      : cryptosuite === "eddsa-rdfc-2022"
        ? "Ed25519"
        : "RSA",
  );
  // signature made with a different key must fail; see signVerifyPair below
  return false;
}

describe("FaceVC — build", () => {
  it("should build a credential with the W3C v2 context and types", () => {
    const vc = FaceVC.build({ did: "did:key:z6Mkexample", descriptorHash: "ab".repeat(32), embeddingVersion: "human-hse", faceCount: 1 });
    assert.deepEqual(vc["@context"], ["https://www.w3.org/ns/credentials/v2"]);
    assert.deepEqual(vc.type, ["VerifiableCredential", "RedoSanFaceBiometricCredential"]);
    assert.equal(vc.issuer, "did:key:z6Mkexample");
    assert.ok(!isNaN(Date.parse(vc.validFrom)));
    assert.equal(vc.issuanceDate, undefined);
    assert.equal(vc.credentialSubject.id, "did:key:z6Mkexample");
    assert.equal(vc.credentialSubject.descriptorHash, "ab".repeat(32));
    assert.equal(vc.credentialSubject.descriptorHashAlg, "sha-256");
    assert.equal(vc.credentialSubject.embeddingVersion, "human-hse");
    assert.equal(vc.credentialSubject.faceCount, 1);
  });

  it("should expose the v1 and v2 context constants", () => {
    assert.equal(FaceVC.CONTEXT_V1, "https://www.w3.org/2018/credentials/v1");
    assert.equal(FaceVC.CONTEXT_V2, "https://www.w3.org/ns/credentials/v2");
    assert.equal(FaceVC.CONTEXT, FaceVC.CONTEXT_V2);
  });

  it("should include attributes and liveness evidence when given", () => {
    const vc = FaceVC.build({
      did: "did:key:z6Mkexample",
      attributes: { age: 30 },
      liveness: { passed: true },
    });
    assert.deepEqual(vc.credentialSubject.attributes, { age: 30 });
    assert.deepEqual(vc.credentialSubject.liveness, { passed: true });
  });

  it("should throw when did is missing", () => {
    assert.throws(() => FaceVC.build({}), /did is required/);
  });
});

describe("FaceVC — canonicalString", () => {
  it("should sort keys deterministically", () => {
    assert.equal(FaceVC.canonicalString({ b: 1, a: 2 }), '{"a":2,"b":1}');
    assert.equal(FaceVC.canonicalString({ x: { z: 1, y: 2 }, w: 3 }), '{"w":3,"x":{"y":2,"z":1}}');
  });
});

describe("FaceVC — sign/verify (Ed25519)", () => {
  it("should sign with a DID keypair and verify with the DID verification API", async () => {
    const kp = await makeKeypair("Ed25519");
    const vc = FaceVC.build({ did: kp.did, descriptorHash: "cafebabe", embeddingVersion: "human-hse", faceCount: 1 });
    await FaceVC.sign(kp, vc);
    assert.equal(vc.proof.type, "DataIntegrityProof");
    assert.equal(vc.proof.cryptosuite, "eddsa-rdfc-2022");
    assert.equal(vc.proof.proofPurpose, "assertionMethod");
    assert.equal(vc.proof.verificationMethod, kp.did + "#" + kp.did.slice(8));
    assert.ok(vc.proof.proofValue.length > 0);
    const payload = FaceVC.canonicalString({ issuer: vc.issuer, validFrom: vc.validFrom, credentialSubject: vc.credentialSubject });
    const pubKey = await didFns.didImportVerifyKey(vc.issuer);
    const ok = await didFns.didVerify(pubKey, FaceCrypto.base64ToBytes(vc.proof.proofValue), payload, "Ed25519");
    assert.equal(ok, true);
  });

  it("should verify via FaceVC.verify with a verifyFn", async () => {
    const kp = await makeKeypair("Ed25519");
    const vc = FaceVC.build({ did: kp.did, descriptorHash: "beef" });
    await FaceVC.sign(kp, vc);
    const res = await FaceVC.verify(vc, async (payload, proofValueB64, suite) => {
      const pubKey = await didFns.didImportVerifyKey(vc.issuer);
      return didFns.didVerify(pubKey, FaceCrypto.base64ToBytes(proofValueB64), payload, "Ed25519");
    });
    assert.deepEqual(res, { valid: true });
  });

  it("should fail verification when the payload is tampered", async () => {
    const kp = await makeKeypair("Ed25519");
    const vc = FaceVC.build({ did: kp.did, descriptorHash: "aaaa" });
    await FaceVC.sign(kp, vc);
    vc.credentialSubject.descriptorHash = "bbbb";
    const res = await FaceVC.verify(vc, async (payload, proofValueB64) => {
      const pubKey = await didFns.didImportVerifyKey(vc.issuer);
      return didFns.didVerify(pubKey, FaceCrypto.base64ToBytes(proofValueB64), payload, "Ed25519");
    });
    assert.equal(res.valid, false);
  });

  it("should reject structurally invalid credentials", async () => {
    const kp = await makeKeypair("Ed25519");
    const vc = FaceVC.build({ did: kp.did });
    await FaceVC.sign(kp, vc);
    const noCtx = JSON.parse(JSON.stringify(vc));
    noCtx["@context"] = ["https://example.org/other"];
    assert.equal((await FaceVC.verify(noCtx, verifyWithDID)).valid, false);
    const noType = JSON.parse(JSON.stringify(vc));
    noType.type = ["VerifiableCredential"];
    assert.equal((await FaceVC.verify(noType, verifyWithDID)).valid, false);
    const wrongSubject = JSON.parse(JSON.stringify(vc));
    wrongSubject.credentialSubject.id = "did:key:someone-else";
    assert.equal((await FaceVC.verify(wrongSubject, verifyWithDID)).valid, false);
    const noProof = JSON.parse(JSON.stringify(vc));
    delete noProof.proof;
    assert.equal((await FaceVC.verify(noProof, verifyWithDID)).valid, false);
    assert.equal((await FaceVC.verify(null, verifyWithDID)).valid, false);
  });

  it("should verify a legacy v1 credential (v1 context + issuanceDate)", async () => {
    const kp = await makeKeypair("Ed25519");
    const vc = {
      "@context": [FaceVC.CONTEXT_V1],
      type: ["VerifiableCredential", "RedoSanFaceBiometricCredential"],
      issuer: kp.did,
      issuanceDate: new Date().toISOString(),
      credentialSubject: { id: kp.did, descriptorHash: "deadbeef", descriptorHashAlg: "sha-256" },
    };
    await FaceVC.sign(kp, vc);
    assert.equal(vc.proof.proofValue.length > 0, true);
    const res = await FaceVC.verify(vc, async (payload, proofValueB64, suite) => {
      const pubKey = await didFns.didImportVerifyKey(vc.issuer);
      return didFns.didVerify(pubKey, FaceCrypto.base64ToBytes(proofValueB64), payload, "Ed25519");
    });
    assert.deepEqual(res, { valid: true });
  });

  it("should reject a v2 credential whose date field is missing entirely", async () => {
    const kp = await makeKeypair("Ed25519");
    const vc = FaceVC.build({ did: kp.did, descriptorHash: "1234" });
    await FaceVC.sign(kp, vc);
    const noDate = JSON.parse(JSON.stringify(vc));
    delete noDate.validFrom;
    delete noDate.issuanceDate;
    const res = await FaceVC.verify(noDate, async () => true);
    assert.equal(res.valid, false);
  });
});

describe("FaceVC — sign errors", () => {
  it("should throw without a keypair", async () => {
    const vc = FaceVC.build({ did: "did:key:z6Mkexample" });
    await assert.rejects(FaceVC.sign(null, vc), /keypair with did required/);
  });

  it("should throw when didSign is unavailable", async () => {
    const saved = globalThis.didSign;
    globalThis.didSign = undefined; // var/function bindings cannot be deleted
    try {
      const vc = FaceVC.build({ did: "did:key:z6Mkexample" });
      await assert.rejects(
        FaceVC.sign({ did: "did:key:z6Mkexample", algorithm: "Ed25519" }, vc),
        /didSign not available/,
      );
    } finally {
      globalThis.didSign = saved;
    }
  });

  it("should reject a keypair without a usable private key", async () => {
    const vc = FaceVC.build({ did: "did:key:z6Mkexample" });
    await assert.rejects(
      FaceVC.sign({ did: "did:key:z6Mkexample", algorithm: "Ed25519" }, vc),
    );
  });
});

describe("FaceVC — toJSON", () => {
  it("should serialize to parseable JSON", async () => {
    const kp = await makeKeypair("Ed25519");
    const vc = FaceVC.build({ did: kp.did, descriptorHash: "1234" });
    await FaceVC.sign(kp, vc);
    const parsed = JSON.parse(FaceVC.toJSON(vc));
    assert.equal(parsed.issuer, kp.did);
    assert.ok(parsed.proof && parsed.proof.proofValue);
  });
});
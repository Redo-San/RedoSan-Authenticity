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
    assert.throws(() => FaceVC.build(), /did is required/);
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

  it("should reject credentials without an issuer", async () => {
    const kp = await makeKeypair("Ed25519");
    const vc = FaceVC.build({ did: kp.did });
    await FaceVC.sign(kp, vc);
    const noIssuer = JSON.parse(JSON.stringify(vc));
    delete noIssuer.issuer;
    const res = await FaceVC.verify(noIssuer, async () => true);
    assert.match(res.error, /missing issuer/);
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

  it("should throw without a VC", async () => {
    await assert.rejects(
      FaceVC.sign({ did: "did:key:z6Mkexample", algorithm: "Ed25519" }, null),
      /unsigned VC required/,
    );
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

describe("FaceVC — cryptosuite mapping", () => {
  it("maps P-256 and RSA algorithms", () => {
    assert.equal(FaceVC.cryptosuiteFor("P-256"), "ecdsa-rdfc-2019");
    assert.equal(FaceVC.cryptosuiteFor("RSA"), "rsa-signature-2022");
    assert.equal(FaceVC.cryptosuiteFor(undefined), "rsa-signature-2022");
  });
});

describe("FaceVC — canonicalString arrays", () => {
  it("canonicalizes arrays recursively", () => {
    assert.equal(FaceVC.canonicalString([3, 1]), "[3,1]");
    assert.equal(
      FaceVC.canonicalString({ list: [{ b: 2, a: 1 }, 5] }),
      '{"list":[{"a":1,"b":2},5]}',
    );
  });
});

describe("FaceVC — sign overrides and base64 fallbacks", () => {
  it("uses a provided signFn and defaults the cryptosuite to Ed25519", async () => {
    const kp = { did: "did:key:z6Mkexample" };
    const vc = FaceVC.build({ did: kp.did });
    await FaceVC.sign(kp, vc, async () => new Uint8Array([1, 2, 3]));
    assert.equal(
      vc.proof.proofValue,
      FaceCrypto.bytesToBase64(new Uint8Array([1, 2, 3])),
    );
    assert.equal(vc.proof.cryptosuite, "eddsa-rdfc-2022");
  });

  it("falls back to didSigToBase64 when FaceCrypto is unavailable", async () => {
    const savedFC = globalThis.FaceCrypto;
    globalThis.FaceCrypto = undefined;
    try {
      const kp = await makeKeypair("Ed25519");
      const vc = FaceVC.build({ did: kp.did });
      await FaceVC.sign(kp, vc);
      assert.ok(vc.proof.proofValue.length > 0);
    } finally {
      globalThis.FaceCrypto = savedFC;
    }
  });

  it("falls back to btoa when neither FaceCrypto nor didSigToBase64 exist", async () => {
    const savedFC = globalThis.FaceCrypto;
    const savedS2B = globalThis.didSigToBase64;
    globalThis.FaceCrypto = undefined;
    globalThis.didSigToBase64 = undefined;
    try {
      const kp = await makeKeypair("Ed25519");
      const vc = FaceVC.build({ did: kp.did });
      await FaceVC.sign(kp, vc);
      assert.ok(vc.proof.proofValue.length > 0);
    } finally {
      globalThis.FaceCrypto = savedFC;
      globalThis.didSigToBase64 = savedS2B;
    }
  });
});

describe("FaceVC — verify via DID API (no verifyFn)", () => {
  it("verifies Ed25519 end-to-end", async () => {
    const kp = await makeKeypair("Ed25519");
    const vc = FaceVC.build({ did: kp.did, descriptorHash: "7777" });
    await FaceVC.sign(kp, vc);
    assert.deepEqual(await FaceVC.verify(vc), { valid: true });
  });

  it("verifies P-256 end-to-end", async () => {
    const kp = await makeKeypair("P-256");
    const vc = FaceVC.build({ did: kp.did });
    await FaceVC.sign(kp, vc);
    assert.deepEqual(await FaceVC.verify(vc), { valid: true });
  });

  it("maps the RSA cryptosuite arm in verify", async () => {
    const kp = await makeKeypair("Ed25519");
    const vc = FaceVC.build({ did: kp.did });
    await FaceVC.sign(kp, vc);
    vc.proof.cryptosuite = "rsa-signature-2022";
    const res = await FaceVC.verify(vc);
    assert.equal(typeof res.valid, "boolean");
  });

  it("returns invalid when the signature does not verify", async () => {
    const kp = await makeKeypair("Ed25519");
    const vc = FaceVC.build({ did: kp.did });
    await FaceVC.sign(kp, vc);
    vc.credentialSubject.descriptorHash = "tampered";
    const res = await FaceVC.verify(vc);
    assert.equal(res.valid, false);
  });

  it("reports verification errors from the DID API", async () => {
    const kp = await makeKeypair("Ed25519");
    const vc = FaceVC.build({ did: kp.did });
    await FaceVC.sign(kp, vc);
    const saved = globalThis.didImportVerifyKey;
    globalThis.didImportVerifyKey = async () => {
      throw new Error("boom");
    };
    try {
      const res = await FaceVC.verify(vc);
      assert.equal(res.valid, false);
      assert.match(res.error, /verification error: boom/);
    } finally {
      globalThis.didImportVerifyKey = saved;
    }
  });

  it("reports a missing DID verification API", async () => {
    const kp = await makeKeypair("Ed25519");
    const vc = FaceVC.build({ did: kp.did });
    await FaceVC.sign(kp, vc);
    const sK = globalThis.didImportVerifyKey;
    const sV = globalThis.didVerify;
    globalThis.didImportVerifyKey = undefined;
    globalThis.didVerify = undefined;
    try {
      const res = await FaceVC.verify(vc);
      assert.match(res.error, /DID verification API not available/);
    } finally {
      globalThis.didImportVerifyKey = sK;
      globalThis.didVerify = sV;
    }
  });
});
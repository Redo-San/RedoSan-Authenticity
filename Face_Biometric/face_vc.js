/* c8 ignore start */
(function(){if(typeof window!=='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
/* c8 ignore stop */
// ── Face VC: W3C Verifiable Credential for face biometric identifiers ──

/**
 * W3C Verifiable Credential representing a face biometric registration.
 * Only the SHA-256 descriptor hash is stored in the credential — never the
 * raw template — so the VC is portable without exposing biometric data.
 */

var FaceVC = {
  CONTEXT: "https://www.w3.org/2018/credentials/v1",
  TYPE: ["VerifiableCredential", "RedoSanFaceBiometricCredential"],
};

/**
 * @param {string} algorithm "Ed25519" | "P-256" | "RSA"
 * @returns {string}
 */
FaceVC.cryptosuiteFor = function (algorithm) {
  if (algorithm === "Ed25519") return "eddsa-rdfc-2022";
  if (algorithm === "P-256") return "ecdsa-rdfc-2019";
  return "rsa-signature-2022";
};

/**
 * Deterministic canonical JSON (sorted keys, depth-first) for signing.
 * @param {object} obj
 * @returns {string}
 */
FaceVC.canonicalString = function (obj) {
  var key, k, v;
  if (Array.isArray(obj)) {
    return "[" + obj.map(FaceVC.canonicalString).join(",") + "]";
  }
  if (obj && typeof obj === "object") {
    key = Object.keys(obj).sort();
    return (
      "{" +
      key
        .map(function (k) {
          return JSON.stringify(k) + ":" + FaceVC.canonicalString(obj[k]);
        })
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(obj);
};

/**
 * Build an unsigned face biometric credential.
 * @param {{did:string, algorithm?:string, descriptorHash?:string, attributes?:object|null, liveness?:object|null, faceCount?:number, embeddingVersion?:string}} opts
 * @returns {object}
 */
FaceVC.build = function (opts) {
  var vc;
  opts = opts || {};
  if (!opts.did) throw new TypeError("FaceVC.build: did is required");
  vc = {
    "@context": [FaceVC.CONTEXT],
    type: FaceVC.TYPE.slice(),
    issuer: opts.did,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: opts.did,
    },
  };
  if (opts.descriptorHash) {
    vc.credentialSubject.descriptorHash = opts.descriptorHash;
    vc.credentialSubject.descriptorHashAlg = "sha-256";
  }
  if (opts.embeddingVersion) vc.credentialSubject.embeddingVersion = opts.embeddingVersion;
  if (opts.faceCount !== undefined && opts.faceCount !== null) {
    vc.credentialSubject.faceCount = opts.faceCount;
  }
  if (opts.attributes) vc.credentialSubject.attributes = opts.attributes;
  if (opts.liveness) vc.credentialSubject.liveness = opts.liveness;
  return vc;
};

/**
 * Sign an unsigned VC with a DID keypair. Uses global `didSign` by default;
 * pass `signFn(bytes) -> Promise<Uint8Array>` to override (e.g. in tests).
 * @param {{did:string, algorithm:string, privateKey?:object}} kp
 * @param {object} vc
 * @param {function} [signFn]
 * @returns {Promise<object>}
 */
FaceVC.sign = async function (kp, vc, signFn) {
  var payload, sig, base64;
  if (!kp || !kp.did) throw new TypeError("FaceVC.sign: keypair with did required");
  if (!vc || !vc.issuer) throw new TypeError("FaceVC.sign: unsigned VC required");
  payload = FaceVC.canonicalString({
    issuer: vc.issuer,
    issuanceDate: vc.issuanceDate,
    credentialSubject: vc.credentialSubject,
  });
  if (!signFn && typeof didSign !== "function") {
    throw new Error("FaceVC.sign: didSign not available (load Decentralized_Identity_DID/did.js)");
  }
  sig = signFn ? await signFn(new TextEncoder().encode(payload)) : await didSign(kp, payload);
  if (typeof FaceCrypto !== "undefined" && FaceCrypto.bytesToBase64) {
    base64 = FaceCrypto.bytesToBase64(sig);
  } else if (typeof didSigToBase64 === "function") {
    base64 = didSigToBase64(sig);
  } else {
    base64 = btoa(String.fromCharCode.apply(null, sig));
  }
  vc.proof = {
    type: "DataIntegrityProof",
    created: new Date().toISOString(),
    verificationMethod: kp.did + "#" + kp.did.slice(8),
    cryptosuite: FaceVC.cryptosuiteFor(kp.algorithm || "Ed25519"),
    proofPurpose: "assertionMethod",
    proofValue: base64,
  };
  return vc;
};

/**
 * Verify credential structure + signature.
 * Uses global `didImportVerifyKey`/`didVerify` by default; pass
 * `verifyFn(payloadString, proofValueB64, algorithm) -> Promise<boolean>`
 * to override (e.g. in tests).
 * @param {object} vc
 * @param {function} [verifyFn]
 * @returns {Promise<{valid:boolean, error?:string}>}
 */
FaceVC.verify = async function (vc, verifyFn) {
  var payload, sigBytes, pubKey, ok;
  if (!vc || typeof vc !== "object") return { valid: false, error: "not an object" };
  if (!Array.isArray(vc["@context"]) || vc["@context"].indexOf(FaceVC.CONTEXT) === -1) {
    return { valid: false, error: "missing credentials v1 context" };
  }
  if (!Array.isArray(vc.type) || vc.type.indexOf("VerifiableCredential") === -1 || vc.type.indexOf("RedoSanFaceBiometricCredential") === -1) {
    return { valid: false, error: "missing credential types" };
  }
  if (!vc.issuer || typeof vc.issuer !== "string") return { valid: false, error: "missing issuer" };
  if (!vc.credentialSubject || vc.credentialSubject.id !== vc.issuer) {
    return { valid: false, error: "credentialSubject.id must equal issuer" };
  }
  if (!vc.proof || !vc.proof.proofValue) return { valid: false, error: "missing proof" };
  if (isNaN(Date.parse(vc.issuanceDate))) return { valid: false, error: "invalid issuanceDate" };
  payload = FaceVC.canonicalString({
    issuer: vc.issuer,
    issuanceDate: vc.issuanceDate,
    credentialSubject: vc.credentialSubject,
  });
  sigBytes = FaceCrypto.base64ToBytes(vc.proof.proofValue);
  if (verifyFn) {
    ok = await verifyFn(payload, vc.proof.proofValue, vc.proof.cryptosuite);
    return ok ? { valid: true } : { valid: false, error: "signature verification failed" };
  }
  if (typeof didImportVerifyKey !== "function" || typeof didVerify !== "function") {
    return { valid: false, error: "DID verification API not available" };
  }
  try {
    pubKey = await didImportVerifyKey(vc.issuer);
    ok = await didVerify(pubKey, sigBytes, payload, vc.proof.cryptosuite === "ecdsa-rdfc-2019" ? "P-256" : vc.proof.cryptosuite === "eddsa-rdfc-2022" ? "Ed25519" : "RSA");
  } catch (e) {
    return { valid: false, error: "verification error: " + e.message };
  }
  return ok ? { valid: true } : { valid: false, error: "signature verification failed" };
};

/**
 * @param {object} vc
 * @returns {string}
 */
FaceVC.toJSON = function (vc) {
  return JSON.stringify(vc, null, 2);
};

/* c8 ignore start */
if (typeof window !== "undefined") {
  window.FaceVC = FaceVC;
}
/* c8 ignore stop */
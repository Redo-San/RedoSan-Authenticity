const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── GPL polyfills ──
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};
globalThis.isSecureContext = true;
globalThis.btoa =
  globalThis.btoa ||
  function (bin) {
    return Buffer.from(bin, "binary").toString("base64");
  };
globalThis.atob =
  globalThis.atob ||
  function (b64) {
    return Buffer.from(b64, "base64").toString("binary");
  };

// ── Load module sources ──
const webauthnSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_webauthn.js"),
  "utf8",
);
vm.runInThisContext(webauthnSrc, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Face_Biometric",
    "face_webauthn.js",
  ),
});

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

const FaceWebauthn = globalThis.FaceWebauthn;

// ── WebAuthn mocks ──
let createdCredential = null;
let getCredential = null;
let createThrows = null;
let getThrows = null;
let lastCreateOptions = null;
let lastGetOptions = null;

function resetWebauthnMocks() {
  createdCredential = null;
  getCredential = null;
  createThrows = null;
  getThrows = null;
  lastCreateOptions = null;
  lastGetOptions = null;
  Object.defineProperty(globalThis, "navigator", {
    value: {
      credentials: {
        create: async function (opts) {
          lastCreateOptions = opts;
          if (createThrows) throw createThrows;
          if (!createdCredential) return null;
          return createdCredential;
        },
        get: async function (opts) {
          lastGetOptions = opts;
          if (getThrows) throw getThrows;
          if (!getCredential) return null;
          return getCredential;
        },
      },
    },
    configurable: true,
  });
}

function fakeCredential(overrides) {
  const rawId = Uint8Array.from([1, 2, 3, 4]);
  const cred = {
    id: "mock-credential-id",
    rawId: rawId,
    type: "public-key",
    response: {
      clientDataJSON: Uint8Array.from(
        Buffer.from('{"type":"webauthn.create","challenge":"abc"}'),
      ),
      attestationObject: Uint8Array.from([9, 8, 7]),
      authenticatorData: Uint8Array.from([5, 6]),
      signature: Uint8Array.from([7, 8]),
      userHandle: Uint8Array.from([9]),
    },
    getClientExtensionResults: function () {
      return {};
    },
  };
  if (overrides) Object.assign(cred, overrides);
  return cred;
}

// ── Tests ──

describe("FaceWebauthn — availability", () => {
  beforeEach(resetWebauthnMocks);

  it("should report unavailable when navigator.credentials is missing", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
    });
    assert.equal(FaceWebauthn.isAvailable(), false);
  });

  it("should report unavailable in a non-secure context", () => {
    Object.defineProperty(globalThis, "isSecureContext", {
      value: false,
      configurable: true,
    });
    assert.equal(FaceWebauthn.isAvailable(), false);
    Object.defineProperty(globalThis, "isSecureContext", {
      value: true,
      configurable: true,
    });
  });

  it("should report available with a credentials API and secure context", () => {
    assert.equal(FaceWebauthn.isAvailable(), true);
  });
});

describe("FaceWebauthn — base64url helpers", () => {
  beforeEach(resetWebauthnMocks);

  it("should round-trip bytes through base64url", () => {
    const bytes = Uint8Array.from([0, 1, 254, 255, 128, 64]);
    const b64url = FaceWebauthn.bytesToB64url(bytes);
    assert.equal(b64url.includes("+"), false);
    assert.equal(b64url.includes("/"), false);
    assert.equal(b64url.includes("="), false);
    assert.deepEqual(FaceWebauthn.b64urlToBytes(b64url), bytes);
  });

  it("should decode base64url with padding and handle empty input", () => {
    assert.deepEqual(
      FaceWebauthn.b64urlToBytes("AAEC"),
      Uint8Array.from([0, 1, 2]),
    );
    assert.equal(FaceWebauthn.b64urlToBytes(null), null);
    assert.equal(FaceWebauthn.bytesToB64url(null), "");
  });
});

describe("FaceWebauthn — randomChallenge", () => {
  beforeEach(resetWebauthnMocks);

  it("should produce a base64url string of the requested byte length", () => {
    const challenge = FaceWebauthn.randomChallenge(32);
    assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
    const again = FaceWebauthn.randomChallenge(32);
    assert.notEqual(challenge, again);
  });

  it("should default to 32 bytes", () => {
    assert.match(FaceWebauthn.randomChallenge(), /^[A-Za-z0-9_-]{43}$/);
  });

  it("should fall back to Math.random when WebCrypto is unavailable", () => {
    const saved = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    try {
      const c = FaceWebauthn.randomChallenge(16);
      assert.match(c, /^[A-Za-z0-9_-]+$/);
      assert.notEqual(
        FaceWebauthn.randomChallenge(16),
        FaceWebauthn.randomChallenge(16),
      );
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: saved,
        configurable: true,
      });
    }
  });
});

describe("FaceWebauthn — parseClientData", () => {
  beforeEach(resetWebauthnMocks);

  it("should parse JSON from bytes", () => {
    const bytes = Uint8Array.from(
      Buffer.from('{"type":"webauthn.create","challenge":"abc"}', "utf8"),
    );
    const data = FaceWebauthn.parseClientData(bytes);
    assert.equal(data.type, "webauthn.create");
    assert.equal(data.challenge, "abc");
  });

  it("should parse JSON from a plain string", () => {
    const data = FaceWebauthn.parseClientData('{"type":"webauthn.get"}');
    assert.equal(data.type, "webauthn.get");
  });

  it("should return {} for invalid input", () => {
    assert.deepEqual(FaceWebauthn.parseClientData(null), {});
    assert.deepEqual(
      FaceWebauthn.parseClientData(Uint8Array.from([255, 254, 253])),
      {},
    );
  });
});

describe("FaceWebauthn — credentialToJSON", () => {
  beforeEach(resetWebauthnMocks);

  it("should encode binary fields as base64url", () => {
    const json = FaceWebauthn.credentialToJSON(fakeCredential());
    assert.equal(json.id, "mock-credential-id");
    assert.equal(json.type, "public-key");
    assert.equal(json.rawId, "AQIDBA");
    assert.equal(json.response.attestationObject, "CQgH");
    assert.equal(
      json.response.clientDataJSON,
      "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiYWJjIn0",
    );
    assert.equal(json.response.authenticatorData, "BQY");
    assert.equal(json.response.signature, "Bwg");
    assert.equal(json.response.userHandle, "CQ");
    assert.deepEqual(json.clientExtensionResults, {});
  });

  it("should return null for missing credential or response", () => {
    assert.equal(FaceWebauthn.credentialToJSON(null), null);
    assert.equal(FaceWebauthn.credentialToJSON({ id: "x" }), null);
  });

  it("should handle a plain get assertion without attestation fields", () => {
    const json = FaceWebauthn.credentialToJSON(
      fakeCredential({
        response: {
          clientDataJSON: Uint8Array.from(Buffer.from("{}")),
          authenticatorData: Uint8Array.from([1]),
          signature: Uint8Array.from([2]),
        },
      }),
    );
    assert.equal(json.response.attestationObject, undefined);
    assert.equal(json.response.userHandle, undefined);
  });
});

describe("FaceWebauthn — verifyClientData", () => {
  beforeEach(resetWebauthnMocks);

  it("should accept a matching challenge and type", () => {
    const json = FaceWebauthn.credentialToJSON(fakeCredential());
    const challenge = "abc";
    assert.equal(
      FaceWebauthn.verifyClientData(json, challenge, "webauthn.create"),
      true,
    );
  });

  it("should reject a wrong challenge or type", () => {
    const json = FaceWebauthn.credentialToJSON(fakeCredential());
    assert.equal(
      FaceWebauthn.verifyClientData(json, "nope", "webauthn.create"),
      false,
    );
    assert.equal(
      FaceWebauthn.verifyClientData(json, "abc", "webauthn.get"),
      false,
    );
  });

  it("should reject malformed credentials", () => {
    assert.equal(FaceWebauthn.verifyClientData(null, "abc"), false);
    assert.equal(FaceWebauthn.verifyClientData({ response: {} }, "abc"), false);
  });
});

describe("FaceWebauthn — register", () => {
  beforeEach(resetWebauthnMocks);

  it("should create a credential and return the JSON shape", async () => {
    createdCredential = fakeCredential();
    const json = await FaceWebauthn.register();
    assert.equal(json.id, "mock-credential-id");
    assert.equal(json.type, "public-key");
    assert.equal(json.rawId, "AQIDBA");
  });

  it("should advertise both ES256 and RS256 pubKeyCredParams", async () => {
    createdCredential = fakeCredential();
    await FaceWebauthn.register();
    const params = lastCreateOptions.publicKey.pubKeyCredParams;
    assert.ok(
      params.some((p) => p.type === "public-key" && p.alg === -7),
      "ES256 (-7) must be advertised",
    );
    assert.ok(
      params.some((p) => p.type === "public-key" && p.alg === -257),
      "RS256 (-257) must be advertised",
    );
  });

  it("should reject when the browser cancels registration", async () => {
    createdCredential = null;
    await assert.rejects(FaceWebauthn.register(), /cancelled/);
  });

  it("should surface browser errors", async () => {
    createThrows = new Error("NotAllowedError: user dismissed");
    await assert.rejects(FaceWebauthn.register(), /user dismissed/);
  });

  it("should require a secure WebAuthn context", async () => {
    Object.defineProperty(globalThis, "isSecureContext", {
      value: false,
      configurable: true,
    });
    try {
      await assert.rejects(FaceWebauthn.register(), /not available/);
    } finally {
      Object.defineProperty(globalThis, "isSecureContext", {
        value: true,
        configurable: true,
      });
    }
  });
});

describe("FaceWebauthn — authenticate", () => {
  beforeEach(resetWebauthnMocks);

  it("should return the assertion JSON", async () => {
    getCredential = fakeCredential({
      response: {
        clientDataJSON: Uint8Array.from(
          Buffer.from('{"type":"webauthn.get","challenge":"abc"}'),
        ),
        authenticatorData: Uint8Array.from([1, 2]),
        signature: Uint8Array.from([3, 4]),
        userHandle: Uint8Array.from([5]),
      },
    });
    const json = await FaceWebauthn.authenticate({
      allowCredentials: [{ id: "AQIDBA" }],
    });
    assert.equal(json.id, "mock-credential-id");
    assert.equal(json.response.signature, "AwQ");
  });

  it("should reject when the browser cancels authentication", async () => {
    getCredential = null;
    await assert.rejects(FaceWebauthn.authenticate(), /cancelled/);
  });

  it("should surface browser errors", async () => {
    getThrows = new Error("NotAllowedError: timed out");
    await assert.rejects(FaceWebauthn.authenticate(), /timed out/);
  });

  it("should require a secure WebAuthn context", async () => {
    Object.defineProperty(globalThis, "isSecureContext", {
      value: false,
      configurable: true,
    });
    try {
      await assert.rejects(FaceWebauthn.authenticate(), /not available/);
    } finally {
      Object.defineProperty(globalThis, "isSecureContext", {
        value: true,
        configurable: true,
      });
    }
  });

  it("should send a PRF extension when prfSalt is supplied", async () => {
    getCredential = fakeCredential({
      response: {
        clientDataJSON: Uint8Array.from(
          Buffer.from('{"type":"webauthn.get","challenge":"abc"}'),
        ),
        authenticatorData: Uint8Array.from([1, 2]),
        signature: Uint8Array.from([3, 4]),
        userHandle: Uint8Array.from([5]),
      },
    });
    const json = await FaceWebauthn.authenticate({
      prfSalt: FaceWebauthn.bytesToB64url(Uint8Array.from([1, 2, 3, 4])),
    });
    assert.ok(
      lastGetOptions &&
        lastGetOptions.publicKey.extensions &&
        lastGetOptions.publicKey.extensions.prf,
      "PRF extension must be requested",
    );
    assert.equal(json.id, "mock-credential-id");
  });
});

describe("FaceWebauthn — b64url bridge helpers", () => {
  beforeEach(resetWebauthnMocks);

  it("should transcode standard base64 to base64url", () => {
    assert.equal(FaceWebauthn.b64ToB64url("a+b/c=="), "a-b_c");
    assert.equal(FaceWebauthn.b64ToB64url(""), "");
  });
});

describe("FaceWebauthn — PRF vault derivation", () => {
  beforeEach(resetWebauthnMocks);

  it("prfOutput returns null without extension results", () => {
    assert.equal(FaceWebauthn.prfOutput(null), null);
    assert.equal(FaceWebauthn.prfOutput({}), null);
    assert.equal(FaceWebauthn.prfOutput({ clientExtensionResults: {} }), null);
    const b64u = FaceWebauthn.bytesToB64url(Uint8Array.from([1, 2, 3, 4]));
    const cred = {
      clientExtensionResults: { prf: { results: { first: b64u } } },
    };
    assert.deepEqual(
      FaceWebauthn.prfOutput(cred),
      Uint8Array.from([1, 2, 3, 4]),
    );
  });

  it("prfSupported reflects presence of PRF output", () => {
    assert.equal(FaceWebauthn.prfSupported({}), false);
    const b64u = FaceWebauthn.bytesToB64url(Uint8Array.from([9, 9]));
    assert.equal(
      FaceWebauthn.prfSupported({
        clientExtensionResults: { prf: { results: { first: b64u } } },
      }),
      true,
    );
  });

  it("deriveVaultKey rejects missing PRF bytes", async () => {
    await assert.rejects(
      FaceWebauthn.deriveVaultKey(null),
      /PRF output is required/,
    );
  });

  it("deriveVaultKey rejects when WebCrypto is unavailable", async () => {
    const saved = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    try {
      await assert.rejects(
        FaceWebauthn.deriveVaultKey(Uint8Array.from([1, 2, 3, 4])),
        /WebCrypto is not available/,
      );
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: saved,
        configurable: true,
      });
    }
  });

  it("deriveVaultKey produces a deterministic AES-GCM key", async () => {
    const prf = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i));
    const k1 = await FaceWebauthn.deriveVaultKey(prf, "redo-san-face-vault-v1");
    const k2 = await FaceWebauthn.deriveVaultKey(prf, "redo-san-face-vault-v1");
    assert.equal(k1.algorithm.name, "AES-GCM");
    assert.equal(k1.algorithm.length, 256);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const e1 = await globalThis.FaceCrypto.encryptWithKey(k1, iv, { a: 1 });
    const e2 = await globalThis.FaceCrypto.encryptWithKey(k2, iv, { a: 1 });
    assert.equal(e1.cipher, e2.cipher);
  });

  it("encryptJSON / decryptJSON round-trips an object", async () => {
    const prf = Uint8Array.from(
      Array.from({ length: 32 }, (_, i) => (i * 7) & 0xff),
    );
    const key = await FaceWebauthn.deriveVaultKey(prf);
    const blob = await FaceWebauthn.encryptJSON(key, { hello: "world", n: 42 });
    assert.match(blob.iv, /^[A-Za-z0-9_-]+$/);
    assert.match(blob.ct, /^[A-Za-z0-9_-]+$/);
    const back = await FaceWebauthn.decryptJSON(key, blob);
    assert.deepEqual(back, { hello: "world", n: 42 });
  });

  it("encryptJSON rejects when FaceCrypto is unavailable", async () => {
    const saved = globalThis.FaceCrypto;
    globalThis.FaceCrypto = undefined;
    try {
      const key = await FaceWebauthn.deriveVaultKey(
        Uint8Array.from(Array.from({ length: 32 }, (_, i) => i)),
      );
      await assert.rejects(
        FaceWebauthn.encryptJSON(key, { a: 1 }),
        /FaceCrypto .* is not available/,
      );
    } finally {
      globalThis.FaceCrypto = saved;
    }
  });

  it("decryptJSON rejects when FaceCrypto is unavailable", async () => {
    const saved = globalThis.FaceCrypto;
    globalThis.FaceCrypto = undefined;
    try {
      const key = await FaceWebauthn.deriveVaultKey(
        Uint8Array.from(Array.from({ length: 32 }, (_, i) => i)),
      );
      await assert.rejects(
        FaceWebauthn.decryptJSON(key, { iv: "a-b_c", ct: "a-b_c" }),
        /FaceCrypto .* is not available/,
      );
    } finally {
      globalThis.FaceCrypto = saved;
    }
  });
});

describe("FaceWebauthn — edge branches", () => {
  beforeEach(resetWebauthnMocks);

  it("isAvailable when only get is a function or neither is", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { credentials: { get: async () => null } },
      configurable: true,
    });
    assert.equal(FaceWebauthn.isAvailable(), true);
    Object.defineProperty(globalThis, "navigator", {
      value: { credentials: {} },
      configurable: true,
    });
    assert.equal(FaceWebauthn.isAvailable(), false);
  });

  it("parseClientData handles a plain byte array and null JSON", () => {
    assert.deepEqual(
      FaceWebauthn.parseClientData([123, 34, 97, 34, 58, 49, 125]),
      { a: 1 },
    );
    assert.deepEqual(FaceWebauthn.parseClientData("null"), {});
  });

  it("credentialToJSON fills defaults for a sparse credential", () => {
    const json = FaceWebauthn.credentialToJSON({
      response: { clientDataJSON: Uint8Array.from([1, 2]) },
    });
    assert.equal(json.id, "");
    assert.equal(json.type, "public-key");
    assert.equal(json.rawId, "");
  });

  it("verifyClientData rejects a non-string challenge", () => {
    const raw = FaceWebauthn.bytesToB64url(
      Uint8Array.from(Buffer.from('{"type":"webauthn.get"}', "utf8")),
    );
    assert.equal(
      FaceWebauthn.verifyClientData(
        { response: { clientDataJSON: raw } },
        "abc",
      ),
      false,
    );
  });

  it("register honours explicit rpId and falls back to localhost", async () => {
    createdCredential = fakeCredential();
    await FaceWebauthn.register({ rpId: "example.com" });
    assert.equal(lastCreateOptions.publicKey.rp.id, "example.com");

    const savedHost = globalThis.location.hostname;
    globalThis.location.hostname = "";
    try {
      await FaceWebauthn.register();
      assert.equal(lastCreateOptions.publicKey.rp.id, "localhost");
    } finally {
      globalThis.location.hostname = savedHost;
    }
  });

  it("authenticate honours explicit rpId and falls back to localhost", async () => {
    getCredential = fakeCredential({
      response: {
        clientDataJSON: Uint8Array.from(
          Buffer.from('{"type":"webauthn.get","challenge":"abc"}'),
        ),
        authenticatorData: Uint8Array.from([1, 2]),
        signature: Uint8Array.from([3, 4]),
        userHandle: Uint8Array.from([5]),
      },
    });
    await FaceWebauthn.authenticate({ rpId: "example.com" });
    assert.equal(lastGetOptions.publicKey.rpId, "example.com");

    const savedHost = globalThis.location.hostname;
    globalThis.location.hostname = "";
    try {
      await FaceWebauthn.authenticate({});
      assert.equal(lastGetOptions.publicKey.rpId, "localhost");
    } finally {
      globalThis.location.hostname = savedHost;
    }
  });
});
describe("FaceWebauthn — hard JS timeout for hung authenticators", () => {
  const savedNav = globalThis.navigator;
  afterEach(function () {
    Object.defineProperty(globalThis, "navigator", {
      value: savedNav,
      configurable: true,
      writable: true,
    });
  });

  function hangNavigator() {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        credentials: {
          create: function () {
            return new Promise(function () {});
          },
          get: function () {
            return new Promise(function () {});
          },
        },
      },
      configurable: true,
      writable: true,
    });
  }

  it("register rejects via timeoutMs instead of hanging forever", async () => {
    hangNavigator();
    await assert.rejects(
      FaceWebauthn.register({
        userName: "u",
        timeoutMs: 25,
        challenge: FaceWebauthn.randomChallenge(16),
      }),
      /registration timed out after 25ms/,
    );
  });

  it("authenticate rejects via timeoutMs instead of hanging forever", async () => {
    hangNavigator();
    await assert.rejects(
      FaceWebauthn.authenticate({
        timeoutMs: 25,
        challenge: FaceWebauthn.randomChallenge(8),
      }),
      /authentication timed out after 25ms/,
    );
  });

  it("clears the timer when the credential arrives in time", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        credentials: {
          create: async function () {
            return { id: "fast", rawId: new Uint8Array(1), response: {} };
          },
        },
      },
      configurable: true,
      writable: true,
    });
    const cred = await FaceWebauthn.register({
      userName: "u",
      timeoutMs: 500,
      challenge: FaceWebauthn.randomChallenge(16),
    });
    assert.equal(cred.id, "fast");
  });
});

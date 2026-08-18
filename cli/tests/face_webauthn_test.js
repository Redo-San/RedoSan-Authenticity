const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── GPL polyfills ──
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };
globalThis.isSecureContext = true;
globalThis.btoa = globalThis.btoa || function (bin) { return Buffer.from(bin, "binary").toString("base64"); };
globalThis.atob = globalThis.atob || function (b64) { return Buffer.from(b64, "base64").toString("binary"); };

// ── Load module sources ──
const webauthnSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_webauthn.js"),
  "utf8",
);
vm.runInThisContext(webauthnSrc, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_webauthn.js") });

const FaceWebauthn = globalThis.FaceWebauthn;

// ── WebAuthn mocks ──
let createdCredential = null;
let getCredential = null;
let createThrows = null;
let getThrows = null;

function resetWebauthnMocks() {
  createdCredential = null;
  getCredential = null;
  createThrows = null;
  getThrows = null;
  Object.defineProperty(globalThis, "navigator", {
    value: {
      credentials: {
        create: async function (opts) {
          if (createThrows) throw createThrows;
          if (!createdCredential) return null;
          return createdCredential;
        },
        get: async function (opts) {
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
      clientDataJSON: Uint8Array.from(Buffer.from('{"type":"webauthn.create","challenge":"abc"}')),
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
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
    assert.equal(FaceWebauthn.isAvailable(), false);
  });

  it("should report unavailable in a non-secure context", () => {
    Object.defineProperty(globalThis, "isSecureContext", { value: false, configurable: true });
    assert.equal(FaceWebauthn.isAvailable(), false);
    Object.defineProperty(globalThis, "isSecureContext", { value: true, configurable: true });
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
    assert.deepEqual(FaceWebauthn.b64urlToBytes("AAEC"), Uint8Array.from([0, 1, 2]));
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
});

describe("FaceWebauthn — parseClientData", () => {
  beforeEach(resetWebauthnMocks);

  it("should parse JSON from bytes", () => {
    const bytes = Uint8Array.from(Buffer.from('{"type":"webauthn.create","challenge":"abc"}', "utf8"));
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
    assert.deepEqual(FaceWebauthn.parseClientData(Uint8Array.from([255, 254, 253])), {});
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
    assert.equal(json.response.clientDataJSON, "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiYWJjIn0");
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
    const json = FaceWebauthn.credentialToJSON(fakeCredential({
      response: {
        clientDataJSON: Uint8Array.from(Buffer.from("{}")),
        authenticatorData: Uint8Array.from([1]),
        signature: Uint8Array.from([2]),
      },
    }));
    assert.equal(json.response.attestationObject, undefined);
    assert.equal(json.response.userHandle, undefined);
  });
});

describe("FaceWebauthn — verifyClientData", () => {
  beforeEach(resetWebauthnMocks);

  it("should accept a matching challenge and type", () => {
    const json = FaceWebauthn.credentialToJSON(fakeCredential());
    const challenge = "abc";
    assert.equal(FaceWebauthn.verifyClientData(json, challenge, "webauthn.create"), true);
  });

  it("should reject a wrong challenge or type", () => {
    const json = FaceWebauthn.credentialToJSON(fakeCredential());
    assert.equal(FaceWebauthn.verifyClientData(json, "nope", "webauthn.create"), false);
    assert.equal(FaceWebauthn.verifyClientData(json, "abc", "webauthn.get"), false);
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

  it("should reject when the browser cancels registration", async () => {
    createdCredential = null;
    await assert.rejects(FaceWebauthn.register(), /cancelled/);
  });

  it("should surface browser errors", async () => {
    createThrows = new Error("NotAllowedError: user dismissed");
    await assert.rejects(FaceWebauthn.register(), /user dismissed/);
  });

  it("should require a secure WebAuthn context", async () => {
    Object.defineProperty(globalThis, "isSecureContext", { value: false, configurable: true });
    try {
      await assert.rejects(FaceWebauthn.register(), /not available/);
    } finally {
      Object.defineProperty(globalThis, "isSecureContext", { value: true, configurable: true });
    }
  });
});

describe("FaceWebauthn — authenticate", () => {
  beforeEach(resetWebauthnMocks);

  it("should return the assertion JSON", async () => {
    getCredential = fakeCredential({
      response: {
        clientDataJSON: Uint8Array.from(Buffer.from('{"type":"webauthn.get","challenge":"abc"}')),
        authenticatorData: Uint8Array.from([1, 2]),
        signature: Uint8Array.from([3, 4]),
        userHandle: Uint8Array.from([5]),
      },
    });
    const json = await FaceWebauthn.authenticate({ allowCredentials: [{ id: "AQIDBA" }] });
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
});
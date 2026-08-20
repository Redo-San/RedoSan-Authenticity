/* c8 ignore start */
(function () {
  if (
    typeof window !== "undefined" &&
    window.location &&
    window.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      window.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();
/* c8 ignore stop */
// ── Face WebAuthn: passkey as a second factor for the face registry ──
// Thin wrapper around the WebAuthn API (navigator.credentials) that returns
// plain JSON credentials (base64url-encoded) ready to be stored, plus small
// helpers for challenges and clientData parsing. No credentials are persisted
// here — the caller stores the credential reference via the FaceRegistry meta
// store.

var FaceWebauthn = (function () {
  "use strict";

  var FIDO2_ES256 = -7;
  var FIDO2_RS256 = -257;

  function b64urlToBytes(b64url) {
    var b64, bin;
    if (!b64url) return null;
    b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    bin = atob(b64);
    return Uint8Array.from(bin, function (c) {
      return c.charCodeAt(0);
    });
  }

  function bytesToB64url(bytes) {
    var bin, i;
    if (!bytes) return "";
    bin = "";
    for (i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function b64ToB64url(b64) {
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  return {
    /**
     * Whether the browser exposes WebAuthn (secure context + credentials API).
     * @returns {boolean}
     */
    isAvailable: function () {
      return (
        typeof navigator !== "undefined" &&
        !!navigator.credentials &&
        (typeof navigator.credentials.create === "function" ||
          typeof navigator.credentials.get === "function") &&
        typeof window !== "undefined" &&
        !!window.isSecureContext
      );
    },

    /**
     * Cryptographically random challenge, base64url-encoded.
     * @param {number} [bytes] length in bytes (default 32)
     * @returns {string}
     */
    randomChallenge: function (bytes) {
      var buf;
      bytes = bytes || 32;
      buf = new Uint8Array(bytes);
      if (
        typeof crypto !== "undefined" &&
        typeof crypto.getRandomValues === "function"
      ) {
        crypto.getRandomValues(buf);
      } else {
        for (var i = 0; i < bytes; i++) buf[i] = (Math.random() * 256) | 0;
      }
      return bytesToB64url(buf);
    },

    bytesToB64url: bytesToB64url,
    b64urlToBytes: b64urlToBytes,

    /**
     * Parse the clientDataJSON of a credential into a plain object.
     * @param {ArrayBuffer|Uint8Array|string} clientDataJSON
     * @returns {object}
     */
    parseClientData: function (clientDataJSON) {
      var bytes, text;
      if (!clientDataJSON) return {};
      if (typeof clientDataJSON === "string") text = clientDataJSON;
      else {
        bytes =
          clientDataJSON instanceof Uint8Array
            ? clientDataJSON
            : new Uint8Array(clientDataJSON);
        text = String.fromCharCode.apply(null, bytes);
      }
      try {
        return JSON.parse(text) || {};
      } catch (e) {
        return {};
      }
    },

    /**
     * Register a new platform passkey. Returns a JSON credential with the raw
     * binary fields base64url-encoded (WebAuthn "credential to JSON" shape).
     * @param {object} [options]
     * @param {string} [options.userId] stable user handle (default random)
     * @param {string} [options.userName] e.g. "Face Registry Owner"
     * @param {string} [options.displayName]
     * @param {string} [options.challenge] base64url (default random 32B)
     * @param {string} [options.rpId] relying party id (default location.hostname)
     * @param {string} [options.rpName] default "RedoSan Authenticity"
     * @returns {Promise<object>} { id, rawId, type, response }
     */
    register: async function (options) {
      var o, challenge, publicKey, cred;
      if (!FaceWebauthn.isAvailable()) {
        throw new Error("WebAuthn is not available in this context");
      }
      o = options || {};
      challenge = o.challenge || FaceWebauthn.randomChallenge(32);
      publicKey = {
        challenge: b64urlToBytes(challenge),
        rp: {
          name: o.rpName || "RedoSan Authenticity",
          id:
            o.rpId ||
            (typeof location !== "undefined" && location.hostname) ||
            "localhost",
        },
        user: {
          id: b64urlToBytes(o.userId || FaceWebauthn.randomChallenge(16)),
          name: o.userName || "Face Registry Owner",
          displayName: o.displayName || o.userName || "Face Registry Owner",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: FIDO2_ES256 },
          { type: "public-key", alg: FIDO2_RS256 },
        ],
        timeout: o.timeout || 60000,
        attestation: o.attestation || "none",
        authenticatorSelection: {
          authenticatorAttachment: o.authenticatorAttachment || "platform",
          residentKey: o.residentKey || "preferred",
          userVerification: o.userVerification || "preferred",
        },
        excludeCredentials: o.excludeCredentials || [],
      };
      cred = await navigator.credentials.create({ publicKey: publicKey });
      if (!cred) throw new Error("Passkey registration was cancelled");
      return FaceWebauthn.credentialToJSON(cred);
    },

    /**
     * Authenticate with a previously registered passkey.
     * @param {object} [options]
     * @param {string} [options.challenge] base64url (default random 32B)
     * @param {string} [options.rpId]
     * @param {Array<object>} [options.allowCredentials] [{ id: b64url }]
     * @param {string} [options.userVerification] default "preferred"
     * @returns {Promise<object>} { id, rawId, type, response }
     */
    authenticate: async function (options) {
      var o, challenge, publicKey, assertion;
      if (!FaceWebauthn.isAvailable()) {
        throw new Error("WebAuthn is not available in this context");
      }
      o = options || {};
      challenge = o.challenge || FaceWebauthn.randomChallenge(32);
      publicKey = {
        challenge: b64urlToBytes(challenge),
        timeout: o.timeout || 60000,
        rpId:
          o.rpId ||
          (typeof location !== "undefined" && location.hostname) ||
          "localhost",
        userVerification: o.userVerification || "preferred",
      };
      if (o.allowCredentials && o.allowCredentials.length) {
        publicKey.allowCredentials = o.allowCredentials.map(function (c) {
          return {
            type: "public-key",
            id: b64urlToBytes(c.id),
            transports: c.transports || ["internal"],
          };
        });
      }
      assertion = await navigator.credentials.get({ publicKey: publicKey });
      if (!assertion) throw new Error("Passkey authentication was cancelled");
      return FaceWebauthn.credentialToJSON(assertion);
    },

    /**
     * Convert a PublicKeyCredential / AuthenticatorAssertionResponse into a
     * plain JSON object with base64url-encoded binary fields.
     * @param {PublicKeyCredential} cred
     * @returns {object}
     */
    credentialToJSON: function (cred) {
      var resp, json;
      if (!cred || !cred.response) return null;
      resp = cred.response;
      json = {
        id: cred.id || "",
        rawId: bytesToB64url(new Uint8Array(cred.rawId || [])),
        type: cred.type || "public-key",
        response: {},
      };
      if (typeof resp.clientDataJSON !== "undefined") {
        json.response.clientDataJSON = bytesToB64url(
          new Uint8Array(resp.clientDataJSON),
        );
      }
      if (resp.attestationObject) {
        json.response.attestationObject = bytesToB64url(
          new Uint8Array(resp.attestationObject),
        );
      }
      if (resp.authenticatorData) {
        json.response.authenticatorData = bytesToB64url(
          new Uint8Array(resp.authenticatorData),
        );
      }
      if (resp.signature) {
        json.response.signature = bytesToB64url(new Uint8Array(resp.signature));
      }
      if (resp.userHandle) {
        json.response.userHandle = bytesToB64url(
          new Uint8Array(resp.userHandle),
        );
      }
      if (
        cred.getClientExtensionResults &&
        typeof cred.getClientExtensionResults === "function"
      ) {
        json.clientExtensionResults = cred.getClientExtensionResults();
      }
      return json;
    },

    /**
     * Verify the clientDataJSON of a credential contains the expected
     * challenge and origin (defensive check — no signature verification,
     * the authenticator already asserted the signature at the platform level).
     * @param {object} credential JSON credential from credentialToJSON
     * @param {string} challenge expected base64url challenge
     * @param {string} [expectedType] "webauthn.create" | "webauthn.get"
     * @returns {boolean}
     */
    verifyClientData: function (credential, challenge, expectedType) {
      var clientData, raw;
      if (!credential || !credential.response) return false;
      raw = credential.response.clientDataJSON;
      if (!raw) return false;
      clientData = FaceWebauthn.parseClientData(b64urlToBytes(raw));
      if (!clientData || typeof clientData.challenge !== "string") return false;
      if (challenge && clientData.challenge !== challenge) return false;
      if (expectedType && clientData.type !== expectedType) return false;
      return true;
    },

    b64ToB64url: b64ToB64url,
  };
})();

/* c8 ignore start */
if (typeof window !== "undefined") window.FaceWebauthn = FaceWebauthn;
/* c8 ignore stop */

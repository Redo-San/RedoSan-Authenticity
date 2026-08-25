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

  // Standard base64 <-> base64url (URL-safe) string transcoding, bridging
  // FaceCrypto's canonical base64 envelope into the base64url wire format.
  function b64urlToB64(s) {
    var b64 = String(s).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    return b64;
  }

  function b64ToB64url(b64) {
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  return {
    /**
     * Whether the browser exposes WebAuthn (secure context + credentials API).
     * @returns {boolean}
     */
    WEB_AUTHN_TIMEOUT_MS: 10000,
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
     * Full capability probe per WebAuthn best practice: API presence alone
     * is not enough — embedded webviews (Facebook/Instagram/TikTok) and
     * devices without a platform authenticator expose the API but fail the
     * ceremony. Combines isAvailable() + UVPA + in-app-webview detection.
     * @returns {Promise<boolean>} resolves false when passkeys cannot work.
     */
    isFullyCapable: function () {
      var self = this;
      if (!self.isAvailable()) return Promise.resolve(false);
      var ua = (navigator && navigator.userAgent) || "";
      if (
        /(FBAN|FBAV|FB_IAB|Instagram|Threads|Barcelona|BytedanceWebview|musical_ly|trill|Snapchat|LinkedInApp|Pinterest)/i.test(
          ua,
        )
      ) {
        return Promise.resolve(false);
      }
      try {
        if (
          typeof PublicKeyCredential === "undefined" ||
          typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !==
            "function"
        ) {
          return Promise.resolve(false);
        }
        if (!self._uvpaPromise) {
          self._uvpaPromise = new Promise(function (resolve) {
            var timer = setTimeout(function () {
              resolve(false);
            }, 3000);
            PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
              .then(function (ok) {
                clearTimeout(timer);
                resolve(!!ok);
              })
              .catch(function () {
                clearTimeout(timer);
                resolve(false);
              });
          });
        }
        return self._uvpaPromise;
      } catch (_probeErr) {
        return Promise.resolve(false);
      }
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
     * Race a WebAuthn promise against a hard JS timeout. The publicKey
     * "timeout" hint is ignored by headless/automation browsers, which would
     * otherwise hang forever with no authenticator present.
     */
    _withTimeout: function (promise, ms, label) {
      var t,
        done = false;
      return Promise.race([
        promise,
        new Promise(function (_resolve, reject) {
          t = setTimeout(function () {
            if (done) return;
            done = true;
            reject(
              new Error("WebAuthn " + label + " timed out after " + ms + "ms"),
            );
          }, ms);
        }),
      ]).then(
        function (v) {
          clearTimeout(t);
          return v;
        },
        function (e) {
          clearTimeout(t);
          throw e;
        },
      );
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
      cred = await FaceWebauthn._withTimeout(
        navigator.credentials.create({ publicKey: publicKey }),
        o.timeoutMs || FaceWebauthn.WEB_AUTHN_TIMEOUT_MS,
        "registration",
      );
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
      if (o.prfSalt) {
        publicKey.extensions = {
          prf: { eval: { first: b64urlToBytes(o.prfSalt) } },
        };
      }
      if (o.allowCredentials && o.allowCredentials.length) {
        publicKey.allowCredentials = o.allowCredentials.map(function (c) {
          return {
            type: "public-key",
            id: b64urlToBytes(c.id),
            transports: c.transports || ["internal"],
          };
        });
      }
      assertion = await FaceWebauthn._withTimeout(
        navigator.credentials.get({ publicKey: publicKey }),
        o.timeoutMs || FaceWebauthn.WEB_AUTHN_TIMEOUT_MS,
        "authentication",
      );
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

    /**
     * Extract the PRF (Pseudo-Random Function) output from a WebAuthn
     * assertion's client extension results, or null when the authenticator
     * does not support the PRF extension. The output is a deterministic 32-byte
     * value bound to the credential + salt, usable as key material for
     * deriving a symmetric vault key (AES-GCM via WebCrypto). See WebAuthn PRF
     * extension (CTAP2 hmac-secret). Reference: Corbado / Yubico PRF guides.
     * @param {object} credential JSON credential from credentialToJSON
     * @returns {Uint8Array|null}
     */
    prfOutput: function (credential) {
      var r =
        credential &&
        credential.clientExtensionResults &&
        credential.clientExtensionResults.prf;
      if (r && r.results && r.results.first) {
        return b64urlToBytes(r.results.first);
      }
      return null;
    },

    /**
     * Whether the last assertion returned a PRF output (i.e. the authenticator
     * supports the PRF extension). Used to decide between encrypted and
     * plaintext storage of the credential reference.
     * @param {object} credential JSON credential from credentialToJSON
     * @returns {boolean}
     */
    prfSupported: function (credential) {
      return !!FaceWebauthn.prfOutput(credential);
    },

    /**
     * Derive a 256-bit AES-GCM vault key from a PRF output via HKDF-SHA256.
     *
     * IKM = the PRF output, which is already a high-entropy 32-byte secret
     * deterministic per (credential, salt). Per RFC 5869 §3.1, a salt is only
     * needed to stretch LOW-entropy input; with a high-entropy IKM a fixed
     * all-zero 32-byte salt is correct and standard (matches the CTAP2/WebAuthn
     * PRF→HKDF derivation used by reference wallets). A RANDOM salt must NOT be
     * used here: it would make the derived key non-deterministic and break
     * recovery of the same vault from the same credential. The `info` string
     * provides domain separation only.
     * @param {Uint8Array} prfBytes 32-byte PRF output
     * @param {string} [info] domain-separation label
     * @returns {Promise<CryptoKey>}
     */
    deriveVaultKey: async function (prfBytes, info) {
      var prk, key;
      if (!prfBytes)
        throw new Error("PRF output is required to derive a vault key");
      if (
        typeof crypto === "undefined" ||
        !crypto.subtle ||
        typeof crypto.subtle.importKey !== "function"
      ) {
        throw new Error("WebCrypto is not available in this context");
      }
      prk = await crypto.subtle.importKey(
        "raw",
        prfBytes,
        { name: "HKDF" },
        false,
        ["deriveKey"],
      );
      key = await crypto.subtle.deriveKey(
        {
          name: "HKDF",
          salt: new Uint8Array(32),
          info: new TextEncoder().encode(info || "redo-san-face-vault-v1"),
          hash: "SHA-256",
        },
        prk,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
      return key;
    },

    /**
     * AES-GCM encrypt a JSON-serialisable object with a vault key.
     *
     * Delegates the actual AES-GCM operation to FaceCrypto.encryptWithKey so
     * the cipher core is single-sourced; only the wire encoding (base64url
     * {iv, ct}) is handled here. Throws on missing WebCrypto/FaceCrypto.
     * @param {CryptoKey} key AES-GCM 256 key from deriveVaultKey
     * @param {*} obj
     * @returns {Promise<{iv:string, ct:string}>} base64url iv + ciphertext
     */
    encryptJSON: async function (key, obj) {
      var iv, env;
      if (
        typeof FaceCrypto === "undefined" ||
        typeof FaceCrypto.encryptWithKey !== "function"
      ) {
        throw new Error("FaceCrypto (AES-GCM core) is not available");
      }
      iv = crypto.getRandomValues(new Uint8Array(12));
      env = await FaceCrypto.encryptWithKey(key, iv, obj);
      return { iv: b64ToB64url(env.iv), ct: b64ToB64url(env.cipher) };
    },

    /**
     * AES-GCM decrypt a {iv, ct} blob back into an object with a vault key.
     * Throws on tamper / wrong key (AES-GCM auth tag failure).
     * @param {CryptoKey} key
     * @param {{iv:string, ct:string}} blob
     * @returns {Promise<*>}
     */
    decryptJSON: async function (key, blob) {
      var env;
      if (
        typeof FaceCrypto === "undefined" ||
        typeof FaceCrypto.decryptWithKey !== "function"
      ) {
        throw new Error("FaceCrypto (AES-GCM core) is not available");
      }
      env = { iv: b64urlToB64(blob.iv), cipher: b64urlToB64(blob.ct) };
      return FaceCrypto.decryptWithKey(key, env);
    },
  };
})();

/* c8 ignore start */
if (typeof window !== "undefined") window.FaceWebauthn = FaceWebauthn;
/* c8 ignore stop */

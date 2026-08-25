/* c8 ignore start */
(function () {
  if (
    globalThis.window !== undefined &&
    globalThis.location &&
    globalThis.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      globalThis.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();
/* c8 ignore stop */

var faceEngine = null;
var faceRegistry = null;
var faceCamera = null;
var faceLiveness = null;
var _faceLivenessEvidence = null;
var _faceReport = null;
var _faceAutoPin = null;
var _faceKeypair = null;
var _facePendingCanvas = null;
var _facePendingSource = null;
var _faceInputTab = "upload";
var _faceEmbedder = "human";
var _lastEmbeddingVersion = "human-hse";
var _faceOverlay = null;
var _faceOverlayRAF = 0;
var _faceOverlayRunning = false;
var _faceOverlayLast = 0;
var _faceOverlayBusy = false;
var facePasskeySessionAuthed = false;
var facePasskeySessionVerifiedAt = "";
var facePasskeyRegistered = false;
/**
 * True when WebAuthn passkeys cannot work on this client (no platform
 * authenticator, or an in-app webview that blocks the ceremony). Set once
 * by the async capability probe / skip branches; relaxes the Generate gate
 * so capable-of-nothing clients are not permanently locked out.
 */
var _faceWaUnavailable = false;
var _faceWaCapableP = null;
/** Resolve (once) whether this client fully supports passkeys. */
function faceWaCapability() {
  if (_faceWaCapableP === null) {
    try {
      _faceWaCapableP =
        typeof FaceWebauthn !== "undefined" &&
        typeof FaceWebauthn.isFullyCapable === "function"
          ? FaceWebauthn.isFullyCapable()
          : Promise.resolve(
              typeof FaceWebauthn !== "undefined" &&
                typeof FaceWebauthn.isAvailable === "function" &&
                FaceWebauthn.isAvailable(),
            );
    } catch (_probeErr) {
      _faceWaCapableP = Promise.resolve(false);
    }
  }
  return _faceWaCapableP;
}
// Last decrypted credential reference (credentialId + rawId), populated on the
// first step-up of a session so subsequent generations can skip the prompt.
var facePasskeyCached = null;
// Stable info label for HKDF domain separation (vault key derivation).
var FACE_VAULT_INFO = "redo-san-face-vault-v1";

/**
 * @param id
 * @param msg
 */
function setStatus(id, msg) {
  var el = document.getElementById(id);
  if (el) el.textContent = msg;
}

/**
 * Show the current pipeline step in the #face-steps box.
 * @param {string|null} text
 */
function setFaceStep(text) {
  var el = document.getElementById("face-steps");
  if (!el) return;
  if (!text) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.textContent = text;
  el.style.display = "block";
}

/**
 * Keep only ASCII characters in a text field value. "label" mode allows
 * English letters, digits, space, dot, dash and underscore; "pass" mode
 * allows any printable ASCII (passphrase safety: blocks non-English input
 * but keeps symbols). Returns the sanitized string (never mutates).
 * @param {string} value
 * @param {"label"|"pass"} mode
 * @returns {string}
 */
function sanitizeFaceText(value, mode) {
  var out, i, c;
  if (typeof value !== "string") return "";
  out = "";
  for (i = 0; i < value.length; i++) {
    c = value.charCodeAt(i);
    if (mode === "pass") {
      if (c >= 0x20 && c <= 0x7e) out += value[i];
    } else if (
      c === 32 ||
      (c >= 48 && c <= 57) ||
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122) ||
      c === 45 ||
      c === 46 ||
      c === 95
    ) {
      if (
        c === 32 &&
        (out.length === 0 || out.charCodeAt(out.length - 1) === 32)
      )
        continue;
      out += value[i];
    }
  }
  return out;
}

var _faceProgressOverlay = null;

/**
 * Re-resolve the overlay elements from the live DOM (cheap) so calls stay
 * correct even after the SPA router swaps the page.
 * @returns {object|null}
 */
function faceProgressRefs() {
  var overlay;
  if (typeof document === "undefined" || !document.getElementById) return null;
  overlay = document.getElementById("face-progress-overlay");
  if (!overlay) return null;
  return {
    overlay: overlay,
    bar: document.getElementById("face-progress-bar"),
    title: document.getElementById("face-progress-title"),
    text: document.getElementById("face-progress-text"),
    pct: document.getElementById("face-progress-pct"),
  };
}

/**
 * Lazily build the blur + spinner progress overlay (works in both the SPA
 * hub and the MPA page). The overlay fades in/out via a CSS opacity
 * transition; the spinner and the indeterminate shimmer are compositor
 * driven, so they keep animating even while the main thread is busy with
 * face detection.
 * @returns {HTMLElement|null}
 */
function faceProgressEnsure() {
  var refs, overlay, card, spin, track, bar, title, text, pct;
  refs = faceProgressRefs();
  if (refs) return refs.overlay;
  if (
    typeof document === "undefined" ||
    !document.getElementById ||
    !document.createElement ||
    !document.body
  )
    return null;
  overlay = document.createElement("div");
  overlay.id = "face-progress-overlay";
  overlay.className = "face-progress-overlay";
  card = document.createElement("div");
  card.className = "face-progress-card";
  spin = document.createElement("div");
  spin.className = "face-progress-spinner";
  title = document.createElement("div");
  title.className = "face-progress-title";
  title.id = "face-progress-title";
  text = document.createElement("div");
  text.className = "face-progress-text";
  text.id = "face-progress-text";
  track = document.createElement("div");
  track.className = "face-progress-track";
  bar = document.createElement("div");
  bar.className = "face-progress-bar";
  bar.id = "face-progress-bar";
  pct = document.createElement("div");
  pct.className = "face-progress-pct";
  pct.id = "face-progress-pct";
  pct.textContent = "0%";
  track.appendChild(bar);
  track.appendChild(pct);
  card.appendChild(spin);
  card.appendChild(title);
  card.appendChild(text);
  card.appendChild(track);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  _faceProgressOverlay = overlay;
  return overlay;
}

/**
 * Fade the progress overlay in and start the current stage label.
 * @param {string} title
 * @param {string} text
 */
function faceProgressShow(title, text) {
  var refs;
  refs = faceProgressRefs();
  if (!refs) {
    if (!faceProgressEnsure()) return;
    refs = faceProgressRefs();
    if (!refs) return;
  }
  if (refs.title) refs.title.textContent = title;
  if (refs.text) refs.text.textContent = text;
  if (refs.bar) refs.bar.style.width = "0%";
  if (refs.pct) refs.pct.textContent = "0%";
  void refs.overlay.offsetWidth; // force reflow so the transition actually runs
  refs.overlay.classList.add("is-visible");
}

/**
 * Advance the determinate progress bar (0..1) and refresh the stage text.
 * @param {number} fraction
 * @param {string|null} text
 */
function faceProgressUpdate(fraction, text) {
  var refs, pct, p;
  refs = faceProgressRefs();
  if (!refs || !refs.overlay.classList.contains("is-visible")) return;
  if (refs.text && text) refs.text.textContent = text;
  pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  if (refs.bar) {
    refs.bar.style.width = pct + "%";
    refs.bar.classList.add("is-det");
  }
  if (refs.pct) refs.pct.textContent = pct + "%";
  p = refs.pct || refs.bar;
  if (p && p.setAttribute) p.setAttribute("aria-valuenow", String(pct));
}

/**
 * Fade the progress overlay out (CSS transition) and detach it so a later
 * run rebuilds a fresh element.
 */
function faceProgressHide() {
  var overlay, t;
  overlay = faceProgressRefs() ? faceProgressRefs().overlay : null;
  if (!overlay || !overlay.classList) return;
  overlay.classList.remove("is-visible");
  t = setTimeout(function () {
    if (
      overlay &&
      overlay.parentNode &&
      typeof overlay.parentNode.removeChild === "function" &&
      !overlay.classList.contains("is-visible")
    ) {
      overlay.parentNode.removeChild(overlay);
    }
  }, 600);
  if (t && t.unref) t.unref();
  _faceProgressOverlay = null;
}

/**
 * Update both the #face-steps box and the progress overlay for a stage.
 * @param {string|null} text
 * @param {number|null} fraction
 */
function setFaceStage(text, fraction) {
  setFaceStep(text);
  if (fraction !== null && typeof faceProgressUpdate === "function") {
    faceProgressUpdate(fraction, text);
  }
}

/**
 * SHA-256 digest of a descriptor (hex). Falls back to the legacy rolling hash
 * only when WebCrypto/FaceCrypto is unavailable.
 * @param {Float32Array|number[]} desc
 * @returns {Promise<string|null>}
 */
async function faceDescriptorHash(desc) {
  var hash, i;
  if (!desc || typeof desc.length !== "number" || desc.length === 0)
    return null;
  if (typeof FaceCrypto !== "undefined" && FaceCrypto.sha256Hex) {
    try {
      return await FaceCrypto.sha256Hex(desc);
    } catch (e) {
      /* fall through to legacy hash */
    }
  }
  hash = 0;
  for (i = 0; i < desc.length; i++) {
    hash = ((hash << 5) - hash + Math.round(desc[i] * 1000)) | 0;
  }
  return Math.abs(hash).toString(16);
}

/**
 * @param {number} n
 */
function faceRandomToken(n) {
  var out, i, bytes, chars;
  chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  out = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    for (i = 0; i < n; i++) out += chars[bytes[i] % chars.length];
  } else {
    for (i = 0; i < n; i++) out += chars[(Math.random() * chars.length) | 0];
  }
  return out;
}

/**
 * @param {Uint8Array} bytes
 */
function faceBytesToHex(bytes) {
  var out, i, h;
  if (!bytes) return "";
  out = "";
  for (i = 0; i < bytes.length; i++) {
    h = bytes[i].toString(16);
    if (h.length < 2) h = "0" + h;
    out += h;
  }
  return out;
}

/**
 * Current embedding engine selection from the #face-embedder select.
 * @returns {string}
 */
function getFaceEmbedderChoice() {
  var sel;
  sel = document.getElementById("face-embedder");
  if (sel && sel.value) return sel.value;
  return _faceEmbedder || "human";
}

/**
 * Called by the #face-embedder select onchange; stores the choice and
 * keeps the hint text in sync with the selected engine.
 */
function handleFaceEmbedderChange() {
  var sel;
  sel = document.getElementById("face-embedder");
  if (sel) _faceEmbedder = sel.value;
  updateFaceEmbedderHint();
}

/**
 * Refresh the helper text under the embedder select to describe the
 * selected engine (offline Human vs CDN-loaded ArcFace ONNX).
 */
function updateFaceEmbedderHint() {
  var hint;
  hint = document.getElementById("face-embedder-hint");
  if (!hint) return;
  hint.removeAttribute("data-i18n");
  hint.textContent =
    _faceEmbedder === "arcface"
      ? __(
          "face.embedder_hint_arcface",
          "ArcFace loads a ~13 MB ONNX model from jsDelivr on first use (WebGPU/WASM).",
        )
      : __(
          "face.embedder_hint_human",
          "Human (HSE) runs fully offline — nothing is downloaded and face data never leaves this device.",
        );
}

/**
 * Human-readable label for one face attribute value.
 * @param {*} v
 * @returns {string}
 */
function faceAttrText(v) {
  if (v == null) return "";
  if (Array.isArray(v)) {
    if (
      v.length > 0 &&
      v[0] &&
      typeof v[0] === "object" &&
      v[0].emotion != null &&
      v[0].score != null
    ) {
      var top = v.reduce(function (a, b) {
        return (b.score || 0) > (a.score || 0) ? b : a;
      });
      return String(top.emotion) + " (" + Math.round(top.score * 100) + "%)";
    }
    return v
      .map(function (x) {
        if (x && typeof x === "object" && x.label != null) return x.label;
        if (x && typeof x === "object" && x.emotion != null)
          return String(x.emotion);
        return String(x);
      })
      .join(", ");
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Extract the descriptor for one face using the selected embedder:
 * "arcface" (MobileFaceNet via ONNX runtime, aligned by 5-point landmarks)
 * or "human" (Human HSE from the detection result).
 * Any ArcFace failure falls back to the human descriptor.
 * @param {HTMLCanvasElement} canvas
 * @param {object} face Detection result (mesh + descriptor)
 * @returns {Promise<{descriptor: Float32Array|null, version: string, error?: string}>}
 */
async function faceExtractEmbedding(canvas, face) {
  var choice, mesh5, aligned, emb;
  choice = getFaceEmbedderChoice();
  if (choice === "arcface") {
    if (
      typeof FaceAlign === "undefined" ||
      typeof FaceONNXEmbedder === "undefined"
    ) {
      return {
        descriptor: face ? face.descriptor : null,
        version: "human-hse",
        error: "arcface-unavailable",
      };
    }
    if (!FaceONNXEmbedder.isReady()) {
      await FaceONNXEmbedder.load();
    }
    if (!FaceONNXEmbedder.isReady()) {
      return {
        descriptor: face ? face.descriptor : null,
        version: "human-hse",
        error: "arcface-load-failed",
      };
    }
    mesh5 = face && face.mesh ? FaceAlign.meshToLandmarks5(face.mesh) : null;
    if (!mesh5) {
      return {
        descriptor: face ? face.descriptor : null,
        version: "human-hse",
        error: "arcface-align-failed",
      };
    }
    aligned = FaceAlign.alignFace(canvas, mesh5);
    if (!aligned) {
      return {
        descriptor: face ? face.descriptor : null,
        version: "human-hse",
        error: "arcface-align-failed",
      };
    }
    try {
      emb = await FaceONNXEmbedder.embed(aligned.canvas);
    } catch (e) {
      return {
        descriptor: face ? face.descriptor : null,
        version: "human-hse",
        error: "arcface-embed-error",
      };
    }
    if (!emb) {
      return {
        descriptor: face ? face.descriptor : null,
        version: "human-hse",
        error: "arcface-embed-null",
      };
    }
    return { descriptor: emb, version: "arcface-mbf" };
  }
  return { descriptor: face ? face.descriptor : null, version: "human-hse" };
}

/**
 *
 */
async function initFaceBiometric() {
  var passEl;
  try {
    // Re-entrancy guard: mpa-router re-runs this init on every AJAX
    // navigation to the page; keep the already-created engine/registry so
    // the human model is not re-downloaded and IndexedDB is not re-opened.
    if (!faceEngine && typeof FaceEngine === "function") {
      faceEngine = new FaceEngine();
    }
    if (!faceRegistry && typeof FaceRegistry === "function") {
      faceRegistry = new FaceRegistry();
      await faceRegistry.open();
    }
  } catch (error) {
    setStatus("face-status", "Failed to initialize: " + error.message);
  }
  passEl = document.getElementById("face-lock-pass");
  if (passEl && typeof passEl.addEventListener === "function") {
    passEl.addEventListener("input", function () {
      passEl.value = sanitizeFaceText(passEl.value, "pass");
    });
  }
  initFaceConsent();
  updateFaceEmbedderHint();
  // Early capability probe: unlock the Generate gate on clients where
  // passkeys cannot work (mobile webviews / no platform authenticator).
  // Requires a REAL browser context (WebAuthn-capable navigator + document)
  // so node/test-VM harnesses with stubbed globals never mutate state.
  if (
    typeof window !== "undefined" &&
    !!window.document &&
    typeof navigator !== "undefined" &&
    !!navigator.credentials &&
    typeof navigator.credentials.create === "function"
  ) {
    faceWaCapability()
      .then(function (capable) {
        if (!capable) {
          _faceWaUnavailable = true;
          updateFaceRunState();
        }
      })
      .catch(function () {
        _faceWaUnavailable = true;
        updateFaceRunState();
      });
  }
  if (typeof listRegisteredFaces === "function") await listRegisteredFaces();
  if (typeof maybePromptFaceEncryption === "function")
    await maybePromptFaceEncryption();
  if (typeof refreshPasskeyStatus === "function") await refreshPasskeyStatus();
}

/**
 * When the registry holds plaintext templates, nudge the user to lock it:
 * status message + focus on the passphrase field. Never throws.
 */
async function maybePromptFaceEncryption() {
  // The registry-encryption (passphrase lock) UI was removed; nothing to prompt.
  return;
}

/**
 * Refresh the passkey row: read the stored credential reference from the
 * registry meta store and toggle the register/remove buttons. Never throws.
 * @returns {Promise<void>}
 */
async function refreshPasskeyStatus() {
  var passkey, statusEl, regBtn, remBtn;
  if (!faceRegistry) return;
  statusEl = document.getElementById("face-passkey-status");
  regBtn = document.getElementById("face-passkey-register-btn");
  remBtn = document.getElementById("face-passkey-remove-btn");
  try {
    passkey = await faceRegistry.getMeta("passkey");
  } catch (e) {
    passkey = null;
  }
  if (statusEl) {
    statusEl.textContent =
      passkey && (passkey.credentialId || passkey.prf)
        ? __("face.passkey_registered", "Passkey registered: {0}")
            .split("{0}")
            .join(passkey.name || "passkey")
        : __("face.passkey_none", "No passkey registered yet.");
  }
  if (regBtn)
    regBtn.disabled = !!(passkey && (passkey.credentialId || passkey.prf));
  if (remBtn)
    remBtn.style.display =
      passkey && (passkey.credentialId || passkey.prf) ? "" : "none";
  facePasskeyRegistered = !!(passkey && (passkey.credentialId || passkey.prf));
  if (typeof updateFaceRunState === "function") updateFaceRunState();
}

/**
 * Register a platform passkey and store its reference in the registry meta
 * store (second factor alongside the passphrase).
 * @returns {Promise<void>}
 */
async function handlePasskeyRegister() {
  var cred, passkey, regBtn;
  if (!faceRegistry) {
    setStatus("face-status", "Face Registry not initialized.");
    return;
  }
  if (typeof FaceWebauthn === "undefined") {
    setStatus("face-status", "WebAuthn module not loaded.");
    return;
  }
  if (!FaceWebauthn.isAvailable()) {
    setStatus(
      "face-status",
      __(
        "face.passkey_unavailable",
        "WebAuthn is not available on this device or browser.",
      ),
    );
    return;
  }
  regBtn = document.getElementById("face-passkey-register-btn");
  if (regBtn) regBtn.disabled = true;
  try {
    var vaultKey = null;
    cred = await FaceWebauthn.register();
    passkey = {
      v: 1,
      name: cred.id.slice(0, 16) + "\u2026",
      createdAt: new Date().toISOString(),
      prf: false,
    };
    // Encrypt the credential reference with a PRF-derived vault key when the
    // authenticator supports the PRF extension. PRF is requested during a
    // second (step-up) assertion right after registration; the derived key
    // never leaves the authenticator's secure element and is re-derived each
    // session. The plaintext credentialId/rawId live ONLY inside the cipher,
    // so the stored record is opaque without a fresh authenticator assertion.
    // If PRF is unavailable, fall back to plaintext storage with a warning
    // (the reference is public by design — no private key is ever stored).
    if (typeof crypto !== "undefined" && crypto.subtle) {
      try {
        var salt = FaceWebauthn.randomChallenge(16);
        var prfAssertion = await FaceWebauthn.authenticate({
          prfSalt: salt,
          userVerification: "required",
          allowCredentials: [{ id: cred.id, transports: ["internal"] }],
        });
        var prfBytes = FaceWebauthn.prfOutput(prfAssertion);
        if (prfBytes) {
          vaultKey = await FaceWebauthn.deriveVaultKey(
            prfBytes,
            FACE_VAULT_INFO,
          );
          var cipher = await FaceWebauthn.encryptJSON(vaultKey, {
            credentialId: cred.id,
            rawId: cred.rawId,
          });
          passkey.prf = true;
          passkey.salt = salt;
          passkey.cipher = cipher;
        } else {
          passkey.credentialId = cred.id;
          passkey.rawId = cred.rawId;
          console.warn(
            "[face] WebAuthn PRF not supported — passkey stored as plaintext reference.",
          );
        }
      } catch (encErr) {
        if (cred && cred.id) {
          passkey.credentialId = cred.id;
          passkey.rawId = cred.rawId;
        }
        console.warn(
          "[face] PRF encryption failed — passkey stored as plaintext reference.",
          encErr,
        );
      }
    } else {
      passkey.credentialId = cred.id;
      passkey.rawId = cred.rawId;
    }
    await faceRegistry.setMeta("passkey", passkey);
    // The PRF-derived vault key now transparently encrypts biometric
    // templates at rest — automatic, no passphrase needed.
    if (vaultKey) {
      try {
        faceRegistry.setVaultKey(vaultKey);
        await faceRegistry.sealAllPlaintext();
      } catch (sealErr) {
        console.warn("[face] automatic template encryption skipped:", sealErr);
      }
    }
    setStatus(
      "face-status",
      __(
        "face.passkey_saved",
        "Passkey saved — this registry is now protected by a second factor.",
      ),
    );
  } catch (error) {
    setStatus(
      "face-status",
      __("face.passkey_error", "Passkey error: {0}")
        .split("{0}")
        .join(error.message),
    );
  }
  await refreshPasskeyStatus();
}

/**
 * Remove the stored passkey reference from the registry meta store. The
 * authenticator-side credential remains until the user deletes it in the
 * browser's passkey manager.
 * @returns {Promise<void>}
 */
async function handlePasskeyRemove() {
  var passkey;
  if (!faceRegistry) return;
  try {
    passkey = await faceRegistry.getMeta("passkey");
    if (passkey && passkey.credentialId)
      await faceRegistry.removeMeta("passkey");
    setStatus(
      "face-status",
      __("face.passkey_removed", "Passkey removed from this registry."),
    );
    facePasskeyCached = null;
    facePasskeySessionAuthed = false;
  } catch (error) {
    setStatus("face-status", "Passkey error: " + error.message);
  }
  await refreshPasskeyStatus();
}

/**
 * @returns {Promise<boolean>} true when a passkey is already registered.
 */
async function isFacePasskeyRegistered() {
  var pk;
  if (!faceRegistry) return false;
  try {
    pk = await faceRegistry.getMeta("passkey");
    return !!(pk && (pk.credentialId || pk.prf));
  } catch (e) {
    return false;
  }
}

/**
 * Reveal the passkey requirement box (used as a gate before generation) and
 * scroll it into view so the user can register.
 */
function revealPasskeyRequire() {
  var box, statusEl;
  box = document.getElementById("face-passkey-require");
  if (box && box.style) box.style.display = "block";
  statusEl = document.getElementById("face-passkey-status");
  if (statusEl)
    statusEl.textContent = __(
      "face.passkey_none",
      "No passkey registered yet.",
    );
  if (box && typeof box.scrollIntoView === "function") {
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/**
 * Gate used by every generation entry point (upload / camera / run). Blocks the
 * action until a passkey is registered — when WebAuthn is available the user
 * must register before any identifier can be generated. On devices without
 * WebAuthn the requirement is skipped (generation still proceeds).
 * @returns {Promise<boolean>} true when the action may proceed.
 */
async function ensureFacePasskeyForAction(force) {
  var registered, waAvailable;
  registered = await isFacePasskeyRegistered();
  if (registered) return true;
  // Session-level dismissal: once the user cancels a ceremony, entry-point
  // gates stop re-prompting on every photo/camera action. The GENERATION
  // step always passes force=true so the security requirement stands.
  var dismissed = false;
  try {
    dismissed = sessionStorage.getItem(FACE_PK_SKIP_KEY) === "1";
  } catch (_e) {}
  if (dismissed && !force) {
    revealPasskeyRequire();
    return false;
  }
  try {
    waAvailable =
      typeof FaceWebauthn !== "undefined" &&
      typeof FaceWebauthn.isAvailable === "function" &&
      FaceWebauthn.isAvailable();
    if (waAvailable && typeof FaceWebauthn.isFullyCapable === "function") {
      waAvailable = await FaceWebauthn.isFullyCapable();
    }
  } catch (_probeErr) {
    waAvailable = false;
  }
  if (!waAvailable) {
    _faceWaUnavailable = true;
    updateFaceRunState();
    setStatus(
      "face-status",
      __(
        "face.passkey_skipped",
        "WebAuthn unavailable on this device — passkey requirement skipped.",
      ),
    );
    return true;
  }
  await handlePasskeyRegister();
  var ok = await isFacePasskeyRegistered();
  if (!ok) {
    try {
      sessionStorage.setItem(FACE_PK_SKIP_KEY, "1");
    } catch (_e) {}
    setStatus(
      "face-status",
      __(
        "face.passkey_required_run",
        "Register a passkey to enable generation.",
      ),
    );
  } else {
    try {
      sessionStorage.removeItem(FACE_PK_SKIP_KEY);
    } catch (_e) {}
  }
  return ok;
}

/**
 * Pipeline step 7/8: step-up verification of the registered passkey.
 * Performs a fresh WebAuthn assertion (userVerification required) the first
 * time per browser session — the session flag resets on page reload, so the
 * user must re-prove possession (biometric / PIN) after every refresh. Once
 * verified this session, subsequent generations reuse the flag. The stored
 * passkey reference is always included in the report.
 *
 * A failed or cancelled assertion throws, which aborts the generation (the
 * caller's try/catch reports it). Never silently bypasses the step-up.
 * @returns {Promise<object|null>}
 */
async function faceStepRegisterPasskey() {
  var stored;
  if (!faceRegistry) return null;
  try {
    stored = await faceRegistry.getMeta("passkey");
  } catch (e) {
    stored = null;
  }
  if (!stored || !(stored.credentialId || stored.prf)) return null;
  // Already verified this session — reuse the cached decrypted reference.
  if (facePasskeySessionAuthed && facePasskeyCached) {
    return {
      credentialId: facePasskeyCached.credentialId,
      name: stored.name || "",
      createdAt: stored.createdAt || "",
      authenticated: true,
      verifiedAt: facePasskeySessionVerifiedAt || "",
      note: "verified earlier this session",
    };
  }
  if (typeof FaceWebauthn === "undefined" || !FaceWebauthn.isAvailable()) {
    // Cannot perform step-up in this context; fall back to stored reference.
    return {
      credentialId: stored.credentialId || "",
      name: stored.name || "",
      createdAt: stored.createdAt || "",
      authenticated: false,
      note: "step-up skipped: WebAuthn unavailable",
    };
  }
  try {
    var challenge = FaceWebauthn.randomChallenge(32);
    var allowCreds = stored.credentialId
      ? [
          {
            id: stored.credentialId,
            transports: stored.transports || ["internal"],
          },
        ]
      : undefined;
    var assertion = await FaceWebauthn.authenticate({
      challenge: challenge,
      userVerification: "required",
      allowCredentials: allowCreds,
      prfSalt: stored.prf ? stored.salt : undefined,
    });
    if (!FaceWebauthn.verifyClientData(assertion, challenge, "webauthn.get")) {
      throw new Error("Passkey assertion did not match the challenge.");
    }
    var credentialId = stored.credentialId || "";
    var rawId = stored.rawId || "";
    if (stored.prf) {
      // Re-derive the vault key from the PRF output and decrypt the opaque
      // credential reference. This proves possession of the authenticator and
      // recovers the credentialId without ever storing it in plaintext.
      var prfBytes = FaceWebauthn.prfOutput(assertion);
      if (prfBytes) {
        var key = await FaceWebauthn.deriveVaultKey(prfBytes, FACE_VAULT_INFO);
        var dec = await FaceWebauthn.decryptJSON(key, stored.cipher);
        credentialId = dec.credentialId || credentialId;
        rawId = dec.rawId || rawId;
      } else if (!credentialId) {
        // PRF was expected (record is encrypted) but the authenticator did not
        // return it and there is no plaintext fallback.
        throw new Error("Passkey PRF unavailable and no plaintext fallback.");
      }
    }
    // Automatically encrypt biometric templates at rest using the PRF vault key.
    // The template added earlier in this pipeline (step 6/8) is sealed here.
    if (faceRegistry && key) {
      try {
        faceRegistry.setVaultKey(key);
        await faceRegistry.sealAllPlaintext();
      } catch (sealErr) {
        console.warn("[face] automatic template encryption skipped:", sealErr);
      }
    }
    facePasskeyCached = { credentialId: credentialId, rawId: rawId };
    facePasskeySessionAuthed = true;
    facePasskeySessionVerifiedAt = new Date().toISOString();
    return {
      credentialId: credentialId,
      name: stored.name || "",
      createdAt: stored.createdAt || "",
      authenticated: true,
      verifiedAt: facePasskeySessionVerifiedAt,
      rawId: assertion.rawId || rawId,
    };
  } catch (e) {
    throw new Error("Passkey step-up failed: " + e.message);
  }
}

/**
 * Pipeline step 8/8 (LAST): issue a W3C Verifiable Credential from the SHA-256
 * descriptor hash only (never the raw template) signed with the session DID
 * keypair. Depends on all main generation results already being produced, so
 * it is intentionally the final step. Never throws — on failure the error is
 * recorded on the report instead of aborting the whole pipeline.
 * @param {{kp:object|null, descriptor:object, attributes:object|null, liveness:object|null, faceCount:number, embeddingVersion:string}} input
 * @returns {Promise<object|null>}
 */
async function faceStepIssueFaceCredential(input) {
  var kp, dh, vc;
  kp = input.kp;
  if (!kp || !kp.did || typeof FaceVC === "undefined") return null;
  try {
    dh = await faceDescriptorHash(input.descriptor);
    vc = FaceVC.build({
      did: kp.did,
      algorithm: kp.algorithm,
      descriptorHash: dh,
      attributes: input.attributes || null,
      liveness: input.liveness || null,
      faceCount: input.faceCount,
      embeddingVersion: input.embeddingVersion,
    });
    vc = await FaceVC.sign(kp, vc);
    window._faceCredential = vc;
    return vc;
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Discard the staged photo (canvas preview + source) when a picked file is
 * rejected, so a previously staged photo is never left on screen as if it
 * were the rejected file.
 */
function clearFacePendingPhoto() {
  var prevEl, startBtn, capBtn;
  _facePendingCanvas = null;
  _facePendingSource = null;
  prevEl = document.getElementById("face-preview");
  if (prevEl && prevEl.style) prevEl.style.display = "none";
  startBtn = document.getElementById("face-cam-start");
  if (startBtn) startBtn.disabled = false;
  capBtn = document.getElementById("face-cam-capture");
  if (capBtn) capBtn.disabled = true;
  updateFaceRunState();
}

/**
 * Entry point for the photo input: stage the photo and refresh the run button.
 * The pipeline starts only via handleFaceRun() once the photo is staged and
 * the Name/Label field is filled in.
 */
async function handleFaceFilePicked() {
  var file, loaded, ctx, startBtn, capBtn, imgEl, inputEl, validated;
  if (!faceConsentGranted()) {
    faceWarnConsentRequired();
    return;
  }
  if (!(await ensureFacePasskeyForAction())) return;
  inputEl = document.getElementById("face-image");
  file = inputEl.files[0];
  if (!file) return;
  if (typeof validateFileInput === "function") {
    try {
      validated = await validateFileInput(inputEl);
    } catch (e) {
      validated = true;
    }
    if (!validated || !inputEl.files.length) {
      clearFacePendingPhoto();
      return;
    }
    file = inputEl.files[0];
  }
  if (
    file.type &&
    !["image/png", "image/jpeg"].some(function (t) {
      return t === file.type;
    })
  ) {
    setStatus(
      "face-status",
      "Unsupported file type. Please use a PNG or JPEG photo.",
    );
    clearFacePendingPhoto();
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    setStatus("face-status", "Photo too large. Maximum file size is 25 MB.");
    clearFacePendingPhoto();
    return;
  }
  try {
    loaded = await loadImage(file);
  } catch (error) {
    setStatus("face-status", "Failed to load image: " + error.message);
    clearFacePendingPhoto();
    return;
  }
  if (loaded.w > 5000 || loaded.h > 5000) {
    setStatus(
      "face-status",
      "Photo dimensions too large. Maximum is 5000x5000 px.",
    );
    clearFacePendingPhoto();
    return;
  }
  if (faceCamera && faceCamera.isActive()) handleFaceCameraStop("face-camera");
  _facePendingCanvas = loaded.canvas;
  _facePendingSource = {
    source: "file",
    fileName: file.name,
    width: loaded.w,
    height: loaded.h,
  };
  prevEl = document.getElementById("face-preview");
  prevEl.width = loaded.w;
  prevEl.height = loaded.h;
  ctx = prevEl.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(loaded.canvas, 0, 0);
  if (prevEl.style) prevEl.style.display = "block";
  startBtn = document.getElementById("face-cam-start");
  if (startBtn) startBtn.disabled = true;
  capBtn = document.getElementById("face-cam-capture");
  if (capBtn) capBtn.disabled = true;
  imgEl = document.getElementById("face-image");
  if (imgEl) imgEl.disabled = false;
  setStatus(
    "face-status",
    "Photo loaded. Enter a Name/Label, then press Generate Identifiers.",
  );
  updateFaceRunState();
}

/**
 * Enable the Generate Identifiers button only when a photo is staged AND the
 * Name/Label field is filled in.
 */
function updateFaceRunState() {
  var btn, label;
  btn = document.getElementById("face-run");
  if (!btn) return;
  label = document.getElementById("face-label");
  if (label && typeof label.value === "string") {
    label.value = sanitizeFaceText(label.value, "label");
  }
  if (!faceConsentGranted()) {
    btn.disabled = true;
    faceWarnConsentRequired(false);
    return;
  }
  var waSatisfied = facePasskeyRegistered || _faceWaUnavailable;
  if (
    !(
      _facePendingCanvas &&
      label &&
      label.value &&
      label.value.trim() !== "" &&
      waSatisfied
    )
  ) {
    btn.disabled = true;
    // Surface the passkey requirement only when everything else is ready, so
    // the user knows why the button is still disabled.
    if (
      _facePendingCanvas &&
      label &&
      label.value &&
      label.value.trim() !== "" &&
      !waSatisfied
    ) {
      setStatus(
        "face-status",
        __(
          "face.passkey_required_run",
          "Register a passkey to enable generation.",
        ),
      );
    }
    return;
  }
  btn.disabled = false;
}

// ── Biometric consent + retention (GDPR Art 9(2)(a), BIPA 740 ILCS 14) ──

/**
 * Consent record: stored in sessionStorage so the choice is scoped to the
 * current browsing session — every new visit requires an explicit consent.
 * Withdrawing consent deletes the record AND all stored biometric data.
 */
var FACE_PK_SKIP_KEY = "redoSan.facePkSkipSession";
var FACE_CONSENT_KEY = "redoSan.faceConsent";
var FACE_CONSENT_VERSION = 1;
var FACE_CONSENT_POLICY_VERSION = 1;

/**
 * Load the stored consent record for this session.
 *
 * Consent is versioned on TWO axes (GDPR Art 7(4) + EDPB/WP29 guidance:
 * consent degrades when the privacy notice or processing purpose changes,
 * so a materially changed policy must invalidate prior consent and force a
 * fresh, informed grant):
 *   - `version`        : structure/shape of the stored record.
 *   - `policyVersion`  : the consent NOTICE shown to the user (text, purposes,
 *                        data flows). Bumped in AGENTS.md/governance whenever
 *                        the notice changes.
 * Both must match the current build or the record is treated as absent and
 * the user is re-prompted.
 *
 * @returns {object|null} stored consent record (null when missing/expired/stale)
 */
function faceConsentLoad() {
  var raw, rec;
  try {
    if (typeof sessionStorage === "undefined") return null;
    raw = sessionStorage.getItem(FACE_CONSENT_KEY);
    if (!raw) return null;
    rec = JSON.parse(raw);
    if (
      !rec ||
      rec.version !== FACE_CONSENT_VERSION ||
      rec.policyVersion !== FACE_CONSENT_POLICY_VERSION
    ) {
      return null;
    }
    return rec;
  } catch (e) {
    return null;
  }
}

/**
 * @param {object} rec
 */
function faceConsentSave(rec) {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(FACE_CONSENT_KEY, JSON.stringify(rec));
    }
  } catch (e) {
    // privacy mode / quota — consent still holds for this session
  }
}

function faceConsentClear() {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(FACE_CONSENT_KEY);
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Unmissable notice when a collection entry point is blocked by missing
 * consent: a status message plus a scroll-and-highlight of the consent panel
 * so the user understands why the upload/camera/run action did not proceed.
 * @param {boolean} [highlight=true] skip the scroll/highlight when false
 */
function faceWarnConsentRequired(highlight) {
  var panel, status;
  status = document.getElementById("face-status");
  if (status) {
    status.textContent = __(
      "face.consent_needed_first",
      "⚠️ Biometric consent is required first — accept the notice above to enable photo upload and camera capture.",
    );
  }
  if (highlight === false) return;
  panel = document.getElementById("face-consent-panel");
  if (panel && typeof panel.scrollIntoView === "function") {
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (panel && panel.style) {
    panel.style.boxShadow = "0 0 0 3px rgba(245,197,66,.6)";
    setTimeout(function () {
      if (panel.style) panel.style.boxShadow = "";
    }, 1800);
  }
}

/**
 * The biometric gate. Active only when the consent panel exists in the page
 * (the Face Biometric MPA); embedded/test contexts without the panel are
 * not gated. The panel is shown before any collection can start.
 * @returns {boolean}
 */
function faceConsentGranted() {
  var panel = document.getElementById("face-consent-panel");
  if (!panel) return true;
  return !!faceConsentLoad();
}

/**
 * Accept handler: requires an explicit, unticked opt-in (GDPR Art 9(2)(a) —
 * pre-ticked boxes are not valid consent).
 * @returns {Promise<void>}
 */
async function handleFaceConsentAccept() {
  var check, panel, statusEl, imgEl, startBtn;
  check = document.getElementById("face-consent-check");
  if (!check || !check.checked) {
    setStatus(
      "face-status",
      __(
        "face.consent_check_required",
        "Please tick the consent checkbox first.",
      ),
    );
    return;
  }
  faceConsentSave({
    version: FACE_CONSENT_VERSION,
    policyVersion: FACE_CONSENT_POLICY_VERSION,
    acceptedAt: new Date().toISOString(),
  });
  panel = document.getElementById("face-consent-panel");
  if (panel) panel.style.display = "none";
  statusEl = document.getElementById("face-consent-status");
  if (statusEl) statusEl.style.display = "block";
  imgEl = document.getElementById("face-image");
  if (imgEl) imgEl.disabled = false;
  startBtn = document.getElementById("face-cam-start");
  if (startBtn) startBtn.disabled = false;
  updateFaceRunState();
  setStatus(
    "face-status",
    __(
      "face.consent_recorded",
      "Consent recorded — all processing stays on this device.",
    ),
  );
}

/**
 * Withdraw consent (GDPR Art 7(3)): drops the record and deletes every
 * stored biometric template (Art 17 erasure) after a confirmation.
 * @returns {Promise<void>}
 */
async function handleFaceConsentWithdraw() {
  var panel, statusEl, imgEl, startBtn, runBtn;
  if (
    typeof confirm === "function" &&
    !confirm(
      __(
        "face.consent_withdraw_confirm",
        "Withdraw consent? This deletes all stored face data on this device.",
      ),
    )
  ) {
    return;
  }
  faceConsentClear();
  if (faceRegistry) {
    try {
      await faceRegistry.clear();
    } catch (e) {
      // registry failure must not block the withdrawal
    }
  }
  panel = document.getElementById("face-consent-panel");
  if (panel) panel.style.display = "";
  statusEl = document.getElementById("face-consent-status");
  if (statusEl) statusEl.style.display = "none";
  imgEl = document.getElementById("face-image");
  if (imgEl) imgEl.disabled = true;
  startBtn = document.getElementById("face-cam-start");
  if (startBtn) startBtn.disabled = true;
  runBtn = document.getElementById("face-run");
  if (runBtn) runBtn.disabled = true;
  if (typeof listRegisteredFaces === "function") await listRegisteredFaces();
  setStatus(
    "face-status",
    __(
      "face.consent_withdrawn",
      "Consent withdrawn — stored biometric data deleted.",
    ),
  );
}

/**
 * Wire the consent panel at startup: hide it when consent is already on
 * record, otherwise show it and block every collection entry point. Never
 * throws.
 */
function initFaceConsent() {
  var panel, check, acceptBtn, imgEl, startBtn, statusEl;
  panel = document.getElementById("face-consent-panel");
  if (!panel) return;
  check = document.getElementById("face-consent-check");
  acceptBtn = document.getElementById("face-consent-accept");
  if (faceConsentLoad()) {
    panel.style.display = "none";
    statusEl = document.getElementById("face-consent-status");
    if (statusEl) statusEl.style.display = "block";
    return;
  }
  imgEl = document.getElementById("face-image");
  if (imgEl) imgEl.disabled = true;
  startBtn = document.getElementById("face-cam-start");
  if (startBtn) startBtn.disabled = true;
  if (check && typeof check.addEventListener === "function") {
    check.addEventListener("change", function () {
      if (acceptBtn) acceptBtn.disabled = !check.checked;
    });
  }
}

/**
 * Switch between "Upload Photo" and "Capture with Camera" (ID Forge style).
 * Switching input method discards the staged photo and stops the camera.
 * @param {string} tab
 */
function switchFaceInput(tab) {
  var btns, wrapU, wrapC, prev, startBtn, imgEl;
  if (tab !== "upload" && tab !== "camera") return;
  if (!faceConsentGranted()) {
    faceWarnConsentRequired();
    return;
  }
  if (_faceInputTab === tab) return;
  _faceInputTab = tab;
  btns = document.querySelectorAll("[data-face-tab]");
  for (let i = 0; i < btns.length; i++) {
    if (btns[i].classList) {
      btns[i].classList.toggle("is-active", btns[i].dataset.faceTab === tab);
    }
  }
  wrapU = document.getElementById("face-upload-wrapper");
  wrapC = document.getElementById("face-capture-wrapper");
  if (wrapU) wrapU.style.display = tab === "upload" ? "block" : "none";
  if (wrapC) wrapC.style.display = tab === "camera" ? "block" : "none";
  _facePendingCanvas = null;
  _facePendingSource = null;
  if (tab === "camera") {
    startBtn = document.getElementById("face-cam-start");
    if (startBtn) startBtn.disabled = false;
    imgEl = document.getElementById("face-image");
    if (imgEl) imgEl.disabled = false;
  } else if (typeof handleFaceCameraStop === "function") {
    handleFaceCameraStop("face-camera");
  }
  prev = document.getElementById("face-preview");
  if (prev && prev.style) prev.style.display = "none";
  setStatus("face-status", "");
  updateFaceRunState();
}

/**
 * Start the automated pipeline with the staged photo (file or camera frame).
 */
async function handleFaceRun() {
  if (!faceConsentGranted()) {
    faceWarnConsentRequired();
    return;
  }
  if (!_facePendingCanvas) {
    setStatus(
      "face-status",
      "No photo loaded. Pick a photo or capture one with the camera first.",
    );
    return;
  }
  if (!(await ensureFacePasskeyForAction(true))) return;
  return runFacePipeline(_facePendingCanvas, _facePendingSource || {});
}

/**
 * Core automated pipeline: detect → DID keypair + signature + VC → BioHash →
 * Fuzzy → registry match (and optional auto-register) → render report.
 * @param {HTMLCanvasElement} canvas
 * @param {{source?: string, fileName?: string, width?: number, height?: number, liveness?: object|null}} opts
 */
async function runFacePipeline(canvas, opts) {
  var result, ctx, box, desc, label, pinEl, pinVal, kp, sigBytes, sigB64;
  var doc, vc, bio, fuzzy, matchR, id, report, repEl, emb;
  var pkObj, credObj;
  opts = opts || {};
  _faceReport = null;
  _faceAutoPin = null;
  window._faceReport = null;
  renderFaceActions(false);
  repEl = document.getElementById("face-report");
  if (repEl) repEl.style.display = "none";
  if (!faceEngine) {
    if (typeof FaceEngine === "function") {
      faceEngine = new FaceEngine();
    }
    if (typeof FaceRegistry === "function") {
      faceRegistry = new FaceRegistry();
      await faceRegistry.open();
    }
  }
  if (!faceEngine) {
    setStatus("face-status", "Face Engine not initialized.");
    setFaceStep(null);
    return;
  }
  try {
    faceProgressShow(
      __("face.progress.title", "Generating Identifiers"),
      __("face.step.detect", "Detecting face..."),
    );
    setFaceStage("1/8 " + __("face.step.detect", "Detecting face..."), 0.06);
    setStatus("face-status", "Loading models...");
    await faceEngine.loadModels();
    setStatus("face-status", "Detecting faces...");
    result = await faceEngine.detectFaces(canvas);
    prevEl = document.getElementById("face-preview");
    prevEl.width = canvas.width;
    prevEl.height = canvas.height;
    ctx = prevEl.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0);
    if (prevEl.style) prevEl.style.display = "block";
    if (result.length > 0) {
      box = result[0].box;
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.fillStyle = "#00ff00";
      ctx.font = "16px sans-serif";
      ctx.fillText(
        "Face " + (result[0].score || result[0].confidence || 0).toFixed(2),
        box.x,
        box.y - 5,
      );
      emb = await faceExtractEmbedding(canvas, result[0]);
      desc = emb.descriptor;
      _lastEmbeddingVersion = emb.version;
      window._lastDescriptor = desc;
      window._lastEmbeddingVersion = _lastEmbeddingVersion;
      window._lastFaceCount = result.length;
      window._lastSource = opts.source || "file";
      if (!desc) {
        setStatus(
          "face-status",
          "No face descriptor available (embedder: " + emb.version + ").",
        );
        setFaceStep(null);
        faceProgressHide();
        return;
      }
    } else {
      window._lastDescriptor = null;
      window._lastFaceCount = 0;
      setStatus("face-status", "No face detected in the image.");
      setFaceStep(null);
      faceProgressHide();
      return;
    }

    setFaceStage(
      "2/8 " + __("face.step.did", "Generating DID keypair..."),
      0.2,
    );
    setStatus("face-status", "Generating DID keypair...");
    kp = null;
    if (typeof didGenerateKeypair === "function") {
      kp = await didGenerateKeypair("Ed25519");
      globalThis._didKeypair = kp;
      _faceKeypair = kp;
    }

    setFaceStage(
      "3/8 " + __("face.step.sign", "Signing descriptor with DID..."),
      0.35,
    );
    setStatus("face-status", "Signing face descriptor with DID...");
    sigBytes = null;
    sigB64 = null;
    if (kp && typeof didSign === "function") {
      sigBytes = await didSign(kp, new Uint8Array(desc.buffer));
      sigB64 = didSigToBase64
        ? didSigToBase64(sigBytes)
        : btoa(String.fromCharCode.apply(null, sigBytes));
    }
    doc =
      typeof didGenerateDocument === "function" && kp
        ? didGenerateDocument(kp)
        : null;
    vc =
      typeof didCreateVerifiableCredential === "function" && kp && sigB64
        ? didCreateVerifiableCredential(
            kp,
            await faceDescriptorHash(desc),
            sigB64,
          )
        : null;

    setFaceStage(
      "4/8 " + __("face.step.biohash", "Generating Privacy ID..."),
      0.5,
    );
    setStatus("face-status", "Generating Privacy Identifier (BioHash)...");
    bio = null;
    pinEl = document.getElementById("face-biohash-pin");
    pinVal = pinEl && pinEl.value ? pinEl.value.trim() : "";
    if (!pinVal) {
      _faceAutoPin = faceRandomToken(8);
      pinVal = _faceAutoPin;
    }
    if (
      typeof FaceBioHash !== "undefined" &&
      typeof FaceBioHash.generate === "function"
    ) {
      bio = FaceBioHash.generate(desc, pinVal);
      bio.codeHex = FaceBioHash.bytesToHex(bio.code);
      bio.pinAuto = !!_faceAutoPin;
    }

    setFaceStage(
      "5/8 " + __("face.step.fuzzy", "Generating Fuzzy ID..."),
      0.62,
    );
    setStatus("face-status", "Generating Fuzzy identifier...");
    fuzzy = null;
    if (
      typeof FaceFuzzy !== "undefined" &&
      typeof FaceFuzzy.quantize === "function" &&
      typeof FaceFuzzy.encode === "function"
    ) {
      fuzzy = FaceFuzzy.encode(FaceFuzzy.quantize(desc));
      fuzzy.helperHex = faceBytesToHex(fuzzy.helper);
    }

    // step 6/8 — Passkey step-up verification (per session; gated at entry).
    // Derives the PRF vault key and seals/unseals templates BEFORE matching so
    // previously registered faces are decryptable for 1:N identification. This
    // is what makes template encryption automatic yet non-breaking for matching.
    setFaceStage(
      "6/8 " + __("face.step.passkey", "Verifying passkey (step-up)..."),
      0.74,
    );
    setStatus("face-status", "Verifying passkey...");
    pkObj = await faceStepRegisterPasskey();

    // step 7/8 — Match against the (now decrypted) registry.
    setFaceStage("7/8 " + __("face.step.match", "Matching registry..."), 0.86);
    setStatus("face-status", "Checking registered faces...");
    matchR = null;
    id = null;
    if (faceRegistry) {
      try {
        matchR = await faceRegistry.findMatch(desc, 0.5, _lastEmbeddingVersion);
      } catch (e) {
        matchR = null;
      }
      label = document.getElementById("face-label");
      label = label && label.value ? label.value.trim() : "";
      if (label) {
        try {
          id = await faceRegistry.addFace(label, desc, {
            embeddingVersion: _lastEmbeddingVersion,
            attributes: result[0].attributes || null,
          });
        } catch (e) {
          id = null;
        }
      }
    }

    // step 8/8 — Issue Face Credential (LAST; depends on all main results)
    setFaceStage(
      "8/8 " + __("face.step.credential", "Issuing face credential..."),
      0.96,
    );
    credObj = await faceStepIssueFaceCredential({
      kp: kp,
      descriptor: desc,
      attributes: result[0].attributes || null,
      liveness: opts.liveness || null,
      faceCount: result.length,
      embeddingVersion: _lastEmbeddingVersion,
    });

    report = {
      type: "redoSan.faceBiometricReport",
      version: 2,
      generatedAt: new Date().toISOString(),
      generator: "RedoSan Authenticity",
      source: opts.source || "file",
      photo: {
        fileName:
          opts.fileName ||
          (opts.source === "camera" ? "camera_capture" : "photo"),
        width: opts.width || canvas.width,
        height: opts.height || canvas.height,
        facesDetected: result.length,
        confidence: result[0].score || result[0].confidence || 0,
        descriptorDim: desc.length,
        descriptorHash: await faceDescriptorHash(desc),
        descriptorHashAlg: "sha-256",
        embeddingVersion: _lastEmbeddingVersion,
        attributes: result[0].attributes || null,
      },
      did: kp
        ? {
            did: kp.did,
            algorithm: kp.algorithm,
            signature: sigB64,
            signedAt: new Date().toISOString(),
            document: doc,
            verifiableCredential: vc,
          }
        : null,
      biohash: bio
        ? {
            bits: bio.bits,
            codeHex: bio.codeHex,
            pinFingerprint: bio.pinFingerprint,
            pinAuto: !!_faceAutoPin,
          }
        : null,
      autoPin: _faceAutoPin || null,
      fuzzy: fuzzy
        ? {
            bits: desc.length,
            helperHex: fuzzy.helperHex,
            params: fuzzy.params,
            key: fuzzy.key,
          }
        : null,
      registry: {
        match:
          matchR && matchR.match
            ? {
                label: matchR.match.label,
                similarity: Math.max(0, (1 - matchR.distance) * 100),
                embeddingVersion: matchR.match.embeddingVersion || null,
              }
            : null,
        registeredId: id || null,
      },
      liveness: opts.liveness || null,
      passkey: pkObj || null,
      credential: credObj || null,
    };
    _faceReport = report;
    window._faceReport = report;
    renderFaceReport(report);
    setDownloadHandler(downloadFaceReport);
    renderFaceActions(true);
    setStatus("face-status", "Done. All identifiers generated.");
    if (faceRegistry && typeof listRegisteredFaces === "function")
      await listRegisteredFaces();
  } catch (error) {
    setStatus("face-status", "Pipeline error: " + error.message);
  }
  setFaceStep(null);
  faceProgressHide();
}

/**
 * @param {boolean} show
 */
function renderFaceActions(show) {
  var el = document.getElementById("face-actions");
  if (!el) return;
  el.style.display = show ? "flex" : "none";
}

/**
 * Organized HTML report of every generated identifier/signature.
 * @param {object} r
 */
function renderFaceReport(r) {
  var el, html, sections, h, sim, pinBox, mt, credStr;
  el = document.getElementById("face-report");
  if (!el) return;
  mt = document.querySelector("#dl-modal-title");
  if (mt) mt.textContent = __("dl.title") || "Download Face Report";
  html = '<div class="result" style="margin-top:4px">';
  html +=
    "<h3 style='margin:0 0 8px'>" +
    __("face.report.title", "Biometric Report") +
    "</h3>";

  sections = [];
  sections.push([
    __("face.report.detection", "Face Detection"),
    "<table class='meta-table'>" +
      "<tr><td>" +
      __("face.report.file", "File") +
      "</td><td><code>" +
      escHtml(r.photo.fileName) +
      "</code></td></tr>" +
      "<tr><td>" +
      __("face.report.size", "Dimensions") +
      "</td><td>" +
      r.photo.width +
      " x " +
      r.photo.height +
      " px</td></tr>" +
      "<tr><td>" +
      __("face.report.faces", "Faces") +
      "</td><td>" +
      r.photo.facesDetected +
      "</td></tr>" +
      "<tr><td>" +
      __("face.report.confidence", "Confidence") +
      "</td><td>" +
      (r.photo.confidence * 100).toFixed(1) +
      "%</td></tr>" +
      "<tr><td>" +
      __("face.report.desc_dim", "Descriptor") +
      "</td><td>" +
      r.photo.descriptorDim +
      " dims</td></tr>" +
      "<tr><td>" +
      __("face.report.embedder", "Embedder") +
      "</td><td>" +
      escHtml(r.photo.embeddingVersion || "human-hse") +
      "</td></tr>" +
      "<tr><td>" +
      __("face.report.desc_hash", "Descriptor hash") +
      "</td><td><code style='font-size:0.7rem'>" +
      escHtml(r.photo.descriptorHash) +
      "</code></td></tr>" +
      "</table>",
  ]);

  if (r.photo.attributes) {
    sections.push([
      __("face.report.attributes", "Face attributes"),
      "<table class='meta-table'>" +
        "<tr><td>Emotion</td><td>" +
        escHtml(faceAttrText(r.photo.attributes.emotion)) +
        "</td></tr>" +
        "<tr><td>Age</td><td>" +
        escHtml(faceAttrText(r.photo.attributes.age)) +
        "</td></tr>" +
        "<tr><td>Gender</td><td>" +
        escHtml(faceAttrText(r.photo.attributes.gender)) +
        "</td></tr>" +
        "<tr><td>Iris</td><td>" +
        escHtml(faceAttrText(r.photo.attributes.iris)) +
        "</td></tr>" +
        "<tr><td>Gaze</td><td>" +
        escHtml(faceAttrText(r.photo.attributes.gaze)) +
        "</td></tr>" +
        "</table>",
    ]);
  }

  if (r.did) {
    sections.push([
      __("face.report.did", "DID Identity & Signature"),
      "<table class='meta-table'>" +
        "<tr><td>DID</td><td><code style='font-size:0.7rem;word-break:break-all'>" +
        escHtml(r.did.did) +
        "</code></td></tr>" +
        "<tr><td>" +
        __("face.report.algorithm", "Algorithm") +
        "</td><td>" +
        escHtml(r.did.algorithm) +
        "</td></tr>" +
        "<tr><td>" +
        __("face.report.signed_at", "Signed at") +
        "</td><td>" +
        escHtml(r.did.signedAt) +
        "</td></tr>" +
        "<tr><td>" +
        __("face.report.signature", "Signature") +
        "</td><td><code style='font-size:0.65rem;word-break:break-all'>" +
        escHtml(r.did.signature) +
        "</code></td></tr>" +
        "</table>" +
        "<details style='margin-top:6px'><summary style='cursor:pointer;font-size:0.75rem'>" +
        __("face.report.did_doc", "DID document") +
        "</summary><pre style='font-size:0.65rem;overflow-x:auto;background:rgba(0,0,0,.04);padding:8px;border-radius:6px'>" +
        escHtml(JSON.stringify(r.did.document, null, 2)) +
        "</pre></details>" +
        "<details style='margin-top:4px'><summary style='cursor:pointer;font-size:0.75rem'>" +
        __("face.report.vc", "Verifiable Credential") +
        "</summary><pre style='font-size:0.65rem;overflow-x:auto;background:rgba(0,0,0,.04);padding:8px;border-radius:6px'>" +
        escHtml(JSON.stringify(r.did.verifiableCredential, null, 2)) +
        "</pre></details>",
    ]);
  }

  if (r.biohash) {
    pinBox = "";
    if (r.biohash.pinAuto && r.autoPin) {
      pinBox =
        "<p style='margin-top:6px;font-size:0.75rem;background:rgba(255,193,7,.15);padding:6px 8px;border-radius:6px'><strong>" +
        __("face.report.auto_pin", "Auto-generated PIN (save it!)") +
        ":</strong> <code>" +
        escHtml(r.autoPin) +
        "</code></p>";
    }
    sections.push([
      __("face.report.biohash", "Privacy Identifier (BioHash)"),
      "<table class='meta-table'>" +
        "<tr><td>" +
        __("face.report.bits", "Bits") +
        "</td><td>" +
        r.biohash.bits +
        "</td></tr>" +
        "<tr><td>" +
        __("face.report.privacy_id", "Privacy ID") +
        "</td><td><code style='font-size:0.65rem;word-break:break-all'>" +
        escHtml(r.biohash.codeHex) +
        "</code></td></tr>" +
        "<tr><td>" +
        __("face.report.pin_fp", "PIN fingerprint") +
        "</td><td><code style='font-size:0.65rem;word-break:break-all'>" +
        escHtml(r.biohash.pinFingerprint) +
        "</code></td></tr>" +
        "</table>" +
        pinBox,
    ]);
  }

  if (r.fuzzy) {
    sections.push([
      __("face.report.fuzzy", "Fuzzy Identifier"),
      "<table class='meta-table'>" +
        "<tr><td>" +
        __("face.report.bits", "Bits") +
        "</td><td>" +
        r.fuzzy.bits +
        "</td></tr>" +
        "<tr><td>Key</td><td><code style='font-size:0.65rem;word-break:break-all'>" +
        escHtml(r.fuzzy.key) +
        "</code></td></tr>" +
        "</table>" +
        "<details style='margin-top:6px'><summary style='cursor:pointer;font-size:0.75rem'>" +
        __("face.report.helper", "Helper data") +
        "</summary><code style='font-size:0.6rem;word-break:break-all'>" +
        escHtml(r.fuzzy.helperHex) +
        "</code></details>",
    ]);
  }

  sim = "";
  if (r.registry.match) {
    sim =
      "<p style='margin-top:6px;font-size:0.8rem;background:rgba(40,167,69,.1);padding:6px 8px;border-radius:6px'><strong>" +
      __("face.report.match_found", "Match found") +
      ":</strong> " +
      escHtml(r.registry.match.label) +
      " (" +
      r.registry.match.similarity.toFixed(1) +
      "%)</p>";
  } else {
    sim =
      "<p style='margin-top:6px;font-size:0.8rem;color:var(--text-muted)'>" +
      __("face.report.no_match", "Not found in the registry.") +
      "</p>";
  }
  if (r.registry.registeredId) {
    sim +=
      "<p style='margin-top:4px;font-size:0.8rem;background:rgba(40,167,69,.1);padding:6px 8px;border-radius:6px'><strong>" +
      __("face.report.registered", "Registered") +
      ":</strong> ID " +
      r.registry.registeredId +
      "</p>";
  }
  sections.push([__("face.report.registry", "Registry"), sim]);

  if (r.liveness) {
    sections.push([
      __("face.report.liveness", "Liveness"),
      "<p style='font-size:0.8rem;margin:0'>" +
        (r.liveness.live
          ? "<span style='color:#28a745'>&#10003; " +
            __("face.report.live_passed", "Passed") +
            "</span>"
          : "<span style='color:#dc3545'>&#10007; " +
            __("face.report.live_failed", "Failed") +
            "</span>") +
        "</p>",
    ]);
  }

  if (r.passkey) {
    sections.push([
      __("face.report.passkey", "Passkey"),
      "<table class='meta-table'>" +
        "<tr><td>Credential ID</td><td><code style='font-size:0.65rem;word-break:break-all'>" +
        escHtml(r.passkey.credentialId) +
        "</code></td></tr>" +
        (r.passkey.name
          ? "<tr><td>Name</td><td>" + escHtml(r.passkey.name) + "</td></tr>"
          : "") +
        (r.passkey.createdAt
          ? "<tr><td>Created</td><td>" +
            escHtml(r.passkey.createdAt) +
            "</td></tr>"
          : "") +
        "<tr><td>Session verified</td><td>" +
        (r.passkey.authenticated
          ? "Yes" +
            (r.passkey.verifiedAt ? " — " + escHtml(r.passkey.verifiedAt) : "")
          : "No" +
            (r.passkey.note ? " (" + escHtml(r.passkey.note) + ")" : "")) +
        "</td></tr>" +
        "</table>",
    ]);
  } else {
    sections.push([
      __("face.report.passkey", "Passkey"),
      "<p style='font-size:0.8rem;color:var(--text-muted)'>" +
        __("face.report.no_passkey", "Not registered.") +
        "</p>",
    ]);
  }

  if (r.credential) {
    if (r.credential.error) {
      sections.push([
        __("face.report.credential", "Face Credential"),
        "<p style='font-size:0.8rem;color:#dc3545'>" +
          escHtml(r.credential.error) +
          "</p>",
      ]);
    } else {
      credStr =
        typeof FaceVC !== "undefined" && FaceVC.toJSON
          ? FaceVC.toJSON(r.credential)
          : JSON.stringify(r.credential, null, 2);
      sections.push([
        __("face.report.credential", "Face Credential"),
        "<details style='margin-top:6px'><summary style='cursor:pointer;font-size:0.75rem'>" +
          __("face.report.vc", "Verifiable Credential") +
          "</summary><pre style='font-size:0.65rem;overflow-x:auto;background:rgba(0,0,0,.04);padding:8px;border-radius:6px'>" +
          escHtml(credStr) +
          "</pre></details>",
      ]);
    }
  }

  for (h = 0; h < sections.length; h++) {
    html +=
      "<div style='margin-top:10px;padding:10px;border:1px solid var(--border-color,#ddd);border-radius:8px'>" +
      "<strong style='font-size:0.8rem'>" +
      sections[h][0] +
      "</strong>" +
      sections[h][1] +
      "</div>";
  }

  html += "</div>";
  el.innerHTML = html;
  el.style.display = "block";
}

/**
 * Multi-format download (JSON/CSV/TXT/XML/HTML/PDF/DOCX) — same pattern as the
 * Fingerprint service. Registered as the download handler for #dl-modal.
 * @param {string} format
 */
async function downloadFaceReport(format) {
  var r, base, content, ext, mime, labels;
  closeDownloadModal();
  r = _faceReport;
  if (!r) return;
  base = r.photo.fileName.replace(/[\\/:*?"<>|]/g, "_").replace(/\.\w+$/, "");
  if (format === "pdf") {
    downloadBlobSimple(await faceReportToPDF(r), base + ".face_report.pdf");
    return;
  }
  if (format === "doc") {
    downloadBlobSimple(await faceReportToDOCX(r), base + ".face_report.docx");
    return;
  }
  switch (format) {
    case "json":
      content = JSON.stringify(r, null, 2);
      ext = "json";
      mime = "application/json";
      break;
    case "csv":
      labels = await faceLabelsToSheet("csv", { includeDescriptor: false });
      content =
        faceReportToCSV(r) + (labels ? "\n\n[Face Labels]\n" + labels : "");
      ext = "csv";
      mime = "text/csv";
      break;
    case "txt":
      labels = await faceLabelsToSheet("txt", { includeDescriptor: false });
      content =
        faceReportToTXT(r) + (labels ? "\n\n[Face Labels]\n" + labels : "");
      ext = "txt";
      mime = "text/plain";
      break;
    case "xml":
      content = faceReportToXML(r);
      ext = "xml";
      mime = "application/xml";
      break;
    case "html":
      content = faceReportToHTML(r);
      ext = "html";
      mime = "text/html";
      break;
  }
  if (content == null) return;
  downloadBlobSimple(
    new Blob([content], { type: mime }),
    base + ".face_report." + ext,
  );
}

/**
 * @param {object} r
 * @returns {string}
 */
function faceReportToCSV(r) {
  var rows, push;
  rows = [
    ["Key", "Value"],
    ["Type", r.type],
    ["Generated at", r.generatedAt],
    ["Source", r.source],
    ["File", r.photo.fileName],
    ["Dimensions", r.photo.width + "x" + r.photo.height],
    ["Faces detected", r.photo.facesDetected],
    ["Confidence", r.photo.confidence],
    ["Descriptor dims", r.photo.descriptorDim],
    ["Descriptor hash", r.photo.descriptorHash],
    ["Embedder", r.photo.embeddingVersion || "human-hse"],
  ];
  push = function (k, v) {
    if (v != null && v !== "") rows.push([k, v]);
  };
  if (r.did) {
    push("DID", r.did.did);
    push("DID algorithm", r.did.algorithm);
    push("DID signed at", r.did.signedAt);
    push("DID signature", r.did.signature);
  }
  if (r.biohash) {
    push("Privacy ID bits", r.biohash.bits);
    push("Privacy ID", r.biohash.codeHex);
    push("PIN fingerprint", r.biohash.pinFingerprint);
  }
  if (r.autoPin) push("Auto PIN (save it!)", r.autoPin);
  if (r.fuzzy) {
    push("Fuzzy bits", r.fuzzy.bits);
    push("Fuzzy key", r.fuzzy.key);
    push("Fuzzy helper", r.fuzzy.helperHex);
  }
  push(
    "Registry match",
    r.registry.match
      ? r.registry.match.label +
          " (" +
          r.registry.match.similarity.toFixed(1) +
          "%)"
      : "none",
  );
  push("Registered ID", r.registry.registeredId);
  push("Passkey", r.passkey ? r.passkey.credentialId : "none");
  push("Passkey Verified", r.passkey && r.passkey.authenticated ? "yes" : "no");
  push(
    "Face Credential",
    r.credential
      ? r.credential.error
        ? "error: " + r.credential.error
        : r.credential.id || "issued"
      : "none",
  );
  return rows
    .map(function (row) {
      return row
        .map(function (cell) {
          return (
            '"' +
            String(cell)
              .replace(/^[=+\-@\t\r]/g, "'$&")
              .replaceAll('"', '""') +
            '"'
          );
        })
        .join(",");
    })
    .join("\n");
}

/**
 * @param {object} r
 * @returns {string}
 */
function faceReportToTXT(r) {
  var lines, push;
  lines = ["=== RedoSan Authenticity - Face Biometric Report ===", ""];
  push = function (k, v) {
    if (v != null && v !== "") lines.push(k + ": " + v);
  };
  push("Generated at", r.generatedAt);
  push("Source", r.source);
  push("File", r.photo.fileName);
  push("Dimensions", r.photo.width + " x " + r.photo.height + " px");
  push("Faces detected", r.photo.facesDetected);
  push("Confidence", (r.photo.confidence * 100).toFixed(1) + "%");
  push("Descriptor", r.photo.descriptorDim + " dims");
  push("Descriptor hash", r.photo.descriptorHash);
  push("Embedder", r.photo.embeddingVersion || "human-hse");
  lines.push("");
  lines.push("-- DID Identity & Signature --");
  if (r.did) {
    push("DID", r.did.did);
    push("Algorithm", r.did.algorithm);
    push("Signed at", r.did.signedAt);
    push("Signature", r.did.signature);
  } else {
    lines.push("(DID module unavailable)");
  }
  lines.push("");
  lines.push("-- Privacy Identifier (BioHash) --");
  if (r.biohash) {
    push("Bits", r.biohash.bits);
    push("Privacy ID", r.biohash.codeHex);
    push("PIN fingerprint", r.biohash.pinFingerprint);
    if (r.biohash.pinAuto && r.autoPin) push("Auto PIN (save it!)", r.autoPin);
  } else {
    lines.push("(BioHash module unavailable)");
  }
  lines.push("");
  lines.push("-- Fuzzy Identifier --");
  if (r.fuzzy) {
    push("Bits", r.fuzzy.bits);
    push("Key", r.fuzzy.key);
    push("Helper", r.fuzzy.helperHex);
  } else {
    lines.push("(Fuzzy module unavailable)");
  }
  lines.push("");
  lines.push("-- Registry --");
  push(
    "Match",
    r.registry.match
      ? r.registry.match.label +
          " (" +
          r.registry.match.similarity.toFixed(1) +
          "%)"
      : "Not found in the registry.",
  );
  push("Registered ID", r.registry.registeredId);
  if (r.liveness) push("Liveness", r.liveness.live ? "passed" : "failed");
  lines.push("");
  lines.push("-- Passkey --");
  if (r.passkey) {
    push("Credential ID", r.passkey.credentialId);
    if (r.passkey.name) push("Name", r.passkey.name);
    if (r.passkey.createdAt) push("Created", r.passkey.createdAt);
    push("Verified", r.passkey.authenticated ? "yes" : "no");
  } else {
    lines.push("Not registered.");
  }
  lines.push("");
  lines.push("-- Face Credential --");
  if (r.credential) {
    if (r.credential.error) lines.push("Error: " + r.credential.error);
    else
      lines.push(
        "Issued " +
          (r.credential.id || "") +
          (r.credential.type ? " (" + r.credential.type + ")" : ""),
      );
  } else {
    lines.push("Not issued.");
  }
  lines.push("");
  lines.push("Generated by RedoSan Authenticity");
  return lines.join("\n");
}

/**
 * @param {object} r
 * @returns {string}
 */
function faceReportToXML(r) {
  var push, x;
  push = function (k, v) {
    return (
      "    <" +
      k +
      ">" +
      String(v)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;") +
      "</" +
      k +
      ">\n"
    );
  };
  x = '<?xml version="1.0" encoding="UTF-8"?>\n<faceBiometricReport>\n';
  x += "  <generatedAt>" + r.generatedAt + "</generatedAt>\n";
  x += "  <source>" + r.source + "</source>\n";
  x += "  <photo>\n";
  x += push("fileName", r.photo.fileName);
  x += push("width", r.photo.width);
  x += push("height", r.photo.height);
  x += push("facesDetected", r.photo.facesDetected);
  x += push("confidence", r.photo.confidence);
  x += push("descriptorDim", r.photo.descriptorDim);
  x += push("descriptorHash", r.photo.descriptorHash);
  x += push("embeddingVersion", r.photo.embeddingVersion || "human-hse");
  x += "  </photo>\n";
  if (r.did) {
    x += "  <did>\n";
    x += push("did", r.did.did);
    x += push("algorithm", r.did.algorithm);
    x += push("signedAt", r.did.signedAt);
    x += push("signature", r.did.signature);
    x += "  </did>\n";
  }
  if (r.biohash) {
    x += "  <biohash>\n";
    x += push("bits", r.biohash.bits);
    x += push("codeHex", r.biohash.codeHex);
    x += push("pinFingerprint", r.biohash.pinFingerprint);
    x += push("pinAuto", r.biohash.pinAuto);
    x += "  </biohash>\n";
  }
  if (r.autoPin) x += push("autoPin", r.autoPin);
  if (r.fuzzy) {
    x += "  <fuzzy>\n";
    x += push("bits", r.fuzzy.bits);
    x += push("key", r.fuzzy.key);
    x += push("helperHex", r.fuzzy.helperHex);
    x += "  </fuzzy>\n";
  }
  x += "  <registry>\n";
  x += push(
    "match",
    r.registry.match
      ? r.registry.match.label +
          " (" +
          r.registry.match.similarity.toFixed(1) +
          "%)"
      : "none",
  );
  x += push("registeredId", r.registry.registeredId || "");
  x += "  </registry>\n";
  x += "  <passkey>\n";
  if (r.passkey) {
    x += push("credentialId", r.passkey.credentialId);
    x += push("name", r.passkey.name || "");
    x += push("createdAt", r.passkey.createdAt || "");
    x += push("authenticated", r.passkey.authenticated ? "true" : "false");
  } else {
    x += push("status", "none");
  }
  x += "  </passkey>\n";
  x += "  <credential>\n";
  if (r.credential) {
    if (r.credential.error) {
      x += push("error", r.credential.error);
    } else {
      x += push("id", r.credential.id || "");
      x += push("type", r.credential.type || "");
    }
  } else {
    x += push("status", "none");
  }
  x += "  </credential>\n";
  x += "</faceBiometricReport>\n";
  return x;
}

/**
 * @param {object} r
 * @returns {string}
 */
function faceReportToHTML(r) {
  var html, row;
  row = function (k, v) {
    return (
      "<tr><td style='width:160px;font-weight:bold'>" +
      escHtml(String(k)) +
      "</td><td style='word-break:break-all'>" +
      escHtml(String(v)) +
      "</td></tr>"
    );
  };
  html =
    "<!doctype html><html><head><meta charset='utf-8'><title>Face Biometric Report</title></head><body style='font-family:sans-serif'>";
  html += "<h2>RedoSan Authenticity - Face Biometric Report</h2>";
  html +=
    "<h3>Detection</h3><table border='1' cellpadding='6' style='border-collapse:collapse'>";
  html += row("Generated at", r.generatedAt);
  html += row("Source", r.source);
  html += row("File", r.photo.fileName);
  html += row("Dimensions", r.photo.width + " x " + r.photo.height);
  html += row("Faces detected", r.photo.facesDetected);
  html += row("Confidence", (r.photo.confidence * 100).toFixed(1) + "%");
  html += row("Descriptor", r.photo.descriptorDim + " dims");
  html += row("Embedder", r.photo.embeddingVersion || "human-hse");
  html += row("Descriptor hash", r.photo.descriptorHash);
  html += "</table>";
  if (r.did) {
    html +=
      "<h3>DID Identity &amp; Signature</h3><table border='1' cellpadding='6' style='border-collapse:collapse'>";
    html += row("DID", r.did.did);
    html += row("Algorithm", r.did.algorithm);
    html += row("Signed at", r.did.signedAt);
    html += row("Signature", r.did.signature);
    html += "</table>";
  }
  if (r.biohash) {
    html +=
      "<h3>Privacy Identifier (BioHash)</h3><table border='1' cellpadding='6' style='border-collapse:collapse'>";
    html += row("Bits", r.biohash.bits);
    html += row("Privacy ID", r.biohash.codeHex);
    html += row("PIN fingerprint", r.biohash.pinFingerprint);
    if (r.autoPin) html += row("Auto PIN (save it!)", r.autoPin);
    html += "</table>";
  }
  if (r.fuzzy) {
    html +=
      "<h3>Fuzzy Identifier</h3><table border='1' cellpadding='6' style='border-collapse:collapse'>";
    html += row("Bits", r.fuzzy.bits);
    html += row("Key", r.fuzzy.key);
    html += row("Helper", r.fuzzy.helperHex);
    html += "</table>";
  }
  html +=
    "<h3>Registry</h3><table border='1' cellpadding='6' style='border-collapse:collapse'>";
  html += row(
    "Match",
    r.registry.match
      ? r.registry.match.label +
          " (" +
          r.registry.match.similarity.toFixed(1) +
          "%)"
      : "Not found in the registry.",
  );
  html += row("Registered ID", r.registry.registeredId || "-");
  html += "</table>";
  if (r.liveness)
    html += "<p>Liveness: " + (r.liveness.live ? "passed" : "failed") + "</p>";
  if (r.passkey) {
    html +=
      "<h3>Passkey</h3><table border='1' cellpadding='6' style='border-collapse:collapse'>";
    html += row("Credential ID", r.passkey.credentialId);
    if (r.passkey.name) html += row("Name", r.passkey.name);
    if (r.passkey.createdAt) html += row("Created", r.passkey.createdAt);
    html += row("Session verified", r.passkey.authenticated ? "yes" : "no");
    html += "</table>";
  } else {
    html += "<p>Passkey: not registered.</p>";
  }
  if (r.credential) {
    html += "<h3>Face Credential</h3><p style='font-size:0.8rem'>";
    if (r.credential.error) {
      html += "Error: " + escHtml(r.credential.error);
    } else {
      html +=
        "Issued " +
        escHtml(r.credential.id || "") +
        (r.credential.type ? " (" + escHtml(r.credential.type) + ")" : "");
    }
    html += "</p>";
  } else {
    html += "<p>Face Credential: not issued.</p>";
  }
  html +=
    "<hr><p style='color:#888;font-size:12px'>Generated by RedoSan Authenticity - 100% browser-based, nothing uploaded.</p>";
  html += "</body></html>";
  return html;
}

/**
 * @param {object} r
 */
async function faceReportToPDF(r) {
  var doc, y, push;
  await ensureLib("jspdf");
  doc = new jspdf.jsPDF();
  y = 20;
  doc.setFontSize(16);
  doc.setTextColor(108, 92, 231);
  doc.text("RedoSan Authenticity - Face Biometric", 14, y);
  y += 10;
  push = function (k, v) {
    /* c8 ignore start -- real reports never exceed one page */
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    /* c8 ignore stop */
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text(k + ": " + v, 14, y);
    y += 5;
  };
  doc.setFontSize(11);
  doc.setTextColor(108, 92, 231);
  doc.text("Detection", 14, y);
  y += 6;
  push("File", r.photo.fileName);
  push("Dimensions", r.photo.width + " x " + r.photo.height);
  push("Faces detected", r.photo.facesDetected);
  push("Confidence", (r.photo.confidence * 100).toFixed(1) + "%");
  push("Descriptor", r.photo.descriptorDim + " dims");
  push("Embedder", r.photo.embeddingVersion || "human-hse");
  push("Descriptor hash", r.photo.descriptorHash);
  y += 3;
  if (r.did) {
    doc.setFontSize(11);
    doc.setTextColor(108, 92, 231);
    doc.text("DID Identity & Signature", 14, y);
    y += 6;
    push("DID", r.did.did);
    push("Algorithm", r.did.algorithm);
    push("Signed at", r.did.signedAt);
    push("Signature", r.did.signature);
    y += 3;
  }
  if (r.biohash) {
    doc.setFontSize(11);
    doc.setTextColor(108, 92, 231);
    doc.text("Privacy Identifier (BioHash)", 14, y);
    y += 6;
    push("Bits", r.biohash.bits);
    push("Privacy ID", r.biohash.codeHex);
    push("PIN fingerprint", r.biohash.pinFingerprint);
    if (r.autoPin) push("Auto PIN (save it!)", r.autoPin);
    y += 3;
  }
  if (r.fuzzy) {
    doc.setFontSize(11);
    doc.setTextColor(108, 92, 231);
    doc.text("Fuzzy Identifier", 14, y);
    y += 6;
    push("Bits", r.fuzzy.bits);
    push("Key", r.fuzzy.key);
    push("Helper", r.fuzzy.helperHex);
    y += 3;
  }
  doc.setFontSize(11);
  doc.setTextColor(108, 92, 231);
  doc.text("Registry", 14, y);
  y += 6;
  push(
    "Match",
    r.registry.match
      ? r.registry.match.label +
          " (" +
          r.registry.match.similarity.toFixed(1) +
          "%)"
      : "Not found in the registry.",
  );
  push("Registered ID", r.registry.registeredId || "-");
  if (r.liveness) push("Liveness", r.liveness.live ? "passed" : "failed");
  if (r.passkey) {
    doc.setFontSize(11);
    doc.setTextColor(108, 92, 231);
    doc.text("Passkey", 14, y);
    y += 6;
    push("Credential ID", r.passkey.credentialId);
    if (r.passkey.name) push("Name", r.passkey.name);
    if (r.passkey.createdAt) push("Created", r.passkey.createdAt);
    push("Verified", r.passkey.authenticated ? "yes" : "no");
    y += 3;
  }
  if (r.credential) {
    doc.setFontSize(11);
    doc.setTextColor(108, 92, 231);
    doc.text("Face Credential", 14, y);
    y += 6;
    if (r.credential.error) push("Error", r.credential.error);
    else
      push(
        "Issued",
        (r.credential.id || "") +
          (r.credential.type ? " (" + r.credential.type + ")" : ""),
      );
    y += 3;
  }
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by RedoSan Authenticity", 14, 285);
  return doc.output("blob");
}

/**
 * @param {object} r
 */
async function faceReportToDOCX(r) {
  var docx, children, infoRows, push, i, didRows, bioRows, fuzzyRows, regRows;
  await ensureLib("docx");
  docx = globalThis.docx;
  children = [];
  children.push(
    new docx.Paragraph({
      children: [
        new docx.TextRun({
          text: "RedoSan Authenticity - Face Biometric",
          bold: true,
          size: 28,
          color: "6C5CE7",
        }),
      ],
      spacing: { after: 200 },
    }),
  );
  infoRows = [
    ["Generated at", r.generatedAt],
    ["Source", r.source],
    ["File", r.photo.fileName],
    ["Dimensions", r.photo.width + " x " + r.photo.height],
    ["Faces detected", r.photo.facesDetected],
    ["Confidence", (r.photo.confidence * 100).toFixed(1) + "%"],
    ["Descriptor", r.photo.descriptorDim + " dims"],
    ["Embedder", r.photo.embeddingVersion || "human-hse"],
    ["Descriptor hash", r.photo.descriptorHash],
  ];
  children.push(
    new docx.Paragraph({
      children: [
        new docx.TextRun({
          text: "Detection",
          bold: true,
          size: 22,
          color: "6C5CE7",
        }),
      ],
      spacing: { before: 200, after: 100 },
    }),
  );
  children.push(faceCreateDocxTable(docx, infoRows));
  if (r.did) {
    didRows = [
      ["DID", r.did.did],
      ["Algorithm", r.did.algorithm],
      ["Signed at", r.did.signedAt],
      ["Signature", r.did.signature],
    ];
    children.push(
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: "DID Identity & Signature",
            bold: true,
            size: 22,
            color: "6C5CE7",
          }),
        ],
        spacing: { before: 200, after: 100 },
      }),
    );
    children.push(faceCreateDocxTable(docx, didRows));
  }
  if (r.biohash) {
    bioRows = [
      ["Bits", r.biohash.bits],
      ["Privacy ID", r.biohash.codeHex],
      ["PIN fingerprint", r.biohash.pinFingerprint],
    ];
    if (r.autoPin) bioRows.push(["Auto PIN (save it!)", r.autoPin]);
    children.push(
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: "Privacy Identifier (BioHash)",
            bold: true,
            size: 22,
            color: "6C5CE7",
          }),
        ],
        spacing: { before: 200, after: 100 },
      }),
    );
    children.push(faceCreateDocxTable(docx, bioRows));
  }
  if (r.fuzzy) {
    fuzzyRows = [
      ["Bits", r.fuzzy.bits],
      ["Key", r.fuzzy.key],
      ["Helper", r.fuzzy.helperHex],
    ];
    children.push(
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: "Fuzzy Identifier",
            bold: true,
            size: 22,
            color: "6C5CE7",
          }),
        ],
        spacing: { before: 200, after: 100 },
      }),
    );
    children.push(faceCreateDocxTable(docx, fuzzyRows));
  }
  regRows = [
    [
      "Match",
      r.registry.match
        ? r.registry.match.label +
          " (" +
          r.registry.match.similarity.toFixed(1) +
          "%)"
        : "Not found in the registry.",
    ],
    ["Registered ID", r.registry.registeredId || "-"],
  ];
  if (r.liveness)
    regRows.push(["Liveness", r.liveness.live ? "passed" : "failed"]);
  if (r.passkey) {
    regRows.push(["Passkey", r.passkey.credentialId]);
    if (r.passkey.name) regRows.push(["Passkey name", r.passkey.name]);
    regRows.push(["Passkey verified", r.passkey.authenticated ? "yes" : "no"]);
  } else {
    regRows.push(["Passkey", "none"]);
  }
  if (r.credential) {
    if (r.credential.error) regRows.push(["Face Credential", "error"]);
    else
      regRows.push([
        "Face Credential",
        (r.credential.id || "issued") +
          (r.credential.type ? " (" + r.credential.type + ")" : ""),
      ]);
  } else {
    regRows.push(["Face Credential", "none"]);
  }
  children.push(
    new docx.Paragraph({
      children: [
        new docx.TextRun({
          text: "Registry",
          bold: true,
          size: 22,
          color: "6C5CE7",
        }),
      ],
      spacing: { before: 200, after: 100 },
    }),
  );
  children.push(faceCreateDocxTable(docx, regRows));
  for (i = 0; i < children.length; i++) {
    if (children[i] === null) children.splice(i--, 1);
  }
  return docx.Packer.toBlob(
    new docx.Document({ sections: [{ children: children }] }),
  );
}

/**
 * @param {object} docx
 * @param {Array<Array<string>>} rows
 */
function faceCreateDocxTable(docx, rows) {
  if (!rows || rows.length === 0) return null;
  return new docx.Table({
    rows: rows.map(function (row, i) {
      return new docx.TableRow({
        children: row.map(function (cell) {
          return new docx.TableCell({
            children: [
              new docx.Paragraph({
                children: [
                  new docx.TextRun({
                    text: String(cell),
                    size: 18,
                    font: "Courier New",
                  }),
                ],
                spacing: { before: 40, after: 40 },
              }),
            ],
          });
        }),
      });
    }),
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
  });
}

/**
 * Start the live detection overlay: a transparent canvas pinned over the video
 * that draws the face box + mesh landmarks at ~5 fps while the camera runs.
 * Decorative only — never throws, never breaks camera startup.
 * @param {HTMLVideoElement} videoEl
 */
function startFaceOverlay(videoEl) {
  var canvas;
  stopFaceOverlay();
  if (!videoEl || !document || !document.createElement) return;
  try {
    canvas = document.createElement("canvas");
    if (!canvas || typeof canvas.getContext !== "function") return;
    canvas.width = videoEl.clientWidth || 320;
    canvas.height = videoEl.clientHeight || 240;
    if (canvas.style) {
      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.pointerEvents = "none";
      canvas.style.borderRadius = "8px";
    }
    if (videoEl.parentNode && videoEl.parentNode.style) {
      videoEl.parentNode.style.position = "relative";
    }
    if (videoEl.insertAdjacentElement) {
      videoEl.insertAdjacentElement("afterend", canvas);
    } else if (videoEl.parentNode) {
      videoEl.parentNode.appendChild(canvas);
    }
    _faceOverlay = canvas;
    _faceOverlayRunning = true;
    _faceOverlayLast = 0;
    _faceOverlayBusy = false;
    faceOverlayScheduleNext();
  } catch (e) {
    _faceOverlay = null;
    _faceOverlayRunning = false;
  }
}

/**
 * Stop the live detection overlay and remove its canvas.
 */
function stopFaceOverlay() {
  _faceOverlayRunning = false;
  _faceOverlayBusy = false;
  if (_faceOverlayRAF && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(_faceOverlayRAF);
  } else if (_faceOverlayRAF && typeof clearTimeout === "function") {
    clearTimeout(_faceOverlayRAF);
  }
  _faceOverlayRAF = 0;
  if (
    _faceOverlay &&
    _faceOverlay.parentNode &&
    _faceOverlay.parentNode.removeChild
  ) {
    _faceOverlay.parentNode.removeChild(_faceOverlay);
  }
  _faceOverlay = null;
}

/**
 * Schedule the next overlay tick (rAF, falling back to a timer).
 */
function faceOverlayScheduleNext() {
  if (!_faceOverlayRunning) return;
  if (typeof requestAnimationFrame === "function") {
    _faceOverlayRAF = requestAnimationFrame(faceOverlayTick);
  } else if (typeof setTimeout === "function") {
    _faceOverlayRAF = setTimeout(faceOverlayTick, 200);
  }
}

/**
 * Draw the latest face box + mesh points onto the overlay canvas.
 */
async function faceOverlayDetectAndDraw() {
  var frame, det, i, k, mesh, sx, sy, ctx, d, x, y;
  if (!_faceOverlay || !_faceOverlay.getContext) return;
  if (!faceCamera || !faceCamera.isActive || !faceCamera.captureFrame) return;
  if (!faceEngine || !faceEngine._loaded) return;
  try {
    frame = faceCamera.captureFrame(640);
    if (!frame || !frame.getContext) return;
    det = await faceEngine.detectFaces(frame);
  } catch (e) {
    return;
  }
  ctx = _faceOverlay.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, _faceOverlay.width, _faceOverlay.height);
  if (!det || det.length === 0) return;
  sx = _faceOverlay.width / frame.width;
  sy = _faceOverlay.height / frame.height;
  for (i = 0; i < det.length; i++) {
    d = det[i];
    if (!d || !d.box) continue;
    ctx.strokeStyle = "#00e676";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      d.box.x * sx,
      d.box.y * sy,
      d.box.width * sx,
      d.box.height * sy,
    );
    mesh = d.mesh;
    if (!mesh) continue;
    ctx.fillStyle = "rgba(0,230,118,0.85)";
    for (k = 0; k < mesh.length; k += 3) {
      x = mesh[k] * sx;
      y = mesh[k + 1] * sy;
      if (x < 0 || y < 0 || x > _faceOverlay.width || y > _faceOverlay.height)
        continue;
      ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
    }
  }
}

/**
 * Throttled rAF loop (~5 fps) for the live detection overlay.
 * @param {number} ts
 */
function faceOverlayTick(ts) {
  var now;
  if (!_faceOverlayRunning) return;
  now = ts || Date.now();
  if (!_faceOverlayBusy && now - _faceOverlayLast >= 200) {
    _faceOverlayLast = now;
    _faceOverlayBusy = true;
    faceOverlayDetectAndDraw().then(
      function () {
        _faceOverlayBusy = false;
      },
      function () {
        _faceOverlayBusy = false;
      },
    );
  }
  faceOverlayScheduleNext();
}

/**
 * Start the webcam preview.
 * @param {string} videoId
 */
async function handleFaceCameraStart(videoId) {
  var videoEl, imgEl, startBtn, stopBtn, capBtn;
  if (!faceConsentGranted()) {
    faceWarnConsentRequired();
    return;
  }
  if (!(await ensureFacePasskeyForAction())) return;
  if (typeof FaceCamera !== "function") {
    setStatus("face-status", "Face Camera module not loaded.");
    return;
  }
  videoEl = document.getElementById(videoId || "face-camera");
  if (!videoEl) {
    setStatus("face-status", "Camera element not found.");
    return;
  }
  if (!faceCamera) faceCamera = new FaceCamera();
  try {
    setStatus("face-status", "Starting camera...");
    await faceCamera.startCamera(videoEl);
    videoEl.style.display = "block";
    startFaceOverlay(videoEl);
    imgEl = document.getElementById("face-image");
    if (imgEl) imgEl.disabled = true;
    startBtn = document.getElementById("face-cam-start");
    if (startBtn) startBtn.disabled = true;
    stopBtn = document.getElementById("face-cam-stop");
    if (stopBtn) stopBtn.disabled = false;
    capBtn = document.getElementById("face-cam-capture");
    if (capBtn) capBtn.disabled = false;
    setStatus(
      "face-status",
      "Camera started. Capture a photo, then press Generate Identifiers.",
    );
  } catch (error) {
    setStatus("face-status", FaceCamera.getCameraErrorMessage(error));
  }
}

/**
 * Stop the webcam preview.
 * @param {string} [videoId]
 */
function handleFaceCameraStop(videoId) {
  var el, imgEl, startBtn, stopBtn, capBtn;
  stopFaceOverlay();
  if (faceCamera) faceCamera.stopCamera();
  if (videoId) {
    el = document.getElementById(videoId);
    if (el) el.style.display = "none";
  } else {
    el = document.getElementById("face-camera");
    if (el) el.style.display = "none";
  }
  imgEl = document.getElementById("face-image");
  if (imgEl) imgEl.disabled = false;
  startBtn = document.getElementById("face-cam-start");
  if (startBtn) startBtn.disabled = false;
  stopBtn = document.getElementById("face-cam-stop");
  if (stopBtn) stopBtn.disabled = true;
  capBtn = document.getElementById("face-cam-capture");
  if (capBtn) capBtn.disabled = true;
  setStatus("face-status", "Camera stopped.");
}

/**
 * Localized instruction for an active challenge type.
 * @param {string} type challenge key ("blink", "smile", "turn-left", ...)
 * @returns {string}
 */
function faceChallengeText(type) {
  var fallback, key;
  fallback =
    {
      blink: "Blink your eyes",
      smile: "Smile",
      "turn-left": "Turn your head to the left",
      "turn-right": "Turn your head to the right",
      "look-up": "Look up",
      "look-down": "Look down",
    }[type] || type;
  key = "face.challenge." + type;
  if (typeof __ === "function") return __(key, fallback);
  return fallback;
}

/**
 * Show or hide the active challenge instruction in the #face-challenge box.
 * @param {{type: string|null, index: number, total: number, done: boolean}|null} c
 */
function renderFaceChallenge(c) {
  var el, text;
  el = document.getElementById("face-challenge");
  if (!el) return;
  if (!c || c.done || !c.type) {
    el.textContent = "";
    el.style.display = "none";
    return;
  }
  text = faceChallengeText(c.type);
  if (typeof __ === "function") {
    text = __("face.challenge_prefix", "Challenge: ") + text;
  } else {
    text = "Challenge: " + text;
  }
  if (c.total > 1) text += " (" + (c.index + 1) + "/" + c.total + ")";
  el.textContent = text;
  el.style.display = "block";
}

/**
 * Run liveness per the selected mode; stores evidence on _faceLivenessEvidence.
 * @returns {Promise<object|null>} evidence {live, ...} or null when skipped
 */
async function runFaceLivenessCheck() {
  var modeEl, mode;
  modeEl = document.getElementById("face-liveness-mode");
  mode = modeEl ? modeEl.value : "passive";
  renderFaceChallenge(null);
  if (mode === "off") {
    _faceLivenessEvidence = null;
    return null;
  }
  if (!faceCamera || !faceCamera.isActive()) {
    setStatus("face-status", "Camera not running. Start the camera first.");
    return null;
  }
  if (typeof FaceLiveness !== "function") {
    setStatus("face-status", "Face Liveness module not loaded.");
    return null;
  }
  if (!faceLiveness) faceLiveness = new FaceLiveness();
  try {
    setStatus(
      "face-status",
      "Liveness check in progress — look at the camera...",
    );
    _faceLivenessEvidence = await faceLiveness.verifyLiveness(
      faceCamera,
      faceEngine,
      {
        mode: mode === "active" ? "both" : "passive",
        frames: 8,
        onChallenge: function (c) {
          renderFaceChallenge(c);
        },
      },
    );
    return _faceLivenessEvidence;
  } catch (error) {
    renderFaceChallenge(null);
    setStatus("face-status", "Liveness error: " + error.message);
    return null;
  }
}

/**
 * Capture a frame from the camera and stage it (with liveness evidence when
 * enabled). The pipeline starts only via handleFaceRun().
 */
async function handleFaceCameraCapture() {
  var frameCanvas, evidence, modeEl, mode, reasons;
  if (!faceCamera || !faceCamera.isActive()) {
    setStatus("face-status", "Camera not running. Start the camera first.");
    return;
  }
  if (!faceEngine) {
    if (typeof FaceEngine === "function") {
      faceEngine = new FaceEngine();
    }
    if (typeof FaceRegistry === "function") {
      faceRegistry = new FaceRegistry();
      await faceRegistry.open();
    }
  }
  /* c8 ignore start -- vm var bindings cannot be deleted in unit tests */
  if (!faceEngine) {
    setStatus("face-status", "Face Engine not initialized.");
    return;
  }
  /* c8 ignore stop */
  try {
    setStatus("face-status", "Loading models...");
    await faceEngine.loadModels();
    evidence = await runFaceLivenessCheck();
    if (evidence !== null && !evidence.live) {
      reasons = evidence.reasons || [];
      if (reasons.length === 0) reasons = evidence.failedChallenges || [];
      setStatus("face-status", "Liveness check failed: " + reasons.join(", "));
      return;
    }
    setStatus("face-status", "Capturing frame...");
    frameCanvas = faceCamera.captureFrame(640);
    if (!frameCanvas) {
      setStatus("face-status", "Could not capture a frame.");
      return;
    }
    _faceLivenessEvidence = evidence;
    modeEl = document.getElementById("face-liveness-mode");
    mode = modeEl ? modeEl.value : "passive";
    _facePendingCanvas = frameCanvas;
    _facePendingSource = {
      source: "camera",
      fileName: "camera_capture",
      width: frameCanvas.width,
      height: frameCanvas.height,
      liveness:
        evidence === null
          ? null
          : {
              live: evidence.live,
              mode: mode,
              reasons: evidence.reasons || [],
            },
    };
    setStatus(
      "face-status",
      "Photo captured. Enter a Name/Label, then press Generate Identifiers.",
    );
    updateFaceRunState();
  } catch (error) {
    setStatus("face-status", "Capture error: " + error.message);
  }
}

/**
 *
 */
async function listRegisteredFaces() {
  var faces, size, el, countEl, div, noteEl, versions;
  if (!faceRegistry) {
    setStatus("face-status", "Face Registry not initialized.");
    return;
  }
  try {
    faces = await faceRegistry.getAllFaces();
    size = await faceRegistry.getSize();
    el = document.getElementById("face-list");
    countEl = document.getElementById("face-count");
    noteEl = document.getElementById("face-migration-note");
    if (noteEl) {
      versions = {};
      faces.forEach(function (f) {
        versions[f.embeddingVersion || "human-hse"] = true;
      });
      noteEl.style.display =
        Object.keys(versions).length > 1 ? "block" : "none";
    }
    if (countEl) {
      if (typeof countEl.setAttribute === "function") {
        countEl.setAttribute("data-i18n-args", JSON.stringify({ 0: size }));
      }
      if (
        typeof i18n !== "undefined" &&
        i18n.data &&
        i18n.data["face.count_label"]
      ) {
        countEl.textContent = i18n.data["face.count_label"]
          .split("{0}")
          .join(String(size));
      } else {
        countEl.textContent = "Registered faces: " + size;
      }
    }
    el.innerHTML = "";
    if (faces.length === 0) {
      el.innerHTML =
        '<p style="color:var(--text-muted)">' +
        __("face.no_faces", "No faces registered yet.") +
        "</p>";
      return size;
    }
    faces.forEach(function (f) {
      div = document.createElement("div");
      div.className = "face-list-item";
      div.innerHTML =
        "<span><strong>" +
        escHtml(f.label) +
        "</strong> (ID: " +
        f.id +
        ")</span>" +
        '<button class="btn btn-sm face-mgmt-btn" onclick="handleFaceDelete(' +
        f.id +
        ')">' +
        __("face.delete_btn", "Delete") +
        "</button>";
      el.append(div);
    });
    return size;
  } catch (error) {
    setStatus("face-status", "List error: " + error.message);
  }
}

/**
 *
 * @param id
 */
async function handleFaceDelete(id) {
  if (!faceRegistry) return;
  try {
    await faceRegistry.deleteFace(id);
      setStatus(
        "face-status",
        __("face.deleted_from_registry", "Face deleted from registry."),
      );
    await listRegisteredFaces();
  } catch (error) {
    setStatus("face-status", "Delete error: " + error.message);
  }
}

/**
 * Refresh List: clear the generated-results view (report, preview, action
 * buttons, staged photo) and re-render the registered faces from storage.
 * This is the "soft reset" that makes Refresh List visibly do something when
 * results are on screen — same effect as reloading the page.
 */
async function handleFaceRefreshList() {
  var repEl, prevEl, size;
  _faceReport = null;
  window._faceReport = null;
  _facePendingCanvas = null;
  _facePendingSource = null;
  repEl = document.getElementById("face-report");
  if (repEl) {
    repEl.style.display = "none";
    repEl.innerHTML = "";
  }
  prevEl = document.getElementById("face-preview");
  if (prevEl && prevEl.style) {
    prevEl.style.display = "none";
  }
  renderFaceActions(false);
  updateFaceRunState();
  size = await listRegisteredFaces();
  if (size !== undefined) {
    setStatus(
      "face-status",
      __("face.refresh_done", "Results cleared. Registered faces: {0}")
        .split("{0}")
        .join(String(size)),
    );
  }
}

/**
 * Copy the latest generated Privacy ID to the clipboard.
 */
function handleFaceBioHashCopy() {
  var code, el;
  if (!_faceReport || !_faceReport.biohash) {
    setStatus("face-status", "Generate a Privacy ID first (run the pipeline).");
    return;
  }
  code = _faceReport.biohash.codeHex;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(
      function () {
        setStatus("face-status", "Privacy ID copied to clipboard.");
      },
      function () {
        setStatus("face-status", "Copy failed. Select the ID text manually.");
      },
    );
  } else {
    el = document.getElementById("face-report");
    if (el && el.select) el.select();
    setStatus("face-status", "Privacy ID ready to copy.");
  }
}

// ── Phase 3: registry encryption (lock/unlock) ──

/**
 * Build the registry labels sheet (label / id / created / descriptorHash /
 * embeddingVersion) for "txt" or "csv". Returns "" when the registry is
 * unavailable, empty or errors — the sheet is an optional appendix of the
 * Download Results TXT/CSV exports.
 * @param {string} format "txt" | "csv"
 * @returns {Promise<string>}
 */
async function faceLabelsToSheet(format, opts) {
  var faces, rows, i, f, hash, lines, cell, j, row, keys;
  opts = opts || {};
  if (!faceRegistry) return "";
  try {
    faces = await faceRegistry.getAllFaces();
  } catch (e) {
    return "";
  }
  if (faces.length === 0) return "";
  rows = [];
  for (i = 0; i < faces.length; i++) {
    f = faces[i];
    hash = "";
    if (!f.encrypted && f.descriptor && f.descriptor.length) {
      hash = (await faceDescriptorHash(f.descriptor)) || "";
    }
    rows.push({
      label: String(f.label || ""),
      id: String(f.id),
      created: f.created ? new Date(f.created).toISOString() : "",
      descriptorHash: hash,
      embeddingVersion: String(f.embeddingVersion || "human-hse"),
    });
  }
  keys =
    opts.includeDescriptor === false
      ? ["label", "id", "created"]
      : ["label", "id", "created", "descriptorHash", "embeddingVersion"];
  if (format === "csv") {
    lines = [keys.join(",")];
    for (i = 0; i < rows.length; i++) {
      row = [];
      for (j = 0; j < keys.length; j++) {
        cell = String(rows[i][keys[j]]);
        if (/[",\n]/.test(cell)) cell = '"' + cell.split('"').join('""') + '"';
        row.push(cell);
      }
      lines.push(row.join(","));
    }
    return lines.join("\n");
  }
  lines = [keys.join("\t")];
  for (i = 0; i < rows.length; i++) {
    lines.push(
      keys
        .map(function (k) {
          return rows[i][k];
        })
        .join("\t"),
    );
  }
  return lines.join("\n");
}

/**
 * Download the registry labels as a standalone TXT/CSV file (programmatic —
 * the UI includes the sheet in Download Results instead of a dedicated button).
 * @param {string} format "txt" | "csv"
 */
async function handleFaceExportLabels(format) {
  var sheet, ext, name;
  if (!faceRegistry) {
    setStatus("face-status", "Face Registry not initialized.");
    return;
  }
  format = format === "csv" ? "csv" : "txt";
  try {
    sheet = await faceLabelsToSheet(format);
  } catch (error) {
    setStatus("face-status", "Export error: " + error.message);
    return;
  }
  if (!sheet) {
    setStatus(
      "face-status",
      __("face.export_empty", "No faces registered yet — nothing to export."),
    );
    return;
  }
  ext = format;
  name = "face_labels." + ext;
  downloadBlobSimple(
    new Blob([sheet], {
      type:
        format === "csv"
          ? "text/csv;charset=utf-8"
          : "text/plain;charset=utf-8",
    }),
    name,
  );
  setStatus(
    "face-status",
    __("face.export_done", "Exported {0} face label(s) as {1}.")
      .split("{0}")
      .join(String(sheet.split("\n").length - 1))
      .split("{1}")
      .join(name),
  );
}

/**
 * Encrypt all registry entries with the passphrase from #face-lock-pass.
 */
async function handleFaceLock() {
  var pass, n, statusEl;
  if (!faceRegistry) return;
  if (typeof FaceCrypto === "undefined") {
    setStatus(
      "face-status",
      __("face.lock_need_crypto", "Encryption module not loaded."),
    );
    return;
  }
  pass = document.getElementById("face-lock-pass");
  pass = pass && pass.value ? pass.value : "";
  if (!pass) {
    setStatus(
      "face-status",
      __("face.lock_no_pass", "Enter a passphrase to lock the registry."),
    );
    return;
  }
  try {
    n = await faceRegistry.lock(pass);
    setStatus(
      "face-status",
      __("face.lock_done", "Registry locked — {0} face(s) encrypted.")
        .split("{0}")
        .join(n),
    );
    if (pass) pass.value = "";
    await listRegisteredFaces();
    statusEl = document.getElementById("face-lock-status");
    if (statusEl)
      statusEl.textContent = "🔒 " + __("face.lock_status_locked", "Locked");
  } catch (error) {
    setStatus("face-status", "Lock error: " + error.message);
  }
}

/**
 * Decrypt all registry entries with the passphrase from #face-lock-pass.
 */
async function handleFaceUnlock() {
  var pass, n, statusEl;
  if (!faceRegistry) return;
  if (typeof FaceCrypto === "undefined") {
    setStatus(
      "face-status",
      __("face.lock_need_crypto", "Encryption module not loaded."),
    );
    return;
  }
  pass = document.getElementById("face-lock-pass");
  pass = pass && pass.value ? pass.value : "";
  if (!pass) {
    setStatus(
      "face-status",
      __(
        "face.lock_unlock_no_pass",
        "Enter the passphrase to unlock the registry.",
      ),
    );
    return;
  }
  try {
    n = await faceRegistry.unlock(pass);
    setStatus(
      "face-status",
      __("face.lock_unlock_done", "Registry unlocked — {0} face(s) decrypted.")
        .split("{0}")
        .join(n),
    );
    if (pass) pass.value = "";
    await listRegisteredFaces();
    statusEl = document.getElementById("face-lock-status");
    if (statusEl)
      statusEl.textContent =
        "🔓 " + __("face.lock_status_unlocked", "Unlocked");
  } catch (error) {
    setStatus(
      "face-status",
      __(
        "face.lock_bad_pass",
        "Unlock failed — wrong passphrase or corrupted data.",
      ),
    );
  }
}

// ── Phase 3: backup / restore ──

/**
 * Export the registry to a JSON backup file (encrypted when passphrase given).
 */
async function handleFaceBackup() {
  var pass, backup, blob;
  if (!faceRegistry) return;
  if (typeof FaceCrypto === "undefined") {
    setStatus(
      "face-status",
      __("face.lock_need_crypto", "Encryption module not loaded."),
    );
    return;
  }
  pass = document.getElementById("face-lock-pass");
  pass = pass && pass.value ? pass.value : "";
  try {
    backup = await faceRegistry.exportBackup(pass || null);
    blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    downloadBlobSimple(blob, "face_registry_backup.json");
    setStatus(
      "face-status",
      pass
        ? __("face.backup_done_enc", "Backup exported (encrypted).")
        : __("face.backup_done", "Backup exported."),
    );
  } catch (error) {
    setStatus(
      "face-status",
      __("face.backup_err", "Backup error: {0}")
        .split("{0}")
        .join(error.message),
    );
  }
}

/**
 * Import a backup file chosen via #face-restore-file.
 */
async function handleFaceRestore() {
  var fileEl, file, text, backup, pass, mode, n;
  if (!faceRegistry) return;
  fileEl = document.getElementById("face-restore-file");
  if (!fileEl || !fileEl.files || fileEl.files.length === 0) {
    setStatus(
      "face-status",
      __("face.restore_no_file", "Choose a backup file first."),
    );
    return;
  }
  file = fileEl.files[0];
  try {
    text = await file.text();
    backup = JSON.parse(text);
  } catch (e) {
    setStatus(
      "face-status",
      __("face.restore_bad_file", "Restore error: not a valid backup file."),
    );
    return;
  }
  pass = document.getElementById("face-lock-pass");
  pass = pass && pass.value ? pass.value : "";
  mode = confirm(
    __(
      "face.restore_confirm",
      "Replace all current faces? OK = replace, Cancel = merge",
    ),
  );
  mode = mode ? "replace" : "merge";
  try {
    n = await faceRegistry.importBackup(backup, pass || null, mode);
    setStatus(
      "face-status",
      __("face.restore_done", "Restored {0} face(s) ({1}).")
        .split("{0}")
        .join(n)
        .split("{1}")
        .join(mode),
    );
    fileEl.value = "";
    await listRegisteredFaces();
  } catch (error) {
    setStatus(
      "face-status",
      __("face.restore_err", "Restore error: {0}")
        .split("{0}")
        .join(error.message),
    );
  }
}

// ── Phase 3: W3C face credential ──

/**
 * Issue a W3C Verifiable Credential from the last pipeline report
 * (SHA-256 descriptor hash only — never the raw template) signed with the
 * session DID keypair, then show + download it.
 */
async function handleFaceIssueCredential() {
  var report, kp, vc, json, pre, box, btn;
  if (!_faceReport) {
    setStatus(
      "face-status",
      __(
        "face.vc_need_report",
        "Run the pipeline first to generate identifiers.",
      ),
    );
    return;
  }
  kp = globalThis._didKeypair || _faceKeypair;
  if (!kp || !kp.did || typeof FaceVC === "undefined") {
    setStatus(
      "face-status",
      __("face.vc_need_did", "DID keypair or FaceVC module not available."),
    );
    return;
  }
  try {
    vc = FaceVC.build({
      did: kp.did,
      algorithm: kp.algorithm,
      descriptorHash: _faceReport.photo.descriptorHash,
      attributes: _faceReport.photo.attributes || null,
      liveness: _faceReport.liveness || null,
      faceCount: _faceReport.photo.facesDetected,
      embeddingVersion: _faceReport.photo.embeddingVersion,
    });
    vc = await FaceVC.sign(kp, vc);
    window._faceCredential = vc;
    json = FaceVC.toJSON(vc);
    pre = document.getElementById("face-vc-output");
    if (pre) {
      pre.textContent = json;
      pre.style.display = "block";
    }
    box = document.getElementById("face-vc-box");
    if (box) box.style.display = "block";
    btn = document.getElementById("face-vc-download");
    if (btn) btn.style.display = "inline-block";
    setStatus(
      "face-status",
      __("face.vc_done", "Face credential issued and signed with {0}.")
        .split("{0}")
        .join(kp.algorithm),
    );
  } catch (error) {
    setStatus(
      "face-status",
      __("face.vc_err", "Credential error: {0}")
        .split("{0}")
        .join(error.message),
    );
  }
}

/**
 * Download the issued face credential as JSON.
 */
function handleFaceVCDownload() {
  var vc;
  vc = window._faceCredential;
  if (!vc) return;
  downloadBlobSimple(
    new Blob([FaceVC.toJSON(vc)], { type: "application/json" }),
    "face_credential.json",
  );
}

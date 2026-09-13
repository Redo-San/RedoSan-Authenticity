/* c8 ignore start */
(function () {
  if (
    typeof window != "undefined" &&
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

/**
 * Voice_Biometric/voice_ui.js
 *
 * Browser controller for the voice-verification chain, mirroring
 * Face_Biometric/face_ui.js. The page (SPA section or MPA page) calls
 * initVoiceBiometric() once; inline onclick handlers reference the top-level
 * functions below.
 *
 * Pipeline order (matches VoiceEngine gate order, §8.2):
 *
 *   Input → Quality (ISO/IEC 29794-1 framework, heuristic) → Anti-Spoof
 *   (ISO/IEC 30107-3, optional) → Embedding → Template protection
 *   (ISO/IEC 24745:2022) → DID signature → Registry match + enroll →
 *   Standards record → Provenance → report.
 *
 * A FAIL at the Quality or Anti-Spoof gate short-circuits: no template is
 * registered and the report records the rejection. There is deliberately no
 * single "AUTHENTIC" verdict — the report layers Media Integrity, Speaker
 * Similarity, Presentation-Attack Detection, Provenance and Limitations so
 * downstream consumers can apply their own policy.
 */

// ── Constants ──
var VOICE_SAMPLE_RATE = 16000;
var VOICE_MIN_SPEECH_SECONDS = 2;
var VOICE_MAX_FILE_MB = 25;
var VOICE_MAX_RECORDING_SECONDS = 180; // 3 minutes max for mic recording
var VOICE_MAX_UPLOAD_SECONDS = 180; // 3 minutes max for uploaded files
var VOICE_RECORDING_WARN_SECONDS = 150; // warn at 2:30 remaining (yellow)
var VOICE_RECORDING_CRITICAL_SECONDS = 170; // critical at 10s remaining (red)
var VOICE_ALLOWED_EXTS = {
  wav: true,
  mp3: true,
  m4a: true,
  ogg: true,
  webm: true,
  opus: true,
  flac: true,
};
var VOICE_ALLOWED_TYPES = {
  "audio/wav": true,
  "audio/x-wav": true,
  "audio/wave": true,
  "audio/mpeg": true,
  "audio/mp4": true,
  "audio/ogg": true,
  "audio/webm": true,
  "audio/opus": true,
  "audio/flac": true,
};
var VOICE_CONSENT_KEY = "redoSan.voiceConsent";
var VOICE_CONSENT_VERSION = 1;
var VOICE_CONSENT_POLICY_VERSION = 1;

// ── Module state ──
var _voiceReport = null;
var _voicePendingAudio = null; // {float32, sampleRate, durationMs}
var _voicePendingBytes = null; // original file bytes (provenance input)
var _voicePendingSource = null; // {source, fileName, durationMs}
var _voiceProvenanceOutput = null;
var _voiceProvenanceManifest = null;
var _voiceKeypair = null;
var _voiceTemplateSecret = null;
var _voiceRegistry = null;
var _voiceEngine = null;
var _voiceEmbedder = "ecapa";
/**
 * Warn-only non-speech honesty floors for the pre-normalization embedding L2
 * magnitude (embedder.lastMagnitude). Near-zero magnitude means the encoder
 * received (near-)silence even though the quality gate passed. Bands are
 * conservative until tuned from real measurements (golden speech vs song
 * clips in the E2E harness) — a below-floor sample only adds a report
 * limitation, it never blocks processing.
 */
var VOICE_EMBED_LOW_MAGNITUDE = {
  "ecapa-tdnn": 0.5,
  "wavlm-base-plus-sv": 2.0,
};
var _voiceInputTab = "upload";
var _voiceMicActive = false;
var _voiceMicBlocks = [];
var _voiceProgressOverlay = null;

/**
 * @param {string} id
 * @param {string} msg
 */
function setStatus(id, msg) {
  var el = document.getElementById(id);
  if (el) el.textContent = msg;
}

/**
 * Show the current pipeline step in the #voice-steps box.
 * @param {string|null} text
 */
function setVoiceStep(text) {
  var el = document.getElementById("voice-steps");
  if (!el) return;
  if (!text) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.textContent = text;
  el.style.display = "block";
}

var _voiceProgressOverlayEl = null;

/**
 * Re-resolve the overlay elements from the live DOM (cheap) so calls stay
 * correct even after the SPA router swaps the page.
 * @returns {object|null}
 */
function voiceProgressRefs() {
  var overlay;
  if (typeof document === "undefined" || !document.getElementById) return null;
  overlay = document.getElementById("voice-progress-overlay");
  if (!overlay) return null;
  return {
    overlay: overlay,
    bar: document.getElementById("voice-progress-bar"),
    title: document.getElementById("voice-progress-title"),
    text: document.getElementById("voice-progress-text"),
    pct: document.getElementById("voice-progress-pct"),
  };
}

/**
 * Lazily build the blur + spinner progress overlay (works in both the SPA
 * hub and the MPA page).
 * @returns {HTMLElement|null}
 */
function voiceProgressEnsure() {
  var refs, overlay, card, spin, track, bar, title, text, pct;
  refs = voiceProgressRefs();
  if (refs) return refs.overlay;
  if (
    typeof document === "undefined" ||
    !document.getElementById ||
    !document.createElement ||
    !document.body
  )
    return null;
  overlay = document.createElement("div");
  overlay.id = "voice-progress-overlay";
  overlay.className = "voice-progress-overlay";
  card = document.createElement("div");
  card.className = "voice-progress-card";
  spin = document.createElement("div");
  spin.className = "voice-progress-spinner";
  title = document.createElement("div");
  title.className = "voice-progress-title";
  title.id = "voice-progress-title";
  text = document.createElement("div");
  text.className = "voice-progress-text";
  text.id = "voice-progress-text";
  track = document.createElement("div");
  track.className = "voice-progress-track";
  bar = document.createElement("div");
  bar.className = "voice-progress-bar";
  bar.id = "voice-progress-bar";
  pct = document.createElement("div");
  pct.className = "voice-progress-pct";
  pct.id = "voice-progress-pct";
  pct.textContent = "0%";
  track.appendChild(bar);
  track.appendChild(pct);
  card.appendChild(spin);
  card.appendChild(title);
  card.appendChild(text);
  card.appendChild(track);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  _voiceProgressOverlayEl = overlay;
  return overlay;
}

/**
 * Fade the progress overlay in and start the current stage label.
 * @param {string} title
 * @param {string} text
 */
function voiceProgressShow(title, text) {
  var refs;
  refs = voiceProgressRefs();
  if (!refs) {
    if (!voiceProgressEnsure()) return;
    refs = voiceProgressRefs();
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
function voiceProgressUpdate(fraction, text) {
  var refs, pct, p;
  refs = voiceProgressRefs();
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
function voiceProgressHide() {
  var overlay, t;
  overlay = voiceProgressRefs() ? voiceProgressRefs().overlay : null;
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
  _voiceProgressOverlay = null;
}

/**
 * Update both the #voice-steps box and the progress overlay for a stage.
 * @param {string|null} text
 * @param {number|null} fraction
 */
function setVoiceStage(text, fraction) {
  setVoiceStep(text);
  if (fraction !== null && typeof voiceProgressUpdate === "function") {
    voiceProgressUpdate(fraction, text);
  }
}

/**
 * @param {number} n
 */
function voiceRandomToken(n) {
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
function voiceBytesToHex(bytes) {
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
 * SHA-256 hex digest of a Float32Array descriptor via VoiceCrypto (hex
 * string input — matches the template-protection util).
 * @param {Float32Array|number[]} emb
 * @returns {Promise<string|null>}
 */
async function voiceDescriptorHash(emb) {
  if (!emb || typeof emb.length !== "number" || emb.length === 0) return null;
  if (
    typeof VoiceCrypto !== "undefined" &&
    typeof VoiceCrypto.sha256Hex === "function"
  ) {
    try {
      return await VoiceCrypto.sha256Hex(emb);
    } catch (e) {
      /* fall through to rolling fallback */
    }
  }
  var h, i, v, b;
  h = 0;
  b = new Uint8Array(emb.buffer || emb);
  for (i = 0; i < b.length; i++) {
    v = b[i];
    h = ((h << 5) - h + v) | 0;
  }
  return Math.abs(h).toString(16);
}

/**
 * Decode an audio File into 16 kHz mono Float32 PCM using Web Audio
 * (OfflineAudioContext works in workers and never plays sound).
 * @param {File|ArrayBuffer} file
 * @returns {Promise<{float32: Float32Array, sampleRate: number, durationMs: number}>}
 */
async function decodeAudioFile(file) {
  var AudioCtor, ctx, arrayBuf, audioBuf, src, len, out, i, frac, j, j2;
  AudioCtor =
    typeof OfflineAudioContext !== "undefined"
      ? OfflineAudioContext
      : typeof webkitOfflineAudioContext !== "undefined"
        ? webkitOfflineAudioContext
        : null;
  if (!AudioCtor) {
    throw new Error(
      __(
        "voice.error.noAudio",
        "Audio decoding is not supported in this browser.",
      ),
    );
  }
  arrayBuf =
    file && typeof file.arrayBuffer === "function"
      ? await file.arrayBuffer()
      : file instanceof ArrayBuffer
        ? file
        : null;
  if (!arrayBuf) {
    throw new Error(
      __("voice.error.noAudio", "Could not read the audio file."),
    );
  }
  ctx = new AudioCtor(1, Math.max(8, Math.round(16000 * 60)), 16000);
  audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
  src = audioBuf.getChannelData(0);
  len = Math.max(
    1,
    Math.round(
      (src.length * VOICE_SAMPLE_RATE) / (audioBuf.sampleRate || 44100),
    ),
  );
  out = new Float32Array(len);
  for (i = 0; i < len; i++) {
    frac = (i * src.length) / len;
    j = Math.floor(frac);
    j2 = Math.min(j + 1, src.length - 1);
    out[i] = src[j] * (1 - (frac - j)) + src[j2] * (frac - j);
  }
  return {
    float32: out,
    sampleRate: VOICE_SAMPLE_RATE,
    durationMs: Math.round((len / VOICE_SAMPLE_RATE) * 1000),
  };
}

/**
 * Current anti-spoof mode from #voice-antispoof-mode ("off" | "aasist" |
 * "heuristic"). Unknown values map to "off" defensively.
 * @returns {string}
 */
function getAntiSpoofMode() {
  var sel;
  sel = document.getElementById("voice-antispoof-mode");
  if (sel && sel.value && sel.value !== "off") return sel.value;
  return "off";
}

/**
 * Enable the Generate Identifiers button only when consent is granted, an
 * audio clip is staged AND the Name/Label field is filled in.
 */
function updateVoiceRunState() {
  var btn, label;
  btn = document.getElementById("voice-run");
  if (!btn) return;
  label = document.getElementById("voice-label");
  if (label && typeof label.value === "string") {
    label.value = label.value.trim();
  }
  if (!voiceConsentGranted()) {
    btn.disabled = true;
    return;
  }
  btn.disabled = !(
    _voicePendingAudio &&
    label &&
    label.value &&
    label.value.trim() !== "" &&
    !_voiceMicActive
  );
}

/**
 * Refresh the helper text under the embedder select.
 */
function updateVoiceEmbedderHint() {
  var hint;
  hint = document.getElementById("voice-embedder-hint");
  if (!hint) return;
  if (_voiceEmbedder === "wavlm") {
    hint.textContent = __(
      "voice.embedder_hint_wavlm",
      "WavLM Base+ (512-dim) downloads a ~102 MB ONNX model on first use — best accuracy, heavier; embeddings stay local and never leave this device.",
    );
    return;
  }
  if (_voiceEmbedder === "ecapa") {
    hint.textContent = __(
      "voice.embedder_hint_ecapa",
      "ECAPA-TDNN (192-dim) downloads an ~83 MB ONNX model on first use; embeddings stay local and never leave this device.",
    );
    return;
  }
  hint.textContent = __(
    "voice.embedder_hint_onnx",
    "ONNX embedder loads a model on first use; embeddings stay local.",
  );
}

/**
 * Resolve the embedder singleton for a mode ("ecapa" | "wavlm"). Returns null
 * only when the requested embedder script is absent (explicit null so the
 * engine fails visibly instead of silently falling back to ECAPA).
 * @param {string} mode
 * @returns {object|null}
 */
function voiceEmbedderFor(mode) {
  if (mode === "wavlm") {
    return typeof VoiceWavlmEmbedder !== "undefined"
      ? VoiceWavlmEmbedder
      : null;
  }
  return typeof VoiceONNXEmbedder !== "undefined" ? VoiceONNXEmbedder : null;
}

/**
 * Build a fresh engine wired to the currently selected embedder.
 * @returns {VoiceEngine|null}
 */
function buildVoiceEngine() {
  var embedder;
  if (typeof VoiceEngine !== "function") return null;
  embedder = voiceEmbedderFor(_voiceEmbedder);
  return new VoiceEngine({
    sampleRate: VOICE_SAMPLE_RATE,
    embedder: embedder,
  });
}

/**
 * Called by the #voice-embedder select onchange; stores the choice, keeps the
 * hint text in sync and rebuilds the engine so the next run uses the selected
 * embedder (a rebuild also drops previously cached templates/report state).
 */
function handleVoiceEmbedderChange() {
  var sel, repEl;
  sel = document.getElementById("voice-embedder");
  if (!sel) return;
  _voiceEmbedder = sel.value;
  _voiceEngine = buildVoiceEngine();
  _voiceReport = null;
  window._voiceReport = null;
  repEl = document.getElementById("voice-report");
  if (repEl) {
    repEl.style.display = "none";
    repEl.innerHTML = "";
  }
  renderVoiceActions(false);
  setStatus(
    "voice-status",
    __(
      "voice.status.embedderChanged",
      "Embedder switched to " +
        _voiceEmbedder +
        ". Re-run to regenerate identifiers.",
    ),
  );
  updateVoiceEmbedderHint();
  updateVoiceVadStatus();
}

/**
 * Refresh the voice-vad-status line based on VoiceVAD availability.
 */
function updateVoiceVadStatus() {
  var el;
  el = document.getElementById("voice-vad-status");
  if (!el) return;
  if (
    typeof VoiceVAD !== "undefined" &&
    VoiceVAD.isReady &&
    VoiceVAD.isReady()
  ) {
    el.textContent = __(
      "voice.vad_ready",
      "VAD ready — speech-activity gating active.",
    );
  } else {
    el.textContent = __(
      "voice.vad_unavailable",
      "VAD not loaded — RMS energy fallback gating.",
    );
  }
}

// ── Consent (GDPR Art 7 / 9(2)(a), mirror of face consent) ──

/**
 * Load the stored consent record for this session. Versioned on two axes;
 * both must match the current build or the record is treated as absent.
 * @returns {object|null}
 */
function voiceConsentLoad() {
  var raw, rec;
  try {
    if (typeof sessionStorage === "undefined") return null;
    raw = sessionStorage.getItem(VOICE_CONSENT_KEY);
    if (!raw) return null;
    rec = JSON.parse(raw);
    if (
      !rec ||
      rec.version !== VOICE_CONSENT_VERSION ||
      rec.policyVersion !== VOICE_CONSENT_POLICY_VERSION
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
function voiceConsentSave(rec) {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(VOICE_CONSENT_KEY, JSON.stringify(rec));
    }
  } catch (e) {
    // privacy mode / quota — consent still holds for this session
  }
}

function voiceConsentClear() {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(VOICE_CONSENT_KEY);
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Unmissable notice when a collection entry point is blocked by missing
 * consent: a status message plus a scroll-and-highlight of the consent panel.
 * @param {boolean} [highlight=true] skip the scroll/highlight when false
 */
function voiceWarnConsentRequired(highlight) {
  var panel, status;
  status = document.getElementById("voice-status");
  if (status) {
    status.textContent = __(
      "voice.consent_needed_first",
      "⚠️ Biometric consent is required first — accept the notice above to enable audio upload and microphone capture.",
    );
  }
  if (highlight === false) return;
  panel = document.getElementById("voice-consent-panel");
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
 * (the Voice Biometric MPA); embedded/test contexts without the panel are
 * not gated.
 * @returns {boolean}
 */
function voiceConsentGranted() {
  var panel = document.getElementById("voice-consent-panel");
  if (!panel) return true;
  return !!voiceConsentLoad();
}

/**
 * Accept handler: requires an explicit, unticked opt-in.
 * @returns {Promise<void>}
 */
async function handleVoiceConsentAccept() {
  var check, panel, statusEl, audioEl, startBtn;
  check = document.getElementById("voice-consent-check");
  if (!check || !check.checked) {
    setStatus(
      "voice-status",
      __(
        "voice.consent_check_required",
        "Please tick the consent checkbox first.",
      ),
    );
    return;
  }
  voiceConsentSave({
    version: VOICE_CONSENT_VERSION,
    policyVersion: VOICE_CONSENT_POLICY_VERSION,
    acceptedAt: new Date().toISOString(),
    accepted: true,
  });
  panel = document.getElementById("voice-consent-panel");
  if (panel) panel.style.display = "none";
  statusEl = document.getElementById("voice-consent-status");
  if (statusEl) statusEl.style.display = "block";
  audioEl = document.getElementById("voice-audio");
  if (audioEl) audioEl.disabled = false;
  startBtn = document.getElementById("voice-record-start");
  if (startBtn) startBtn.disabled = false;
  updateVoiceRunState();
  setStatus(
    "voice-status",
    __(
      "voice.consent_recorded",
      "Consent recorded — all processing stays on this device.",
    ),
  );
}

/**
 * Withdraw consent (GDPR Art 7(3)): drops the record and deletes every
 * stored voice template (Art 17 erasure) after a confirmation.
 * @returns {Promise<void>}
 */
async function handleVoiceConsentWithdraw() {
  var panel, statusEl, audioEl, startBtn, runBtn;
  if (
    typeof confirm === "function" &&
    !confirm(
      __(
        "voice.consent_withdraw_confirm",
        "Withdraw consent? This deletes all stored voice data on this device.",
      ),
    )
  ) {
    return;
  }
  voiceConsentClear();
  if (_voiceRegistry) {
    try {
      await _voiceRegistry.clear();
    } catch (e) {
      // registry failure must not block the withdrawal
    }
  }
  panel = document.getElementById("voice-consent-panel");
  if (panel) panel.style.display = "";
  statusEl = document.getElementById("voice-consent-status");
  if (statusEl) statusEl.style.display = "none";
  audioEl = document.getElementById("voice-audio");
  if (audioEl) audioEl.disabled = true;
  startBtn = document.getElementById("voice-record-start");
  if (startBtn) startBtn.disabled = true;
  runBtn = document.getElementById("voice-run");
  if (runBtn) runBtn.disabled = true;
  if (typeof listVoiceRegistered === "function") await listVoiceRegistered();
  setStatus(
    "voice-status",
    __(
      "voice.consent_withdrawn",
      "Consent withdrawn — stored biometric data deleted.",
    ),
  );
}

/**
 * Wire the consent panel at startup: hide it when consent is already on
 * record, otherwise show it and block every collection entry point. Never
 * throws.
 */
function initVoiceConsent() {
  var panel, check, acceptBtn, audioEl, startBtn, statusEl;
  panel = document.getElementById("voice-consent-panel");
  if (!panel) return;
  check = document.getElementById("voice-consent-check");
  acceptBtn = document.getElementById("voice-consent-accept");
  if (voiceConsentLoad()) {
    panel.style.display = "none";
    statusEl = document.getElementById("voice-consent-status");
    if (statusEl) statusEl.style.display = "block";
    audioEl = document.getElementById("voice-audio");
    if (audioEl) audioEl.disabled = false;
    startBtn = document.getElementById("voice-record-start");
    if (startBtn) startBtn.disabled = false;
    return;
  }
  if (check) check.checked = false;
  audioEl = document.getElementById("voice-audio");
  if (audioEl) audioEl.disabled = true;
  startBtn = document.getElementById("voice-record-start");
  if (startBtn) startBtn.disabled = true;
  runBtn = document.getElementById("voice-run");
  if (runBtn) runBtn.disabled = true;
  if (check && typeof check.addEventListener === "function") {
    check.addEventListener("change", function () {
      if (acceptBtn) acceptBtn.disabled = !check.checked;
    });
  }
}

// ── Input switching / file staging / microphone capture ──

/**
 * Toggle between the upload and microphone capture wrappers.
 * @param {string} mode "upload" | "microphone"
 */
function switchVoiceInput(mode) {
  var wrapU, wrapC, startBtn, audioEl, prev, tabBtns, i;
  if (mode !== "upload" && mode !== "microphone") return;
  if (!voiceConsentGranted()) {
    voiceWarnConsentRequired();
    return;
  }
  if (_voiceInputTab === mode) return;
  _voiceInputTab = mode;
  wrapU = document.getElementById("voice-upload-wrapper");
  wrapC = document.getElementById("voice-capture-wrapper");
  if (wrapU) wrapU.style.display = mode === "upload" ? "block" : "none";
  if (wrapC) wrapC.style.display = mode === "microphone" ? "block" : "none";
  tabBtns = document.querySelectorAll(".voice-tab-btn");
  for (i = 0; i < tabBtns.length; i++) {
    if (tabBtns[i].dataset.voiceTab === mode) {
      tabBtns[i].classList.add("is-active");
    } else {
      tabBtns[i].classList.remove("is-active");
    }
  }
  _voicePendingAudio = null;
  _voicePendingBytes = null;
  _voicePendingSource = null;
  startBtn = document.getElementById("voice-record-start");
  if (startBtn) startBtn.disabled = false;
  audioEl = document.getElementById("voice-audio");
  if (audioEl) audioEl.disabled = false;
  prev = document.getElementById("voice-preview");
  if (prev && prev.style) prev.style.display = "none";
  if (mode === "microphone" && _voiceMicActive) {
    if (typeof VoiceMicrophone !== "undefined") VoiceMicrophone.stop();
    _voiceMicActive = false;
    _voiceMicBlocks = [];
    stopRecorderVisualization();
  }

  // Show/hide recorder UI based on mode
  if (mode === "microphone") {
    showRecorderUI();
  } else {
    hideRecorderUI();
  }

  setStatus("voice-status", "");
  updateVoiceRunState();
}

/**
 * Return true when the file (by type or extension) is an allowed audio input.
 * @param {object} file
 * @returns {boolean}
 */
function isAllowedVoiceFile(file) {
  var name, dot, ext;
  if (!file) return false;
  if (file.type && VOICE_ALLOWED_TYPES[file.type]) return true;
  name = String(file.name || "");
  dot = name.lastIndexOf(".");
  if (dot === -1) return false;
  ext = name.slice(dot + 1).toLowerCase();
  return !!VOICE_ALLOWED_EXTS[ext];
}

/**
 * File input handler (#voice-audio onchange). Validates, decodes to 16 kHz
 * mono PCM and stages the clip for the pipeline. Also keeps the original
 * bytes for provenance embedding.
 * @returns {Promise<void>}
 */
async function handleVoiceFilePicked() {
  var inputEl, file, validated, bytes, decoded;
  if (!voiceConsentGranted()) {
    voiceWarnConsentRequired();
    return;
  }
  inputEl = document.getElementById("voice-audio");
  file = inputEl.files[0];
  if (!file) return;
  if (typeof validateFileInput === "function") {
    try {
      validated = await validateFileInput(inputEl);
    } catch (e) {
      validated = true;
    }
    if (!validated || !inputEl.files.length) {
      _voicePendingAudio = null;
      _voicePendingBytes = null;
      _voicePendingSource = null;
      updateVoiceRunState();
      return;
    }
    file = inputEl.files[0];
  }
  if (!isAllowedVoiceFile(file)) {
    setStatus(
      "voice-status",
      __(
        "voice.error.badType",
        "Unsupported file type. Please use WAV, MP3, M4A, OGG, WebM, OPUS or FLAC audio.",
      ),
    );
    _voicePendingAudio = null;
    _voicePendingBytes = null;
    _voicePendingSource = null;
    updateVoiceRunState();
    return;
  }
  if (file.size > VOICE_MAX_FILE_MB * 1024 * 1024) {
    setStatus(
      "voice-status",
      __(
        "voice.error.tooLarge",
        "Audio too large. Maximum file size is 25 MB.",
      ),
    );
    _voicePendingAudio = null;
    _voicePendingBytes = null;
    _voicePendingSource = null;
    updateVoiceRunState();
    return;
  }
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
    decoded = await decodeAudioFile(file);
  } catch (error) {
    setStatus("voice-status", "Failed to load audio: " + error.message);
    _voicePendingAudio = null;
    _voicePendingBytes = null;
    _voicePendingSource = null;
    updateVoiceRunState();
    return;
  }
  if (!decoded || !decoded.float32 || decoded.float32.length < 1600) {
    setStatus(
      "voice-status",
      __(
        "voice.error.tooShort",
        "The audio clip is too short (need at least 100 ms of audio).",
      ),
    );
    _voicePendingAudio = null;
    _voicePendingBytes = null;
    _voicePendingSource = null;
    updateVoiceRunState();
    return;
  }
  if (decoded.durationMs > VOICE_MAX_UPLOAD_SECONDS * 1000) {
    setStatus(
      "voice-status",
      __(
        "voice.error.tooLong",
        "Audio exceeds maximum duration of 3 minutes. Please trim your file.",
      ),
    );
    _voicePendingAudio = null;
    _voicePendingBytes = null;
    _voicePendingSource = null;
    updateVoiceRunState();
    return;
  }
  if (_voiceMicActive && typeof VoiceMicrophone !== "undefined") {
    VoiceMicrophone.stop();
    _voiceMicActive = false;
    _voiceMicBlocks = [];
  }
  _voicePendingAudio = decoded;
  _voicePendingBytes = bytes;
  _voicePendingSource = {
    source: "file",
    fileName: file.name,
    durationMs: decoded.durationMs,
  };
  updateVoiceVadStatus();
  setStatus(
    "voice-status",
    __(
      "voice.status.audioLoaded",
      "Audio loaded ({0} s). Enter a Name/Label, then press Generate Identifiers.",
    )
      .split("{0}")
      .join((decoded.durationMs / 1000 || 0).toFixed(1)),
  );
  updateVoiceRunState();
}

/**
 * Concatenate captured Float32 blocks into one contiguous buffer.
 * @param {Float32Array[]} blocks
 * @returns {Float32Array}
 */
function concatVoiceBlocks(blocks) {
  var total, out, off, i;
  total = 0;
  for (i = 0; i < blocks.length; i++) total += blocks[i].length;
  out = new Float32Array(total);
  off = 0;
  for (i = 0; i < blocks.length; i++) {
    out.set(blocks[i], off);
    off += blocks[i].length;
  }
  return out;
}

/**
 * Estimate speech seconds in a 16 kHz buffer: VAD frame counts when
 * VoiceVAD is ready, otherwise an RMS-energy activity ratio. Returns null
 * when the VAD path errors (caller then applies the manual-stop fallback).
 * @param {Float32Array} pcm
 * @returns {Promise<number|null>}
 */
async function calculateVoiceSpeechSeconds(pcm) {
  var vad, BLOCK, blocks, speech, i, res, prob, secs, sum, end, j, v, active;
  if (
    typeof VoiceVAD !== "undefined" &&
    VoiceVAD.isReady &&
    VoiceVAD.isReady() &&
    typeof VoiceVAD.process === "function"
  ) {
    BLOCK = 512;
    blocks = Math.max(1, Math.floor(pcm.length / BLOCK));
    speech = 0;
    try {
      for (i = 0; i < blocks; i++) {
        res = await VoiceVAD.process(pcm.subarray(i * BLOCK, (i + 1) * BLOCK));
        prob =
          res && typeof res.probability === "number"
            ? res.probability
            : res && res.isSpeech
              ? 1
              : 0;
        if (prob >= 0.5) speech++;
      }
    } catch (e) {
      return null;
    }
    return (speech * BLOCK) / VOICE_SAMPLE_RATE;
  }
  BLOCK = 512;
  blocks = Math.max(1, Math.floor(pcm.length / BLOCK));
  active = 0;
  for (i = 0; i < blocks; i++) {
    sum = 0;
    end = Math.min((i + 1) * BLOCK, pcm.length);
    for (j = i * BLOCK; j < end; j++) {
      v = pcm[j];
      sum += v * v;
    }
    if (Math.sqrt(sum / (end - i * BLOCK)) >= 1e-4) active++;
  }
  secs = pcm.length / VOICE_SAMPLE_RATE;
  return secs * (active / blocks);
}

/**
 * Start microphone capture via VoiceMicrophone. Blocks are buffered for the
 * stop handler; nothing is staged until capture ends and the speech gate
 * passes.
 * @returns {Promise<void>}
 */
async function handleVoiceRecordStart() {
  var statusEl, started;
  if (!voiceConsentGranted()) {
    voiceWarnConsentRequired();
    return;
  }
  if (
    typeof VoiceMicrophone === "undefined" ||
    typeof VoiceMicrophone.supported !== "function" ||
    !VoiceMicrophone.supported()
  ) {
    setStatus(
      "voice-status",
      __(
        "voice.status.micUnavailable",
        "Microphone capture is not supported in this browser.",
      ),
    );
    return;
  }
  _voiceMicBlocks = [];
  setStatus(
    "voice-status",
    __("voice.status.requestingMic", "Requesting microphone…"),
  );
  try {
    started = await VoiceMicrophone.start({
      onPcm: function (block) {
        _voiceMicBlocks.push(block);
      },
      onLevel: null,
      workletUrl: "../../../Voice_Biometric/voice_capture_worklet.js",
    });
  } catch (e) {
    setStatus(
      "voice-status",
      typeof VoiceMicrophone.getMicrophoneErrorMessage === "function"
        ? VoiceMicrophone.getMicrophoneErrorMessage(e)
        : "Microphone error: " + (e && e.message ? e.message : e),
    );
    return;
  }
  if (!started || !started.sampleRate) {
    setStatus("voice-status", "Microphone could not be started.");
    return;
  }
  _voiceMicActive = true;

  // Show recorder UI and start visualization
  showRecorderUI();
  var stream =
    typeof VoiceMicrophone.getStream === "function"
      ? VoiceMicrophone.getStream()
      : null;
  if (stream) {
    startRecorderVisualization(stream);
  }

  statusEl = document.getElementById("voice-record-start");
  if (statusEl) statusEl.disabled = true;
  statusEl = document.getElementById("voice-record-stop");
  if (statusEl) statusEl.disabled = false;
  statusEl = document.getElementById("voice-record-abort");
  if (statusEl) statusEl.disabled = false;
  setStatus(
    "voice-status",
    __("voice.status.recording", "Recording… speak clearly, then press Stop."),
  );
  updateVoiceRunState();
}

/**
 * Stop microphone capture, apply the VAD/min-speech gate and stage the
 * recording when it passes. Manual stops with ≥1.0 s of audio are accepted
 * when VAD is not available.
 * @returns {Promise<void>}
 */
async function handleVoiceRecordStop() {
  var pcm, secs, speechSecs, startBtn, stopBtn, abortBtn;
  if (!_voiceMicActive) return;
  _voiceMicActive = false;

  // Stop recorder visualization
  stopRecorderVisualization();

  if (typeof VoiceMicrophone !== "undefined") VoiceMicrophone.stop();
  pcm = concatVoiceBlocks(_voiceMicBlocks);
  _voiceMicBlocks = [];
  secs = pcm.length / VOICE_SAMPLE_RATE;
  if (secs < 1.0) {
    setStatus(
      "voice-status",
      __(
        "voice.status.tooShort",
        "Recording too short (need at least 1 second).",
      ),
    );
    updateVoiceRunState();
    return;
  }
  speechSecs = await calculateVoiceSpeechSeconds(pcm);
  if (speechSecs === null && secs >= 1.0) {
    // VAD error path — accept the manual stop (≥1 s) and warn.
    speechSecs = secs;
  }
  if (speechSecs < VOICE_MIN_SPEECH_SECONDS) {
    setStatus(
      "voice-status",
      __(
        "voice.status.noSpeech",
        "Not enough speech detected in the recording. Please try again.",
      ),
    );
    updateVoiceRunState();
    return;
  }
  _voicePendingAudio = {
    float32: pcm,
    sampleRate: VOICE_SAMPLE_RATE,
    durationMs: Math.round(secs * 1000),
  };
  _voicePendingBytes = null; // mic bytes are not provenance-embeddable
  _voicePendingSource = {
    source: "microphone",
    fileName: "microphone_capture",
    durationMs: Math.round(secs * 1000),
  };
  updateVoiceVadStatus();
  setStatus(
    "voice-status",
    __(
      "voice.status.recordingStaged",
      "Recording staged ({0} s speech). Enter a Name/Label, then press Generate Identifiers.",
    )
      .split("{0}")
      .join(speechSecs.toFixed(1)),
  );
  resetMicButtons();
  updateVoiceRunState();
}

/**
 * Reset mic button states to the idle/ready state after recording ends
 * (stop or abort).  Discard is kept enabled when staged audio exists so
 * the user can discard it.
 */
function resetMicButtons() {
  var s = document.getElementById("voice-record-start");
  var p = document.getElementById("voice-record-stop");
  var a = document.getElementById("voice-record-abort");
  if (s) s.disabled = false;
  if (p) p.disabled = true;
  if (a) a.disabled = !_voicePendingAudio;
}

/**
 * Abort microphone capture without staging anything.
 * Also clears any previously staged recording so the user can start fresh.
 * @returns {Promise<void>}
 */
async function handleVoiceRecordAbort() {
  if (_voiceMicActive) {
    _voiceMicActive = false;

    // Stop recorder visualization
    stopRecorderVisualization();

    if (typeof VoiceMicrophone !== "undefined") VoiceMicrophone.stop();
    _voiceMicBlocks = [];
  }
  _voicePendingAudio = null;
  _voicePendingBytes = null;
  _voicePendingSource = {};
  resetMicButtons();
  setStatus(
    "voice-status",
    __("voice.status.recordingAborted", "Recording aborted."),
  );
  updateVoiceRunState();
}

// ── Pipeline ──

/**
 * Start the automated pipeline with the staged audio (file or microphone).
 */
async function handleVoiceRun() {
  if (!voiceConsentGranted()) {
    voiceWarnConsentRequired();
    return;
  }
  if (!_voicePendingAudio) {
    setStatus(
      "voice-status",
      __(
        "voice.status.noAudio",
        "No audio loaded. Pick an audio file or record with the microphone first.",
      ),
    );
    return;
  }
  return runVoicePipeline(_voicePendingAudio, _voicePendingSource || {});
}

/**
 * Build a report skeleton with the shared fields already filled.
 * @param {object} opts
 * @returns {object}
 */
function voiceBaseReport(opts) {
  var base;
  opts = opts || {};
  base = {
    type: "redoSan.voiceBiometricReport",
    version: 1,
    generatedAt: new Date().toISOString(),
    generator: "RedoSan Authenticity",
    source: opts.source || "file",
  };
  return Object.assign(base, {
    audio: opts.audio || null,
    quality: opts.quality || null,
    antiSpoof: opts.antiSpoof || null,
    speaker: opts.speaker || null,
    template: opts.template || null,
    registry: opts.registry || { match: null, registeredId: null },
    did: opts.did || null,
    standards: opts.standards || null,
    provenance: opts.provenance || null,
    limitations: opts.limitations || null,
    timings: opts.timings || null,
  });
}

/**
 * Core automated pipeline: quality → PAD (optional) → embedding →
 * template protection → DID signature → registry match + enroll → standards
 * record → provenance → render report.
 * @param {{float32: Float32Array, sampleRate: number, durationMs: number}} audio
 * @param {{source?: string, fileName?: string, durationMs?: number}} opts
 */
async function runVoicePipeline(audio, opts) {
  var repEl, labelEl, label, mode, kp, emb, code, embHash, sigBytes, sigB64;
  var doc,
    vc,
    matchR,
    id,
    record,
    prov,
    quality,
    pad,
    report,
    embedMagnitude,
    modelVersion;
  opts = opts || {};
  var _perf = [],
    _pt0 = performance.now();
  function _pt(stage) {
    var _now = performance.now();
    _perf.push({ stage: stage, ms: Math.round((_now - _pt0) * 10) / 10 });
    _pt0 = _now;
  }
  if (typeof window !== "undefined") window._voiceTimings = _perf;
  if (!audio || !audio.float32 || !audio.float32.length) {
    setStatus("voice-status", "No audio data staged.");
    return;
  }
  _voiceReport = null;
  window._voiceReport = null;
  renderVoiceActions(false);
  repEl = document.getElementById("voice-report");
  if (repEl) {
    repEl.style.display = "none";
    repEl.innerHTML = "";
  }
  // Build singletons once (first run). The engine picks the selected
  // embedder (ECAPA default, or WavLM when "wavlm" is chosen).
  if (!_voiceEngine) {
    _voiceEngine = buildVoiceEngine();
  }
  if (!_voiceRegistry && typeof VoiceRegistry === "function") {
    _voiceRegistry = new VoiceRegistry();
    try {
      await _voiceRegistry.open();
    } catch (e) {
      setStatus("voice-status", "Voice Registry failed to open: " + e.message);
      setVoiceStep(null);
      return;
    }
  }
  if (!_voiceRegistry) {
    setStatus(
      "voice-status",
      __(
        "voice.status.registryUnavailable",
        "Voice Registry is not available in this browser.",
      ),
    );
    setVoiceStep(null);
    return;
  }
  if (!_voiceEngine) {
    setStatus(
      "voice-status",
      __(
        "voice.status.engineUnavailable",
        "Voice Engine is not available in this browser.",
      ),
    );
    setVoiceStep(null);
    return;
  }
  pcm = audio.float32;
  _pt("audio");
  try {
    voiceProgressShow(
      __("voice.progress.title", "Generating Voice Identifiers"),
      __("voice.step.load", "Preparing voice engine…"),
    );
    setVoiceStage(
      "1/8 " + __("voice.step.load", "Preparing voice engine…"),
      0.06,
    );
    setStatus(
      "voice-status",
      __("voice.status.preparing", "Preparing voice engine…"),
    );
    if (typeof _voiceEngine.load === "function" && !_voiceEngine.isLoaded()) {
      try {
        await _voiceEngine.load();
      } catch (e) {
        // A missing ONNX embedder is non-fatal when a mock/fallback isn't
        // wired; quality/RMS gating still runs below.
      }
    }
    _pt("load");

    // 2/8 — Quality gate (ISO/IEC 29794-1 framework)
    setVoiceStage(
      "2/8 " + __("voice.step.quality", "Assessing audio quality…"),
      0.18,
    );
    setStatus(
      "voice-status",
      __("voice.status.quality", "Assessing audio quality…"),
    );
    quality =
      typeof _voiceEngine.assessQuality === "function"
        ? await _voiceEngine.assessQuality(pcm, VOICE_SAMPLE_RATE, {
            minSpeechSeconds: VOICE_MIN_SPEECH_SECONDS,
          })
        : { gate: "PASS", score: 100, speechRatio: 1, reasons: [] };
    _pt("quality");
    if (quality.gate === "FAIL") {
      report = voiceBaseReport({
        source: opts.source || "file",
        audio: {
          fileName:
            opts.fileName ||
            (opts.source === "microphone" ? "microphone_capture" : "audio"),
          sampleRate: VOICE_SAMPLE_RATE,
          durationMs: audio.durationMs,
        },
        quality: quality,
        antiSpoof: {
          mode: "off",
          gate: "NOT_RUN",
          standard: "ISO/IEC 30107-3",
          reasons: [],
        },
        limitations: [
          __(
            "voice.limitation.qualityRejected",
            "Audio did not pass the quality gate; a voice template would degrade recognition accuracy.",
          ),
        ],
        timings: _perf,
      });
      _voiceReport = report;
      window._voiceReport = report;
      renderVoiceReport(report);
      setDownloadHandler(downloadVoiceReport);
      renderVoiceActions(true);
      setStatus(
        "voice-status",
        __(
          "voice.status.qualityRejected",
          "Audio quality rejected — too short or too much silence. No template was registered.",
        ),
      );
      setVoiceStep(null);
      voiceProgressHide();
      return;
    }

    // 3/8 — Presentation Attack Detection (optional, ISO/IEC 30107-3)
    mode = getAntiSpoofMode();
    pad = { mode: mode };
    if (mode !== "off") {
      setVoiceStage(
        "3/8 " + __("voice.step.pad", "Checking presentation attack…"),
        0.3,
      );
      setStatus(
        "voice-status",
        __("voice.status.pad", "Checking presentation attack…"),
      );
      pad = await _voiceEngine.assessPAD(pcm, VOICE_SAMPLE_RATE);
      pad.mode = mode;
      if (pad.gate === "FAIL") {
        report = voiceBaseReport({
          source: opts.source || "file",
          audio: {
            fileName:
              opts.fileName ||
              (opts.source === "microphone" ? "microphone_capture" : "audio"),
            sampleRate: VOICE_SAMPLE_RATE,
            durationMs: audio.durationMs,
          },
          quality: quality,
          antiSpoof: pad,
          limitations: [
            __(
              "voice.limitation.spoofRejected",
              "Presentation attack detected; the sample was not enrolled and no template was registered.",
            ),
          ],
          timings: _perf,
        });
        _voiceReport = report;
        window._voiceReport = report;
        renderVoiceReport(report);
        setDownloadHandler(downloadVoiceReport);
        renderVoiceActions(true);
        setStatus(
          "voice-status",
          __(
            "voice.status.spoofRejected",
            "Anti-spoof check failed (spoof detected). No template was registered.",
          ),
        );
        setVoiceStep(null);
        voiceProgressHide();
        return;
      }
    } else {
      pad.gate = "NOT_RUN";
      pad.verdict = null;
      pad.standard = "ISO/IEC 30107-3";
      pad.reasons = ["disabled-by-user"];
    }

    // 4/8 — Embedding (ECAPA-TDNN 192-dim)
    setVoiceStage(
      "4/8 " + __("voice.step.embed", "Extracting voice embedding…"),
      0.42,
    );
    setStatus(
      "voice-status",
      __("voice.status.embed", "Extracting voice embedding…"),
    );
    try {
      emb = await _voiceEngine._embed(pcm, VOICE_SAMPLE_RATE);
    } catch (e) {
      setStatus("voice-status", "Embedding stage error: " + e.message);
      setVoiceStep(null);
      voiceProgressHide();
      return;
    }
    _pt("embed");
    if (!emb || !emb.length) {
      setStatus(
        "voice-status",
        __(
          "voice.status.embedFailed",
          "Voice embedding not available (embedder: " + _voiceEmbedder + ").",
        ),
      );
      setVoiceStep(null);
      voiceProgressHide();
      return;
    }

    // Non-speech honesty: capture the pre-normalization embedding L2 magnitude
    // (near-zero → the encoder received near-silence; surfaced as a
    // warn-only limitation so the decision is never silently relied on).
    embedMagnitude = null;
    modelVersion = null;
    if (_voiceEngine && _voiceEngine._embedder) {
      if (typeof _voiceEngine._embedder.lastMagnitude === "number") {
        embedMagnitude = _voiceEngine._embedder.lastMagnitude;
      }
      if (_voiceEngine._embedder.VERSION) {
        modelVersion = _voiceEngine._embedder.VERSION;
      }
    }

    // 5/8 — Template protection (ISO/IEC 24745:2022, cancellable)
    setVoiceStage(
      "5/8 " + __("voice.step.template", "Protecting template…"),
      0.55,
    );
    setStatus(
      "voice-status",
      __("voice.status.template", "Protecting template…"),
    );
    if (!_voiceTemplateSecret) {
      _voiceTemplateSecret = voiceRandomToken(16);
    }
    if (
      typeof VoiceTemplateProtection !== "undefined" &&
      typeof VoiceTemplateProtection.generate === "function"
    ) {
      code = await VoiceTemplateProtection.generate(emb, _voiceTemplateSecret, {
        dim: Math.min(128, emb.length),
      });
    } else {
      // Extremely defensive fallback: mail the embedding through WebCrypto.
      code = {
        schema: null,
        code: new Uint8Array(await voiceDescriptorBytes(emb)),
        bits: emb.length * 8,
        params: { kdf: "none" },
        keyFingerprint: (await voiceDescriptorHash(emb)) || null,
      };
    }
    _pt("template");

    // 6/8 — DID signature over the embedding bytes
    kp = null;
    sigBytes = null;
    sigB64 = null;
    doc = null;
    vc = null;
    if (typeof didGenerateKeypair === "function") {
      setVoiceStage(
        "6/8 " + __("voice.step.did", "Signing embedding with DID…"),
        0.7,
      );
      setStatus(
        "voice-status",
        __("voice.status.did", "Signing embedding with DID…"),
      );
      kp = await didGenerateKeypair("Ed25519");
      _voiceKeypair = kp;
      globalThis._voiceKeypair = kp;
      if (kp && typeof didSign === "function") {
        sigBytes = await didSign(kp, new Uint8Array(emb.buffer));
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
              await voiceDescriptorHash(emb),
              sigB64,
            )
          : null;
    }
    _pt("did");

    // 7/8 — Registry match + enroll (consent-scoped)
    matchR = null;
    id = null;
    if (_voiceRegistry) {
      setVoiceStage(
        "7/8 " + __("voice.step.registry", "Matching registry…"),
        0.84,
      );
      setStatus(
        "voice-status",
        __("voice.status.registry", "Matching registry…"),
      );
      try {
        matchR = await _voiceRegistry.findMatch(code.code, 0.7);
      } catch (e) {
        matchR = null;
      }
      labelEl = document.getElementById("voice-label");
      label = labelEl && labelEl.value ? labelEl.value.trim() : "";
      if (label) {
        try {
          await _voiceRegistry.grantConsent(
            label,
            "voice-biometric-authentication",
            {},
          );
        } catch (e) {
          // consent row already active or registry metadata error — non-fatal
        }
        try {
          id = await _voiceRegistry.add(label, code, {
            source: opts.source || "file",
            fileName: opts.fileName || null,
            registeredAt: new Date().toISOString(),
          });
        } catch (e) {
          id = null;
        }
      }
    }

    // 8/8 — Standards record + provenance
    record = null;
    prov = null;
    setVoiceStage(
      "8/8 " + __("voice.step.record", "Creating standards record…"),
      0.93,
    );
    setStatus(
      "voice-status",
      __("voice.status.record", "Creating standards record…"),
    );
    if (
      typeof VoiceStandards !== "undefined" &&
      typeof VoiceStandards.createRecord === "function"
    ) {
      try {
        record = await VoiceStandards.createRecord({
          audioMetaInfo: {
            channelCount: 1,
            samplingRate: VOICE_SAMPLE_RATE,
            bitsPerSample: 16,
          },
          audioContent: pcm,
        });
      } catch (e) {
        record = null;
      }
    }
    if (_voicePendingBytes && kp) {
      prov = await voiceProvenanceEmbed(_voicePendingBytes, kp);
    } else {
      prov = null;
    }
    _pt("record");

    report = voiceBaseReport({
      source: opts.source || "file",
      audio: {
        fileName:
          opts.fileName ||
          (opts.source === "microphone" ? "microphone_capture" : "audio"),
        sampleRate: VOICE_SAMPLE_RATE,
        durationMs: audio.durationMs,
      },
      quality: quality,
      antiSpoof: pad,
      speaker: {
        embeddingDim: emb.length,
        embeddingHash: await voiceDescriptorHash(emb),
        embeddingVersion: _voiceEmbedder,
        embeddingModel: modelVersion,
        embedMagnitude: embedMagnitude,
        similarity: matchR && matchR.match ? matchR.similarity : null,
        decision: matchR ? (matchR.match ? "MATCH" : "NO_MATCH") : null,
      },
      template: code
        ? {
            schema: code.schema || null,
            bits: code.bits || null,
            codeSha256: await voiceDescriptorHash(code.code),
            pinFingerprint: code.keyFingerprint || null,
            params: code.params || null,
          }
        : null,
      registry: {
        match:
          matchR && matchR.match
            ? {
                label: matchR.match.label,
                similarity: Math.max(
                  0,
                  Math.round(matchR.similarity * 10000) / 100,
                ),
              }
            : null,
        registeredId: id || null,
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
      standards: record || null,
      provenance: prov || null,
      limitations: voiceLimitations(
        quality,
        pad,
        matchR,
        embedMagnitude,
        modelVersion,
      ),
      timings: _perf,
    });
    _voiceReport = report;
    window._voiceReport = report;
    console.log("[POST-REPORT] renderVoiceReport START");
    renderVoiceReport(report);
    console.log("[POST-REPORT] renderVoiceReport END");
    setDownloadHandler(downloadVoiceReport);
    console.log("[POST-REPORT] setDownloadHandler END");
    renderVoiceActions(true);
    console.log("[POST-REPORT] renderVoiceActions END");
    setStatus(
      "voice-status",
      __(
        "voice.status.embedderChanged",
        "Embedder switched to " +
          _voiceEmbedder +
          ". Re-run to regenerate identifiers.",
      ).replace("{0}", _voiceEmbedder),
    );
    console.log("[POST-REPORT] setStatus END");
    if (typeof listVoiceRegistered === "function") {
      console.log("[POST-REPORT] listVoiceRegistered START");
      await listVoiceRegistered();
      console.log("[POST-REPORT] listVoiceRegistered END");
    }
  } catch (error) {
    setStatus("voice-status", "Pipeline error: " + error.message);
  }
  setVoiceStep(null);
  voiceProgressHide();
}

/**
 * Bytes view of an embedding (for the defensive template fallback).
 * @param {Float32Array} emb
 * @returns {Promise<Uint8Array>}
 */
async function voiceDescriptorBytes(emb) {
  var out, i;
  out = new Uint8Array(emb.length * 4);
  new DataView(out.buffer).setFloat32(0, 0); // keep DataView referenced
  for (i = 0; i < emb.length; i++) {
    out[i] = Math.round((emb[i] + 1) * 127.5) & 0xff;
  }
  return out;
}

/**
 * Honest limitations list shown in every report (privacy-first framing).
 * @param {object} quality
 * @param {object} pad
 * @param {object|null} matchR
 * @param {number|null} [embedMagnitude] pre-normalization embedding L2 norm
 * @param {string|null} [modelVersion] embedder model label (floor lookup)
 * @returns {string[]}
 */
function voiceLimitations(quality, pad, matchR, embedMagnitude, modelVersion) {
  var lines, floor;
  lines = [
    __(
      "voice.limitation.quality",
      "Quality gating is a heuristic (ISO/IEC 29794-1 framework) — it cannot guarantee enrolment success in noisy environments.",
    ),
  ];
  if (!pad || pad.gate === "NOT_RUN") {
    lines.push(
      __(
        "voice.limitation.padOff",
        "Presentation-attack detection is disabled; the report only records a positive biometric capture.",
      ),
    );
  }
  if (!matchR || !matchR.match) {
    lines.push(
      __(
        "voice.limitation.firstEnrolment",
        "First enrolment: no prior voice template was matched; similarity and decision are reported for later verification only.",
      ),
    );
  }
  if (typeof embedMagnitude === "number") {
    floor = VOICE_EMBED_LOW_MAGNITUDE[modelVersion];
    if (typeof floor === "number" && embedMagnitude < floor) {
      lines.push(
        __(
          "voice.limitation.lowMagnitude",
          "The embedding produced an unexpectedly low signal magnitude; the input may not have contained clear speech. Treat the resulting identifiers as low-confidence.",
        ),
      );
    }
  }
  return lines;
}

/**
 * Embed C2PA-style provenance into the original upload bytes via the
 * VoiceProvenance ES-module bridge (window.VoiceProvenance in the browser).
 * Kept separate so the unit suite can stub the module.
 * @param {Uint8Array} bytes
 * @param {object} kp
 * @returns {Promise<object|null>}
 */
async function voiceProvenanceEmbed(bytes, kp) {
  var res;
  if (
    typeof VoiceProvenance === "undefined" ||
    typeof VoiceProvenance.embedAudio !== "function"
  ) {
    return {
      status: "absent",
      absentReason: "VoiceProvenance module not loaded (browser bridge).",
    };
  }
  try {
    res = await VoiceProvenance.embedAudio({
      bytes: bytes,
      keypair: kp,
      generatorName: "redosan",
      generatorVersion: "1.0.0",
      ots: null,
    });
  } catch (e) {
    return {
      status: "partial",
      error: e && e.message ? e.message : "embed-error",
    };
  }
  if (!res || !res.output) {
    return { status: "partial", error: "no-output" };
  }
  _voiceProvenanceOutput = res.output;
  _voiceProvenanceManifest = res.manifest || null;
  return {
    status: "complete",
    manifestLabel: (res.manifest && res.manifest.manifestLabel) || null,
    format: (res.manifest && res.manifest.format) || null,
    signerDid: (res.manifest && res.manifest.signerDid) || null,
    storeLength: (res.manifest && res.manifest.storeLength) || null,
    exclusions:
      res.manifest && res.manifest.exclusionStart != null
        ? [
            {
              start: res.manifest.exclusionStart,
              length: res.manifest.exclusionLength,
            },
          ]
        : null,
    outputBytesAvailable: true,
  };
}

// ── Report rendering ──

/**
 * @param {boolean} show
 */
function renderVoiceActions(show) {
  var el = document.getElementById("voice-actions");
  if (!el) return;
  el.style.display = show ? "flex" : "none";
}

/**
 * Organized HTML report of every generated identifier/signature.
 * @param {object} r
 */
function renderVoiceReport(r) {
  var el, html, sections, rows, i, mt, j;
  el = document.getElementById("voice-report");
  if (!el) return;
  mt = document.querySelector("#dl-modal-title");
  if (mt) mt.textContent = __("dl.title") || "Download Voice Report";
  html = '<div class="result" style="margin-top:4px">';
  html +=
    "<h3 style='margin:0 0 8px'>" +
    __("voice.report.title", "Voice Biometric Report") +
    "</h3>";

  rows = function (pairs) {
    var out;
    out = "<table class='meta-table'>";
    for (i = 0; i < pairs.length; i++) {
      out +=
        "<tr><td>" + pairs[i][0] + "</td><td>" + pairs[i][1] + "</td></tr>";
    }
    return out + "</table>";
  };
  sections = [];
  sections.push([
    __("voice.report.audio", "Audio"),
    rows([
      [
        "File",
        "<code>" + escHtml(r.audio ? r.audio.fileName : "-") + "</code>",
      ],
      ["Sample rate", r.audio ? r.audio.sampleRate + " Hz" : "-"],
      [
        "Duration",
        r.audio ? (r.audio.durationMs / 1000).toFixed(2) + " s" : "-",
      ],
    ]),
  ]);
  sections.push([
    __("voice.report.quality", "Quality gate"),
    rows([
      ["Gate", r.quality ? escHtml(String(r.quality.gate)) : "-"],
      ["Score", r.quality ? String(r.quality.score) : "-"],
      [
        "Speech ratio",
        r.quality && isFinite(r.quality.speechRatio)
          ? (r.quality.speechRatio * 100).toFixed(1) + "%"
          : "n/a",
      ],
      [
        "Reasons",
        r.quality
          ? escHtml((r.quality.reasons || []).join(", ") || "pass")
          : "-",
      ],
      ["Standard", r.quality ? escHtml(r.quality.standard) : "-"],
    ]),
  ]);
  if (r.antiSpoof) {
    sections.push([
      __("voice.report.pad", "Presentation attack detection"),
      rows([
        ["Mode", escHtml(String(r.antiSpoof.mode || "off"))],
        ["Gate", escHtml(String(r.antiSpoof.gate))],
        [
          "Verdict",
          r.antiSpoof.verdict ? escHtml(String(r.antiSpoof.verdict)) : "n/a",
        ],
        ["Standard", escHtml(r.antiSpoof.standard)],
        ["Reasons", escHtml((r.antiSpoof.reasons || []).join(", ") || "pass")],
      ]),
    ]);
  }
  if (r.speaker) {
    sections.push([
      __("voice.report.speaker", "Speaker verification"),
      rows([
        ["Embedding", r.speaker.embeddingDim + " dims"],
        ["Embedder", escHtml(r.speaker.embeddingVersion || "ecapa")],
        [
          "Embedding magnitude",
          typeof r.speaker.embedMagnitude === "number"
            ? r.speaker.embedMagnitude.toFixed(3)
            : "—",
        ],
        [
          "Similarity",
          r.speaker.similarity != null
            ? (r.speaker.similarity * 100).toFixed(1) + "%"
            : "—",
        ],
        ["Decision", r.speaker.decision ? escHtml(r.speaker.decision) : "—"],
        [
          "Embedding hash",
          "<code style='font-size:0.65rem;word-break:break-all'>" +
            escHtml(r.speaker.embeddingHash) +
            "</code>",
        ],
      ]),
    ]);
  }
  if (r.template) {
    sections.push([
      __("voice.report.template", "Protected template (ISO/IEC 24745)"),
      rows([
        ["Bits", String(r.template.bits)],
        ["Schema", escHtml(r.template.schema || "-")],
        [
          "Code hash",
          "<code style='font-size:0.65rem;word-break:break-all'>" +
            escHtml(r.template.codeSha256) +
            "</code>",
        ],
        [
          "Key fingerprint",
          "<code style='font-size:0.65rem;word-break:break-all'>" +
            escHtml(r.template.pinFingerprint || "-") +
            "</code>",
        ],
      ]),
    ]);
  }
  sections.push([
    __("voice.report.registry", "Registry"),
    rows([
      [
        "Match",
        r.registry && r.registry.match
          ? escHtml(r.registry.match.label) +
            " (" +
            r.registry.match.similarity.toFixed(1) +
            "%)"
          : __("voice.report.noMatch", "Not found in the registry."),
      ],
      [
        "Registered ID",
        r.registry ? String(r.registry.registeredId || "-") : "-",
      ],
    ]),
  ]);
  if (r.did) {
    sections.push([
      __("voice.report.did", "DID identity & signature"),
      rows([
        [
          "DID",
          "<code style='font-size:0.7rem;word-break:break-all'>" +
            escHtml(r.did.did) +
            "</code>",
        ],
        ["Algorithm", escHtml(r.did.algorithm)],
        ["Signed at", escHtml(r.did.signedAt)],
        [
          "Signature",
          "<code style='font-size:0.65rem;word-break:break-all'>" +
            escHtml(r.did.signature || "") +
            "</code>",
        ],
      ]) +
        "<details style='margin-top:6px'><summary style='cursor:pointer;font-size:0.75rem'>" +
        __("voice.report.didDoc", "DID document") +
        "</summary><pre style='font-size:0.65rem;overflow-x:auto;background:rgba(0,0,0,.04);padding:8px;border-radius:6px'>" +
        escHtml(JSON.stringify(r.did.document, null, 2)) +
        "</pre></details>" +
        "<details style='margin-top:4px'><summary style='cursor:pointer;font-size:0.75rem'>" +
        __("voice.report.vc", "Verifiable Credential") +
        "</summary><pre style='font-size:0.65rem;overflow-x:auto;background:rgba(0,0,0,.04);padding:8px;border-radius:6px'>" +
        escHtml(JSON.stringify(r.did.verifiableCredential, null, 2)) +
        "</pre></details>",
    ]);
  }
  if (r.standards) {
    sections.push([
      __("voice.report.standards", "Standards record"),
      "<pre style='font-size:0.65rem;overflow-x:auto;background:rgba(0,0,0,.04);padding:8px;border-radius:6px'>" +
        escHtml(JSON.stringify(r.standards, null, 2)) +
        "</pre>",
    ]);
  }
  if (r.provenance) {
    sections.push([
      __("voice.report.provenance", "Provenance"),
      rows([
        ["Status", escHtml(String(r.provenance.status))],
        [
          "Manifest",
          r.provenance.manifestLabel
            ? "<code style='font-size:0.65rem;word-break:break-all'>" +
              escHtml(r.provenance.manifestLabel) +
              "</code>"
            : "-",
        ],
        [
          "Format",
          r.provenance.format ? escHtml(String(r.provenance.format)) : "-",
        ],
        [
          "Signer DID",
          r.provenance.signerDid
            ? escHtml(String(r.provenance.signerDid))
            : "-",
        ],
        [
          "Store length",
          r.provenance.storeLength != null
            ? String(r.provenance.storeLength)
            : "-",
        ],
      ]),
    ]);
  }
  if (r.limitations && r.limitations.length) {
    html +=
      "<h4 style='margin:10px 0 4px;font-size:0.8rem'>" +
      __("voice.report.limitations", "Limitations") +
      "</h4><ul style='font-size:0.75rem;color:var(--text-muted);padding-left:18px'>";
    for (i = 0; i < r.limitations.length; i++) {
      html += "<li>" + escHtml(r.limitations[i]) + "</li>";
    }
    html += "</ul>";
  }
  for (i = 0; i < sections.length; i++) {
    html +=
      "<div style='margin-bottom:6px'><h4 style='margin:6px 0 4px;font-size:0.85rem'>" +
      sections[i][0] +
      "</h4>" +
      sections[i][1] +
      "</div>";
  }
  html += "</div>";
  el.innerHTML = html;
  el.style.display = "block";
}

// ── Downloads ──

/**
 * Download the current voice report in the requested format.
 * @param {string} format "json" | "csv" | "txt" | "xml" | "html" | "pdf" | "doc"
 */
async function downloadVoiceReport(format) {
  var r, base, content, ext, mime, labels;
  closeDownloadModal();
  r = _voiceReport;
  if (!r) return;
  base = String(r.audio && r.audio.fileName ? r.audio.fileName : "voice-report")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\.\w+$/, "");
  if (format === "pdf") {
    downloadBlobSimple(await voiceReportToPDF(r), base + ".voice_report.pdf");
    return;
  }
  if (format === "doc") {
    downloadBlobSimple(await voiceReportToDOCX(r), base + ".voice_report.docx");
    return;
  }
  switch (format) {
    case "json":
      content = JSON.stringify(r, null, 2);
      ext = "json";
      mime = "application/json";
      break;
    case "csv":
      labels = await voiceLabelsToSheet("csv");
      content =
        voiceReportToCSV(r) +
        (labels ? "\n\n[Registered Voice Labels]\n" + labels : "");
      ext = "csv";
      mime = "text/csv";
      break;
    case "txt":
      labels = await voiceLabelsToSheet("txt");
      content =
        voiceReportToTXT(r) +
        (labels ? "\n\n[Registered Voice Labels]\n" + labels : "");
      ext = "txt";
      mime = "text/plain";
      break;
    case "xml":
      content = voiceReportToXML(r);
      ext = "xml";
      mime = "application/xml";
      break;
    case "html":
      content = voiceReportToHTML(r);
      ext = "html";
      mime = "text/html";
      break;
  }
  if (content == null) return;
  downloadBlobSimple(
    new Blob([content], { type: mime }),
    base + ".voice_report." + ext,
  );
}

/**
 * @param {object} r
 * @returns {string}
 */
function voiceReportToCSV(r) {
  var rows, push;
  rows = [
    ["Key", "Value"],
    ["Type", r.type],
    ["Generated at", r.generatedAt],
    ["Source", r.source],
    ["File", r.audio ? r.audio.fileName : ""],
    ["Sample rate", r.audio ? r.audio.sampleRate : ""],
    ["Duration ms", r.audio ? r.audio.durationMs : ""],
  ];
  push = function (k, v) {
    if (v != null && v !== "") rows.push([k, v]);
  };
  if (r.quality) {
    push("Quality gate", r.quality.gate);
    push("Quality score", r.quality.score);
    push("Quality reasons", (r.quality.reasons || []).join(", "));
  }
  if (r.antiSpoof) {
    push("PAD gate", r.antiSpoof.gate);
    push("PAD verdict", r.antiSpoof.verdict || "");
  }
  if (r.speaker) {
    push("Embedding dims", r.speaker.embeddingDim);
    push("Embedding hash", r.speaker.embeddingHash);
    push("Speaker decision", r.speaker.decision || "");
  }
  if (r.template) {
    push("Template bits", r.template.bits);
    push("Template code hash", r.template.codeSha256);
    push("Template key fingerprint", r.template.pinFingerprint);
  }
  push(
    "Registry match",
    r.registry && r.registry.match
      ? r.registry.match.label +
          " (" +
          r.registry.match.similarity.toFixed(1) +
          "%)"
      : "none",
  );
  push("Registered ID", r.registry ? r.registry.registeredId : "");
  if (r.did) {
    push("DID", r.did.did);
    push("DID algorithm", r.did.algorithm);
    push("DID signed at", r.did.signedAt);
    push("DID signature", r.did.signature);
  }
  if (r.provenance) push("Provenance", r.provenance.status);
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
function voiceReportToTXT(r) {
  var lines, push;
  lines = ["=== RedoSan Authenticity - Voice Biometric Report ===", ""];
  push = function (k, v) {
    if (v != null && v !== "") lines.push(k + ": " + v);
  };
  push("Generated at", r.generatedAt);
  push("Source", r.source);
  push("File", r.audio ? r.audio.fileName : "");
  push("Sample rate", r.audio ? r.audio.sampleRate + " Hz" : "");
  push(
    "Duration",
    r.audio ? (r.audio.durationMs / 1000).toFixed(2) + " s" : "",
  );
  lines.push("");
  lines.push("-- Quality Gate --");
  if (r.quality) {
    push("Gate", r.quality.gate);
    push("Score", r.quality.score);
    push(
      "Speech ratio",
      isFinite(r.quality.speechRatio)
        ? (r.quality.speechRatio * 100).toFixed(1) + "%"
        : "n/a",
    );
    push("Reasons", (r.quality.reasons || []).join(", "));
  } else {
    lines.push("(quality module unavailable)");
  }
  lines.push("");
  lines.push("-- Presentation Attack Detection --");
  if (r.antiSpoof) {
    push("Gate", r.antiSpoof.gate);
    push("Verdict", r.antiSpoof.verdict || "n/a");
    push("Reasons", (r.antiSpoof.reasons || []).join(", "));
  } else {
    lines.push("(not evaluated)");
  }
  lines.push("");
  lines.push("-- Speaker Verification --");
  if (r.speaker) {
    push("Embedding", r.speaker.embeddingDim + " dims");
    push("Embedding hash", r.speaker.embeddingHash);
    push(
      "Similarity",
      r.speaker.similarity != null
        ? (r.speaker.similarity * 100).toFixed(1) + "%"
        : "n/a",
    );
    push("Decision", r.speaker.decision || "n/a");
  } else {
    lines.push("(embedding unavailable)");
  }
  lines.push("");
  lines.push("-- Protected Template --");
  if (r.template) {
    push("Bits", r.template.bits);
    push("Code hash", r.template.codeSha256);
    push("Key fingerprint", r.template.pinFingerprint);
  } else {
    lines.push("(template module unavailable)");
  }
  lines.push("");
  lines.push("-- Registry --");
  push(
    "Match",
    r.registry && r.registry.match
      ? r.registry.match.label +
          " (" +
          r.registry.match.similarity.toFixed(1) +
          "%)"
      : "Not found in the registry.",
  );
  push("Registered ID", r.registry ? r.registry.registeredId : "");
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
  if (r.standards) {
    lines.push("");
    lines.push("-- Standards Record --");
    lines.push(JSON.stringify(r.standards, null, 2));
  }
  if (r.provenance) {
    lines.push("");
    lines.push("-- Provenance --");
    push("Status", r.provenance.status);
    push("Manifest", r.provenance.manifestLabel);
    push("Signer DID", r.provenance.signerDid);
  }
  lines.push("");
  lines.push("-- Limitations --");
  if (r.limitations && r.limitations.length) {
    for (i = 0; i < r.limitations.length; i++)
      lines.push("- " + r.limitations[i]);
  }
  lines.push("");
  lines.push("Generated by RedoSan Authenticity");
  return lines.join("\n");
}

/**
 * @param {object} r
 * @returns {string}
 */
function voiceReportToXML(r) {
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
  x = '<?xml version="1.0" encoding="UTF-8"?>\n<voiceBiometricReport>\n';
  x += "  <generatedAt>" + r.generatedAt + "</generatedAt>\n";
  x += "  <source>" + r.source + "</source>\n";
  if (r.audio) {
    x += "  <audio>\n";
    x += push("fileName", r.audio.fileName);
    x += push("sampleRate", r.audio.sampleRate);
    x += push("durationMs", r.audio.durationMs);
    x += "  </audio>\n";
  }
  if (r.quality) {
    x += "  <quality>\n";
    x += push("gate", r.quality.gate);
    x += push("score", r.quality.score);
    x += push("speechRatio", r.quality.speechRatio);
    x += push("reasons", (r.quality.reasons || []).join(","));
    x += push("standard", r.quality.standard);
    x += "  </quality>\n";
  }
  if (r.antiSpoof) {
    x += "  <antiSpoof>\n";
    x += push("mode", r.antiSpoof.mode || "off");
    x += push("gate", r.antiSpoof.gate);
    x += push("verdict", r.antiSpoof.verdict || "");
    x += push("standard", r.antiSpoof.standard || "ISO/IEC 30107-3");
    x += "  </antiSpoof>\n";
  }
  if (r.speaker) {
    x += "  <speaker>\n";
    x += push("embeddingDim", r.speaker.embeddingDim);
    x += push("embeddingHash", r.speaker.embeddingHash);
    x += push("embeddingVersion", r.speaker.embeddingVersion || "");
    x += push(
      "embedMagnitude",
      typeof r.speaker.embedMagnitude === "number"
        ? r.speaker.embedMagnitude
        : "",
    );
    x += push(
      "similarity",
      r.speaker.similarity == null ? "" : r.speaker.similarity,
    );
    x += push("decision", r.speaker.decision || "");
    x += "  </speaker>\n";
  }
  if (r.template) {
    x += "  <template>\n";
    x += push("bits", r.template.bits);
    x += push("codeSha256", r.template.codeSha256);
    x += push("pinFingerprint", r.template.pinFingerprint || "");
    x += "  </template>\n";
  }
  x += "  <registry>\n";
  x += push(
    "match",
    r.registry && r.registry.match
      ? r.registry.match.label +
          " (" +
          r.registry.match.similarity.toFixed(1) +
          "%)"
      : "none",
  );
  x += push("registeredId", r.registry ? r.registry.registeredId || "" : "");
  x += "  </registry>\n";
  if (r.did) {
    x += "  <did>\n";
    x += push("did", r.did.did);
    x += push("algorithm", r.did.algorithm);
    x += push("signedAt", r.did.signedAt);
    x += push("signature", r.did.signature);
    x += "  </did>\n";
  }
  x += "</voiceBiometricReport>\n";
  return x;
}

/**
 * @param {object} r
 * @returns {string}
 */
function voiceReportToHTML(r) {
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
    "<!doctype html><html><head><meta charset='utf-8'><title>Voice Biometric Report</title></head><body style='font-family:sans-serif'>";
  html += "<h2>RedoSan Authenticity - Voice Biometric Report</h2>";
  html +=
    "<h3>Audio</h3><table border='1' cellpadding='6' style='border-collapse:collapse'>";
  html += row("Generated at", r.generatedAt);
  html += row("Source", r.source);
  html += row("File", r.audio ? r.audio.fileName : "-");
  html += row(
    "Duration",
    r.audio ? (r.audio.durationMs / 1000).toFixed(2) + " s" : "-",
  );
  html += "</table>";
  if (r.quality) {
    html +=
      "<h3>Quality Gate</h3><table border='1' cellpadding='6' style='border-collapse:collapse'>";
    html += row("Gate", r.quality.gate);
    html += row("Score", r.quality.score);
    html += row(
      "Speech ratio",
      isFinite(r.quality.speechRatio)
        ? (r.quality.speechRatio * 100).toFixed(1) + "%"
        : "n/a",
    );
    html += row("Reasons", (r.quality.reasons || []).join(", ") || "pass");
    html += "</table>";
  }
  if (r.antiSpoof) {
    html +=
      "<h3>Presentation Attack Detection</h3><table border='1' cellpadding='6' style='border-collapse:collapse'>";
    html += row("Mode", r.antiSpoof.mode || "off");
    html += row("Gate", r.antiSpoof.gate);
    html += row("Verdict", r.antiSpoof.verdict || "n/a");
    html += row("Reasons", (r.antiSpoof.reasons || []).join(", ") || "pass");
    html += "</table>";
  }
  if (r.speaker) {
    html +=
      "<h3>Speaker Verification</h3><table border='1' cellpadding='6' style='border-collapse:collapse'>";
    html += row("Embedding", r.speaker.embeddingDim + " dims");
    html += row("Embedder", r.speaker.embeddingVersion || "ecapa");
    html += row(
      "Similarity",
      r.speaker.similarity != null
        ? (r.speaker.similarity * 100).toFixed(1) + "%"
        : "n/a",
    );
    html += row("Decision", r.speaker.decision || "n/a");
    html += row("Embedding hash", r.speaker.embeddingHash);
    html += "</table>";
  }
  if (r.template) {
    html +=
      "<h3>Protected Template (ISO/IEC 24745)</h3><table border='1' cellpadding='6' style='border-collapse:collapse'>";
    html += row("Bits", r.template.bits);
    html += row("Code hash", r.template.codeSha256);
    html += row("Key fingerprint", r.template.pinFingerprint || "-");
    html += "</table>";
  }
  html +=
    "<h3>Registry</h3><table border='1' cellpadding='6' style='border-collapse:collapse'>";
  html += row(
    "Match",
    r.registry && r.registry.match
      ? r.registry.match.label +
          " (" +
          r.registry.match.similarity.toFixed(1) +
          "%)"
      : "Not found in the registry.",
  );
  html += row(
    "Registered ID",
    r.registry ? r.registry.registeredId || "-" : "-",
  );
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
  if (r.provenance) {
    html +=
      "<h3>Provenance</h3><table border='1' cellpadding='6' style='border-collapse:collapse'>";
    html += row("Status", r.provenance.status);
    html += row("Manifest", r.provenance.manifestLabel || "-");
    html += row("Format", r.provenance.format || "-");
    html += row("Signer DID", r.provenance.signerDid || "-");
    html += "</table>";
  }
  if (r.limitations && r.limitations.length) {
    html += "<h3>Limitations</h3><ul>";
    for (i = 0; i < r.limitations.length; i++) {
      html += "<li>" + escHtml(r.limitations[i]) + "</li>";
    }
    html += "</ul>";
  }
  html +=
    "<hr><p style='color:#888;font-size:12px'>Generated by RedoSan Authenticity - 100% browser-based, nothing uploaded.</p>";
  html += "</body></html>";
  return html;
}

/**
 * @param {object} r
 */
async function voiceReportToPDF(r) {
  var doc, y, push;
  await ensureLib("jspdf");
  doc = new jspdf.jsPDF();
  y = 20;
  doc.setFontSize(16);
  doc.setTextColor(108, 92, 231);
  doc.text("RedoSan Authenticity - Voice Biometric", 14, y);
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
  doc.text("Audio", 14, y);
  y += 6;
  push("File", r.audio ? r.audio.fileName : "-");
  push("Sample rate", r.audio ? r.audio.sampleRate + " Hz" : "-");
  push(
    "Duration",
    r.audio ? (r.audio.durationMs / 1000).toFixed(2) + " s" : "-",
  );
  y += 3;
  if (r.quality) {
    doc.setFontSize(11);
    doc.setTextColor(108, 92, 231);
    doc.text("Quality Gate", 14, y);
    y += 6;
    push("Gate", r.quality.gate);
    push("Score", r.quality.score);
    push(
      "Speech ratio",
      isFinite(r.quality.speechRatio)
        ? (r.quality.speechRatio * 100).toFixed(1) + "%"
        : "n/a",
    );
    y += 3;
  }
  if (r.antiSpoof) {
    doc.setFontSize(11);
    doc.setTextColor(108, 92, 231);
    doc.text("Presentation Attack Detection", 14, y);
    y += 6;
    push("Gate", r.antiSpoof.gate);
    push("Verdict", r.antiSpoof.verdict || "n/a");
    y += 3;
  }
  if (r.speaker) {
    doc.setFontSize(11);
    doc.setTextColor(108, 92, 231);
    doc.text("Speaker Verification", 14, y);
    y += 6;
    push("Embedding", r.speaker.embeddingDim + " dims");
    push("Embedding hash", r.speaker.embeddingHash);
    push("Decision", r.speaker.decision || "n/a");
    y += 3;
  }
  if (r.template) {
    doc.setFontSize(11);
    doc.setTextColor(108, 92, 231);
    doc.text("Protected Template", 14, y);
    y += 6;
    push("Bits", r.template.bits);
    push("Code hash", r.template.codeSha256);
    push("Key fingerprint", r.template.pinFingerprint || "-");
    y += 3;
  }
  doc.setFontSize(11);
  doc.setTextColor(108, 92, 231);
  doc.text("Registry", 14, y);
  y += 6;
  push(
    "Match",
    r.registry && r.registry.match
      ? r.registry.match.label +
          " (" +
          r.registry.match.similarity.toFixed(1) +
          "%)"
      : "Not found in the registry.",
  );
  push("Registered ID", r.registry ? r.registry.registeredId : "-");
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
  }
  return doc.output("blob");
}

/**
 * @param {object} r
 */
async function voiceReportToDOCX(r) {
  var docx, children, tables, i, j, k, rows, t, sec;
  await ensureLib("docx");
  docx = globalThis.docx;
  if (!docx || !docx.Packer) return null;
  children = [];
  tables = [];
  tables.push([
    ["File", r.audio ? r.audio.fileName : "-"],
    ["Sample rate", r.audio ? String(r.audio.sampleRate) : "-"],
    ["Duration", r.audio ? (r.audio.durationMs / 1000).toFixed(2) + " s" : "-"],
  ]);
  tables.push([
    ["Gate", r.quality ? r.quality.gate : "-"],
    ["Score", r.quality ? String(r.quality.score) : "-"],
  ]);
  children.push(
    new docx.Paragraph({
      children: [
        new docx.TextRun({
          text: "RedoSan Authenticity - Voice Biometric",
          bold: true,
          size: 28,
          color: "6C5CE7",
        }),
      ],
      spacing: { after: 200 },
    }),
  );
  for (k = 0; k < 2; k++) {
    children.push(
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: k === 0 ? "Audio" : "Quality Gate",
            bold: true,
            size: 22,
            color: "6C5CE7",
          }),
        ],
        spacing: { before: 200, after: 100 },
      }),
    );
    children.push(voiceCreateDocxTable(docx, tables[k]));
  }
  regRows = [
    [
      "Match",
      r.registry && r.registry.match
        ? r.registry.match.label +
          " (" +
          r.registry.match.similarity.toFixed(1) +
          "%)"
        : "Not found in the registry.",
    ],
    [
      "Registered ID",
      r.registry ? String(r.registry.registeredId || "-") : "-",
    ],
  ];
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
    children.push(voiceCreateDocxTable(docx, didRows));
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
  children.push(voiceCreateDocxTable(docx, regRows));
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
function voiceCreateDocxTable(docx, rows) {
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

// ── Registry list / lifecycle ──

/**
 * Render the registered-voice list under #voice-list and refresh the count.
 * @returns {Promise<number|undefined>}
 */
async function listVoiceRegistered() {
  var voices, el, countEl, div, noteEl, versions, i, size;
  if (!_voiceRegistry) {
    setStatus(
      "voice-status",
      __(
        "voice.status.registryUnavailable",
        "Voice Registry is not available in this browser.",
      ),
    );
    return;
  }
  try {
    voices = await _voiceRegistry.getAll();
    size = voices.length;
    el = document.getElementById("voice-list");
    countEl = document.getElementById("voice-count");
    noteEl = document.getElementById("voice-migration-note");
    if (noteEl) {
      versions = {};
      voices.forEach(function (v) {
        versions[v.schema || "voice-template-protection-v1"] = true;
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
        i18n.data["voice.count_label"]
      ) {
        countEl.textContent = i18n.data["voice.count_label"]
          .split("{0}")
          .join(String(size));
      } else {
        countEl.textContent = "Registered voices: " + size;
      }
    }
    if (!el) return size;
    el.innerHTML = "";
    if (voices.length === 0) {
      el.innerHTML =
        '<p style="color:var(--text-muted)">' +
        __("voice.no_voices", "No voices registered yet.") +
        "</p>";
      return size;
    }
    voices.forEach(function (v) {
      div = document.createElement("div");
      div.className = "voice-list-item";
      div.innerHTML =
        "<span><strong>" +
        escHtml(v.label) +
        "</strong> (ID: " +
        v.id +
        ")</span>" +
        '<button class="btn btn-sm voice-mgmt-btn" onclick="handleVoiceDelete(' +
        v.id +
        ')">' +
        __("voice.delete_btn", "Delete") +
        "</button>";
      el.append(div);
    });
    return size;
  } catch (error) {
    setStatus("voice-status", "List error: " + error.message);
  }
}

/**
 * @param {number} id
 */
async function handleVoiceDelete(id) {
  if (!_voiceRegistry) return;
  try {
    await _voiceRegistry.remove(id);
    setStatus(
      "voice-status",
      __("voice.deleted_from_registry", "Voice deleted from registry."),
    );
    if (typeof listVoiceRegistered === "function") await listVoiceRegistered();
  } catch (error) {
    setStatus("voice-status", "Delete error: " + error.message);
  }
}

/**
 * Refresh List: clear the generated-results view and re-render the
 * registered voices from storage.
 */
async function handleVoiceRefreshList() {
  var repEl, size;
  _voiceReport = null;
  window._voiceReport = null;
  _voicePendingAudio = null;
  _voicePendingBytes = null;
  _voicePendingSource = null;
  repEl = document.getElementById("voice-report");
  if (repEl) {
    repEl.style.display = "none";
    repEl.innerHTML = "";
  }
  renderVoiceActions(false);
  updateVoiceRunState();
  size = await listVoiceRegistered();
  if (size !== undefined) {
    setStatus(
      "voice-status",
      __("voice.refresh_done", "Results cleared. Registered voices: {0}")
        .split("{0}")
        .join(String(size)),
    );
  }
}

/**
 * Registry label sheet for the CSV/TXT export tail.
 * @param {string} format "txt" | "csv"
 * @returns {Promise<string>}
 */
async function voiceLabelsToSheet(format) {
  var voices, keys, lines, i, j, row, cell;
  if (!_voiceRegistry) return "";
  try {
    voices = await _voiceRegistry.getAll();
  } catch (e) {
    return "";
  }
  if (voices.length === 0) return "";
  keys = ["label", "id", "created"];
  if (format === "csv") {
    lines = [keys.join(",")];
    for (i = 0; i < voices.length; i++) {
      row = [];
      for (j = 0; j < keys.length; j++) {
        cell = String(voices[i][keys[j]] || "");
        if (/[",\n]/.test(cell)) cell = '"' + cell.split('"').join('""') + '"';
        row.push(cell);
      }
      lines.push(row.join(","));
    }
    return lines.join("\n");
  }
  lines = [keys.join("\t")];
  for (i = 0; i < voices.length; i++) {
    lines.push(
      keys
        .map(function (k) {
          return voices[i][k] || "";
        })
        .join("\t"),
    );
  }
  return lines.join("\n");
}

// ── Interactive Audio Recorder UI ──

var _recorderUI = {
  canvas: null,
  ctx: null,
  audioContext: null,
  analyser: null,
  source: null,
  animationFrame: null,
  timerInterval: null,
  startTime: 0,
  isRecording: false,
  dataArray: null,
  maxDurationInterval: null,
  maxDurationReached: false,
};

/**
 * Initialize the recorder UI canvas and get 2D context.
 */
function initRecorderUI() {
  _recorderUI.canvas = document.getElementById("voice-recorder-canvas");
  if (_recorderUI.canvas) {
    _recorderUI.ctx = _recorderUI.canvas.getContext("2d");
    // Set canvas size based on container
    resizeRecorderCanvas();
    window.addEventListener("resize", resizeRecorderCanvas);
  }
}

/**
 * Resize canvas to match container dimensions.
 */
function resizeRecorderCanvas() {
  if (!_recorderUI.canvas) return;
  var container = _recorderUI.canvas.parentElement;
  if (!container) return;
  var rect = container.getBoundingClientRect();
  _recorderUI.canvas.width = rect.width * (window.devicePixelRatio || 1);
  _recorderUI.canvas.height = rect.height * (window.devicePixelRatio || 1);
  _recorderUI.ctx.scale(
    window.devicePixelRatio || 1,
    window.devicePixelRatio || 1,
  );
}

/**
 * Show the recorder UI and hide the standard audio element.
 */
function showRecorderUI() {
  var ui = document.getElementById("voice-recorder-ui");
  var audioEl = document.getElementById("voice-recorder");
  if (ui) ui.style.display = "block";
  if (audioEl) audioEl.style.display = "none";
  initRecorderUI();
}

/**
 * Hide the recorder UI.
 */
function hideRecorderUI() {
  var ui = document.getElementById("voice-recorder-ui");
  if (ui) ui.style.display = "none";
}

/**
 * Start the audio visualization from the microphone stream.
 * @param {MediaStream} stream - The microphone stream
 */
function startRecorderVisualization(stream) {
  if (!_recorderUI.canvas || !_recorderUI.ctx) return;

  try {
    // Create AudioContext if not exists
    if (!_recorderUI.audioContext) {
      _recorderUI.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }

    // Create AnalyserNode
    _recorderUI.analyser = _recorderUI.audioContext.createAnalyser();
    _recorderUI.analyser.fftSize = 256;
    _recorderUI.analyser.smoothingTimeConstant = 0.8;

    // Connect stream to analyser
    _recorderUI.source =
      _recorderUI.audioContext.createMediaStreamSource(stream);
    _recorderUI.source.connect(_recorderUI.analyser);

    // Prepare data array
    var bufferLength = _recorderUI.analyser.frequencyBinCount;
    _recorderUI.dataArray = new Uint8Array(bufferLength);

    // Start animation
    _recorderUI.isRecording = true;
    drawRecorderVisualization();

    // Start timer
    startRecorderTimer();

    // Update UI state
    updateRecorderUIState(true);
  } catch (e) {
    console.error("Failed to start recorder visualization:", e);
  }
}

/**
 * Stop the audio visualization.
 */
function stopRecorderVisualization() {
  _recorderUI.isRecording = false;

  if (_recorderUI.animationFrame) {
    cancelAnimationFrame(_recorderUI.animationFrame);
    _recorderUI.animationFrame = null;
  }

  if (_recorderUI.timerInterval) {
    clearInterval(_recorderUI.timerInterval);
    _recorderUI.timerInterval = null;
  }

  if (_recorderUI.maxDurationInterval) {
    clearInterval(_recorderUI.maxDurationInterval);
    _recorderUI.maxDurationInterval = null;
  }

  // Disconnect source
  if (_recorderUI.source) {
    _recorderUI.source.disconnect();
    _recorderUI.source = null;
  }

  // Update UI state
  updateRecorderUIState(false);
}

/**
 * Draw the audio visualization on the canvas.
 */
function drawRecorderVisualization() {
  if (!_recorderUI.isRecording || !_recorderUI.canvas || !_recorderUI.ctx)
    return;

  _recorderUI.animationFrame = requestAnimationFrame(drawRecorderVisualization);

  // Get frequency data
  _recorderUI.analyser.getByteFrequencyData(_recorderUI.dataArray);

  var ctx = _recorderUI.ctx;
  var canvas = _recorderUI.canvas;
  var width = canvas.width / (window.devicePixelRatio || 1);
  var height = canvas.height / (window.devicePixelRatio || 1);

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw frequency bars
  var barWidth = (width / _recorderUI.dataArray.length) * 2.5;
  var barHeight;
  var x = 0;

  // Get theme colors
  var style = getComputedStyle(document.documentElement);
  var primaryColor = style.getPropertyValue("--primary").trim() || "#6c5ce7";
  var primaryDarkColor =
    style.getPropertyValue("--primary-dark").trim() || "#5a4bd1";

  for (var i = 0; i < _recorderUI.dataArray.length; i++) {
    barHeight = (_recorderUI.dataArray[i] / 255) * height;

    // Create gradient for each bar
    var gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
    gradient.addColorStop(0, primaryColor);
    gradient.addColorStop(1, primaryDarkColor);

    ctx.fillStyle = gradient;
    ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);

    x += barWidth;
  }
}

/**
 * Start the recording timer with max duration enforcement.
 */
function startRecorderTimer() {
  _recorderUI.startTime = Date.now();
  _recorderUI.maxDurationReached = false;
  updateRecorderTimer();

  _recorderUI.timerInterval = setInterval(updateRecorderTimer, 100);

  // Max duration enforcement — check every 250ms for precision
  _recorderUI.maxDurationInterval = setInterval(function () {
    if (!_recorderUI.isRecording || _recorderUI.maxDurationReached) return;
    var elapsed = (Date.now() - _recorderUI.startTime) / 1000;
    if (elapsed >= VOICE_MAX_RECORDING_SECONDS) {
      _recorderUI.maxDurationReached = true;
      handleVoiceRecordStop();
      setStatus(
        "voice-status",
        __(
          "voice.status.maxDurationReached",
          "Maximum recording duration (3 minutes) reached. Recording stopped automatically.",
        ),
      );
    }
  }, 250);
}

/**
 * Update the timer display and remaining-time progress bar.
 */
function updateRecorderTimer() {
  var timerEl = document.getElementById("voice-recorder-timer");
  var progressEl = document.getElementById("voice-recorder-progress");
  if (!timerEl) return;

  var elapsed = Math.floor((Date.now() - _recorderUI.startTime) / 1000);
  var remaining = Math.max(0, VOICE_MAX_RECORDING_SECONDS - elapsed);
  var minutes = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  var seconds = (remaining % 60).toString().padStart(2, "0");
  timerEl.textContent = minutes + ":" + seconds;

  // Update progress bar
  if (progressEl) {
    var pct = Math.min(100, (elapsed / VOICE_MAX_RECORDING_SECONDS) * 100);
    progressEl.style.width = pct + "%";

    // Color transitions: green -> yellow -> red
    progressEl.classList.remove(
      "voice-recorder-progress--warn",
      "voice-recorder-progress--critical",
    );
    if (elapsed >= VOICE_RECORDING_CRITICAL_SECONDS) {
      progressEl.classList.add("voice-recorder-progress--critical");
    } else if (elapsed >= VOICE_RECORDING_WARN_SECONDS) {
      progressEl.classList.add("voice-recorder-progress--warn");
    }
  }
}

/**
 * Update the recorder UI state (recording/idle).
 * @param {boolean} recording - Whether currently recording
 */
function updateRecorderUIState(recording) {
  var dot = document.querySelector(".voice-recorder-dot");
  var statusText = document.getElementById("voice-recorder-status-text");
  var timerEl = document.getElementById("voice-recorder-timer");

  if (dot) {
    if (recording) {
      dot.classList.add("recording");
    } else {
      dot.classList.remove("recording");
    }
  }

  if (statusText) {
    if (recording) {
      statusText.textContent = __(
        "voice.recorder_status_recording",
        "Recording...",
      );
    } else if (_voicePendingAudio) {
      statusText.textContent = __(
        "voice.recorder_status_staged",
        "Recording staged",
      );
    } else {
      statusText.textContent = __("voice.recorder_status", "Ready to record");
    }
  }

  // Reset timer and progress bar when not recording
  if (!recording && timerEl) {
    timerEl.textContent = "03:00";
    var progressEl = document.getElementById("voice-recorder-progress");
    if (progressEl) {
      progressEl.style.width = "0%";
      progressEl.classList.remove(
        "voice-recorder-progress--warn",
        "voice-recorder-progress--critical",
      );
    }
  }
}

// ── Init ──

/**
 * Initialize the Voice Biometric page: engine/registry singletons, consent
 * wiring, embedder hint, VAD status and the registered-voice list. Safe to
 * call more than once (mpa-router re-runs it on AJAX navigation).
 * @returns {Promise<void>}
 */
async function initVoiceBiometric() {
  var audioEl, startBtn;
  try {
    if (!_voiceEngine) {
      _voiceEngine = buildVoiceEngine();
    }
    if (!_voiceRegistry && typeof VoiceRegistry === "function") {
      _voiceRegistry = new VoiceRegistry();
      await _voiceRegistry.open();
    }
  } catch (error) {
    setStatus("voice-status", "Failed to initialize: " + error.message);
  }
  if (!_voiceTemplateSecret) {
    _voiceTemplateSecret = voiceRandomToken(16);
  }
  initVoiceConsent();
  updateVoiceEmbedderHint();
  updateVoiceVadStatus();
  if (typeof listVoiceRegistered === "function") await listVoiceRegistered();
}

window.initVoiceBiometric = initVoiceBiometric;

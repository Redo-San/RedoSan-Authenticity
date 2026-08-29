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

var irisEngine = null;
var irisCamera = null;
var irisLiveness = null;
var irisStorage = null;
var _irisOverlay = null;
var _irisOverlayRAF = 0;
var _irisOverlayRunning = false;
var _irisCaptureState = "idle"; // idle | capturing | processing | verifying | done
var _irisDilationFrames = [];
var _irisTemporalFrames = [];
var _irisCurrentResult = null;
var _irisGallery = [];
var _irisPendingSource = null; // { kind: 'camera'|'upload', imageData, width, height, fileName }
var _irisReport = null;

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESS OVERLAY (blur + spinner + determinate bar)
// Mirrors Face_Biometric faceProgress* helpers. The overlay fades in/out via
// a CSS opacity transition; the spinner keeps animating even while the main
// thread is busy with the Daugman pipeline.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Re-resolve overlay elements from the live DOM (cheap) so calls stay correct
 * after SPA/MPA router swaps.
 * @returns {object|null}
 */
function irisProgressRefs() {
  var overlay;
  if (typeof document === "undefined" || !document.getElementById) return null;
  overlay = document.getElementById("iris-progress-overlay");
  if (!overlay) return null;
  return {
    overlay: overlay,
    bar: document.getElementById("iris-progress-bar"),
    title: document.getElementById("iris-progress-title"),
    text: document.getElementById("iris-progress-text"),
    pct: document.getElementById("iris-progress-pct"),
  };
}

/**
 * Lazily build the blur + spinner progress overlay.
 * @returns {HTMLElement|null}
 */
function irisProgressEnsure() {
  var refs, overlay, card, spin, track, bar, title, text, pct;
  refs = irisProgressRefs();
  if (refs) return refs.overlay;
  if (
    typeof document === "undefined" ||
    !document.getElementById ||
    !document.createElement ||
    !document.body
  )
    return null;
  overlay = document.createElement("div");
  overlay.id = "iris-progress-overlay";
  overlay.className = "iris-progress-overlay";
  card = document.createElement("div");
  card.className = "iris-progress-card";
  spin = document.createElement("div");
  spin.className = "iris-progress-spinner";
  title = document.createElement("div");
  title.className = "iris-progress-title";
  title.id = "iris-progress-title";
  text = document.createElement("div");
  text.className = "iris-progress-text";
  text.id = "iris-progress-text";
  track = document.createElement("div");
  track.className = "iris-progress-track";
  bar = document.createElement("div");
  bar.className = "iris-progress-bar";
  bar.id = "iris-progress-bar";
  pct = document.createElement("div");
  pct.className = "iris-progress-pct";
  pct.id = "iris-progress-pct";
  pct.textContent = "0%";
  track.append(bar);
  track.append(pct);
  card.append(spin);
  card.append(title);
  card.append(text);
  card.append(track);
  overlay.append(card);
  document.body.append(overlay);
  return overlay;
}

/**
 * Fade the progress overlay in and start the current stage label.
 * @param {string} title
 * @param {string} text
 */
function irisProgressShow(title, text) {
  var refs;
  refs = irisProgressRefs();
  if (!refs) {
    if (!irisProgressEnsure()) return;
    refs = irisProgressRefs();
    if (!refs) return;
  }
  if (refs.title) refs.title.textContent = title;
  if (refs.text) refs.text.textContent = text;
  if (refs.bar) {
    refs.bar.style.width = "0%";
    refs.bar.classList.remove("is-det");
  }
  if (refs.pct) refs.pct.textContent = "0%";
  void refs.overlay.offsetWidth; // force reflow so the transition runs
  refs.overlay.classList.add("is-visible");
}

/**
 * Advance the determinate progress bar (0..1) and refresh stage text.
 * @param {number} fraction
 * @param {string|null} text
 */
function irisProgressUpdate(fraction, text) {
  var refs, pct;
  refs = irisProgressRefs();
  if (!refs || !refs.overlay.classList.contains("is-visible")) return;
  // eslint-disable-next-line unicorn/prefer-simple-condition-first
  if (refs.text && text) refs.text.textContent = text;
  pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  if (refs.bar) {
    refs.bar.style.width = pct + "%";
    refs.bar.classList.add("is-det");
  }
  if (refs.pct) refs.pct.textContent = pct + "%";
}

/**
 * Fade the progress overlay out (CSS transition) then detach it.
 */
function irisProgressHide() {
  var overlay, t;
  var refs = irisProgressRefs();
  overlay = refs ? refs.overlay : null;
  if (!overlay || !overlay.classList) return;
  overlay.classList.remove("is-visible");
  t = setTimeout(function () {
    if (
      overlay &&
      overlay.parentNode &&
      typeof overlay.parentNode.removeChild === "function" &&
      !overlay.classList.contains("is-visible")
    ) {
      overlay.remove();
    }
  }, 600);
  if (t && t.unref) t.unref();
}

/**
 * Update both the #iris-steps box and the progress overlay for a stage.
 * @param {string|null} text
 * @param {number|null} fraction
 */
function setIrisStage(text, fraction) {
  var stepsEl = document.getElementById("iris-steps");
  if (stepsEl && text) stepsEl.textContent = text;
  if (fraction !== null && typeof irisProgressUpdate === "function") {
    irisProgressUpdate(fraction, text);
  }
}

/**
 * Yield to the compositor so the spinner/bar paint between CPU-heavy stages.
 * @returns {Promise<void>}
 */
function _irisRaf() {
  return new Promise(function (resolve) {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () {
        setTimeout(resolve, 0);
      });
    } else {
      setTimeout(resolve, 16);
    }
  });
}

/**
 * @param id
 * @param msg
 */
function irisSetStatus(id, msg) {
  var el = document.getElementById(id);
  if (el) el.textContent = msg;
}

/**
 * Get the i18n helper function.
 * @returns {function(string, string): string}
 */
function _iris__() {
  if (typeof window !== "undefined" && typeof window.__ === "function") {
    return window.__;
  }
  return function (key, fallback) {
    return fallback || key;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Initialize the iris biometric system.
 * Call once when the page loads.
 * @returns {Promise<void>}
 */
async function irisInit() {
  var __ = _iris__();

  irisSetStatus("iris-status", __("iris.init", "Initializing iris biometric system..."));

  try {
    // Initialize components
    irisEngine = new IrisEngine();
    irisCamera = new IrisCamera();
    irisLiveness = new IrisLiveness();
    irisStorage = new IrisStorage();

    // Load engine models
    await irisEngine.loadModels();

    // Load stored gallery
    _irisGallery = await irisStorage.list();

    irisSetStatus(
      "iris-status",
      __("iris.ready", "Iris biometric system ready. Stored templates: {0}")
        .split("{0}")
        .join(String(_irisGallery.length)),
    );
  } catch (error) {
    irisSetStatus(
      "iris-status",
      __("iris.init_error", "Initialization error: {0}")
        .split("{0}")
        .join(error.message),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMERA CONTROL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Start the iris camera preview.
 */
async function irisStartCamera() {
  var __ = _iris__();
  var videoEl = document.getElementById("iris-video");
  var startBtn = document.getElementById("iris-start-btn");
  var stopBtn = document.getElementById("iris-stop-btn");
  var captureBtn = document.getElementById("iris-capture-btn");

  if (!IrisCamera.isSupported()) {
    irisSetStatus("iris-status", __("iris.no_camera", "Camera not supported in this browser."));
    return;
  }

  try {
    irisSetStatus("iris-status", __("iris.starting_camera", "Starting camera..."));
    await irisCamera.startCamera(videoEl);

    if (startBtn) startBtn.style.display = "none";
    if (stopBtn) stopBtn.style.display = "inline-block";
    if (captureBtn) captureBtn.style.display = "inline-block";

    irisSetStatus("iris-status", __("iris.camera_active", "Camera active. Position your eye in the center."));
  } catch (error) {
    irisSetStatus(
      "iris-status",
      IrisCamera.getCameraErrorMessage(error),
    );
  }
}

/**
 * Stop the iris camera.
 */
function irisStopCamera() {
  var __ = _iris__();
  var startBtn = document.getElementById("iris-start-btn");
  var stopBtn = document.getElementById("iris-stop-btn");
  var captureBtn = document.getElementById("iris-capture-btn");

  irisCamera.stopCamera();
  _irisStopOverlay();

  if (startBtn) startBtn.style.display = "inline-block";
  if (stopBtn) stopBtn.style.display = "none";
  if (captureBtn) captureBtn.style.display = "none";

  irisSetStatus("iris-status", __("iris.camera_stopped", "Camera stopped."));
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPTURE & ENROLLMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Start the iris capture process.
 * Captures multiple frames for liveness and quality assessment.
 */
async function irisStartCapture() {
  var __ = _iris__();
  var captureBtn = document.getElementById("iris-capture-btn");
  var statusEl = document.getElementById("iris-status");

  if (!irisCamera || !irisCamera.isActive()) {
    irisSetStatus("iris-status", __("iris.start_camera_first", "Start the camera first."));
    return;
  }

  if (_irisCaptureState === "capturing") return;

  _irisCaptureState = "capturing";
  _irisDilationFrames = [];
  _irisTemporalFrames = [];

  if (captureBtn) captureBtn.disabled = true;

  irisSetStatus("iris-status", __("iris.capturing", "Hold still... capturing iris images..."));

  try {
    // Capture frames for liveness analysis
    var frames = await irisCamera.captureMultipleFrames(5, 400);

    _irisCaptureState = "processing";
    irisSetStatus("iris-status", __("iris.processing", "Processing iris images..."));

    // Process each frame
    var bestResult = null;
    var bestQuality = 0;

    for (var i = 0; i < frames.length; i++) {
      if (!frames[i]) continue;

      // Run iris engine pipeline
      var result = irisEngine.extract(frames[i]);

      // Quality check
      var quality = IrisQuality.assess({
        normalizedIris: result.normalized,
        normW: IRIS_ENGINE_CONFIG.normWidth,
        normH: IRIS_ENGINE_CONFIG.normHeight,
        mask: result.irisCode.mask,
        pupil: result.segmentation.pupil,
        iris: result.segmentation.iris,
        imageWidth: frames[i].width,
        imageHeight: frames[i].height,
      });

      // Collect liveness data
      _irisDilationFrames.push({
        pupilRadius: result.segmentation.pupil.radius,
        irisRadius: result.segmentation.iris.radius,
      });

      _irisTemporalFrames.push({
        irisCx: result.segmentation.iris.cx,
        irisCy: result.segmentation.iris.cy,
      });

      // Track best quality result
      if (quality.score > bestQuality) {
        bestQuality = quality.score;
        bestResult = result;
      }
    }

    // Liveness assessment
    var livenessResult = irisLiveness.assess({
      dilationFrames: _irisDilationFrames,
      grayImage: IrisEngine._toGray2D(IrisEngine._toGrayscale(frames[2] || frames[0])),
      imageWidth: (frames[2] || frames[0]).width,
      imageHeight: (frames[2] || frames[0]).height,
      pupil: bestResult.segmentation.pupil,
      iris: bestResult.segmentation.iris,
      temporalFrames: _irisTemporalFrames,
    });

    // Store result
    _irisCurrentResult = {
      irisCode: bestResult.irisCode,
      segmentation: bestResult.segmentation,
      liveness: livenessResult,
      quality: bestQuality,
    };

    _irisCaptureState = "done";

    // Display results
    _irisDisplayResult(_irisCurrentResult);

    if (captureBtn) captureBtn.disabled = false;
  } catch (error) {
    _irisCaptureState = "idle";
    irisSetStatus(
      "iris-status",
      __("iris.capture_error", "Capture error: {0}")
        .split("{0}")
        .join(error.message),
    );
    if (captureBtn) captureBtn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENROLLMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Enroll the current iris capture as a new template.
 */
async function irisEnroll() {
  var __ = _iris__();

  if (!_irisCurrentResult) {
    irisSetStatus("iris-status", __("iris.capture_first", "Capture an iris image first."));
    return;
  }

  if (!_irisCurrentResult.liveness.isLive) {
    irisSetStatus(
      "iris-status",
      __("iris.liveness_failed", "Liveness check failed. Cannot enroll spoofed image."),
    );
    return;
  }

  var label = prompt(__("iris.enter_label", "Enter a label for this iris template:"));
  if (!label) return;

  var id = "iris_" + Date.now() + "_" + Math.random().toString(36).substr(2, 8);

  try {
    await irisStorage.save({
      id: id,
      label: label,
      leftCode: _irisCurrentResult.irisCode.code,
      leftMask: _irisCurrentResult.irisCode.mask,
      quality: {
        score: _irisCurrentResult.quality,
        livenessScore: _irisCurrentResult.liveness.score,
      },
    });

    _irisGallery = await irisStorage.list();

    irisSetStatus(
      "iris-status",
      __("iris.enrolled", "Iris enrolled successfully as '{0}'. Total templates: {1}")
        .split("{0}")
        .join(label)
        .split("{1}")
        .join(String(_irisGallery.length)),
    );
  } catch (error) {
    irisSetStatus(
      "iris-status",
      __("iris.enroll_error", "Enrollment error: {0}")
        .split("{0}")
        .join(error.message),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFICATION (1:1 matching)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verify the current capture against a specific template.
 * @param {string} templateId
 */
async function irisVerify(templateId) {
  var __ = _iris__();
  var template, result;

  if (!_irisCurrentResult) {
    irisSetStatus("iris-status", __("iris.capture_first", "Capture an iris image first."));
    return;
  }

  if (!_irisCurrentResult.liveness.isLive) {
    irisSetStatus(
      "iris-status",
      __("iris.liveness_failed_verify", "Liveness check failed. Cannot verify."),
    );
    return;
  }

  try {
    template = await irisStorage.load(templateId);
    if (!template) {
      irisSetStatus("iris-status", __("iris.template_not_found", "Template not found."));
      return;
    }

    result = IrisMatcher.compare(
      _irisCurrentResult.irisCode,
      { code: template.leftCode, mask: template.leftMask },
    );

    var msg;
    if (result.match) {
      msg = __("iris.verified", "✓ Verified! HD: {0} (confidence: {1}%)")
        .split("{0}")
        .join(result.hd.toFixed(4))
        .split("{1}")
        .join((result.confidence * 100).toFixed(1));
    } else {
      msg = __("iris.not_verified", "✗ Not matched. HD: {0} (confidence: {1}%)")
        .split("{0}")
        .join(result.hd.toFixed(4))
        .split("{1}")
        .join((result.confidence * 100).toFixed(1));
    }

    irisSetStatus("iris-status", msg);
  } catch (error) {
    irisSetStatus(
      "iris-status",
      __("iris.verify_error", "Verification error: {0}")
        .split("{0}")
        .join(error.message),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// IDENTIFICATION (1:N matching)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Identify the current capture against all stored templates.
 */
async function irisIdentify() {
  var __ = _iris__();
  var galleryData, i, template, identifyResult;

  if (!_irisCurrentResult) {
    irisSetStatus("iris-status", __("iris.capture_first", "Capture an iris image first."));
    return;
  }

  if (!_irisCurrentResult.liveness.isLive) {
    irisSetStatus(
      "iris-status",
      __("iris.liveness_failed_identify", "Liveness check failed. Cannot identify."),
    );
    return;
  }

  if (_irisGallery.length === 0) {
    irisSetStatus("iris-status", __("iris.no_templates", "No templates enrolled. Enroll first."));
    return;
  }

  try {
    // Load all templates for matching
    galleryData = [];
    for (i = 0; i < _irisGallery.length; i++) {
      template = await irisStorage.load(_irisGallery[i].id);
      if (template) {
        galleryData.push({
          id: template.id,
          label: template.label,
          code: template.leftCode,
          mask: template.leftMask,
        });
      }
    }

    identifyResult = IrisMatcher.identify(_irisCurrentResult.irisCode, galleryData);

    var msg;
    if (identifyResult.bestMatch) {
      msg = __("iris.identified", "✓ Identified: '{0}' (HD: {1})")
        .split("{0}")
        .join(identifyResult.bestMatch.label || identifyResult.bestMatch.id)
        .split("{1}")
        .join(identifyResult.bestMatch.hd.toFixed(4));
    } else {
      msg = __("iris.not_identified", "✗ No match found in gallery (best HD: {0})")
        .split("{0}")
        .join(
          identifyResult.allResults.length > 0
            ? identifyResult.allResults[0].hd.toFixed(4)
            : "N/A",
        );
    }

    irisSetStatus("iris-status", msg);

    // Show top results
    _irisDisplayIdentifyResults(identifyResult.allResults);
  } catch (error) {
    irisSetStatus(
      "iris-status",
      __("iris.identify_error", "Identification error: {0}")
        .split("{0}")
        .join(error.message),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * List all enrolled templates in the UI.
 */
async function irisListTemplates() {
  var __ = _iris__();
  var listEl = document.getElementById("iris-template-list");
  var items, i, template, li;

  _irisGallery = await irisStorage.list();

  if (!listEl) return;

  if (_irisGallery.length === 0) {
    listEl.innerHTML = "<li>" + (__("iris.no_templates", "No templates enrolled.")) + "</li>";
    return;
  }

  items = "";
  for (i = 0; i < _irisGallery.length; i++) {
    template = _irisGallery[i];
    li =
      '<li data-id="' +
      template.id +
      '">' +
      (template.label || template.id) +
      " (" +
      new Date(template.enrolledAt).toLocaleDateString() +
      ")" +
      ' <button class="iris-verify-btn" onclick="irisVerify(\'' +
      template.id +
      "')\">Verify</button>" +
      ' <button class="iris-delete-btn" onclick="irisDeleteTemplate(\'' +
      template.id +
      "')\">Delete</button>" +
      "</li>";
    items += li;
  }
  listEl.innerHTML = items;
}

/**
 * Delete a template.
 * @param {string} templateId
 */
async function irisDeleteTemplate(templateId) {
  var __ = _iris__();

  if (!confirm(__("iris.confirm_delete", "Delete this iris template?"))) return;

  try {
    await irisStorage.delete(templateId);
    _irisGallery = await irisStorage.list();
    irisListTemplates();
    irisSetStatus(
      "iris-status",
      __("iris.deleted", "Template deleted. Remaining: {0}")
        .split("{0}")
        .join(String(_irisGallery.length)),
    );
  } catch (error) {
    irisSetStatus(
      "iris-status",
      __("iris.delete_error", "Delete error: {0}")
        .split("{0}")
        .join(error.message),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Display capture results in the UI.
 * @param {object} result
 */
function _irisDisplayResult(result) {
  var __ = _iris__();
  var box = document.getElementById("iris-result-box");
  var details = document.getElementById("iris-result-details");

  if (box) box.style.display = "block";

  if (details) {
    var html =
      "<strong>" + (__("iris.liveness", "Liveness")) + ":</strong> " +
      (result.liveness.isLive
        ? '<span style="color:#2ecc71">' + (__("iris.live", "LIVE")) + "</span>"
        : '<span style="color:#e74c3c">' + (__("iris.spoof", "SPOOF")) + "</span>") +
      " (" +
      (result.liveness.score * 100).toFixed(1) +
      "%)<br>" +
      "<strong>" + (__("iris.quality", "Quality")) + ":</strong> " +
      result.quality.toFixed(1) +
      "%<br>" +
      "<strong>" + (__("iris.pupil", "Pupil")) + ":</strong> r=" +
      result.segmentation.pupil.radius.toFixed(1) +
      "px<br>" +
      "<strong>" + (__("iris.iris", "Iris")) + ":</strong> r=" +
      result.segmentation.iris.radius.toFixed(1) +
      "px<br>" +
      "<strong>" + (__("iris.code", "IrisCode")) + ":</strong> " +
      result.irisCode.length +
      " bits";

    details.innerHTML = html;
  }
}

/**
 * Display identification results.
 * @param {Array} results
 */
function _irisDisplayIdentifyResults(results) {
  var __ = _iris__();
  var box = document.getElementById("iris-identify-box");
  var details = document.getElementById("iris-identify-details");
  var i, html;

  if (box) box.style.display = "block";
  if (!details || !results) return;

  html = "<table><thead><tr><th>" + (__("iris.label", "Label")) + "</th><th>HD</th><th>" + (__("iris.match", "Match")) + "</th></tr></thead><tbody>";
  for (i = 0; i < Math.min(results.length, 10); i++) {
    html +=
      "<tr>" +
      "<td>" + (results[i].label || results[i].id) + "</td>" +
      "<td>" + results[i].hd.toFixed(4) + "</td>" +
      "<td>" + (results[i].match ? "✓" : "✗") + "</td>" +
      "</tr>";
  }
  html += "</tbody></table>";
  details.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERLAY (live preview with iris landmarks)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Start the live overlay drawing.
 */
function _irisStartOverlay() {
  if (_irisOverlayRunning) return;
  _irisOverlayRunning = true;
  _irisOverlayDraw();
}

/**
 * Stop the overlay.
 */
function _irisStopOverlay() {
  _irisOverlayRunning = false;
  if (_irisOverlayRAF) {
    cancelAnimationFrame(_irisOverlayRAF);
    _irisOverlayRAF = 0;
  }
}

/**
 * Draw overlay frame.
 */
function _irisOverlayDraw() {
  if (!_irisOverlayRunning) return;
  // Overlay drawing would go here (landmarks, circles, etc.)
  // For now, rely on the video element showing the preview
  _irisOverlayRAF = requestAnimationFrame(_irisOverlayDraw);
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATED IDENTIFIER GENERATION (mirrors Face "Generate Identifiers")
// Pipeline: models → segment+normalize → IrisCode → quality+gates → liveness
//           → Privacy ID (BioHash) → auto template ID + encrypted save.
// The page blurs behind the progress overlay for the whole run.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Entry point wired to the Generate Identifiers button.
 * @returns {Promise<void>}
 */
async function handleIrisRun() {
  var __ = _iris__();
  try {
    if (localStorage.getItem("iris_consent") !== "1") {
      irisSetStatus(
        "iris-status",
        __("iris.consent_required_run", "Consent required before generating iris identifiers."),
      );
      return;
    }
  } catch { /* localStorage unavailable */ }
  if (!_irisPendingSource) {
    irisSetStatus(
      "iris-status",
      __("iris.no_source", "Load an eye photo or capture a frame first."),
    );
    return;
  }
  return runIrisPipeline(_irisPendingSource);
}

/**
 * Core automated pipeline. Blur overlay covers the page; each stage yields to
 * the compositor so the spinner keeps animating during CPU-heavy work.
 * @param {{ kind: string, imageData: ImageData, width: number, height: number, fileName?: string }} src
 * @returns {Promise<void>}
 */
async function runIrisPipeline(src) {
  var __ = _iris__();
  var gray, extractResult, qualityFull, gates, livenessResult;
  var codeLen, seedStr, seed, matrix, bh, privacyHex;
  var templateId, labelInput, label, passInput, pass, autoPass, salt, key;
  var matchInfo, r, reportEl, actionsEl;

  _irisReport = null;
  reportEl = document.getElementById("iris-report");
  if (reportEl) reportEl.style.display = "none";
  actionsEl = document.getElementById("iris-actions");
  if (actionsEl) actionsEl.style.display = "none";

  try {
    // ── Stage 1/7: models ──
    irisProgressShow(
      __("iris.progress.title", "Generating Identifiers"),
      __("iris.step.models", "Loading iris engine..."),
    );
    setIrisStage("1/7 " + __("iris.step.models", "Loading iris engine..."), 0.04);
    if (!irisEngine) irisEngine = new IrisEngine();
    await irisEngine.loadModels();
    if (!irisStorage) irisStorage = new IrisStorage();
    await _irisRaf();

    // ── Stage 2/7: segmentation + rubber-sheet + IrisCode ──
    setIrisStage("2/7 " + __("iris.step.segment", "Segmenting iris & generating IrisCode..."), 0.18);
    extractResult = irisEngine.extract(src.imageData);
    if (
      !extractResult ||
      !extractResult.segmentation ||
      !extractResult.segmentation.iris ||
      !extractResult.segmentation.iris.radius ||
      !extractResult.irisCode ||
      !extractResult.irisCode.code
    ) {
      if (typeof _irisRecordFTA === "function") _irisRecordFTA("segmentation-failed");
      irisSetStatus("iris-status", __("iris.no_iris", "No iris detected in the image. Please retake the photo."));
      throw new Error("No iris detected in image");
    }
    gray = _irisToGray(src.imageData);

    // ── Eye-presence gate: reject photos that contain no usable iris ──
    // (Failure To Acquire). detectIris always returns a radius, so without
    // this the pipeline would enrol a "template" from any picture.
    var eyeCheck = IrisEngine.validateEyePresence(
      gray,
      src.width,
      src.height,
      extractResult.segmentation.pupil,
      extractResult.segmentation.iris,
    );
    if (!eyeCheck.ok) {
      if (typeof _irisRecordFTA === "function") _irisRecordFTA("no-eye:" + eyeCheck.reason);
      irisSetStatus(
        "iris-status",
        __("iris.no_iris", "No iris detected in the image. Please retake the photo.") +
          " (" + eyeCheck.reason + ")",
      );
      throw new Error("No eye present in image: " + eyeCheck.reason);
    }

    // Build an IMAGE-SPACE ring validity mask (pupil<r<iris) so ISO 29794-6
    // area/occlusion metrics and the Worldcoin gates operate on real pixels
    // (the normalized IrisCode mask is a different resolution and would yield
    // VIA=0 / 100% occlusion if passed directly).
    var seg = extractResult.segmentation;
    var pup = {
      x: seg.pupil.cx || seg.pupil.x,
      y: seg.pupil.cy || seg.pupil.y,
      radius: seg.pupil.radius,
    };
    var ir = {
      x: seg.iris.cx || seg.iris.x,
      y: seg.iris.cy || seg.iris.y,
      radius: seg.iris.radius,
    };
    var imgMask = _irisBuildRingMask(src.width, src.height, ir, pup);
    var roiBox = {
      x: ir.x - ir.radius * 1.2,
      y: ir.y - ir.radius * 1.2,
      width: ir.radius * 2.4,
      height: ir.radius * 2.4,
    };
    await _irisRaf();

    // ── Stage 3/7: ISO quality + Worldcoin acquisition gates ──
    setIrisStage("3/7 " + __("iris.step.quality", "Assessing ISO 29794-6 quality..."), 0.42);
    qualityFull = IrisQualityFull.computeCompositeQuality({
      imageData: gray,
      width: src.width,
      height: src.height,
      mask: imgMask,
      roi: roiBox,
      pupil: pup,
      iris: ir,
    });
    gates = qualityFull.gates || { passed: false, failures: [], metrics: {} };
    if (gates && !gates.passed) {
      // ACQUISITION GATES are hard gates: a capture that fails any gate (incl.
      // the Section-0 iris-texture-contrast floor for visible-light/dark-iris
      // captures) must NOT be silently enrolled as a noisy IrisCode.
      if (typeof _irisRecordFTER === "function") {
        _irisRecordFTER((gates.failures || []).join("; ") || "gates-failed");
      }
      throw new Error(
        "Capture rejected by acquisition quality gate: " + (gates.failures || []).join("; ")
      );
    }
    await _irisRaf();

    // ── Stage 4/7: liveness (camera burst only — uploads skip) ──
    setIrisStage("4/7 " + __("iris.step.liveness", "Running liveness detection..."), 0.55);
    if (src.kind === "camera" && _irisDilationFrames.length >= 2) {
      livenessResult = irisLiveness.assess({
        dilationFrames: _irisDilationFrames,
        temporalFrames: _irisTemporalFrames,
        grayImage: gray,
        imageWidth: src.width,
        imageHeight: src.height,
        pupil: extractResult.segmentation.pupil,
        iris: extractResult.segmentation.iris,
      });
    } else {
      livenessResult = {
        score: 1,
        isLive: true,
        checks: [],
        details: "Uploaded image — liveness check skipped",
      };
    }

    // ── Stage 5/7: Privacy Identifier (stable BioHash projection) ──
    setIrisStage("5/7 " + __("iris.step.privacy", "Generating Privacy Identifier (BioHash)..."), 0.68);
    codeLen = extractResult.irisCode.code.length;
    seed = _irisGetPrivacySeed();
    matrix = IrisTemplateProtection.generateProjectionMatrix(codeLen, 256, seed);
    bh = IrisTemplateProtection.biohash(extractResult.irisCode.code, matrix, 256);
    privacyHex = _irisBitsToHex(bh.hashed);
    await _irisRaf();

    // ── Stage 6/7: auto template ID + encrypted save ──
    setIrisStage("6/7 " + __("iris.step.encrypt", "Encrypting & storing template..."), 0.82);
    templateId = _irisGenerateId();
    labelInput = document.getElementById("iris-label");
    label = labelInput && labelInput.value.trim()
      ? labelInput.value.trim()
      : "Iris-" + templateId.slice(0, 8);
    var eyeSideSel = document.getElementById("iris-eye-side");
    var eyeSide = eyeSideSel && eyeSideSel.value === "left" ? "left"
      : eyeSideSel && eyeSideSel.value === "right" ? "right"
      : "unknown";
    var illumination = IrisQualityFull.detectIllumination(
      src.imageData && src.imageData.data ? src.imageData.data : null,
      src.width, src.height
    );
    // Phase 3A: NIR camera capability advisory (ISO/IEC 29794-6 §6 prefers NIR)
    var nir = await IrisQualityFull.detectNirCapability();
    // Encryption is fully automatic: a single stable, device-bound vault
    // passphrase is generated once and persisted in localStorage, then used to
    // derive the AES-GCM key for EVERY stored template (so previously saved
    // templates remain decryptable on later runs).
    pass = _irisGetVaultPass();
    autoPass = "";
    salt = FaceCrypto.generateSalt(16);
    key = await FaceCrypto.deriveKey(pass, salt);
    irisStorage.setVaultKey(key);

    // Registry match BEFORE saving the new template
    matchInfo = await _irisMatchGallery(extractResult.irisCode);

    await irisStorage.save({
      id: templateId,
      label: label,
      eyeSide: eyeSide,
      leftCode: extractResult.irisCode.code,
      leftMask: extractResult.irisCode.mask,
      quality: {
        score: qualityFull.score,
        level: qualityFull.level,
        livenessScore: livenessResult.score,
        gatesPassed: gates.passed,
      },
    });
    _irisGallery = await irisStorage.list();

    // ── Stage 7/7: render report ──
    setIrisStage("7/7 " + __("iris.step.report", "Building report..."), 0.96);
    r = {
      type: "iris-biometric",
      generatedAt: new Date().toISOString(),
      source: {
        kind: src.kind,
        fileName: src.fileName || (src.kind === "camera" ? "camera-capture" : "upload"),
        width: src.width,
        height: src.height,
      },
      segmentation: {
        pupilRadius: Math.round(extractResult.segmentation.pupil.radius * 10) / 10,
        irisRadius: Math.round(extractResult.segmentation.iris.radius * 10) / 10,
        center:
          (extractResult.segmentation.iris.cx || extractResult.segmentation.iris.x) +
          "," +
          (extractResult.segmentation.iris.cy || extractResult.segmentation.iris.y),
      },
      irisCode: {
        bits: extractResult.irisCode.length,
        validBits: extractResult.irisCode.mask.reduce(function (a, b) { return a + b; }, 0),
        sha256: await FaceCrypto.sha256Hex(extractResult.irisCode.code),
      },
      quality: {
        score: qualityFull.score,
        level: qualityFull.level,
        metrics: qualityFull.metrics,
      },
      gates: gates,
      privacy: { bits: bh.hashed.length, codeHex: privacyHex },
      liveness: {
        live: !!livenessResult.isLive,
        score: livenessResult.score,
        detail: livenessResult.details || "",
      },
      registry: {
        best: matchInfo,
        totalTemplates: _irisGallery.length,
      },
      illumination: illumination,
      nir: nir,
      performance: _irisGetStats(),
      template: {
        id: templateId,
        label: label,
        eyeSide: eyeSide,
        encrypted: true,
        encryption: "Device vault (automatic)",
      },
    };
    _irisReport = r;
    window._irisReport = r;
    _irisRenderReport(r);
    if (actionsEl) actionsEl.style.display = "flex";
    irisProgressUpdate(1, __("iris.step.done", "Done"));
    await _irisRaf();

    _irisCurrentResult = {
      irisCode: extractResult.irisCode,
      segmentation: extractResult.segmentation,
      liveness: livenessResult,
      quality: qualityFull.score,
    };

    irisSetStatus(
      "iris-status",
      __("iris.pipeline_done", "Identifiers generated. Template '{0}' saved encrypted ({1} total).")
        .split("{0}").join(label)
        .split("{1}").join(String(_irisGallery.length)),
    );
    if (typeof handleIrisRefreshList === "function") handleIrisRefreshList();
  } catch (error) {
    if (typeof window !== "undefined") {
      window._irisLastError = {
        message: error && error.message,
        stack: error && error.stack,
        string: String(error),
      };
    }
    irisSetStatus(
      "iris-status",
      __("iris.pipeline_error", "Generation error: {0}").split("{0}").join(error && error.message ? error.message : String(error)),
    );
  } finally {
    irisProgressHide();
    setIrisStage(null);
  }
}

/** Stable per-device vault passphrase (localStorage-backed, auto-created). */
function _irisGetVaultPass() {
  try {
    var s = localStorage.getItem("iris_vault_pass");
    if (s) return s;
    var p = _irisRandomToken(24);
    localStorage.setItem("iris_vault_pass", p);
    return p;
  } catch {
    return "iris-default-vault-pass";
  }
}

/** Stable per-device BioHash projection seed (localStorage-backed). */
function _irisGetPrivacySeed() {
  try {
    var s = localStorage.getItem("iris_privacy_seed");
    if (s) return parseInt(s, 10);
    var n = Math.floor(Math.random() * 0xff_ff_ff_ff);
    localStorage.setItem("iris_privacy_seed", String(n));
    return n;
  } catch {
    return 123_456_789;
  }
}

/**
 * Validate that an uploaded image uses a lossless format (PNG or BMP).
 *
 * OSAC 2024-N-0004 §4.3.5: the iris image data element should be
 * uncompressed. Lossy JPEG destroys the high-frequency texture that Daugman
 * encoding relies on, so it is rejected at the point of upload.
 * @param {{ type?: string, name?: string }} file - The picked File/Blob
 * @returns {{ ok: boolean, reason: string }}
 *   reason ∈ {"", "no-file", "jpeg-not-allowed", "unsupported-format"}
 */
function irisValidateImageFile(file) {
  if (!file) return { ok: false, reason: "no-file" };

  var t = (file.type || "").toLowerCase();
  var n = (file.name || "").toLowerCase();

  if (t === "image/jpeg" || t === "image/jpg") {
    return { ok: false, reason: "jpeg-not-allowed" };
  }
  if (t === "image/png" || t === "image/bmp" ||
      t === "image/x-bmp" || t === "image/x-ms-bmp") {
    return { ok: true, reason: "" };
  }

  // MIME missing/unknown — fall back to extension
  if (/\.(png|bmp)$/.test(n)) return { ok: true, reason: "" };
  if (/\.jpe?g$/.test(n)) return { ok: false, reason: "jpeg-not-allowed" };

  return { ok: false, reason: "unsupported-format" };
}

/**
 * RGBA ImageData → Uint8 grayscale array.
 * @param imageData
 */
function _irisToGray(imageData) {
  var d = imageData.data, out = new Uint8Array(imageData.width * imageData.height), i, g;
  for (i = 0, g = 0; i < d.length; i += 4, g++) {
    out[g] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
  }
  return out;
}

/**
 * Build an image-space ring validity mask (1 = within iris annulus, 0 outside).
 * Used so ISO 29794-6 area/occlusion metrics and the Worldcoin gates operate on
 * real pixels rather than the normalized IrisCode mask.
 * @param width
 * @param height
 * @param iris
 * @param pupil
 */
function _irisBuildRingMask(width, height, iris, pupil) {
  var mask = new Uint8Array(width * height), x, y, idx, dx, dy;
  var dIris, dPup, ri, rp;
  if (!iris || !iris.radius) return mask;
  ri = iris.radius;
  rp = pupil && pupil.radius ? pupil.radius : 0;
  for (y = 0; y < height; y++) {
    for (x = 0; x < width; x++) {
      idx = y * width + x;
      dx = x - iris.x;
      dy = y - iris.y;
      dIris = Math.hypot(dx, dy);
      dPup = rp ? Math.hypot(dx, dy) : Infinity;
      if (dIris <= ri * 0.98 && dPup >= rp * 0.98) mask[idx] = 1;
    }
  }
  return mask;
}

/**
 * Uint8 bit array → hex string.
 * @param bits
 */
function _irisBitsToHex(bits) {
  var hex = "", i, b;
  for (i = 0; i < bits.length; i += 4) {
    b =
      ((bits[i] || 0) << 3) |
      ((bits[i + 1] || 0) << 2) |
      ((bits[i + 2] || 0) << 1) |
      (bits[i + 3] || 0);
    hex += b.toString(16);
  }
  return hex;
}

/** Auto template ID — UUID v4 when available. */
function _irisGenerateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "iris_" + Date.now() + "_" + _irisRandomToken(8);
}

/**
 * Random alphanumeric token.
 * @param n
 */
function _irisRandomToken(n) {
  var chars = "abcdefghjkmnpqrstuvwxyz23456789", out = "", i, arr;
  arr = new Uint32Array(n);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(arr);
  else for (i = 0; i < n; i++) arr[i] = (Math.random() * 0xff_ff_ff_ff) | 0;
  for (i = 0; i < n; i++) out += chars[arr[i] % chars.length];
  return out;
}

/**
 * Best gallery match for the given IrisCode (or null).
 * @param irisCode
 */
async function _irisMatchGallery(irisCode) {
  var data, i, t, res;
  if (!_irisGallery || _irisGallery.length === 0) return null;
  data = [];
  for (i = 0; i < _irisGallery.length; i++) {
    t = await irisStorage.load(_irisGallery[i].id);
    if (t && t.leftCode && !t.decryptError) {
      data.push({ id: t.id, label: t.label, code: t.leftCode, mask: t.leftMask, eyeSide: t.eyeSide });
    }
  }
  res = IrisMatcher.identify(irisCode, data);
  return res.bestMatch
    ? {
        label: res.bestMatch.label || res.bestMatch.id,
        hd: res.bestMatch.hd,
        eyeSide: res.bestMatch.eyeSide || "unknown",
        match: true,
      }
    : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT RENDERING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * HTML-escape helper.
 * @param {*} s
 * @returns {string}
 */
function _irisEscHtml(s) {
  return String(s == null ? "" : s)
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;");
}

/**
 * Render the identifier report into #iris-report.
 * @param {object} r
 */
function _irisRenderReport(r) {
  var __ = _iris__();
  var el = document.getElementById("iris-report");
  var sections, html, h;

  if (!el) return;

  sections = [];
  sections.push([
    __("iris.report.source", "Source"),
    "<table class='meta-table'>" +
      "<tr><td>" + __("iris.report.file", "File") + "</td><td>" + _irisEscHtml(r.source.fileName) + "</td></tr>" +
      "<tr><td>" + __("iris.report.dims", "Dimensions") + "</td><td>" + r.source.width + " × " + r.source.height + "</td></tr>" +
      "</table>",
  ]);
  sections.push([
    __("iris.report.seg", "Segmentation"),
    "<table class='meta-table'>" +
      "<tr><td>" + __("iris.result_pupil", "Pupil Radius") + "</td><td>" + r.segmentation.pupilRadius + " px</td></tr>" +
      "<tr><td>" + __("iris.result_iris", "Iris Radius") + "</td><td>" + r.segmentation.irisRadius + " px</td></tr>" +
      "</table>",
  ]);
  sections.push([
    __("iris.report.code", "IrisCode"),
    "<table class='meta-table'>" +
      "<tr><td>Bits</td><td>" + r.irisCode.bits + " (" + r.irisCode.validBits + " " + __("iris.report.valid", "valid") + ")</td></tr>" +
      "<tr><td>SHA-256</td><td><code style='font-size:0.65rem;word-break:break-all'>" + _irisEscHtml(r.irisCode.sha256) + "</code></td></tr>" +
      "</table>",
  ]);
  sections.push([
    __("iris.report.quality", "Quality (ISO 29794-6)"),
    "<p style='font-size:0.85rem;margin:0 0 6px'><strong>" + r.quality.score + "/100 (" + _irisEscHtml(r.quality.level) + ")</strong></p>" +
      "<p style='font-size:0.75rem;margin:0'>" +
      __("iris.report.gates", "Acquisition gates") + ": " +
      (r.gates.passed
        ? "<span style='color:#28a745'>&#10003; " + __("iris.report.passed", "passed") + "</span>"
        : "<span style='color:#dc3545'>&#10007; " + _irisEscHtml(r.gates.failures.join("; ")) + "</span>") +
      "</p>",
  ]);
  sections.push([
    __("iris.report.privacy", "Privacy Identifier (BioHash)"),
    "<table class='meta-table'>" +
      "<tr><td>Bits</td><td>" + r.privacy.bits + "</td></tr>" +
      "<tr><td>ID</td><td><code style='font-size:0.65rem;word-break:break-all'>" + _irisEscHtml(r.privacy.codeHex) + "</code></td></tr>" +
      "</table>",
  ]);
  sections.push([
    __("iris.result_liveness", "Liveness"),
    "<p style='font-size:0.85rem;margin:0'>" +
      (r.liveness.live
        ? "<span style='color:#28a745'>&#10003; " + __("iris.live", "LIVE") + "</span>"
        : "<span style='color:#dc3545'>&#10007; " + __("iris.spoof", "SPOOF") + "</span>") +
      " (" + (r.liveness.score * 100).toFixed(1) + "%)" +
      (r.liveness.detail ? "<br><small style='color:var(--text-muted)'>" + _irisEscHtml(r.liveness.detail) + "</small>" : "") +
      "</p>",
  ]);
  sections.push([
    __("iris.report.registry", "Registry"),
    r.registry.best
      ? "<p style='margin:0;font-size:0.8rem;background:rgba(40,167,69,.1);padding:6px 8px;border-radius:6px'><strong>" +
        __("iris.report.match_found", "Match found") + ":</strong> " + _irisEscHtml(r.registry.best.label) +
        " (HD " + r.registry.best.hd.toFixed(4) + ")</p>"
      : "<p style='margin:0;font-size:0.8rem;color:var(--text-muted)'>" +
        __("iris.report.no_match", "Not found in the registry.") + "</p>",
  ]);
  sections.push([
    __("iris.report.template", "Template"),
    "<table class='meta-table'>" +
      "<tr><td>ID</td><td><code style='font-size:0.65rem'>" + _irisEscHtml(r.template.id) + "</code></td></tr>" +
      "<tr><td>" + __("iris.report.label", "Label") + "</td><td>" + _irisEscHtml(r.template.label) + "</td></tr>" +
      "<tr><td>" + __("iris.report.eye_side", "Eye Side") + "</td><td>" + _irisEscHtml(r.template.eyeSide || "unknown") + "</td></tr>" +
      "" +
      "<tr><td>AES-GCM</td><td><span style='color:#28a745'>&#128274; " + __("iris.report.encrypted", "encrypted at rest") + "</span></td></tr>" +
      (r.template.encryption
        ? "<tr><td colspan='2' style='background:rgba(40,167,69,.12)'><strong>&#128274; " +
          _irisEscHtml(r.template.encryption) + "</strong></td></tr>"
        : "") +
      "</table>",
  ]);

  // Illumination advisory (ISO/IEC 29794-6 §6: NIR preferred)
  if (r.illumination) {
    var illumNote = r.illumination.colorCapture
      ? __("iris.report.illum_color", "Color/visible capture detected — NIR illumination is recommended for robust iris recognition (ISO/IEC 29794-6).")
      : __("iris.report.illum_mono", "Monochrome/NIR-like capture detected.");
    sections.push([
      __("iris.report.illumination", "Illumination"),
      "<p style='font-size:0.8rem;margin:0'>" +
        (r.illumination.modality === "color"
          ? "<span style='color:#e0a800'>&#9888; "
          : "<span style='color:#28a745'>&#10003; ") +
        _irisEscHtml(r.illumination.modality) + " (" +
        r.illumination.meanChannelDiff + " ch&Delta;)</span><br>" +
        "<small style='color:var(--text-muted)'>" + _irisEscHtml(illumNote) + "</small></p>",
    ]);
  }

  // NIR camera capability advisory (Phase 3A — ISO/IEC 29794-6 §6)
  if (r.nir) {
    var nirNote = r.nir.nirAvailable
      ? __("iris.report.nir_ok", "NIR-capable camera detected — optimal for iris recognition.")
      : __("iris.report.nir_visible", "No NIR camera detected — visible/color capture used. NIR illumination is recommended for robust iris recognition (ISO/IEC 29794-6 §6).");
    sections.push([
      __("iris.report.nir", "NIR Capability"),
      "<p style='font-size:0.8rem;margin:0'>" +
        (r.nir.nirAvailable
          ? "<span style='color:#28a745'>&#10003; "
          : "<span style='color:#e0a800'>&#9888; ") +
        _irisEscHtml(nirNote) + "</span></p>",
    ]);
  }

  // Operational FTA/FTER performance (ISO/IEC 19794-6 §7)
  if (r.performance) {
    sections.push([
      __("iris.report.performance", "Operational Stats"),
      "<table class='meta-table'>" +
        "<tr><td>FTA</td><td>" + (r.performance.fta || 0) + "</td></tr>" +
        "<tr><td>FTER</td><td>" + (r.performance.fter || 0) + "</td></tr>" +
        (r.performance.lastFta
          ? "<tr><td colspan='2' style='font-size:0.7rem;color:var(--text-muted)'>" +
            __("iris.report.last_fta", "Last FTA") + ": " + _irisEscHtml(r.performance.lastFta.reason) + "</td></tr>"
          : "") +
        (r.performance.lastFter
          ? "<tr><td colspan='2' style='font-size:0.7rem;color:var(--text-muted)'>" +
            __("iris.report.last_fter", "Last FTER") + ": " + _irisEscHtml(r.performance.lastFter.reason) + "</td></tr>"
          : "") +
        "</table>",
    ]);
  }

  html = "<div>";
  for (h = 0; h < sections.length; h++) {
    html +=
      "<div style='margin-top:10px;padding:10px;border:1px solid var(--border-color,#ddd);border-radius:8px'>" +
      "<strong style='font-size:0.8rem'>" + sections[h][0] + "</strong>" +
      sections[h][1] +
      "</div>";
  }
  html += "</div>";
  el.innerHTML = html;
  el.style.display = "block";
}

// ═══════════════════════════════════════════════════════════════════════════
// DOWNLOAD RESULTS (JSON / CSV / TXT / XML / PDF / DOCX)
// Same pattern as Face_Biometric downloadFaceReport.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lazily ensure a vendor library is available on window.
 * @param {string} lib
 * @returns {Promise<void>}
 */
async function _irisEnsureLib(lib) {
  var start, map;
  map = { jspdf: "jspdf", docx: "docx" };
  if (typeof window.loadVendorLib === "function") window.loadVendorLib(lib);
  start = Date.now();
  while (!window[map[lib]]) {
    if (Date.now() - start > 8000) throw new Error(lib + " failed to load");
    await new Promise(function (res) { setTimeout(res, 60); });
  }
}

/**
 * Multi-format download handler registered for the shared #dl-modal.
 * @param {string} format
 */
async function downloadIrisReport(format) {
  var r, content, ext, mime, blob;
  closeDownloadModal();
  r = window._irisReport;
  if (!r) return;

  try {
    if (format === "pdf") {
      blob = await _irisReportToPDF(r);
      downloadBlobSimple(blob, "iris_report." + _irisFileStamp() + ".pdf");
      return;
    }
    if (format === "doc" || format === "docx") {
      blob = await _irisReportToDOCX(r);
      downloadBlobSimple(blob, "iris_report." + _irisFileStamp() + ".docx");
      return;
    }
    switch (format) {
      case "json": {
        content = JSON.stringify(r, null, 2);
        ext = "json";
        mime = "application/json";
        break;
      }
      case "csv": {
        content = _irisReportToCSV(r);
        ext = "csv";
        mime = "text/csv;charset=utf-8";
        break;
      }
      case "txt": {
        content = _irisReportToTXT(r);
        ext = "txt";
        mime = "text/plain;charset=utf-8";
        break;
      }
      case "xml": {
        content = _irisReportToXML(r);
        ext = "xml";
        mime = "application/xml";
        break;
      }
      default: {
        return;
      }
    }
    if (content == null) return;
    downloadBlobSimple(new Blob([content], { type: mime }), "iris_report." + _irisFileStamp() + "." + ext);
  } catch (error) {
    irisSetStatus("iris-status", "Download error: " + error.message);
  }
}

/**
 *
 */
function _irisFileStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/**
 *
 * @param r
 */
function _irisReportToCSV(r) {
  var rows;
  rows = [
    ["Key", "Value"],
    ["Type", r.type],
    ["Generated at", r.generatedAt],
    ["Source kind", r.source.kind],
    ["File", r.source.fileName],
    ["Dimensions", r.source.width + "x" + r.source.height],
    ["Pupil radius", r.segmentation.pupilRadius],
    ["Iris radius", r.segmentation.irisRadius],
    ["IrisCode bits", r.irisCode.bits],
    ["Valid bits", r.irisCode.validBits],
    ["IrisCode SHA-256", r.irisCode.sha256],
    ["Quality score", r.quality.score],
    ["Quality level", r.quality.level],
    ["Gates passed", r.gates.passed],
    ["Gates failures", (r.gates.failures || []).join("; ")],
    ["Privacy ID bits", r.privacy.bits],
    ["Privacy ID", r.privacy.codeHex],
    ["Liveness", r.liveness.live ? "LIVE" : "SPOOF"],
    ["Liveness score", (r.liveness.score * 100).toFixed(1) + "%"],
    ["Registry match", r.registry.best ? r.registry.best.label + " HD=" + r.registry.best.hd.toFixed(4) : "none"],
    ["Template ID", r.template.id],
    ["Template label", r.template.label],
    ["Eye side", r.template.eyeSide || "unknown"],
    ["NIR available", r.nir ? (r.nir.nirAvailable ? "yes" : "no") : "unknown"],
    ["Illumination", r.illumination ? r.illumination.modality : "unknown"],
    ["FTA", r.performance ? r.performance.fta : 0],
    ["FTER", r.performance ? r.performance.fter : 0],
    ["Encrypted", r.template.encrypted ? "AES-GCM" : "no"],
  ];
  return rows
    .map(function (row) {
      return row
        .map(function (cell) {
          cell = String(cell == null ? "" : cell);
          return /[",\n]/.test(cell) ? '"' + cell.split('"').join('""') + '"' : cell;
        })
        .join(",");
    })
    .join("\n");
}

/**
 *
 * @param r
 */
function _irisReportToTXT(r) {
  var line = "=".repeat(46);
  return [
    line,
    "RedoSan Authenticity - Iris Biometric Report",
    line,
    "Generated : " + r.generatedAt,
    "Source    : " + r.source.fileName + " (" + r.source.kind + ", " + r.source.width + "x" + r.source.height + ")",
    "",
    "[Segmentation]",
    "  Pupil radius : " + r.segmentation.pupilRadius + " px",
    "  Iris radius  : " + r.segmentation.irisRadius + " px",
    "  Center       : " + r.segmentation.center,
    "",
    "[IrisCode]",
    "  Bits    : " + r.irisCode.bits + " (" + r.irisCode.validBits + " valid)",
    "  SHA-256 : " + r.irisCode.sha256,
    "",
    "[Quality - ISO 29794-6]",
    "  Score  : " + r.quality.score + "/100 (" + r.quality.level + ")",
    "  Gates  : " + (r.gates.passed ? "PASSED" : "FAILED - " + (r.gates.failures || []).join("; ")),
    "",
    "[Privacy Identifier (BioHash)]",
    "  Bits : " + r.privacy.bits,
    "  ID   : " + r.privacy.codeHex,
    "",
    "[Liveness]",
    "  Result : " + (r.liveness.live ? "LIVE" : "SPOOF") + " (" + (r.liveness.score * 100).toFixed(1) + "%)",
    r.liveness.detail ? "  Detail : " + r.liveness.detail : "",
    "",
    "[Registry]",
    "  Match : " + (r.registry.best ? r.registry.best.label + " (HD " + r.registry.best.hd.toFixed(4) + ")" : "not found"),
    "  Templates stored : " + r.registry.totalTemplates,
    "",
    "[Template]",
    "  ID        : " + r.template.id,
    "  Label     : " + r.template.label,
    "  Eye side  : " + (r.template.eyeSide || "unknown"),
    "  NIR       : " + (r.nir ? (r.nir.nirAvailable ? "available" : "not available (visible fallback)") : "unknown"),
    "  Encrypted : AES-GCM (at rest)",
    "  Encryption: " + r.template.encryption,
    "",
    "[Illumination]",
    "  Modality  : " + (r.illumination ? r.illumination.modality : "unknown") +
      (r.illumination && r.illumination.colorCapture ? " (visible/color — NIR recommended)" : ""),
    "",
    "[Operational Stats]",
    "  FTA  : " + (r.performance ? r.performance.fta : 0),
    "  FTER : " + (r.performance ? r.performance.fter : 0),
    "",
    "Generated by RedoSan Authenticity - 100% browser-based",
  ]
    .filter(function (l) { return l !== ""; })
    .join("\n");
}

/**
 *
 * @param r
 */
function _irisReportToXML(r) {
  var x = _irisEscHtml;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<irisReport>",
    "  <type>" + x(r.type) + "</type>",
    "  <generatedAt>" + x(r.generatedAt) + "</generatedAt>",
    "  <source kind=\"" + x(r.source.kind) + "\" width=\"" + r.source.width + "\" height=\"" + r.source.height + "\">" + x(r.source.fileName) + "</source>",
    "  <segmentation pupilRadius=\"" + r.segmentation.pupilRadius + "\" irisRadius=\"" + r.segmentation.irisRadius + "\" center=\"" + x(r.segmentation.center) + "\" />",
    "  <irisCode bits=\"" + r.irisCode.bits + "\" validBits=\"" + r.irisCode.validBits + "\">" + x(r.irisCode.sha256) + "</irisCode>",
    "  <quality score=\"" + r.quality.score + "\" level=\"" + x(r.quality.level) + "\">",
    "    <gates passed=\"" + r.gates.passed + "\">" + x((r.gates.failures || []).join("; ")) + "</gates>",
    "  </quality>",
    "  <privacyIdentifier bits=\"" + r.privacy.bits + "\">" + x(r.privacy.codeHex) + "</privacyIdentifier>",
    "  <liveness live=\"" + r.liveness.live + "\" score=\"" + (r.liveness.score * 100).toFixed(1) + "\" />",
    "  <registry totalTemplates=\"" + r.registry.totalTemplates + "\">",
    r.registry.best
      ? "    <match label=\"" + x(r.registry.best.label) + "\" hd=\"" + r.registry.best.hd.toFixed(4) + "\" />"
      : "    <match />",
    "  </registry>",
    "  <template id=\"" + x(r.template.id) + "\" label=\"" + x(r.template.label) + "\" eyeSide=\"" + x(r.template.eyeSide || "unknown") + "\" encrypted=\"AES-GCM\" nirAvailable=\"" + (r.nir ? r.nir.nirAvailable : "unknown") + "\" />",
    "  <illumination modality=\"" + x(r.illumination ? r.illumination.modality : "unknown") + "\" colorCapture=\"" + (r.illumination ? r.illumination.colorCapture : false) + "\" />",
    "  <performance fta=\"" + (r.performance ? r.performance.fta : 0) + "\" fter=\"" + (r.performance ? r.performance.fter : 0) + "\" />",
    "</irisReport>",
  ].join("\n");
}

/**
 *
 * @param r
 */
async function _irisReportToPDF(r) {
  var doc, y, push;
  await _irisEnsureLib("jspdf");
  doc = new window.jspdf.jsPDF();
  y = 20;
  doc.setFontSize(16);
  doc.setTextColor(108, 92, 231);
  doc.text("RedoSan Authenticity - Iris Biometric", 14, y);
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
  doc.text("Source", 14, y);
  y += 6;
  push("File", r.source.fileName + " (" + r.source.kind + ")");
  push("Dimensions", r.source.width + " x " + r.source.height);
  y += 3;
  doc.setFontSize(11);
  doc.setTextColor(108, 92, 231);
  doc.text("IrisCode", 14, y);
  y += 6;
  push("Bits", r.irisCode.bits + " (" + r.irisCode.validBits + " valid)");
  push("SHA-256", r.irisCode.sha256);
  y += 3;
  doc.setFontSize(11);
  doc.setTextColor(108, 92, 231);
  doc.text("Quality (ISO 29794-6)", 14, y);
  y += 6;
  push("Score", r.quality.score + "/100 (" + r.quality.level + ")");
  push("Gates", r.gates.passed ? "PASSED" : "FAILED - " + (r.gates.failures || []).join("; "));
  y += 3;
  doc.setFontSize(11);
  doc.setTextColor(108, 92, 231);
  doc.text("Privacy Identifier (BioHash)", 14, y);
  y += 6;
  push("Bits", r.privacy.bits);
  push("ID", r.privacy.codeHex);
  y += 3;
  doc.setFontSize(11);
  doc.setTextColor(108, 92, 231);
  doc.text("Liveness & Registry", 14, y);
  y += 6;
  push("Liveness", (r.liveness.live ? "LIVE" : "SPOOF") + " (" + (r.liveness.score * 100).toFixed(1) + "%)");
  push("Match", r.registry.best ? r.registry.best.label + " (HD " + r.registry.best.hd.toFixed(4) + ")" : "not found");
  push("Templates", r.registry.totalTemplates);
  y += 3;
  doc.setFontSize(11);
  doc.setTextColor(108, 92, 231);
  doc.text("Template", 14, y);
  y += 6;
  push("ID", r.template.id);
  push("Label", r.template.label);
  push("Eye side", r.template.eyeSide || "unknown");
  push("Encryption", r.template.encryption);
  push("Illumination", r.illumination ? r.illumination.modality : "unknown");
  push("FTA/FTER", (r.performance ? r.performance.fta : 0) + " / " + (r.performance ? r.performance.fter : 0));
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by RedoSan Authenticity", 14, 285);
  return doc.output("blob");
}

/**
 *
 * @param r
 */
async function _irisReportToDOCX(r) {
  var P, T, kids;
  await _irisEnsureLib("docx");
  P = window.docx.Paragraph;
  T = window.docx.TextRun;
  kids = [
    new P({ text: "RedoSan Authenticity - Iris Biometric Report", bold: true, heading: "Heading1" }),
    new P({ text: "Generated: " + r.generatedAt }),
    new P({ text: "" }),
    new P({ text: "Source", bold: true, heading: "Heading2" }),
    new P({ children: [new T({ text: "File: " + r.source.fileName + " (" + r.source.kind + ", " + r.source.width + "x" + r.source.height + ")" })] }),
    new P({ text: "IrisCode", bold: true, heading: "Heading2" }),
    new P({ children: [new T({ text: "Bits: " + r.irisCode.bits + " (" + r.irisCode.validBits + " valid) - SHA-256: " + r.irisCode.sha256 })] }),
    new P({ text: "Quality (ISO 29794-6)", bold: true, heading: "Heading2" }),
    new P({ children: [new T({ text: "Score: " + r.quality.score + "/100 (" + r.quality.level + ") - Gates: " + (r.gates.passed ? "PASSED" : "FAILED - " + (r.gates.failures || []).join("; ")) })] }),
    new P({ text: "Privacy Identifier (BioHash)", bold: true, heading: "Heading2" }),
    new P({ children: [new T({ text: r.privacy.bits + " bits: " + r.privacy.codeHex })] }),
    new P({ text: "Liveness", bold: true, heading: "Heading2" }),
    new P({ children: [new T({ text: (r.liveness.live ? "LIVE" : "SPOOF") + " (" + (r.liveness.score * 100).toFixed(1) + "%)" })] }),
    new P({ text: "Registry", bold: true, heading: "Heading2" }),
    new P({ children: [new T({ text: r.registry.best ? "Match: " + r.registry.best.label + " (HD " + r.registry.best.hd.toFixed(4) + ")" : "Not found in the registry." })] }),
    new P({ text: "Template", bold: true, heading: "Heading2" }),
    new P({ children: [new T({ text: "ID: " + r.template.id + " - Label: " + r.template.label + " - Eye: " + (r.template.eyeSide || "unknown") + " - Encrypted: AES-GCM" })] }),
    new P({ children: [new T({ text: "Illumination: " + (r.illumination ? r.illumination.modality : "unknown") + " - FTA/FTER: " + (r.performance ? r.performance.fta : 0) + "/" + (r.performance ? r.performance.fter : 0) })] }),
  ];
  if (r.template.encryption) {
    kids.push(new P({ children: [new T({ text: r.template.encryption, bold: true })] }));
  }
  kids.push(new P({ text: "" }), new P({ text: "Generated by RedoSan Authenticity - 100% browser-based", italics: true }));
  return await window.docx.Packer.toBlob(
    new window.docx.Document({ sections: [{ children: kids }] })
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FTA / FTER STATS (ISO/IEC 19794-6 §7 operational metrics)
// FTA = Failure To Acquire (no usable iris detected).
// FTER = Failure To Enroll (acquired but failed quality/enrolment gates).
// ═══════════════════════════════════════════════════════════════════════════

var IRIS_STATS_KEY = "redosan_iris_stats";

/** Resolve a persistent KV store (localStorage with in-memory fallback). */
function _irisStatsStore() {
  try {
    if (typeof localStorage !== "undefined" && localStorage) return localStorage;
  } catch {
    /* fall through to memory */
  }
  if (globalThis.__irisStatsMem === undefined) globalThis.__irisStatsMem = {};
  return {
    getItem: function (k) {
      return globalThis.__irisStatsMem[k] == null ? null : globalThis.__irisStatsMem[k];
    },
    setItem: function (k, v) {
      globalThis.__irisStatsMem[k] = String(v);
    },
    removeItem: function (k) {
      delete globalThis.__irisStatsMem[k];
    },
  };
}

/** Read FTA/FTER counters. @returns {{fta:number,fter:number,total:number,lastFta:*,lastFter:*}} */
function _irisGetStats() {
  var raw = _irisStatsStore().getItem(IRIS_STATS_KEY);
  var s = raw ? JSON.parse(raw) : {};
  return {
    fta: s.fta || 0,
    fter: s.fter || 0,
    total: s.total || 0,
    lastFta: s.lastFta || null,
    lastFter: s.lastFter || null,
  };
}

/**
 * Record a Failure To Acquire. @param {string} [reason]
 * @param reason
 */
function _irisRecordFTA(reason) {
  var st = _irisStatsStore(), s = _irisGetStats();
  s.fta = (s.fta || 0) + 1;
  s.lastFta = { reason: reason || "unknown", at: Date.now() };
  st.setItem(IRIS_STATS_KEY, JSON.stringify(s));
}

/**
 * Record a Failure To Enroll. @param {string} [reason]
 * @param reason
 */
function _irisRecordFTER(reason) {
  var st = _irisStatsStore(), s = _irisGetStats();
  s.fter = (s.fter || 0) + 1;
  s.lastFter = { reason: reason || "unknown", at: Date.now() };
  st.setItem(IRIS_STATS_KEY, JSON.stringify(s));
}

/** Reset FTA/FTER counters (used by tests / devtools). */
function _irisResetStats() {
  _irisStatsStore().removeItem(IRIS_STATS_KEY);
}

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════

if (typeof window !== "undefined") {
  window.irisInit = irisInit;
  window.irisStartCamera = irisStartCamera;
  window.irisStopCamera = irisStopCamera;
  window.irisStartCapture = irisStartCapture;
  window.irisEnroll = irisEnroll;
  window.irisVerify = irisVerify;
  window.irisIdentify = irisIdentify;
  window.irisListTemplates = irisListTemplates;
  window.irisDeleteTemplate = irisDeleteTemplate;
  window.handleIrisRun = handleIrisRun;
  window.runIrisPipeline = runIrisPipeline;
  window.downloadIrisReport = downloadIrisReport;
  window._irisGetStats = _irisGetStats;
  window._irisRecordFTA = _irisRecordFTA;
  window._irisRecordFTER = _irisRecordFTER;
  window._irisResetStats = _irisResetStats;
  if (typeof setDownloadHandler === "function") {
    setDownloadHandler(downloadIrisReport);
  }
}

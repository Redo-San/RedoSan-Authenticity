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
/* c8 ignore start */
// ── Iris Camera: getUserMedia wrapper for iris capture ──

/**
 * @param {object} [opts]
 * @param {boolean} [opts.mirror] mirror preview (default true for selfie UX)
 */
function IrisCamera(opts) {
  this._stream = null;
  this._video = null;
  this._mirror = !opts || opts.mirror !== false;
  this._engine = null;
}

/**
 * True when the environment can access a camera.
 * @returns {boolean}
 */
IrisCamera.isSupported = function () {
  var nav, md;
  if (typeof navigator === "undefined") return false;
  nav = navigator;
  md = nav.mediaDevices;
  return (
    !!md &&
    typeof md.getUserMedia === "function" &&
    nav.isSecureContext !== false
  );
};

/**
 * Human-readable message per getUserMedia failure.
 * @param {Error|DOMException|string} err
 * @returns {string}
 */
IrisCamera.getCameraErrorMessage = function (err) {
  var name, e;
  if (!err) return "Camera error.";
  name = typeof err === "string" ? err : err.name || err.code || "UnknownError";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError": {
      return "Camera permission denied. Allow camera access in your browser.";
    }
    case "NotFoundError":
    case "DevicesNotFoundError": {
      return "No camera found on this device.";
    }
    case "NotReadableError":
    case "TrackStartError": {
      return "Camera is already in use by another application.";
    }
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError": {
      return "Camera cannot satisfy the requested constraints.";
    }
    case "AbortError": {
      return "Camera access was aborted.";
    }
    case "NotSupportedError": {
      return "Camera is not supported in this browser or context.";
    }
    default: {
      e = typeof err === "string" ? "" : err.message || "";
      return "Camera error: " + (e || name);
    }
  }
};

/**
 * Start the webcam and attach it to a <video> element.
 * @param {HTMLVideoElement} videoEl
 * @param {object} [opts]
 * @param {string} [opts.facingMode] "user" | "environment"
 * @param {string} [opts.deviceId]
 * @param {number} [opts.width]
 * @param {number} [opts.height]
 * @returns {Promise<MediaStream>}
 */
IrisCamera.prototype.startCamera = async function (videoEl, opts) {
  var constraints, stream, md, o;
  o = opts || {};
  if (!IrisCamera.isSupported()) {
    throw new Error(
      "Camera not available: insecure context or no mediaDevices support.",
    );
  }
  if (
    !videoEl ||
    !videoEl.tagName ||
    videoEl.tagName.toLowerCase() !== "video"
  ) {
    throw new Error("A <video> element is required.");
  }
  md = navigator.mediaDevices;
  constraints = {
    video: {
      facingMode: o.facingMode || "user",
      width: { ideal: o.width || 1920 }, // higher res for iris detail
      height: { ideal: o.height || 1080 },
    },
    audio: false,
  };
  if (o.deviceId) constraints.video.deviceId = { exact: o.deviceId };
  stream = await md.getUserMedia(constraints);
  this._stream = stream;
  this._video = videoEl;
  videoEl.srcObject = stream;
  await videoEl.play().catch(function () {});
  if (this._mirror) videoEl.style.transform = "scaleX(-1)";
  return stream;
};

/**
 * Stop the webcam and release the stream.
 * @returns {void}
 */
IrisCamera.prototype.stopCamera = function () {
  var track, i;
  if (this._stream) {
    for (i = 0; i < this._stream.getTracks().length; i++) {
      track = this._stream.getTracks()[i];
      track.stop();
    }
    this._stream = null;
  }
  if (this._video) {
    if (this._video.srcObject) {
      this._video.srcObject = null;
    }
    this._video.style.transform = "";
    this._video = null;
  }
};

/**
 * @returns {boolean}
 */
IrisCamera.prototype.isActive = function () {
  return !!this._stream && this._stream.active;
};

/**
 * Enumerate available video input devices.
 * @returns {Promise<Array<{deviceId: string, label: string}>>}
 */
IrisCamera.prototype.listCameras = async function () {
  var devices, list, i, d;
  if (!IrisCamera.isSupported()) return [];
  try {
    devices = await navigator.mediaDevices.enumerateDevices();
    list = [];
    for (i = 0; i < devices.length; i++) {
      d = devices[i];
      if (d.kind === "videoinput") {
        list.push({ deviceId: d.deviceId, label: d.label || "Camera " + (list.length + 1) });
      }
    }
    return list;
  } catch {
    return [];
  }
};

/**
 * Capture a single frame from the video as ImageData.
 * @param {HTMLVideoElement} [video] - uses stored video if omitted
 * @returns {ImageData|null}
 */
IrisCamera.prototype.captureFrame = function (video) {
  var v, canvas, ctx;
  v = video || this._video;
  if (!v) return null;
  canvas = document.createElement("canvas");
  canvas.width = v.videoWidth || v.width;
  canvas.height = v.videoHeight || v.height;
  ctx = canvas.getContext("2d");
  ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/**
 * Capture a frame and convert to a canvas element.
 * @param {HTMLVideoElement} [video]
 * @returns {HTMLCanvasElement|null}
 */
IrisCamera.prototype.captureCanvas = function (video) {
  var v, canvas, ctx;
  v = video || this._video;
  if (!v) return null;
  canvas = document.createElement("canvas");
  canvas.width = v.videoWidth || v.width;
  canvas.height = v.videoHeight || v.height;
  ctx = canvas.getContext("2d");
  ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
  return canvas;
};

/**
 * Capture multiple frames for liveness analysis.
 * @param {number} count - number of frames to capture
 * @param {number} intervalMs - ms between captures
 * @returns {Promise<Array<ImageData>>}
 */
IrisCamera.prototype.captureMultipleFrames = async function (count, intervalMs) {
  var frames, i;
  count = count || 5;
  intervalMs = intervalMs || 300;
  frames = [];

  for (i = 0; i < count; i++) {
    frames.push(this.captureFrame());
    if (i < count - 1) {
      await new Promise(function (resolve) {
        setTimeout(resolve, intervalMs);
      });
    }
  }

  return frames;
};

/**
 * Adjust camera brightness for pupil dilation test.
 * Uses the track's advanced constraints if available.
 * @param {number} value - -1.0 to 1.0 (0 = default)
 * @returns {Promise<void>}
 */
IrisCamera.prototype.setBrightness = async function (value) {
  var track, caps;
  if (!this._stream) return;
  track = this._stream.getVideoTracks()[0];
  if (!track) return;
  caps = track.getCapabilities ? track.getCapabilities() : {};
  if (caps.brightness) {
    try {
      await track.applyConstraints({
        advanced: [{ brightness: value }],
      });
    } catch {
      // Not all browsers support brightness constraint
    }
  }
};

// Expose on window for browser usage
if (typeof window !== "undefined") {
  window.IrisCamera = IrisCamera;
}
/* c8 ignore stop */

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
// ── Face Camera: getUserMedia wrapper, capture, best-frame selection ──

/**
 * @param {object} [opts]
 * @param {boolean} [opts.mirror] mirror preview (default true for selfie UX)
 */
function FaceCamera(opts) {
  this._stream = null;
  this._video = null;
  this._mirror = !opts || opts.mirror !== false;
}

/**
 * True when the environment can access a camera at all.
 * @returns {boolean}
 */
FaceCamera.isSupported = function () {
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
FaceCamera.getCameraErrorMessage = function (err) {
  var name, e;
  if (!err) return "Camera error.";
  name = typeof err === "string" ? err : err.name || err.code || "UnknownError";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "Camera permission denied. Allow camera access in your browser.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera found on this device.";
    case "NotReadableError":
    case "TrackStartError":
      return "Camera is already in use by another application.";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "Camera cannot satisfy the requested constraints.";
    case "AbortError":
      return "Camera access was aborted.";
    case "NotSupportedError":
      return "Camera is not supported in this browser or context.";
    default:
      e = typeof err === "string" ? "" : err.message || "";
      return "Camera error: " + (e || name);
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
FaceCamera.prototype.startCamera = async function (videoEl, opts) {
  var constraints, stream, md, o;
  o = opts || {};
  if (!FaceCamera.isSupported()) {
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
      width: { ideal: o.width || 1280 },
      height: { ideal: o.height || 720 },
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
FaceCamera.prototype.stopCamera = function () {
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
FaceCamera.prototype.isActive = function () {
  return !!this._stream && this._stream.active;
};

/**
 * Enumerate available video input devices.
 * @returns {Promise<Array<{deviceId: string, label: string}>>}
 */
FaceCamera.prototype.listCameras = async function () {
  var devices, list, i, d;
  if (!FaceCamera.isSupported()) return [];
  devices = await navigator.mediaDevices.enumerateDevices();
  list = [];
  for (i = 0; i < devices.length; i++) {
    d = devices[i];
    if (d.kind === "videoinput") {
      list.push({
        deviceId: d.deviceId,
        label: d.label || "Camera " + (list.length + 1),
      });
    }
  }
  return list;
};

/**
 * Snapshot the current video frame to a canvas.
 * @param {number} [maxW] cap width (keeps aspect)
 * @returns {HTMLCanvasElement|null}
 */
FaceCamera.prototype.captureFrame = function (maxW) {
  var video, canvas, ctx, w, h, scale;
  video = this._video;
  if (!video || !this._stream || !this._stream.active) return null;
  w = video.videoWidth || 640;
  h = video.videoHeight || 480;
  /* c8 ignore next 1 */
  if (!w || !h) return null;
  scale = 1;
  if (maxW && w > maxW) scale = maxW / w;
  canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (this._mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
};

/**
 * Score a captured frame (detection confidence + quality) — used by captureBestFrame.
 * @param {HTMLCanvasElement} canvas
 * @param {object} engine FaceEngine-like with detectFaces(input)
 * @returns {Promise<{canvas: HTMLCanvasElement, result: object|null, score: number}>}
 */
FaceCamera.prototype.scoreFrame = async function (canvas, engine) {
  var result, face, score;
  if (!engine || !engine.detectFaces)
    return { canvas: canvas, result: null, score: 0 };
  result = await engine.detectFaces(canvas);
  face = result && result.length > 0 ? result[0] : null;
  if (!face || !face.box) return { canvas: canvas, result: null, score: 0 };
  score = (face.score || 0) * 100;
  if (face.box.width > 0 && face.box.height > 0) {
    score += Math.min(
      50,
      ((face.box.width * face.box.height) / (canvas.width * canvas.height)) *
        1000,
    );
  }
  return { canvas: canvas, result: face, score: score };
};

/**
 * Capture N frames and return the one with the highest score.
 * @param {object} engine
 * @param {number} [n]
 * @param {number} [delayMs] between captures
 * @returns {Promise<{canvas: HTMLCanvasElement, result: object|null, score: number}>}
 */
FaceCamera.prototype.captureBestFrame = async function (engine, n, delayMs) {
  var best, i, frame, delay;
  if (!n || n < 1) n = 5;
  delay = delayMs || 100;
  best = null;
  for (i = 0; i < n; i++) {
    frame = await this.scoreFrame(this.captureFrame(), engine);
    if (best === null || frame.score > best.score) best = frame;
    if (delay > 0 && i < n - 1) {
      await new Promise(function (resolve) {
        setTimeout(resolve, delay);
      });
    }
  }
  /* c8 ignore next 1 */
  return best || { canvas: null, result: null, score: 0 };
};

/* c8 ignore start */
if (typeof window !== "undefined") window.FaceCamera = FaceCamera;
/* c8 ignore stop */

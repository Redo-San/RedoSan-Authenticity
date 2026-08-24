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
// ── Face Liveness: passive heuristics + active challenge-response (ISO/IEC 30107-3 style) ──

/**
 * All threshold constants live here for calibration in one place.
 */
var FACE_LIVENESS_CONFIG = {
  earBlinkThreshold: 0.22, // EAR below this = eye closed
  earOpenThreshold: 0.28, // EAR above this = eye open (blink recovery)
  blinkMinFrames: 1, // min consecutive closed frames for one blink
  motionMinVariance: 0.00008, // inter-frame nose displacement variance below this = static
  sharpnessMin: 120, // variance-of-Laplacian below this = blurred
  qualityMinConfidence: 0.3, // detection confidence gate
  qualityMaxFaceRatio: 0.95, // face larger than this fraction of frame = too close
  qualityMinFaceRatio: 0.05, // face smaller than this fraction of frame = too far
  frontalNoseOffsetRatio: 0.12, // nose x offset beyond this fraction of face width = not frontal
  activeChallengeTimeoutMs: 8000, // per-challenge window
  activeMaxAttempts: 3, // failed challenges before liveness fails
  activeMinChallenges: 3, // challenges to pass by default
  captureFrames: 8, // passive analysis frame count
  antiSpoofMinScore: 0.5, // PAD live-score gate (MiniFASNetV2 softmax)
};

// MediaPipe Face Mesh landmark indices (468 points, Human 3.3.6 layout)
var FACE_MESH_INDICES = {
  leftEye: [33, 160, 158, 133, 153, 144],
  rightEye: [362, 385, 387, 263, 373, 380],
  noseTip: 1,
  lipCornerLeft: 61,
  lipCornerRight: 291,
  lipUpperMid: 13,
  lipLowerMid: 14,
};

function FaceLiveness() {}

/**
 * Eye Aspect Ratio from the 6 EAR points of one eye.
 * @param {Float32Array|Array<number>} mesh 468x3 flat landmarks
 * @param {Array<number>} eyeIndices 6 point indices
 * @returns {number}
 */
FaceLiveness.ear = function (mesh, eyeIndices) {
  var idx, p1, p2, p3, p4, p5, p6, d1, d2, d3;
  if (!mesh || !eyeIndices || eyeIndices.length < 6) return 0;
  idx = function (n) {
    return n * 3;
  };
  p1 = mesh[idx(eyeIndices[0])];
  p2 = mesh[idx(eyeIndices[1])];
  p3 = mesh[idx(eyeIndices[2])];
  p4 = mesh[idx(eyeIndices[3])];
  p5 = mesh[idx(eyeIndices[4])];
  p6 = mesh[idx(eyeIndices[5])];
  if (
    p1 === undefined ||
    p2 === undefined ||
    p3 === undefined ||
    p4 === undefined ||
    p5 === undefined ||
    p6 === undefined
  )
    return 0;
  d1 = Math.hypot(
    p2 - p6,
    mesh[idx(eyeIndices[1]) + 1] - mesh[idx(eyeIndices[5]) + 1],
  );
  d2 = Math.hypot(
    p3 - p5,
    mesh[idx(eyeIndices[2]) + 1] - mesh[idx(eyeIndices[4]) + 1],
  );
  d3 = Math.hypot(
    p1 - p4,
    mesh[idx(eyeIndices[0]) + 1] - mesh[idx(eyeIndices[3]) + 1],
  );
  if (d3 === 0) return 0;
  return (d1 + d2) / (2 * d3);
};

/**
 * Count blinks over a frame sequence using both-eye EAR.
 * @param {Array<{mesh: Float32Array|Array<number>}>} frames
 * @returns {{count: number, earSeries: Array<number>, closedRuns: number}}
 */
FaceLiveness.blinkScore = function (frames) {
  var earSeries, left, right, avg, closed, blinkCount, run, i, f;
  if (!frames || frames.length === 0)
    return { count: 0, earSeries: [], closedRuns: 0 };
  earSeries = [];
  closed = [];
  for (i = 0; i < frames.length; i++) {
    f = frames[i];
    if (!f || !f.mesh) {
      earSeries.push(0);
      closed.push(false);
      continue;
    }
    left = FaceLiveness.ear(f.mesh, FACE_MESH_INDICES.leftEye);
    right = FaceLiveness.ear(f.mesh, FACE_MESH_INDICES.rightEye);
    avg = (left + right) / 2;
    earSeries.push(avg);
    closed.push(avg > 0 && avg < FACE_LIVENESS_CONFIG.earBlinkThreshold);
  }
  blinkCount = 0;
  run = 0;
  closedRuns = 0;
  for (i = 0; i < closed.length; i++) {
    if (closed[i]) {
      run++;
    } else {
      if (run >= FACE_LIVENESS_CONFIG.blinkMinFrames) blinkCount++;
      if (run > 0) closedRuns++;
      run = 0;
    }
  }
  if (run >= FACE_LIVENESS_CONFIG.blinkMinFrames) blinkCount++;
  if (run > 0) closedRuns++;
  return { count: blinkCount, earSeries: earSeries, closedRuns: closedRuns };
};

/**
 * Inter-frame nose-tip displacement variance (static photos ≈ 0, replay has uniform motion).
 * @param {Array<{mesh: Float32Array|Array<number>}>} frames
 * @returns {number} variance of per-frame displacement magnitude
 */
FaceLiveness.motionScore = function (frames) {
  var deltas, mean, variance, i, x, y, prev, dx, dy, n;
  if (!frames || frames.length < 2) return 0;
  deltas = [];
  prev = null;
  for (i = 0; i < frames.length; i++) {
    if (!frames[i] || !frames[i].mesh) continue;
    x = frames[i].mesh[FACE_MESH_INDICES.noseTip * 3];
    y = frames[i].mesh[FACE_MESH_INDICES.noseTip * 3 + 1];
    if (x === undefined || y === undefined) continue;
    if (prev !== null) {
      dx = x - prev.x;
      dy = y - prev.y;
      deltas.push(Math.sqrt(dx * dx + dy * dy));
    }
    prev = { x: x, y: y };
  }
  if (deltas.length === 0) return 0;
  mean = 0;
  for (i = 0; i < deltas.length; i++) mean += deltas[i];
  mean /= deltas.length;
  variance = 0;
  for (i = 0; i < deltas.length; i++)
    variance += (deltas[i] - mean) * (deltas[i] - mean);
  n = deltas.length;
  return variance / n;
};

/**
 * Sharpness via variance of Laplacian over a grayscale canvas.
 * @param {HTMLCanvasElement} canvas
 * @returns {number} higher = sharper
 */
FaceLiveness.sharpnessScore = function (canvas) {
  var ctx, data, gray, lap, mean, variance, i, j, w, h, idx, g, prevG;
  if (!canvas || !canvas.getContext) return 0;
  ctx = canvas.getContext("2d");
  w = canvas.width;
  h = canvas.height;
  if (!w || !h) return 0;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch (e) {
    return 0;
  }
  gray = [];
  for (i = 0; i < data.length; i += 4) {
    g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray.push(g);
  }
  lap = [];
  for (i = 1; i < h - 1; i++) {
    for (j = 1; j < w - 1; j++) {
      idx = i * w + j;
      prevG = gray[idx];
      lap.push(
        -prevG * 4 +
          gray[idx - 1] +
          gray[idx + 1] +
          gray[idx - w] +
          gray[idx + w],
      );
    }
  }
  if (lap.length === 0) return 0;
  mean = 0;
  for (i = 0; i < lap.length; i++) mean += lap[i];
  mean /= lap.length;
  variance = 0;
  for (i = 0; i < lap.length; i++)
    variance += (lap[i] - mean) * (lap[i] - mean);
  return variance / lap.length;
};

/**
 * Frame quality: face size vs frame, confidence, frontal-ness (nose x offset from face center).
 * @param {{box: object, score: number, mesh: Float32Array|Array<number>}} result
 * @param {number} frameW
 * @param {number} frameH
 * @returns {{ok: boolean, score: number, reasons: Array<string>}}
 */
FaceLiveness.qualityScore = function (result, frameW, frameH) {
  var reasons, box, ratio, conf, noseX, centerX, offset, ok, faceH, faceW;
  reasons = [];
  if (!result || !result.box)
    return { ok: false, score: 0, reasons: ["no_face"] };
  box = result.box;
  faceW = box.width;
  faceH = box.height;
  if (!faceW || !faceH) return { ok: false, score: 0, reasons: ["no_face"] };
  ratio = Math.max(faceW / (frameW || 1), faceH / (frameH || 1));
  conf = result.score || 0;
  if (conf < FACE_LIVENESS_CONFIG.qualityMinConfidence)
    reasons.push("low_confidence");
  if (ratio > FACE_LIVENESS_CONFIG.qualityMaxFaceRatio)
    reasons.push("too_close");
  else if (ratio < FACE_LIVENESS_CONFIG.qualityMinFaceRatio)
    reasons.push("too_far");
  if (result.mesh) {
    noseX = result.mesh[FACE_MESH_INDICES.noseTip * 3];
    centerX = box.x + faceW / 2;
    if (noseX !== undefined) {
      offset = Math.abs(noseX - centerX) / faceW;
      if (offset > FACE_LIVENESS_CONFIG.frontalNoseOffsetRatio)
        reasons.push("not_frontal");
    }
  }
  ok = reasons.length === 0;
  return {
    ok: ok,
    score: ok ? 1 : Math.max(0, 1 - reasons.length * 0.25),
    reasons: reasons,
  };
};

/**
 * Passive analysis over a frame window. A live subject blinks, moves slightly,
 * and produces a sharp, frontal, reasonably sized face.
 * @param {Array<{mesh: Float32Array|Array<number>, canvas: HTMLCanvasElement|null, result: object|null}>} frames
 * @returns {{live: boolean, score: number, blinkCount: number, motion: number, sharpness: number, quality: object, reasons: Array<string>}}
 */
FaceLiveness.analyzePassive = function (frames) {
  var blinks, motion, sharpness, quality, reasons, i, frame, q;
  if (!frames || frames.length === 0) {
    return {
      live: false,
      score: 0,
      blinkCount: 0,
      motion: 0,
      sharpness: 0,
      quality: { ok: false, reasons: ["no_frames"] },
      reasons: ["no_frames"],
    };
  }
  blinks = FaceLiveness.blinkScore(frames);
  motion = FaceLiveness.motionScore(frames);
  reasons = [];
  sharpness = 0;
  quality = { ok: false, reasons: [] };
  for (i = 0; i < frames.length; i++) {
    frame = frames[i];
    if (frame && frame.canvas && sharpness === 0) {
      sharpness = FaceLiveness.sharpnessScore(frame.canvas);
    }
    if (frame && frame.result && !quality.ok) {
      q = FaceLiveness.qualityScore(
        frame.result,
        frame.canvas ? frame.canvas.width : 640,
        frame.canvas ? frame.canvas.height : 480,
      );
      if (i === 0) quality = q;
      else if (q.ok) quality = q;
    }
  }
  if (blinks.count === 0) reasons.push("no_blink");
  if (motion < FACE_LIVENESS_CONFIG.motionMinVariance) reasons.push("static");
  if (sharpness > 0 && sharpness < FACE_LIVENESS_CONFIG.sharpnessMin)
    reasons.push("blurred");
  if (!quality.ok) reasons = reasons.concat(quality.reasons);
  return {
    live: reasons.length === 0,
    score: Math.max(0, 1 - reasons.length * 0.2),
    blinkCount: blinks.count,
    motion: motion,
    sharpness: sharpness,
    quality: quality,
    reasons: reasons,
  };
};

/**
 * Challenge-response engine (ISO/IEC 30107-3 style active liveness).
 * @param {object} [opts]
 * @param {Array<string>} [opts.challenges] ordered challenge types
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.maxAttempts]
 */
FaceLiveness.ChallengeEngine = function (opts) {
  var o = opts || {};
  this._challenges =
    o.challenges && o.challenges.length ? o.challenges.slice() : null;
  this._timeoutMs =
    o.timeoutMs || FACE_LIVENESS_CONFIG.activeChallengeTimeoutMs;
  this._maxAttempts = o.maxAttempts || FACE_LIVENESS_CONFIG.activeMaxAttempts;
  this._index = 0;
  this._startedAt = 0;
  this._currentDeadline = 0;
  this._attempts = 0;
  this._passed = [];
  this._failed = [];
  this._done = false;
};

/**
 * All challenge types with their frame validators.
 * @returns {object} type → {label, validate(mesh)}
 */
FaceLiveness.ChallengeEngine.VALIDATORS = {
  blink: function (mesh) {
    var left = FaceLiveness.ear(mesh, FACE_MESH_INDICES.leftEye);
    var right = FaceLiveness.ear(mesh, FACE_MESH_INDICES.rightEye);
    return (left + right) / 2 < FACE_LIVENESS_CONFIG.earBlinkThreshold;
  },
  smile: function (mesh) {
    var c1y = mesh[FACE_MESH_INDICES.lipCornerLeft * 3 + 1];
    var c2y = mesh[FACE_MESH_INDICES.lipCornerRight * 3 + 1];
    var midY = mesh[FACE_MESH_INDICES.lipUpperMid * 3 + 1];
    var lowY = mesh[FACE_MESH_INDICES.lipLowerMid * 3 + 1];
    if (
      c1y === undefined ||
      c2y === undefined ||
      midY === undefined ||
      lowY === undefined
    )
      return false;
    // corners above the upper-lip midpoint = smile; open mouth also counts
    return (c1y + c2y) / 2 < midY - 1 || lowY - midY > 2;
  },
  "turn-left": function (mesh) {
    // subject turns to their left → nose moves toward image right
    return FaceLiveness._noseOffset(mesh) > 0.18;
  },
  "turn-right": function (mesh) {
    return FaceLiveness._noseOffset(mesh) < -0.18;
  },
  "look-up": function (mesh) {
    var noseY = mesh[FACE_MESH_INDICES.noseTip * 3 + 1];
    var eyeY = FaceLiveness._eyeMidY(mesh);
    if (noseY === undefined || eyeY === null) return false;
    return noseY < eyeY - 8;
  },
  "look-down": function (mesh) {
    var noseY = mesh[FACE_MESH_INDICES.noseTip * 3 + 1];
    var eyeY = FaceLiveness._eyeMidY(mesh);
    if (noseY === undefined || eyeY === null) return false;
    return noseY > eyeY + 8;
  },
};

FaceLiveness._noseOffset = function (mesh) {
  // nose x normalized by inter-eye distance; sign = image direction
  var nx, ex1, ex2, dist;
  nx = mesh[FACE_MESH_INDICES.noseTip * 3];
  ex1 = mesh[FACE_MESH_INDICES.leftEye[3] * 3];
  ex2 = mesh[FACE_MESH_INDICES.rightEye[3] * 3];
  if (nx === undefined || ex1 === undefined || ex2 === undefined) return 0;
  dist = Math.abs(ex2 - ex1);
  if (dist === 0) return 0;
  return (nx - (ex1 + ex2) / 2) / dist;
};

FaceLiveness._eyeMidY = function (mesh) {
  var y1, y2;
  y1 = mesh[FACE_MESH_INDICES.leftEye[3] * 3 + 1];
  y2 = mesh[FACE_MESH_INDICES.rightEye[3] * 3 + 1];
  if (y1 === undefined || y2 === undefined) return null;
  return (y1 + y2) / 2;
};

FaceLiveness.CHALLENGE_LABELS = {
  blink: "Blink",
  smile: "Smile",
  "turn-left": "Turn head left",
  "turn-right": "Turn head right",
  "look-up": "Look up",
  "look-down": "Look down",
};

/**
 * Start the challenge sequence.
 * @returns {string|null} first challenge type
 */
FaceLiveness.ChallengeEngine.prototype.start = function () {
  if (!this._challenges) {
    this._challenges = [
      "blink",
      "smile",
      "turn-left",
      "turn-right",
      "look-up",
      "look-down",
    ];
    while (this._challenges.length > FACE_LIVENESS_CONFIG.activeMinChallenges) {
      this._challenges.splice(
        Math.floor(Math.random() * this._challenges.length),
        1,
      );
    }
  }
  this._index = 0;
  this._startedAt = Date.now();
  this._attempts = 0;
  this._passed = [];
  this._failed = [];
  this._done = false;
  if (this._challenges.length === 0) {
    this._done = true;
    return null;
  }
  this._currentDeadline = Date.now() + this._timeoutMs;
  return this._challenges[0];
};

/**
 * Validate a frame against the current challenge.
 * @param {Float32Array|Array<number>} mesh face mesh landmarks
 * @param {number} [now]
 * @returns {{current: string|null, passed: boolean, done: boolean, live: boolean, next: string|null}}
 */
FaceLiveness.ChallengeEngine.prototype.validate = function (mesh, now) {
  var type, validator, timedOut, deadline;
  if (this._done)
    return {
      current: null,
      passed: false,
      done: true,
      live: this._passed.length > 0,
      next: null,
    };
  if (!this._startedAt) this.start();
  now = now || Date.now();
  type = this._challenges[this._index];
  deadline = this._currentDeadline;
  timedOut = now > deadline;
  if (timedOut) {
    this._failed.push({ type: type, reason: "timeout" });
    this._attempts++;
    if (
      this._attempts >= this._maxAttempts ||
      this._index >= this._challenges.length - 1
    ) {
      this._done = true;
      return {
        current: null,
        passed: false,
        done: true,
        live: false,
        next: null,
      };
    }
    this._index++;
    this._currentDeadline = now + this._timeoutMs;
    return {
      current: this._challenges[this._index],
      passed: false,
      done: false,
      live: false,
      next: this._challenges[this._index],
    };
  }
  validator = FaceLiveness.ChallengeEngine.VALIDATORS[type];
  if (!validator || !validator(mesh)) {
    return {
      current: type,
      passed: false,
      done: false,
      live: false,
      next: null,
    };
  }
  this._passed.push({ type: type });
  this._index++;
  if (this._index >= this._challenges.length) {
    this._done = true;
    return { current: type, passed: true, done: true, live: true, next: null };
  }
  this._currentDeadline = now + this._timeoutMs;
  return {
    current: type,
    passed: true,
    done: false,
    live: false,
    next: this._challenges[this._index],
  };
};

/**
 * Remaining/passed/failed challenge summary.
 * @returns {{total: number, passed: Array<string>, failed: Array<string>, done: boolean}}
 */
FaceLiveness.ChallengeEngine.prototype.summary = function () {
  return {
    total: this._challenges ? this._challenges.length : 0,
    passed: this._passed.map(function (p) {
      return p.type;
    }),
    failed: this._failed.map(function (f) {
      return f.type;
    }),
    done: this._done,
  };
};

/**
 * Optional PAD stage (ISO/IEC 30107-3): classify a frame with the MiniFASNetV2
 * classifier when the FaceAntiSpoof module is present. Never throws — when the
 * model cannot be loaded the caller keeps the heuristic result.
 * @param {HTMLCanvasElement} canvas
 * @param {{x:number, y:number, width:number, height:number}} [box]
 * @returns {Promise<object|null>} null when the module is unavailable
 */
FaceLiveness.antiSpoofCheck = async function (canvas, box) {
  var res;
  if (
    typeof FaceAntiSpoof === "undefined" ||
    !canvas ||
    typeof canvas.getContext !== "function"
  )
    return null;
  try {
    if (!FaceAntiSpoof.isReady() && !(await FaceAntiSpoof.load())) {
      return {
        available: true,
        ready: false,
        error: FaceAntiSpoof.getError() || "load-failed",
      };
    }
    res = await FaceAntiSpoof.predict(canvas, box);
    return {
      model: FaceAntiSpoof.VERSION,
      available: true,
      ready: true,
      live: !!res.live,
      score: res.score,
      label: res.label,
      probabilities: res.probabilities ? Array.from(res.probabilities) : null,
      backend: FaceAntiSpoof.getBackend() || null,
    };
  } catch (e) {
    return {
      model: "minifasnet-v2",
      available: true,
      ready: false,
      error: e.message,
    };
  }
};

/**
 * Orchestrate passive (+ optional active) liveness over live frames.
 * @param {object} camera object with captureFrame()
 * @param {object} engine FaceEngine-like with detectFaces(input)
 * @param {object} [opts]
 * @param {string} [opts.mode] "passive" | "active" | "both" (default "passive")
 * @param {number} [opts.frames] passive frame count
 * @param {number} [opts.challengeCount]
 * @param {boolean} [opts.antiSpoof] run the MiniFASNet PAD stage (default true when the module is present)
 * @param {Function} [opts.onChallenge] called when the active challenge changes:
 *     onChallenge({type: string|null, index: number, total: number, done: boolean})
 * @returns {Promise<object>} evidence {live, score, mode, blinkCount, motion, sharpness, quality, passedChallenges, failedChallenges, antiSpoof, durationMs, timestamp}
 */
FaceLiveness.prototype.verifyLiveness = async function (camera, engine, opts) {
  var mode,
    frames,
    passive,
    evidence,
    challengeEngine,
    type,
    currentType,
    started,
    result,
    i,
    canvas,
    detection,
    total,
    notifyChallenge,
    activeDeadline,
    as,
    asFrame;
  mode = opts && opts.mode ? opts.mode : "passive";
  started = Date.now();
  if (!camera || !camera.captureFrame) {
    return {
      live: false,
      score: 0,
      mode: mode,
      reasons: ["no_camera"],
      durationMs: 0,
      timestamp: new Date().toISOString(),
    };
  }
  frames = [];
  if (mode === "passive" || mode === "both") {
    for (
      i = 0;
      i <
      (opts && opts.frames ? opts.frames : FACE_LIVENESS_CONFIG.captureFrames);
      i++
    ) {
      canvas = camera.captureFrame();
      if (!canvas) continue;
      detection = null;
      if (engine && engine.detectFaces) {
        try {
          detection = await engine.detectFaces(canvas);
        } catch (e) {
          detection = null;
        }
      }
      frames.push({
        canvas: canvas,
        result: detection && detection.length > 0 ? detection[0] : null,
        mesh: detection && detection.length > 0 ? detection[0].mesh : null,
      });
    }
    passive = FaceLiveness.analyzePassive(frames);
  }
  evidence = {
    live: passive ? passive.live : false,
    score: passive ? passive.score : 0,
    mode: mode,
    blinkCount: passive ? passive.blinkCount : 0,
    motion: passive ? passive.motion : 0,
    sharpness: passive ? passive.sharpness : 0,
    quality: passive
      ? passive.quality
      : { ok: false, reasons: ["not_analyzed"] },
    reasons: passive ? passive.reasons : [],
    passedChallenges: [],
    failedChallenges: [],
    durationMs: Date.now() - started,
    timestamp: new Date().toISOString(),
  };
  if (mode === "active" || mode === "both") {
    if (!passive || passive.live) {
      challengeEngine = new FaceLiveness.ChallengeEngine({
        challenges: opts && opts.challengeCount ? null : null,
        timeoutMs:
          opts && opts.timeoutMs
            ? opts.timeoutMs
            : FACE_LIVENESS_CONFIG.activeChallengeTimeoutMs,
      });
      if (opts && opts.challenges && opts.challenges.length) {
        challengeEngine._challenges = opts.challenges.slice();
      }
      total = challengeEngine._challenges.length;
      notifyChallenge = opts && opts.onChallenge ? opts.onChallenge : null;
      // Overall guard: fail safely even if the loop can never validate a mesh
      // (e.g. no face in view) — per-challenge budget times challenges plus slack.
      activeDeadline = Date.now() + challengeEngine._timeoutMs * (total + 1);
      type = challengeEngine.start();
      currentType = type;
      if (notifyChallenge)
        notifyChallenge({ type: type, index: 0, total: total, done: false });
      while (type !== null && !challengeEngine._done) {
        if (Date.now() > activeDeadline) {
          challengeEngine._done = true;
          if (notifyChallenge)
            notifyChallenge({
              type: null,
              index: challengeEngine._index,
              total: total,
              done: true,
            });
          break;
        }
        canvas = camera.captureFrame();
        detection = null;
        if (canvas && engine && engine.detectFaces) {
          try {
            detection = await engine.detectFaces(canvas);
          } catch (e) {
            detection = null;
          }
        }
        if (detection && detection.length > 0 && detection[0].mesh) {
          result = challengeEngine.validate(detection[0].mesh);
          if (
            notifyChallenge &&
            (result.done || (result.next && result.next !== currentType))
          ) {
            currentType = result.done ? null : result.next;
            notifyChallenge({
              type: currentType,
              index: Math.min(challengeEngine._index, total - 1),
              total: total,
              done: result.done,
            });
          }
          if (result.done) break;
        }
      }
      evidence.passedChallenges = challengeEngine.summary().passed;
      evidence.failedChallenges = challengeEngine.summary().failed;
      evidence.live =
        challengeEngine._done && challengeEngine.summary().passed.length > 0;
      evidence.score =
        challengeEngine.summary().passed.length /
        Math.max(1, challengeEngine.summary().total);
      evidence.durationMs = Date.now() - started;
    } else {
      evidence.live = false;
    }
  }
  // PAD stage: when the MiniFASNet module is present, a spoof verdict
  // (print/replay) overrides the heuristic result.
  if (!opts || opts.antiSpoof !== false) {
    asFrame = null;
    for (i = frames.length - 1; i >= 0; i--) {
      if (frames[i] && frames[i].canvas) {
        asFrame = frames[i];
        break;
      }
    }
    if (asFrame) {
      as = await FaceLiveness.antiSpoofCheck(
        asFrame.canvas,
        asFrame.result && asFrame.result.box ? asFrame.result.box : null,
      );
      if (as) {
        evidence.antiSpoof = as;
        if (as.ready && !as.live) {
          evidence.live = false;
          if (
            as.score !== undefined &&
            as.score < FACE_LIVENESS_CONFIG.antiSpoofMinScore
          ) {
            evidence.reasons = evidence.reasons.concat("anti_spoof");
          }
        }
      }
    }
  }
  return evidence;
};

/* c8 ignore start */
if (typeof window !== "undefined") window.FaceLiveness = FaceLiveness;
/* c8 ignore stop */

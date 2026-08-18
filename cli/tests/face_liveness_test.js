const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── GPL polyfills ──
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };

// ── Load FaceLiveness source ──
const livenessSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_liveness.js"),
  "utf8",
);
vm.runInThisContext(livenessSrc, {
  filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_liveness.js"),
});

// ── Synthetic landmark helpers ──

// MediaPipe mesh indices
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const NOSE = 1;
const LIP_L = 61;
const LIP_R = 291;
const LIP_U = 13;
const LIP_D = 14;
const EYE_L_INNER = 133; // left eye inner corner (x anchor)
const EYE_R_INNER = 362; // right eye inner corner (x anchor)
const EYE_L_INNER_Y = 133; // y anchor for eye line

/**
 * Build a 468x3 zero-filled mesh.
 */
function emptyMesh() {
  return new Float32Array(468 * 3);
}

/**
 * Place an eye: 6 points [outer, upL, upR, inner, downR, downL] at given x-center.
 * EAR of the eye is (d1+d2)/(2*d3) — controlled via eyeHeight.
 * @param {Float32Array} mesh
 * @param {Array<number>} indices 6 EAR point indices
 * @param {number} cx
 * @param {number} cy
 * @param {number} eyeHeight vertical opening
 * @param {number} eyeWidth horizontal span
 */
function placeEye(mesh, indices, cx, cy, eyeHeight, eyeWidth) {
  const [outer, upL, upR, inner, downR, downL] = indices;
  mesh[outer * 3] = cx - eyeWidth / 2;
  mesh[outer * 3 + 1] = cy;
  mesh[inner * 3] = cx + eyeWidth / 2;
  mesh[inner * 3 + 1] = cy;
  mesh[upL * 3] = cx - eyeWidth / 4;
  mesh[upL * 3 + 1] = cy - eyeHeight;
  mesh[upR * 3] = cx + eyeWidth / 4;
  mesh[upR * 3 + 1] = cy - eyeHeight;
  mesh[downR * 3] = cx + eyeWidth / 4;
  mesh[downR * 3 + 1] = cy + eyeHeight;
  mesh[downL * 3] = cx - eyeWidth / 4;
  mesh[downL * 3 + 1] = cy + eyeHeight;
}

/**
 * Two open eyes with configurable eye height (open = 8, blink = 2).
 */
function faceWithEyes(eyeHeightL, eyeHeightR, noseOffsetX) {
  const mesh = emptyMesh();
  placeEye(mesh, LEFT_EYE, 250, 200, eyeHeightL === undefined ? 8 : eyeHeightL, 60);
  placeEye(mesh, RIGHT_EYE, 390, 200, eyeHeightR === undefined ? 8 : eyeHeightR, 60);
  mesh[NOSE * 3] = 320 + (noseOffsetX || 0);
  mesh[NOSE * 3 + 1] = 260;
  // inner eye corners (for nose offset normalization)
  mesh[EYE_L_INNER * 3] = 280;
  mesh[EYE_R_INNER * 3] = 360;
  mesh[EYE_L_INNER_Y * 3 + 1] = 200;
  mesh[EYE_R_INNER * 3 + 1] = 200;
  return mesh;
}

/**
 * Frame wrapper {mesh}.
 */
function frame(mesh) {
  return { mesh: mesh };
}

// ── EAR ──

describe("FaceLiveness — ear", () => {
  it("returns 0 for null input", () => {
    assert.equal(globalThis.FaceLiveness.ear(null, LEFT_EYE), 0);
    assert.equal(globalThis.FaceLiveness.ear(new Float32Array(10), LEFT_EYE), 0);
  });

  it("is high for an open eye and low for a closed eye", () => {
    const open = faceWithEyes(10, 10);
    const closed = faceWithEyes(2, 2);
    const earOpen = globalThis.FaceLiveness.ear(open, LEFT_EYE);
    const earClosed = globalThis.FaceLiveness.ear(closed, LEFT_EYE);
    assert.ok(earOpen > 0.3, `open EAR ${earOpen} should be > 0.3`);
    assert.ok(earClosed < 0.2, `closed EAR ${earClosed} should be < 0.2`);
  });
});

// ── blinkScore ──

describe("FaceLiveness — blinkScore", () => {
  it("returns zeros for empty input", () => {
    const r = globalThis.FaceLiveness.blinkScore([]);
    assert.equal(r.count, 0);
    assert.deepEqual(r.earSeries, []);
  });

  it("counts two blinks in a frame window", () => {
    const open = faceWithEyes(8, 8);
    const blink = faceWithEyes(2, 2);
    const frames = [open, blink, open, open, blink, open].map(frame);
    const r = globalThis.FaceLiveness.blinkScore(frames);
    assert.equal(r.count, 2);
    assert.equal(r.earSeries.length, 6);
  });

  it("counts zero blinks when eyes stay open", () => {
    const frames = [faceWithEyes(8, 8), faceWithEyes(8, 8), faceWithEyes(8, 8)].map(frame);
    assert.equal(globalThis.FaceLiveness.blinkScore(frames).count, 0);
  });

  it("handles frames without mesh", () => {
    const frames = [{ mesh: null }, { mesh: null }];
    assert.equal(globalThis.FaceLiveness.blinkScore(frames).count, 0);
  });
});

// ── motionScore ──

describe("FaceLiveness — motionScore", () => {
  it("returns 0 for fewer than 2 frames", () => {
    assert.equal(globalThis.FaceLiveness.motionScore([]), 0);
    assert.equal(globalThis.FaceLiveness.motionScore([frame(faceWithEyes(8, 8))]), 0);
  });

  it("is ~0 for a static subject", () => {
    const m = faceWithEyes(8, 8);
    const frames = [frame(m), frame(m), frame(m)];
    assert.ok(globalThis.FaceLiveness.motionScore(frames) < 0.00001);
  });

  it("is positive when the nose moves between frames", () => {
    const f1 = faceWithEyes(8, 8);
    const f2 = faceWithEyes(8, 8);
    const f3 = faceWithEyes(8, 8);
    f2[NOSE * 3] += 3;
    f3[NOSE * 3] += 7;
    const frames = [frame(f1), frame(f2), frame(f3)];
    assert.ok(globalThis.FaceLiveness.motionScore(frames) > 0.0001);
  });
});

// ── sharpnessScore ──

describe("FaceLiveness — sharpnessScore", () => {
  let canvas;

  beforeEach(() => {
    const { createCanvas } = require("canvas");
    canvas = createCanvas(64, 64);
  });

  it("returns 0 for missing canvas", () => {
    assert.equal(globalThis.FaceLiveness.sharpnessScore(null), 0);
    assert.equal(globalThis.FaceLiveness.sharpnessScore({}), 0);
  });

  it("is ~0 for a blank canvas and high for a noisy one", () => {
    const { createCanvas } = require("canvas");
    const blank = createCanvas(64, 64);
    const noisy = createCanvas(64, 64);
    const nctx = noisy.getContext("2d");
    const img = nctx.createImageData(64, 64);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (i / 7) % 255;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
    const blankScore = globalThis.FaceLiveness.sharpnessScore(blank);
    const noisyScore = globalThis.FaceLiveness.sharpnessScore(noisy);
    assert.ok(blankScore < 1, `blank ${blankScore} should be near 0`);
    assert.ok(noisyScore > 100, `noisy ${noisyScore} should be high`);
  });
});

// ── qualityScore ──

describe("FaceLiveness — qualityScore", () => {
  it("fails when no box", () => {
    const q = globalThis.FaceLiveness.qualityScore({ score: 0.9 }, 640, 480);
    assert.equal(q.ok, false);
    assert.ok(q.reasons.includes("no_face"));
  });

  it("passes for a well-placed frontal face", () => {
    const mesh = faceWithEyes(8, 8, 0);
    const q = globalThis.FaceLiveness.qualityScore(
      { box: { x: 200, y: 100, width: 240, height: 300 }, score: 0.9, mesh: mesh },
      640,
      480,
    );
    assert.equal(q.ok, true);
    assert.deepEqual(q.reasons, []);
  });

  it("rejects low confidence", () => {
    const q = globalThis.FaceLiveness.qualityScore(
      { box: { x: 200, y: 100, width: 240, height: 300 }, score: 0.1 },
      640,
      480,
    );
    assert.ok(q.reasons.includes("low_confidence"));
  });

  it("rejects a face that is too small", () => {
    const q = globalThis.FaceLiveness.qualityScore(
      { box: { x: 300, y: 220, width: 20, height: 20 }, score: 0.9 },
      640,
      480,
    );
    assert.ok(q.reasons.includes("too_far"));
  });

  it("rejects a non-frontal profile when nose is offset", () => {
    const mesh = faceWithEyes(8, 8, 60); // nose shifted right
    const q = globalThis.FaceLiveness.qualityScore(
      { box: { x: 200, y: 100, width: 240, height: 300 }, score: 0.9, mesh: mesh },
      640,
      480,
    );
    assert.ok(q.reasons.includes("not_frontal"));
  });
});

// ── analyzePassive ──

describe("FaceLiveness — analyzePassive", () => {
  it("fails with no frames", () => {
    const r = globalThis.FaceLiveness.analyzePassive([]);
    assert.equal(r.live, false);
    assert.ok(r.reasons.includes("no_frames"));
  });

  it("passes for blinking, moving, sharp frontal frames", () => {
    const open = faceWithEyes(8, 8);
    const blink = faceWithEyes(2, 2);
    const moving = faceWithEyes(8, 8);
    moving[NOSE * 3] += 2;
    const frames = [frame(open), frame(blink), frame(moving)];
    const r = globalThis.FaceLiveness.analyzePassive(frames);
    assert.equal(r.live, true);
    assert.equal(r.blinkCount, 1);
  });

  it("fails when the subject never blinks", () => {
    const frames = [frame(faceWithEyes(8, 8)), frame(faceWithEyes(8, 8))];
    const r = globalThis.FaceLiveness.analyzePassive(frames);
    assert.equal(r.live, false);
    assert.ok(r.reasons.includes("no_blink"));
  });
});

// ── ChallengeEngine ──

describe("FaceLiveness — ChallengeEngine", () => {
  it("passes all challenges with matching frames", () => {
    const engine = new globalThis.FaceLiveness.ChallengeEngine({
      challenges: ["blink", "smile", "turn-left", "look-up"],
      maxAttempts: 1,
    });
    assert.equal(engine.start(), "blink");
    let r = engine.validate(faceWithEyes(2, 2)); // blink
    assert.equal(r.passed, true);
    assert.equal(r.next, "smile");
    r = engine.validate(smileMesh());
    assert.equal(r.passed, true);
    assert.equal(r.next, "turn-left");
    r = engine.validate(turnMesh(1));
    assert.equal(r.passed, true);
    assert.equal(r.next, "look-up");
    r = engine.validate(lookMesh(1));
    assert.equal(r.passed, true);
    assert.equal(r.done, true);
    assert.equal(r.live, true);
  });

  it("fails after exceeding max attempts on timeouts", () => {
    const engine = new globalThis.FaceLiveness.ChallengeEngine({
      challenges: ["blink"],
      maxAttempts: 2,
      timeoutMs: 50,
    });
    engine.start();
    const now = Date.now() + 100;
    engine.validate(faceWithEyes(8, 8), now); // wrong action
    engine.validate(faceWithEyes(8, 8), now + 100); // wrong action again
    const r = engine.validate(faceWithEyes(8, 8), now + 200);
    assert.equal(r.done, true);
    assert.equal(r.live, false);
  });

  it("treats validate() after done as no-op", () => {
    const engine = new globalThis.FaceLiveness.ChallengeEngine({
      challenges: ["blink"],
      maxAttempts: 1,
    });
    engine.start();
    engine.validate(faceWithEyes(2, 2));
    const r = engine.validate(faceWithEyes(8, 8));
    assert.equal(r.done, true);
    assert.equal(r.passed, false);
  });

  it("starts with a random 3-challenge set when none given", () => {
    const engine = new globalThis.FaceLiveness.ChallengeEngine({});
    const first = engine.start();
    assert.notEqual(first, null);
    const summary = engine.summary();
    assert.equal(summary.total, 3);
  });
});

function smileMesh() {
  const mesh = faceWithEyes(8, 8);
  mesh[LIP_L * 3 + 1] = 330; // corners raised above upper-lip mid
  mesh[LIP_R * 3 + 1] = 330;
  mesh[LIP_U * 3 + 1] = 340;
  mesh[LIP_D * 3 + 1] = 360;
  return mesh;
}

function turnMesh(dir) {
  const mesh = faceWithEyes(8, 8);
  // inner-corner distance = 140, eye mid = 350 → 60px gives |offset| = 0.43 (> 0.18)
  mesh[NOSE * 3] = 320 + 60 * dir;
  return mesh;
}

function lookMesh(dir) {
  const mesh = faceWithEyes(8, 8);
  // up = +1 → nose rises well above the eye line (190 < 192); down = -1 → 330 > 208
  mesh[NOSE * 3 + 1] = 260 - 70 * dir;
  return mesh;
}

// ── verifyLiveness orchestration ──

describe("FaceLiveness — verifyLiveness", () => {
  let liveness;

  beforeEach(() => {
    liveness = new globalThis.FaceLiveness();
  });

  it("fails fast when camera is missing", async () => {
    const r = await liveness.verifyLiveness(null, null, { mode: "passive" });
    assert.equal(r.live, false);
    assert.ok(r.reasons.includes("no_camera"));
  });

  it("passes passive mode with a blinking fake camera", async () => {
    const open1 = faceWithEyes(8, 8);
    const open2 = faceWithEyes(8, 8);
    open2[NOSE * 3] += 3;
    const open3 = faceWithEyes(8, 8);
    open3[NOSE * 3] += 6;
    const blink = faceWithEyes(2, 2);
    const frames = [open1, blink, open2, open3];
    let idx = 0;
    const camera = {
      captureFrame: function () {
        const canvas = makeCanvas();
        camera._lastMesh = frames[idx % frames.length];
        idx++;
        return canvas;
      },
    };
    const engine = {
      detectFaces: async function () {
        return [{ box: { x: 200, y: 100, width: 240, height: 300 }, score: 0.9, mesh: camera._lastMesh }];
      },
    };
    const r = await liveness.verifyLiveness(camera, engine, { mode: "passive", frames: 4 });
    assert.equal(r.live, true);
    assert.equal(r.blinkCount, 1);
    assert.equal(r.mode, "passive");
  });

  it("fails passive mode when subject is static and never blinks", async () => {
    const m = faceWithEyes(8, 8);
    const camera = {
      captureFrame: function () {
        return makeCanvas();
      },
      _mesh: m,
    };
    const engine = {
      detectFaces: async function () {
        return [{ box: { x: 200, y: 100, width: 240, height: 300 }, score: 0.9, mesh: camera._mesh }];
      },
    };
    const r = await liveness.verifyLiveness(camera, engine, { mode: "passive", frames: 3 });
    assert.equal(r.live, false);
    assert.ok(r.reasons.includes("no_blink"));
  });

  it("runs active challenges in both mode", async () => {
    // passive phase passes (blink + motion), then active challenges run
    const open1 = faceWithEyes(8, 8);
    const open2 = faceWithEyes(8, 8);
    open2[NOSE * 3] += 3;
    const blink = faceWithEyes(2, 2);
    const challengeFrames = [faceWithEyes(2, 2), smileMesh(), turnMesh(1), lookMesh(1)];
    const sequence = [open1, blink, open2, open1, ...challengeFrames];
    let idx = 0;
    const camera = {
      captureFrame: function () {
        camera._mesh = sequence[idx % sequence.length];
        idx++;
        return makeCanvas();
      },
    };
    const engine = {
      detectFaces: async function () {
        return [{ box: { x: 200, y: 100, width: 240, height: 300 }, score: 0.9, mesh: camera._mesh }];
      },
    };
    const r = await liveness.verifyLiveness(camera, engine, {
      mode: "both",
      frames: 4,
      challenges: ["blink", "smile", "turn-left", "look-up"],
      timeoutMs: 500,
    });
    assert.equal(r.live, true);
    assert.ok(r.passedChallenges.length >= 4);
  });

  it("notifies the current challenge via onChallenge and ends with null", async () => {
    const open1 = faceWithEyes(8, 8);
    const open2 = faceWithEyes(8, 8);
    open2[NOSE * 3] += 3;
    const blink = faceWithEyes(2, 2);
    const challengeFrames = [faceWithEyes(2, 2), smileMesh(), turnMesh(1), lookMesh(1)];
    const sequence = [open1, blink, open2, open1, ...challengeFrames];
    let idx = 0;
    const camera = {
      captureFrame: function () {
        camera._mesh = sequence[idx % sequence.length];
        idx++;
        return makeCanvas();
      },
    };
    const engine = {
      detectFaces: async function () {
        return [{ box: { x: 200, y: 100, width: 240, height: 300 }, score: 0.9, mesh: camera._mesh }];
      },
    };
    const notified = [];
    await liveness.verifyLiveness(camera, engine, {
      mode: "both",
      frames: 4,
      challenges: ["blink", "smile", "turn-left", "look-up"],
      timeoutMs: 500,
      onChallenge: function (c) {
        notified.push(c.type);
      },
    });
    assert.deepEqual(notified, ["blink", "smile", "turn-left", "look-up", null]);
  });

  it("times out safely when no face mesh ever appears in active mode", async () => {
    const camera = {
      captureFrame: function () {
        return makeCanvas();
      },
    };
    const engine = {
      detectFaces: async function () {
        return [];
      },
    };
    const started = Date.now();
    const r = await liveness.verifyLiveness(camera, engine, {
      mode: "active",
      challenges: ["blink", "smile"],
      timeoutMs: 100,
    });
    assert.equal(r.live, false);
    assert.ok(Date.now() - started < 5000, "must fail fast via the overall deadline");
  });
});

function makeCanvas() {
  const { createCanvas } = require("canvas");
  const c = createCanvas(640, 480);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(640, 480);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (i / 7) % 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

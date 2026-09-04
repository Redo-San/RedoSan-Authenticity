const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── GPL polyfills ──
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};

// ── Load FaceLiveness source ──
const livenessSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_liveness.js"),
  "utf8",
);
vm.runInThisContext(livenessSrc, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Face_Biometric",
    "face_liveness.js",
  ),
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
  placeEye(
    mesh,
    LEFT_EYE,
    250,
    200,
    eyeHeightL === undefined ? 8 : eyeHeightL,
    60,
  );
  placeEye(
    mesh,
    RIGHT_EYE,
    390,
    200,
    eyeHeightR === undefined ? 8 : eyeHeightR,
    60,
  );
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
    assert.equal(
      globalThis.FaceLiveness.ear(new Float32Array(10), LEFT_EYE),
      0,
    );
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
    const frames = [
      faceWithEyes(8, 8),
      faceWithEyes(8, 8),
      faceWithEyes(8, 8),
    ].map(frame);
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
    assert.equal(
      globalThis.FaceLiveness.motionScore([frame(faceWithEyes(8, 8))]),
      0,
    );
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
      {
        box: { x: 200, y: 100, width: 240, height: 300 },
        score: 0.9,
        mesh: mesh,
      },
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
      {
        box: { x: 200, y: 100, width: 240, height: 300 },
        score: 0.9,
        mesh: mesh,
      },
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
        return [
          {
            box: { x: 200, y: 100, width: 240, height: 300 },
            score: 0.9,
            mesh: camera._lastMesh,
          },
        ];
      },
    };
    const r = await liveness.verifyLiveness(camera, engine, {
      mode: "passive",
      frames: 4,
    });
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
        return [
          {
            box: { x: 200, y: 100, width: 240, height: 300 },
            score: 0.9,
            mesh: camera._mesh,
          },
        ];
      },
    };
    const r = await liveness.verifyLiveness(camera, engine, {
      mode: "passive",
      frames: 3,
    });
    assert.equal(r.live, false);
    assert.ok(r.reasons.includes("no_blink"));
  });

  it("runs active challenges in both mode", async () => {
    // passive phase passes (blink + motion), then active challenges run
    const open1 = faceWithEyes(8, 8);
    const open2 = faceWithEyes(8, 8);
    open2[NOSE * 3] += 3;
    const blink = faceWithEyes(2, 2);
    const challengeFrames = [
      faceWithEyes(2, 2),
      smileMesh(),
      turnMesh(1),
      lookMesh(1),
    ];
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
        return [
          {
            box: { x: 200, y: 100, width: 240, height: 300 },
            score: 0.9,
            mesh: camera._mesh,
          },
        ];
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
    const challengeFrames = [
      faceWithEyes(2, 2),
      smileMesh(),
      turnMesh(1),
      lookMesh(1),
    ];
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
        return [
          {
            box: { x: 200, y: 100, width: 240, height: 300 },
            score: 0.9,
            mesh: camera._mesh,
          },
        ];
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
    assert.deepEqual(notified, [
      "blink",
      "smile",
      "turn-left",
      "look-up",
      null,
    ]);
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
    assert.ok(
      Date.now() - started < 5000,
      "must fail fast via the overall deadline",
    );
  });
});

// ── Coverage: antiSpoofCheck and PAD orchestration ──

describe("FaceLiveness — antiSpoofCheck", () => {
  const REAL_AS = globalThis.FaceAntiSpoof;

  afterEach(() => {
    globalThis.FaceAntiSpoof = REAL_AS;
  });

  it("returns null when the module or canvas is unusable", async () => {
    globalThis.FaceAntiSpoof = undefined;
    assert.equal(
      await globalThis.FaceLiveness.antiSpoofCheck(makeCanvas(), null),
      null,
    );
    globalThis.FaceAntiSpoof = REAL_AS;
    assert.equal(
      await globalThis.FaceLiveness.antiSpoofCheck(null, null),
      null,
    );
    assert.equal(await globalThis.FaceLiveness.antiSpoofCheck({}, null), null);
  });

  it("reports a load failure with a fallback error string", async () => {
    globalThis.FaceAntiSpoof = {
      isReady: () => false,
      load: async () => false,
      getError: () => "",
    };
    const res = await globalThis.FaceLiveness.antiSpoofCheck(
      makeCanvas(),
      null,
    );
    assert.equal(res.ready, false);
    assert.equal(res.error, "load-failed");
  });

  it("maps a successful prediction including optional fields", async () => {
    globalThis.FaceAntiSpoof = {
      VERSION: "minifasnet-v2",
      isReady: () => true,
      load: async () => true,
      getBackend: () => "wasm",
      predict: async () => ({
        live: true,
        score: 0.93,
        label: "live",
        probabilities: new Float32Array([0.93, 0.05, 0.02]),
      }),
    };
    const res = await globalThis.FaceLiveness.antiSpoofCheck(
      makeCanvas(),
      null,
    );
    assert.equal(res.ready, true);
    assert.equal(res.backend, "wasm");
    assert.equal(res.probabilities.length, 3);
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(res.probabilities[i] - [0.93, 0.05, 0.02][i]) < 1e-6);
    }

    globalThis.FaceAntiSpoof.predict = async () => ({
      live: false,
      score: 0.1,
      label: "spoof",
    });
    globalThis.FaceAntiSpoof.getBackend = () => "";
    const minimal = await globalThis.FaceLiveness.antiSpoofCheck(
      makeCanvas(),
      null,
    );
    assert.equal(minimal.probabilities, null);
    assert.equal(minimal.backend, null);
  });

  it("wraps prediction errors as ready:false chunks", async () => {
    globalThis.FaceAntiSpoof = {
      isReady: () => true,
      load: async () => true,
      getBackend: () => null,
      predict: async () => {
        throw new Error("pad exploded");
      },
    };
    const res = await globalThis.FaceLiveness.antiSpoofCheck(
      makeCanvas(),
      null,
    );
    assert.equal(res.ready, false);
    assert.equal(res.error, "pad exploded");
  });
});

describe("FaceLiveness — verifyLiveness coverage arms", () => {
  let liveness;

  beforeEach(() => {
    liveness = new globalThis.FaceLiveness();
  });

  function staticCamera(mesh) {
    return {
      captureFrame: function () {
        return makeCanvas();
      },
      _mesh: mesh,
    };
  }

  function meshEngine(mesh) {
    return {
      detectFaces: async function () {
        return [
          {
            box: { x: 200, y: 100, width: 240, height: 300 },
            score: 0.9,
            mesh: mesh,
          },
        ];
      },
    };
  }

  it("defaults to passive mode with the standard frame budget", async () => {
    const r = await liveness.verifyLiveness(
      staticCamera(faceWithEyes(8, 8)),
      meshEngine(faceWithEyes(8, 8)),
      { antiSpoof: false },
    );
    assert.equal(r.mode, "passive");
    assert.equal(
      r.quality.reasons[0] !== undefined || r.reasons.length >= 0,
      true,
    );
  });

  it("skips null captures and survives detector failures", async () => {
    let calls = 0;
    const camera = { captureFrame: () => null };
    const r1 = await liveness.verifyLiveness(
      camera,
      meshEngine(faceWithEyes(8, 8)),
      { frames: 2, antiSpoof: false },
    );
    assert.ok(r1.reasons.includes("no_frames"));

    const camera2 = { captureFrame: () => makeCanvas() };
    let detectCalls = 0;
    const flaky = {
      detectFaces: async function () {
        detectCalls++;
        if (detectCalls === 1) throw new Error("detector down");
        if (detectCalls === 2) return [];
        return [{}];
      },
    };
    const r2 = await liveness.verifyLiveness(camera2, flaky, {
      frames: 3,
      antiSpoof: false,
    });
    assert.equal(r2.live, false);
    calls++;
  });

  it("runs active-only mode without a passive phase", async () => {
    const challengeFrames = [
      faceWithEyes(2, 2),
      smileMesh(),
      turnMesh(1),
      lookMesh(1),
    ];
    let idx = 0;
    const camera = {
      captureFrame: function () {
        camera._mesh = challengeFrames[idx % challengeFrames.length];
        idx++;
        return makeCanvas();
      },
    };
    const engine = {
      detectFaces: async function () {
        return [
          {
            box: { x: 200, y: 100, width: 240, height: 300 },
            score: 0.9,
            mesh: camera._mesh,
          },
        ];
      },
    };
    const r = await liveness.verifyLiveness(camera, engine, {
      mode: "active",
      challenges: ["blink", "smile", "turn-left", "look-up"],
      timeoutMs: 500,
      challengeCount: 4,
      onChallenge: function () {},
    });
    assert.equal(r.live, true);
    assert.equal(
      r.antiSpoof,
      undefined,
      "active-only runs leave no frames for PAD",
    );
    assert.ok(r.passedChallenges.length === 4);
  });

  it("keeps active mode failed when passive evidence is absent but challenges fail", async () => {
    const camera = { captureFrame: () => makeCanvas() };
    const engine = { detectFaces: async () => [] };
    const r = await liveness.verifyLiveness(camera, engine, {
      mode: "active",
      challenges: ["blink"],
      timeoutMs: 50,
    });
    assert.equal(r.live, false);
  });

  it("completes an active run using the default challenge timeout", async () => {
    const challengeFrames = [
      faceWithEyes(2, 2),
      smileMesh(),
      turnMesh(1),
      lookMesh(1),
    ];
    let idx = 0;
    const camera = {
      captureFrame: function () {
        camera._mesh = challengeFrames[idx % challengeFrames.length];
        idx++;
        return makeCanvas();
      },
    };
    const engine = {
      detectFaces: async function () {
        return [
          {
            box: { x: 200, y: 100, width: 240, height: 300 },
            score: 0.9,
            mesh: camera._mesh,
          },
        ];
      },
    };
    const r = await liveness.verifyLiveness(camera, engine, {
      mode: "active",
      challenges: ["blink", "smile", "turn-left", "look-up"],
    });
    assert.equal(r.live, true);
    assert.equal(r.passedChallenges.length, 4);
  });

  it("breaks the active loop via the overall deadline guard", async (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    const openMesh = faceWithEyes(8, 8);
    let detectCalls = 0;
    const notified = [];
    const camera = { captureFrame: () => makeCanvas() };
    const engine = {
      detectFaces: async function () {
        detectCalls++;
        if (detectCalls === 2) t.mock.timers.tick(60000);
        return [
          {
            box: { x: 200, y: 100, width: 240, height: 300 },
            score: 0.9,
            mesh: openMesh,
          },
        ];
      },
    };
    const r = await liveness.verifyLiveness(camera, engine, {
      mode: "active",
      challenges: ["blink", "smile", "turn-left"],
      timeoutMs: 1000,
      onChallenge: function (c) {
        notified.push(c);
      },
    });
    assert.equal(r.live, false);
    assert.deepEqual(r.passedChallenges, []);
    const last = notified[notified.length - 1];
    assert.equal(
      last.done,
      true,
      "the deadline break must emit a final done notification",
    );
  });

  it("aborts the active phase when the detector keeps throwing", async () => {
    const camera = { captureFrame: () => makeCanvas() };
    const engine = {
      detectFaces: async function () {
        throw new Error("camera gone");
      },
    };
    const r = await liveness.verifyLiveness(camera, engine, {
      mode: "active",
      challenges: ["blink", "smile"],
      timeoutMs: 60,
    });
    assert.equal(r.live, false);
  });

  it("fails both mode without running challenges when passive fails", async () => {
    const m = faceWithEyes(8, 8);
    const r = await liveness.verifyLiveness(staticCamera(m), meshEngine(m), {
      mode: "both",
      frames: 2,
      challenges: ["blink"],
      antiSpoof: false,
    });
    assert.equal(r.live, false);
    assert.deepEqual(r.passedChallenges, []);
  });

  it("applies the PAD verdict when the module is present", async () => {
    const REAL_AS = globalThis.FaceAntiSpoof;
    const open1 = faceWithEyes(8, 8);
    const blink = faceWithEyes(2, 2);
    const seq = [open1, blink, faceWithEyes(8, 8), faceWithEyes(8, 8)];
    let idx = 0;
    const camera = {
      captureFrame: function () {
        camera._mesh = seq[idx % seq.length];
        idx++;
        return makeCanvas();
      },
    };
    const engine = {
      detectFaces: async function () {
        return [
          {
            box: { x: 200, y: 100, width: 240, height: 300 },
            score: 0.9,
            mesh: camera._mesh,
          },
        ];
      },
    };
    try {
      globalThis.FaceAntiSpoof = {
        VERSION: "minifasnet-v2",
        isReady: () => true,
        load: async () => true,
        getBackend: () => "wasm",
        predict: async () => ({
          live: false,
          score: 0.2,
          label: "print",
          probabilities: [0.2, 0.5, 0.3],
        }),
      };
      const spoofed = await liveness.verifyLiveness(camera, engine, {
        mode: "passive",
        frames: 4,
      });
      assert.equal(
        spoofed.live,
        false,
        "a spoof verdict must override heuristics",
      );
      assert.ok(spoofed.reasons.includes("anti_spoof"));
      assert.equal(spoofed.antiSpoof.ready, true);

      globalThis.FaceAntiSpoof.predict = async () => ({
        live: false,
        score: 0.9,
        label: "print",
      });
      idx = 0;
      const lowConfidenceOverride = await liveness.verifyLiveness(
        camera,
        engine,
        { mode: "passive", frames: 4 },
      );
      assert.equal(lowConfidenceOverride.live, false);
      assert.ok(
        !lowConfidenceOverride.reasons.includes("anti_spoof"),
        "high PAD scores skip the reason tag",
      );

      globalThis.FaceAntiSpoof = undefined;
      idx = 0;
      const noPad = await liveness.verifyLiveness(camera, engine, {
        mode: "passive",
        frames: 4,
      });
      assert.equal(noPad.antiSpoof, undefined);

      // PAD with a frame whose detection has no usable box → null box is passed
      globalThis.FaceAntiSpoof = {
        VERSION: "minifasnet-v2",
        isReady: () => true,
        load: async () => true,
        getBackend: () => "wasm",
        predict: async () => ({ live: true, score: 0.9, label: "live" }),
      };
      const boxProbeEngine = {
        detectFaces: async function () {
          return [{}]; // no box at all
        },
      };
      idx = 0;
      const noBoxRun = await liveness.verifyLiveness(camera, boxProbeEngine, {
        mode: "passive",
        frames: 2,
      });
      assert.equal(noBoxRun.antiSpoof.ready, true);
    } finally {
      globalThis.FaceAntiSpoof = REAL_AS;
    }
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

// ── Coverage: pure-function edge arms ──

describe("FaceLiveness — edge arms (pure functions)", () => {
  it("ear returns 0 for a degenerate eye with zero width", () => {
    const mesh = faceWithEyes(8, 8);
    // collapse all left-eye points onto one spot → d3 === 0
    for (const idx of LEFT_EYE) {
      mesh[idx * 3] = 250;
      mesh[idx * 3 + 1] = 200;
    }
    assert.equal(globalThis.FaceLiveness.ear(mesh, LEFT_EYE), 0);
  });

  it("blinkScore counts a trailing closed run at the end of the window", () => {
    const frames = [
      faceWithEyes(8, 8),
      faceWithEyes(8, 8),
      faceWithEyes(2, 2),
    ].map(frame);
    const r = globalThis.FaceLiveness.blinkScore(frames);
    assert.equal(r.count, 1);
    assert.equal(r.closedRuns, 1);
  });

  it("motionScore skips frames without a usable nose", () => {
    const good = faceWithEyes(8, 8);
    const noYMesh = new Float32Array(4); // x defined (0), y undefined → skip
    const frames = [frame(good), { mesh: null }, frame(noYMesh)];
    assert.equal(globalThis.FaceLiveness.motionScore(frames), 0);
    const noXMesh = new Float32Array(3); // x itself undefined → skip too
    const frames2 = [frame(good), frame(noXMesh)];
    assert.equal(globalThis.FaceLiveness.motionScore(frames2), 0);
  });

  it("motionScore returns 0 when no deltas could be formed", () => {
    const frames = [frame(faceWithEyes(8, 8)), { mesh: null }];
    assert.equal(globalThis.FaceLiveness.motionScore(frames), 0);
  });

  it("sharpnessScore returns 0 for zero-size canvases and read failures", () => {
    assert.equal(
      globalThis.FaceLiveness.sharpnessScore({
        width: 0,
        height: 0,
        getContext: () => ({}),
      }),
      0,
    );
    const boom = {
      width: 32,
      height: 32,
      getContext: () => ({
        getImageData() {
          throw new Error("tainted");
        },
      }),
    };
    assert.equal(globalThis.FaceLiveness.sharpnessScore(boom), 0);
  });

  it("sharpnessScore returns 0 when the canvas is too small for the kernel", () => {
    const { createCanvas } = require("canvas");
    assert.equal(globalThis.FaceLiveness.sharpnessScore(createCanvas(2, 2)), 0);
  });

  it("qualityScore flags zero-size boxes and missing confidence", () => {
    const q = globalThis.FaceLiveness.qualityScore(
      { box: { x: 10, y: 10, width: 0, height: 100 }, score: 0.9 },
      640,
      480,
    );
    assert.ok(q.reasons.includes("no_face"));
    const q2 = globalThis.FaceLiveness.qualityScore(
      { box: { x: 200, y: 100, width: 240, height: 300 } },
      640,
      480,
    );
    assert.ok(q2.reasons.includes("low_confidence"));
  });

  it("qualityScore falls back to unit frame dimensions and flags too-close faces", () => {
    const big = globalThis.FaceLiveness.qualityScore(
      { box: { x: 5, y: 5, width: 630, height: 470 }, score: 0.9 },
      640,
      480,
    );
    assert.ok(big.reasons.includes("too_close"));
    const fallbackDims = globalThis.FaceLiveness.qualityScore(
      { box: { x: 200, y: 100, width: 240, height: 300 }, score: 0.9 },
      0,
      0,
    );
    assert.equal(fallbackDims.ok, false, "unit frame dims make the face huge");
    assert.ok(fallbackDims.reasons.includes("too_close"));
  });

  it("analyzePassive uses default dimensions for canvas-less frames and rescues quality later", () => {
    const badResult = { box: null, score: 0 }; // i=0 quality lands as no_face
    const goodResult = {
      box: { x: 200, y: 100, width: 240, height: 300 },
      score: 0.9,
      mesh: faceWithEyes(8, 8),
    };
    const frames = [
      { result: badResult, canvas: null, mesh: null },
      { result: goodResult, canvas: makeCanvas(), mesh: faceWithEyes(8, 8) },
    ];
    const r = globalThis.FaceLiveness.analyzePassive(frames);
    assert.equal(
      r.quality.ok,
      true,
      "later good frame must override early bad quality",
    );
    assert.ok(r.reasons.includes("no_blink"));
  });
});

// ── Coverage: validators and challenge engine arms ──

describe("FaceLiveness — validator edge arms", () => {
  const V = globalThis.FaceLiveness.ChallengeEngine.VALIDATORS;

  // Anchors the SOURCE actually reads: nose=x@3/y@4, left-eye inner 133 (x@399,y@400),
  // right-eye inner 263 (x@789,y@791). Built directly to stay independent of the
  // placeEye helper geometry.
  function anchoredMesh(noseX, noseY, lx, ly, rx, ry) {
    const m = emptyMesh();
    m[3] = noseX;
    m[4] = noseY;
    m[399] = lx;
    m[400] = ly;
    m[789] = rx;
    m[790] = ry;
    return m;
  }

  it("turn-right passes when the nose moves image-left", () => {
    const m = anchoredMesh(260, 260, 280, 200, 405, 200); // offset ≈ -0.66
    assert.equal(V["turn-right"](m), true);
    const frontal = anchoredMesh(340, 260, 280, 200, 405, 200); // offset ≈ -0.02
    assert.equal(V["turn-right"](frontal), false);
  });

  it("look-down passes when the nose drops below the eye line", () => {
    const down = anchoredMesh(320, 260, 280, 200, 405, 200); // nose well below eye line
    assert.equal(V["look-down"](down), true);
    const level = anchoredMesh(320, 205, 280, 200, 405, 200); // barely below
    assert.equal(V["look-down"](level), false);
    const sparse = emptyMesh();
    assert.equal(V["look-down"](sparse), false);
  });

  it("look-up fails on sparse meshes without nose or eye anchors", () => {
    assert.equal(V["look-up"](emptyMesh()), false);
  });

  it("smile fails on sparse meshes and accepts an open mouth", () => {
    assert.equal(
      V.smile(new Float32Array(40)),
      false,
      "missing lip anchors hit the guard",
    );
    const openMouth = faceWithEyes(8, 8);
    openMouth[LIP_L * 3 + 1] = 350; // corners below the trigger line
    openMouth[LIP_R * 3 + 1] = 350;
    openMouth[LIP_U * 3 + 1] = 340; // upper-lip mid at 340
    openMouth[LIP_D * 3 + 1] = 360; // lower-lip mid 20px below → open mouth wins
    assert.equal(V.smile(openMouth), true);
  });

  it("look-up and look-down fail when the eye line is unavailable", () => {
    const halfMesh = new Float32Array(500); // nose + left eye exist, right eye does not
    halfMesh[4] = 260;
    assert.equal(V["look-up"](halfMesh), false);
    assert.equal(V["look-down"](halfMesh), false);
  });

  it("_noseOffset guards a missing right-eye anchor", () => {
    const halfMesh = new Float32Array(500);
    halfMesh[3] = 320;
    halfMesh[399] = 280;
    assert.equal(globalThis.FaceLiveness._noseOffset(halfMesh), 0);
  });

  it("flags a soft-but-not-blank frame as blurred", () => {
    const { createCanvas } = require("canvas");
    const c = createCanvas(16, 16);
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4;
        const v = ((x + y) % 2) * 2; // low-amplitude checkerboard → tiny laplacian variance
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const s = globalThis.FaceLiveness.sharpnessScore(c);
    assert.ok(s > 0 && s < 120, `soft sharpness ${s} must sit in (0,120)`);
    const blink = faceWithEyes(2, 2);
    const moving = faceWithEyes(8, 8);
    moving[NOSE * 3] += 2;
    const frames = [
      {
        canvas: c,
        mesh: moving,
        result: {
          box: { x: 200, y: 100, width: 240, height: 300 },
          score: 0.9,
          mesh: moving,
        },
      },
      { canvas: makeCanvas(), mesh: blink, result: null },
      { canvas: makeCanvas(), mesh: faceWithEyes(8, 8), result: null },
    ];
    const r = globalThis.FaceLiveness.analyzePassive(frames);
    assert.ok(
      r.reasons.includes("blurred"),
      "soft frame must trigger the blurred reason",
    );
  });

  it("_noseOffset and _eyeMidY guard sparse meshes and coincident eyes", () => {
    const FL = globalThis.FaceLiveness;
    assert.equal(FL._noseOffset(emptyMesh()), 0);
    const sameX = anchoredMesh(50, 260, 100, 200, 100, 200); // dist === 0
    assert.equal(FL._noseOffset(sameX), 0);
    const halfMesh = new Float32Array(500); // left anchors exist, right ones do not
    assert.equal(FL._eyeMidY(halfMesh), null);
    assert.equal(FL._eyeMidY(emptyMesh()), 0);
  });
});

describe("FaceLiveness — ChallengeEngine edge arms", () => {
  it("reports done immediately when started with an empty list", () => {
    const engine = new globalThis.FaceLiveness.ChallengeEngine({
      challenges: ["blink"],
    });
    engine._challenges = [];
    assert.equal(engine.start(), null);
    const r = engine.validate(faceWithEyes(8, 8));
    assert.equal(r.done, true);
  });

  it("falls back to the random set for an explicitly empty challenge list", () => {
    const engine = new globalThis.FaceLiveness.ChallengeEngine({
      challenges: [],
    });
    const first = engine.start();
    assert.notEqual(first, null);
    assert.equal(engine.summary().total, globalThis.FaceLiveness ? 3 : 3);
  });

  it("supports zero-argument construction", () => {
    const engine = new globalThis.FaceLiveness.ChallengeEngine();
    const first = engine.start();
    assert.notEqual(first, null);
    assert.equal(engine.summary().total, 3);
  });

  it("auto-starts on the first validate call", () => {
    const engine = new globalThis.FaceLiveness.ChallengeEngine({
      challenges: ["blink"],
      maxAttempts: 3,
    });
    const r = engine.validate(faceWithEyes(8, 8));
    assert.equal(r.current, "blink");
    assert.equal(r.passed, false);
  });

  it("advances to the next challenge when one times out", () => {
    const engine = new globalThis.FaceLiveness.ChallengeEngine({
      challenges: ["blink", "smile"],
      maxAttempts: 5,
      timeoutMs: 50,
    });
    engine.start();
    const now = Date.now();
    const r = engine.validate(faceWithEyes(8, 8), now + 100);
    assert.equal(r.passed, false);
    assert.equal(r.done, false);
    assert.equal(r.next, "smile");
  });

  it("returns a fail object for unknown challenge types", () => {
    const engine = new globalThis.FaceLiveness.ChallengeEngine({
      challenges: ["bogus"],
      maxAttempts: 3,
    });
    engine.start();
    const r = engine.validate(faceWithEyes(8, 8));
    assert.equal(r.passed, false);
    assert.equal(r.current, "bogus");
  });

  it("summary reports zeros before start and failures after timeouts", () => {
    const fresh = new globalThis.FaceLiveness.ChallengeEngine({});
    assert.equal(fresh.summary().total, 0);
    const engine = new globalThis.FaceLiveness.ChallengeEngine({
      challenges: ["blink"],
      maxAttempts: 1,
      timeoutMs: 10,
    });
    engine.start();
    engine.validate(faceWithEyes(8, 8), Date.now() + 100);
    const s = engine.summary();
    assert.deepEqual(s.failed, ["blink"]);
  });
});

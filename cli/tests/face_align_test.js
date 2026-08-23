const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createCanvas } = require("canvas");

// Polyfills for GPL check
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };
globalThis.document = { createElement: (t) => (t === "canvas" ? createCanvas(1, 1) : null) };

const alignSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_align.js"),
  "utf8",
);
vm.runInThisContext(alignSrc, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_align.js") });

/** Build a 468-point FaceMesh with the canonical 5 landmarks at known coords. */
function makeMesh(pts) {
  const mesh = new Array(468);
  FaceAlign.MESH_INDICES.forEach((idx, i) => {
    mesh[idx] = { x: pts[i][0], y: pts[i][1] };
  });
  return mesh;
}

const CANON = FaceAlign.DST_POINTS;

describe("FaceAlign — meshToLandmarks5", () => {
  it("extracts the 5 canonical points from an object-based mesh", () => {
    const mesh = makeMesh([[10, 20], [30, 20], [20, 30], [12, 40], [28, 40]]);
    const out = FaceAlign.meshToLandmarks5(mesh);
    assert.deepEqual(out, [[10, 20], [30, 20], [20, 30], [12, 40], [28, 40]]);
  });

  it("supports flat [x,y,z] meshes", () => {
    const flat = new Float32Array(468 * 3);
    const pts = [[10, 20], [30, 20], [20, 30], [12, 40], [28, 40]];
    FaceAlign.MESH_INDICES.forEach((idx, i) => {
      flat[idx * 3] = pts[i][0];
      flat[idx * 3 + 1] = pts[i][1];
    });
    assert.deepEqual(FaceAlign.meshToLandmarks5(flat), pts);
  });

  it("supports [x,y,z] triplet arrays (Human FaceMesh output)", () => {
    const mesh = new Array(478);
    const pts = [[10, 20], [30, 20], [20, 30], [12, 40], [28, 40]];
    FaceAlign.MESH_INDICES.forEach((idx, i) => {
      mesh[idx] = [pts[i][0], pts[i][1], 0];
    });
    assert.deepEqual(FaceAlign.meshToLandmarks5(mesh), pts);
  });

  it("returns null for meshes shorter than 468", () => {
    assert.equal(FaceAlign.meshToLandmarks5(new Array(100)), null);
    assert.equal(FaceAlign.meshToLandmarks5(null), null);
    assert.equal(FaceAlign.meshToLandmarks5([]), null);
  });

  it("returns null when a required landmark is missing", () => {
    const mesh = new Array(468);
    mesh[33] = { x: 1, y: 1 };
    assert.equal(FaceAlign.meshToLandmarks5(mesh), null);
  });
});

describe("FaceAlign — estimateSimilarity", () => {
  it("returns identity-like transform for canonical points", () => {
    const est = FaceAlign.estimateSimilarity(CANON);
    assert.notEqual(est, null);
    assert.ok(Math.abs(est.scale - 1) < 1e-6);
    assert.ok(Math.abs(est.angle) < 1e-9);
    assert.ok(Math.abs(est.tx) < 1e-6 && Math.abs(est.ty) < 1e-6);
  });

  it("computes scale from the eye distance ratio", () => {
    const src = CANON.map((p) => [p[0] * 2, p[1] * 2]);
    const est = FaceAlign.estimateSimilarity(src);
    assert.ok(Math.abs(est.scale - 0.5) < 1e-6);
  });

  it("accepts {x, y} objects and arrays interchangeably", () => {
    const obj5 = CANON.map((p) => ({ x: p[0], y: p[1] }));
    const est = FaceAlign.estimateSimilarity(obj5);
    assert.notEqual(est, null);
    assert.ok(Math.abs(est.scale - 1) < 1e-6);
  });

  it("returns null for degenerate inputs", () => {
    assert.equal(FaceAlign.estimateSimilarity(null), null);
    assert.equal(FaceAlign.estimateSimilarity([[0, 0]]), null);
    assert.equal(FaceAlign.estimateSimilarity([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]), null);
  });

  it("returns null when the scale is out of the sane range", () => {
    const src = CANON.map((p) => [p[0] * 1000, p[1] * 1000]);
    assert.equal(FaceAlign.estimateSimilarity(src), null);
  });

  it("matrix reproduces the affine transform at src[0]", () => {
    const est = FaceAlign.estimateSimilarity(CANON);
    const [a, b, c, d, tx, ty] = est.matrix;
    const x = CANON[0][0];
    const y = CANON[0][1];
    assert.ok(Math.abs(a * x + c * y + tx - CANON[0][0]) < 1e-6);
    assert.ok(Math.abs(b * x + d * y + ty - CANON[0][1]) < 1e-6);
  });
});

describe("FaceAlign — alignFace", () => {
  it("warps a canvas to the canonical 112×112 grid", () => {
    const src = createCanvas(200, 200);
    const out = FaceAlign.alignFace(src, CANON);
    assert.notEqual(out, null);
    assert.equal(out.canvas.width, 112);
    assert.equal(out.canvas.height, 112);
    assert.equal(out.scale, 1);
    assert.ok(out.matrix.length === 6);
  });

  it("honors a custom output size", () => {
    const src = createCanvas(200, 200);
    const out = FaceAlign.alignFace(src, CANON, 64);
    assert.equal(out.canvas.width, 64);
    assert.equal(out.canvas.height, 64);
  });

  it("returns null when landmarks are missing", () => {
    assert.equal(FaceAlign.alignFace(createCanvas(200, 200), null), null);
    assert.equal(FaceAlign.alignFace(createCanvas(200, 200), [[0, 0]]), null);
  });

  it("returns null when the transform cannot be estimated", () => {
    const src = CANON.map((p) => [p[0] * 1000, p[1] * 1000]);
    assert.equal(FaceAlign.alignFace(createCanvas(200, 200), src), null);
  });

  it("returns null when document.createElement throws", () => {
    const orig = globalThis.document.createElement;
    globalThis.document.createElement = () => {
      throw new Error("no canvas");
    };
    try {
      assert.equal(FaceAlign.alignFace(createCanvas(200, 200), CANON), null);
    } finally {
      globalThis.document.createElement = orig;
    }
  });

  it("returns null when the canvas context lacks setTransform", () => {
    const orig = globalThis.document.createElement;
    globalThis.document.createElement = () => ({ getContext: () => null, width: 0, height: 0 });
    try {
      assert.equal(FaceAlign.alignFace(createCanvas(200, 200), CANON), null);
    } finally {
      globalThis.document.createElement = orig;
    }
  });
});

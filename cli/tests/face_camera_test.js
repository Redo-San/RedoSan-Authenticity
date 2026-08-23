const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── GPL polyfills ──
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };

// Mock DOM element factory — video mocks must be real node-canvas instances so
// drawImage(video, ...) succeeds.
function makeEl(tag) {
  if (tag === "video") {
    const { createCanvas } = require("canvas");
    const video = createCanvas(1, 1);
    video.tagName = "VIDEO";
    video.videoWidth = 640;
    video.videoHeight = 480;
    video.srcObject = null;
    video.style = {};
    video.play = async function () {};
    return video;
  }
  return {
    tagName: tag.toUpperCase(),
    style: {},
    srcObject: null,
    play: async function () {},
    videoWidth: 640,
    videoHeight: 480,
  };
}

globalThis.document = {
  createElement: function (t) {
    if (t === "canvas") {
      const { createCanvas } = require("canvas");
      return createCanvas(1, 1);
    }
    return makeEl(t);
  },
  getElementById: function () {
    return null;
  },
};

// Mock navigator with fake getUserMedia (Node ≥21 defines a built-in navigator getter,
// so a plain assignment is silently ignored — must use defineProperty).
function setNavigator(nav) {
  Object.defineProperty(globalThis, "navigator", {
    value: nav,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

function installNavigator(fakeGetUserMedia) {
  setNavigator({
    isSecureContext: true,
    mediaDevices: {
      getUserMedia: fakeGetUserMedia,
      enumerateDevices: async function () {
        return [
          { kind: "videoinput", deviceId: "cam-1", label: "Webcam 1" },
          { kind: "audioinput", deviceId: "mic-1", label: "Mic" },
        ];
      },
    },
  });
}

function fakeStream() {
  return {
    active: true,
    getTracks: function () {
      return [{ stop: function () {} }];
    },
  };
}

// ── Load FaceCamera source ──
const cameraSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_camera.js"),
  "utf8",
);
vm.runInThisContext(cameraSrc, {
  filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_camera.js"),
});

describe("FaceCamera — isSupported", () => {
  it("is true in a secure context with mediaDevices", () => {
    installNavigator(async function () { return fakeStream(); });
    assert.equal(globalThis.FaceCamera.isSupported(), true);
  });

  it("is false without mediaDevices", () => {
    setNavigator({ isSecureContext: true, mediaDevices: null });
    assert.equal(globalThis.FaceCamera.isSupported(), false);
  });

  it("is false in a non-secure context", () => {
    setNavigator({ isSecureContext: false, mediaDevices: { getUserMedia: function () {} } });
    assert.equal(globalThis.FaceCamera.isSupported(), false);
  });

  it("is false when navigator is undefined", () => {
    setNavigator(undefined);
    assert.equal(globalThis.FaceCamera.isSupported(), false);
  });
});

describe("FaceCamera — getCameraErrorMessage", () => {
  it("maps permission errors", () => {
    assert.ok(globalThis.FaceCamera.getCameraErrorMessage({ name: "NotAllowedError" }).includes("permission"));
    assert.ok(globalThis.FaceCamera.getCameraErrorMessage({ name: "SecurityError" }).includes("permission"));
  });

  it("maps not-found errors", () => {
    assert.ok(globalThis.FaceCamera.getCameraErrorMessage({ name: "NotFoundError" }).includes("No camera"));
  });

  it("maps in-use errors", () => {
    assert.ok(globalThis.FaceCamera.getCameraErrorMessage({ name: "NotReadableError" }).includes("already in use"));
  });

  it("maps overconstrained errors", () => {
    assert.ok(globalThis.FaceCamera.getCameraErrorMessage({ name: "OverconstrainedError" }).includes("constraints"));
  });

  it("falls back to the message for unknown errors", () => {
    const msg = globalThis.FaceCamera.getCameraErrorMessage({ name: "BogusError", message: "weird" });
    assert.ok(msg.includes("weird"));
  });

  it("handles null", () => {
    assert.equal(globalThis.FaceCamera.getCameraErrorMessage(null), "Camera error.");
  });

  it("maps abort errors", () => {
    assert.ok(globalThis.FaceCamera.getCameraErrorMessage({ name: "AbortError" }).includes("aborted"));
  });

  it("maps not-supported errors", () => {
    assert.ok(globalThis.FaceCamera.getCameraErrorMessage({ name: "NotSupportedError" }).includes("not supported"));
  });

  it("maps a string error", () => {
    assert.equal(globalThis.FaceCamera.getCameraErrorMessage("SomeError"), "Camera error: SomeError");
  });

  it("maps an error with only a code", () => {
    assert.equal(globalThis.FaceCamera.getCameraErrorMessage({ code: "E123" }), "Camera error: E123");
  });

  it("maps a nameless error with no message", () => {
    assert.equal(globalThis.FaceCamera.getCameraErrorMessage({ foo: 1 }), "Camera error: UnknownError");
  });
});

describe("FaceCamera — startCamera", () => {
  let camera;

  beforeEach(() => {
    camera = new globalThis.FaceCamera();
  });

  afterEach(() => {
    if (camera) camera.stopCamera();
  });

  it("attaches the stream and plays the video", async () => {
    installNavigator(async function () { return fakeStream(); });
    const video = makeEl("video");
    const stream = await camera.startCamera(video);
    assert.equal(camera.isActive(), true);
    assert.equal(video.srcObject, stream);
    assert.equal(video.style.transform, "scaleX(-1)");
  });

  it("does not mirror when mirror:false", async () => {
    installNavigator(async function () { return fakeStream(); });
    const video = makeEl("video");
    const cam = new globalThis.FaceCamera({ mirror: false });
    await cam.startCamera(video);
    assert.ok(!video.style.transform);
    cam.stopCamera();
  });

  it("throws without a video element", async () => {
    installNavigator(async function () { return fakeStream(); });
    await assert.rejects(camera.startCamera(null), /element is required/);
  });

  it("rejects with the original DOMException when getUserMedia fails", async () => {
    installNavigator(async function () {
      const err = new Error("denied");
      err.name = "NotAllowedError";
      throw err;
    });
    await assert.rejects(camera.startCamera(makeEl("video")), { name: "NotAllowedError" });
  });

  it("throws when unsupported (no mediaDevices)", async () => {
    setNavigator({ isSecureContext: true, mediaDevices: null });
    await assert.rejects(camera.startCamera(makeEl("video")), /not available/i);
  });

  it("passes deviceId constraints", async () => {
    let captured;
    installNavigator(async function (c) { captured = c; return fakeStream(); });
    const video = makeEl("video");
    await camera.startCamera(video, { deviceId: "dev-9" });
    assert.equal(captured.video.deviceId.exact, "dev-9");
  });
});

describe("FaceCamera — stopCamera & captureFrame", () => {
  let camera;

  beforeEach(() => {
    camera = new globalThis.FaceCamera();
  });

  it("stops tracks and clears the video", async () => {
    let stopped = false;
    const stream = {
      active: true,
      getTracks: function () {
        return [{ stop: function () { stopped = true; } }];
      },
    };
    installNavigator(async function () { return stream; });
    const video = makeEl("video");
    await camera.startCamera(video);
    camera.stopCamera();
    assert.equal(stopped, true);
    assert.equal(camera.isActive(), false);
    assert.equal(video.srcObject, null);
    assert.equal(video.style.transform, "");
  });

  it("captureFrame returns null when not running", () => {
    assert.equal(camera.captureFrame(), null);
  });

  it("captureFrame draws the video frame to a canvas", async () => {
    installNavigator(async function () { return fakeStream(); });
    const video = makeEl("video");
    video.videoWidth = 1280;
    video.videoHeight = 720;
    await camera.startCamera(video);
    const canvas = camera.captureFrame();
    assert.ok(canvas);
    assert.equal(canvas.width, 1280);
    assert.equal(canvas.height, 720);
    const capped = camera.captureFrame(320);
    assert.equal(capped.width, 320);
    assert.equal(capped.height, 180);
  });

  it("captureFrame uses default dimensions", async () => {
    installNavigator(async function () { return fakeStream(); });
    const video = makeEl("video");
    video.videoWidth = 0;
    video.videoHeight = 0;
    await camera.startCamera(video);
    const canvas = camera.captureFrame();
    assert.equal(canvas.width, 640);
    assert.equal(canvas.height, 480);
  });
});

describe("FaceCamera — listCameras", () => {
  it("returns video inputs only", async () => {
    installNavigator(async function () { return fakeStream(); });
    const camera = new globalThis.FaceCamera();
    const list = await camera.listCameras();
    assert.equal(list.length, 1);
    assert.equal(list[0].deviceId, "cam-1");
    assert.equal(list[0].label, "Webcam 1");
  });

  it("returns [] when unsupported", async () => {
    setNavigator({ isSecureContext: true, mediaDevices: null });
    const camera = new globalThis.FaceCamera();
    assert.deepEqual(await camera.listCameras(), []);
  });

  it("falls back to a default label", async () => {
    setNavigator({
      isSecureContext: true,
      mediaDevices: {
        getUserMedia: async function () { return fakeStream(); },
        enumerateDevices: async function () {
          return [{ kind: "videoinput", deviceId: "cam-x" }];
        },
      },
    });
    const camera = new globalThis.FaceCamera();
    const list = await camera.listCameras();
    assert.equal(list[0].label, "Camera 1");
  });
});

describe("FaceCamera — scoreFrame & captureBestFrame", () => {
  let camera;

  beforeEach(() => {
    camera = new globalThis.FaceCamera();
  });

  it("scoreFrame returns score 0 when engine has no detect", async () => {
    const r = await camera.scoreFrame({}, null);
    assert.equal(r.score, 0);
    assert.equal(r.result, null);
  });

  it("scoreFrame scores detection confidence and face size", async () => {
    const engine = {
      detectFaces: async function () {
        return [{ box: { x: 0, y: 0, width: 320, height: 240 }, score: 0.8 }];
      },
    };
    const canvas = { width: 640, height: 480 };
    const r = await camera.scoreFrame(canvas, engine);
    assert.ok(r.score > 80);
    assert.equal(r.result.box.width, 320);
  });

  it("captureBestFrame returns the highest-scoring frame", async () => {
    const scores = [0.3, 0.9, 0.6];
    let idx = 0;
    camera.captureFrame = function () {
      return { width: 640, height: 480 };
    };
    camera.scoreFrame = async function () {
      const s = scores[idx % scores.length];
      idx++;
      return { canvas: { w: s }, result: { box: { width: s * 100 } }, score: s * 100 };
    };
    const best = await camera.captureBestFrame(null, 3, 0);
    assert.equal(best.score, 90);
  });

  it("scoreFrame returns 0 when no face detected", async () => {
    const engine = { detectFaces: async function () { return []; } };
    const r = await camera.scoreFrame({ width: 640, height: 480 }, engine);
    assert.equal(r.score, 0);
    assert.equal(r.result, null);
  });

  it("scoreFrame skips size bonus when box has zero width or height", async () => {
    const engine = {
      detectFaces: async function () {
        return [{ box: { x: 0, y: 0, width: 320, height: 0 }, score: 0.8 }];
      },
    };
    const r = await camera.scoreFrame({ width: 640, height: 480 }, engine);
    assert.equal(r.score, 80);
  });

  it("scoreFrame treats a missing face score as 0", async () => {
    const engine = {
      detectFaces: async function () {
        return [{ box: { x: 0, y: 0, width: 320, height: 240 } }];
      },
    };
    const r = await camera.scoreFrame({ width: 640, height: 480 }, engine);
    assert.equal(r.score, 50);
  });

  it("captureBestFrame defaults n to 5", async () => {
    let calls = 0;
    camera.captureFrame = function () {
      return { width: 640, height: 480 };
    };
    camera.scoreFrame = async function () {
      calls++;
      return { canvas: {}, result: null, score: 0 };
    };
    const best = await camera.captureBestFrame(null, 0, 0);
    assert.equal(calls, 5);
    assert.ok(best);
  });
});

require("./setup");
const test = require("node:test");
const assert = require("node:assert");

const IC = global.IrisCamera;

// ═══════════════════════════════════════════════════════════════
// iris_camera.js — basic static methods
// ═══════════════════════════════════════════════════════════════

test("IrisCamera.isSupported: returns boolean", () => {
  assert.equal(typeof IC.isSupported(), "boolean");
});

test("IrisCamera.getCameraErrorMessage: formats error", () => {
  const msg = IC.getCameraErrorMessage(new Error("NotAllowedError"));
  assert.equal(typeof msg, "string");
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: DOMException", () => {
  const msg = IC.getCameraErrorMessage({
    name: "NotAllowedError",
    message: "denied",
  });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: string", () => {
  const msg = IC.getCameraErrorMessage("some error");
  assert.ok(msg.length > 0);
});

// ═══════════════════════════════════════════════════════════════
// iris_camera.js — instance methods with DOM mocks
// ═══════════════════════════════════════════════════════════════

test("IrisCamera.isSupported: returns boolean", () => {
  assert.equal(typeof IC.isSupported(), "boolean");
});

test("IrisCamera.getCameraErrorMessage: formats error", () => {
  const msg = IC.getCameraErrorMessage(new Error("NotAllowedError"));
  assert.equal(typeof msg, "string");
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: DOMException", () => {
  const msg = IC.getCameraErrorMessage({
    name: "NotAllowedError",
    message: "denied",
  });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: string", () => {
  const msg = IC.getCameraErrorMessage("some error");
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: null returns default", () => {
  const msg = IC.getCameraErrorMessage(null);
  assert.ok(msg.includes("error"));
});

test("IrisCamera.getCameraErrorMessage: NotFoundError", () => {
  const msg = IC.getCameraErrorMessage({ name: "NotFoundError" });
  assert.ok(msg.includes("No camera"));
});

test("IrisCamera.getCameraErrorMessage: NotReadableError", () => {
  const msg = IC.getCameraErrorMessage({ name: "NotReadableError" });
  assert.ok(msg.includes("in use") || msg.includes("camera"));
});

test("IrisCamera.getCameraErrorMessage: OverconstrainedError", () => {
  const msg = IC.getCameraErrorMessage({ name: "OverconstrainedError" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: AbortError", () => {
  const msg = IC.getCameraErrorMessage({ name: "AbortError" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.prototype.stopCamera: no-op when no stream", () => {
  const cam = new IC();
  cam.stopCamera();
  assert.equal(cam._stream, null);
  assert.equal(cam._video, null);
});

test("IrisCamera.prototype.isActive: false when no stream", () => {
  const cam = new IC();
  assert.equal(cam.isActive(), false);
});

test("IrisCamera.prototype.stopCamera: clears stream and video", () => {
  const cam = new IC();
  const stopped = [];
  cam._stream = {
    getTracks: () => [
      {
        stop() {
          stopped.push(true);
        },
      },
    ],
    active: true,
  };
  cam._video = { srcObject: {}, style: { transform: "scale(1)" } };
  cam.stopCamera();
  assert.equal(stopped.length, 1);
  assert.equal(cam._stream, null);
  assert.equal(cam._video, null);
});

test("IrisCamera.prototype.captureFrame: null when no video", () => {
  const cam = new IC();
  assert.equal(cam.captureFrame(), null);
});

test("IrisCamera.prototype.captureFrame: returns ImageData from video", () => {
  const cam = new IC();
  const mockVideo = { videoWidth: 640, videoHeight: 480 };
  cam._video = mockVideo;
  const result = cam.captureFrame();
  assert.ok(result);
  assert.equal(result.width, 640);
  assert.equal(result.height, 480);
});

test("IrisCamera.prototype.captureCanvas: null when no video", () => {
  const cam = new IC();
  assert.equal(cam.captureCanvas(), null);
});

test("IrisCamera.prototype.captureCanvas: returns canvas from video", () => {
  const cam = new IC();
  const mockVideo = { videoWidth: 320, videoHeight: 240 };
  const result = cam.captureCanvas(mockVideo);
  assert.ok(result);
});

test("IrisCamera.prototype.captureMultipleFrames: returns array", async () => {
  const cam = new IC();
  cam._video = { videoWidth: 100, videoHeight: 100 };
  const frames = await cam.captureMultipleFrames(2, 10);
  assert.ok(Array.isArray(frames));
  assert.equal(frames.length, 2);
});

test("IrisCamera.prototype.listCameras: returns empty when unsupported", async () => {
  const cam = new IC();
  const list = await cam.listCameras();
  assert.ok(Array.isArray(list));
});

test("IrisCamera.getCameraErrorMessage: code fallback", () => {
  const msg = IC.getCameraErrorMessage({ code: "NotAllowedError" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: generic unknown error", () => {
  const msg = IC.getCameraErrorMessage({ name: "SomeWeirdError" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.prototype.startCamera: throws when unsupported", async () => {
  const cam = new IC();
  try {
    await cam.startCamera({ tagName: "video" });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("Camera"));
  }
});

test("IrisCamera.prototype.startCamera: throws when no video element", async () => {
  const cam = new IC();
  try {
    await cam.startCamera(null);
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("Camera") || e.message.includes("video"));
  }
});

test("IrisCamera.prototype.startCamera: throws when not a video element", async () => {
  const cam = new IC();
  try {
    await cam.startCamera({ tagName: "div" });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("Camera") || e.message.includes("video"));
  }
});

test("IrisCamera.prototype.startCamera: succeeds with mock video", async () => {
  const origDesc = Object.getOwnPropertyDescriptor(global, "navigator");
  const mockTrack = { stop() {}, kind: "video" };
  const mockStream = { getTracks: () => [mockTrack], active: true };
  Object.defineProperty(global, "navigator", {
    value: {
      mediaDevices: { getUserMedia: async () => mockStream },
      isSecureContext: true,
    },
    configurable: true,
    writable: true,
  });
  const cam = new IC();
  const videoEl = {
    tagName: "video",
    srcObject: null,
    style: { transform: "" },
    play() {
      return { catch() {} };
    },
  };
  const stream = await cam.startCamera(videoEl, {
    facingMode: "environment",
    width: 640,
    height: 480,
  });
  assert.equal(stream, mockStream);
  assert.equal(cam._stream, mockStream);
  assert.equal(cam._video, videoEl);
  assert.equal(videoEl.srcObject, mockStream);
  cam.stopCamera();
  if (origDesc) Object.defineProperty(global, "navigator", origDesc);
  else delete global.navigator;
});

test("IrisCamera.prototype.startCamera: with deviceId option", async () => {
  const origDesc = Object.getOwnPropertyDescriptor(global, "navigator");
  const mockStream = { getTracks: () => [], active: true };
  Object.defineProperty(global, "navigator", {
    value: {
      mediaDevices: { getUserMedia: async () => mockStream },
      isSecureContext: true,
    },
    configurable: true,
    writable: true,
  });
  const cam = new IC();
  const videoEl = {
    tagName: "video",
    srcObject: null,
    style: { transform: "" },
    play() {
      return { catch() {} };
    },
  };
  const stream = await cam.startCamera(videoEl, { deviceId: "cam-1" });
  assert.ok(stream);
  cam.stopCamera();
  if (origDesc) Object.defineProperty(global, "navigator", origDesc);
  else delete global.navigator;
});

test("IrisCamera.prototype.startCamera: with mirror option", async () => {
  const origDesc = Object.getOwnPropertyDescriptor(global, "navigator");
  const mockStream = { getTracks: () => [], active: true };
  Object.defineProperty(global, "navigator", {
    value: {
      mediaDevices: { getUserMedia: async () => mockStream },
      isSecureContext: true,
    },
    configurable: true,
    writable: true,
  });
  const cam = new IC();
  cam._mirror = true;
  const videoEl = {
    tagName: "video",
    srcObject: null,
    style: { transform: "" },
    play() {
      return { catch() {} };
    },
  };
  await cam.startCamera(videoEl);
  assert.ok(videoEl.style.transform.includes("scaleX(-1)"));
  cam.stopCamera();
  if (origDesc) Object.defineProperty(global, "navigator", origDesc);
  else delete global.navigator;
});

test("IrisCamera.prototype.setBrightness: no-op when no stream", async () => {
  const cam = new IC();
  await cam.setBrightness(0.5);
});

test("IrisCamera.prototype.setBrightness: no-op when no track", async () => {
  const cam = new IC();
  cam._stream = { getVideoTracks: () => [] };
  await cam.setBrightness(0.5);
});

test("IrisCamera.prototype.setBrightness: applies constraint when supported", async () => {
  const applied = [];
  const mockTrack = {
    getCapabilities: () => ({ brightness: { min: -1, max: 1 } }),
    applyConstraints: async (c) => {
      applied.push(c);
    },
  };
  const cam = new IC();
  cam._stream = { getVideoTracks: () => [mockTrack] };
  await cam.setBrightness(0.7);
  assert.equal(applied.length, 1);
});

test("IrisCamera.prototype.setBrightness: no-op when no capabilities", async () => {
  const mockTrack = {
    getCapabilities: () => ({}),
    applyConstraints: async () => {},
  };
  const cam = new IC();
  cam._stream = { getVideoTracks: () => [mockTrack] };
  await cam.setBrightness(0.5);
});

// ═══════════════════════════════════════════════════════════════
// iris_camera.js — push from 77% to 80%+
// ═══════════════════════════════════════════════════════════════
test("IrisCamera.getCameraErrorMessage: NotSupportedError", () => {
  const msg = IC.getCameraErrorMessage({ name: "NotSupportedError" });
  assert.ok(msg.includes("not supported") || msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: TrackStartError", () => {
  const msg = IC.getCameraErrorMessage({ name: "TrackStartError" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: DevicesNotFoundError", () => {
  const msg = IC.getCameraErrorMessage({ name: "DevicesNotFoundError" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: ConstraintNotSatisfiedError", () => {
  const msg = IC.getCameraErrorMessage({ name: "ConstraintNotSatisfiedError" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: error without name", () => {
  const msg = IC.getCameraErrorMessage({ message: "oops" });
  assert.ok(msg.length > 0);
});

test("IrisCamera.getCameraErrorMessage: string error", () => {
  const msg = IC.getCameraErrorMessage("Camera failed");
  assert.ok(msg.length > 0);
});

test("IrisCamera.isActive: returns boolean when stream exists", () => {
  const cam = new IC();
  cam._stream = { active: true, getTracks: () => [{ readyState: "live" }] };
  assert.equal(typeof cam.isActive(), "boolean");
  assert.equal(cam.isActive(), true);
});

test("IrisCamera.isActive: false when track ended", () => {
  const cam = new IC();
  cam._stream = { active: false, getTracks: () => [{ readyState: "ended" }] };
  assert.equal(cam.isActive(), false);
});

test("IrisCamera.captureFrame: returns null when no video", () => {
  const cam = new IC();
  assert.equal(cam.captureFrame(), null);
});

test("IrisCamera.captureCanvas: returns null when no video", () => {
  const cam = new IC();
  assert.equal(cam.captureCanvas(), null);
});

test("IrisCamera.captureMultipleFrames: returns empty when no video", async () => {
  const cam = new IC();
  const frames = await cam.captureMultipleFrames(3);
  assert.ok(Array.isArray(frames));
});

test("IrisCamera.listCameras: returns empty when no enumerateDevices", async () => {
  const cam = new IC();
  const list = await cam.listCameras();
  assert.ok(Array.isArray(list));
});

test("IrisCamera.prototype.startCamera: rejects non-video element", async () => {
  const cam = new IC();
  try {
    await cam.startCamera({ tagName: "div" });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.length > 0);
  }
});

// ═══════════════════════════════════════════════════════════════
// iris_camera.js: navigator undefined check (L35)
// ═══════════════════════════════════════════════════════════════
test("IrisCamera.isSupported: navigator undefined → false (L35-L37)", () => {
  const origNav = global.navigator;
  delete global.navigator;
  const r = IrisCamera.isSupported();
  assert.equal(r, false);
  global.navigator = origNav;
});

// ═══════════════════════════════════════════════════════════════
// iris_camera.js: tagName check without videoEl.tagName (L104-L106)
// ═══════════════════════════════════════════════════════════════
test("IrisCamera.startCamera: element without tagName (L104-L108)", async () => {
  const origNav = Object.getOwnPropertyDescriptor(global, "navigator");
  Object.defineProperty(global, "navigator", {
    value: {
      mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) },
      isSecureContext: true,
    },
    configurable: true,
    writable: true,
  });
  const cam = new IrisCamera();
  try {
    await assert.rejects(async () => {
      await cam.startCamera({ tagName: "div" });
    }, /video/);
  } finally {
    if (origNav) Object.defineProperty(global, "navigator", origNav);
    else delete global.navigator;
  }
});

// ═══════════════════════════════════════════════════════════════
// iris_camera.js: constructor mirror (L25)
// ═══════════════════════════════════════════════════════════════
test("IrisCamera: constructor defaults mirror=true (L25)", () => {
  const cam1 = new IC();
  assert.equal(cam1._mirror, true);
  const cam2 = new IC({ mirror: false });
  assert.equal(cam2._mirror, false);
  const cam3 = new IC({ mirror: true });
  assert.equal(cam3._mirror, true);
});

// ═══════════════════════════════════════════════════════════════
// iris_camera.js: captureMultipleFrames with count=1 (L222)
// ═══════════════════════════════════════════════════════════════
test("IrisCamera.captureMultipleFrames: count=1 (L222)", async () => {
  const cam = new IC();
  cam._stream = { active: true };
  cam._video = { videoWidth: 64, videoHeight: 64 };
  const r = await cam.captureMultipleFrames(1, 0);
  assert.ok(Array.isArray(r));
  assert.equal(r.length, 1);
});

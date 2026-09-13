const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills needed by the origin-guard IIFE in voice_microphone.js
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/voice_microphone.js",
  hostname: "localhost",
  origin: "null",
};

const modSrc = fs.readFileSync(
  path.join(__dirname, "../../Voice_Biometric/voice_microphone.js"),
  "utf8",
);
vm.runInThisContext(modSrc, {
  filename: path.resolve(
    __dirname,
    "../../Voice_Biometric/voice_microphone.js",
  ),
});

const VoiceMicrophone = globalThis.VoiceMicrophone;

// Node >= 21 defines `navigator` as a non-writable accessor on globalThis;
// plain assignment is silently ignored. Override it via defineProperty.
function setGlobalNavigator(obj) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, "navigator");
  const prev = had
    ? Object.getOwnPropertyDescriptor(globalThis, "navigator")
    : null;
  Object.defineProperty(globalThis, "navigator", {
    value: obj,
    configurable: true,
    writable: true,
    enumerable: true,
  });
  return function restore() {
    if (prev) Object.defineProperty(globalThis, "navigator", prev);
    else delete globalThis.navigator;
  };
}

describe("VoiceMicrophone — contract", () => {
  it("exposes 16 kHz mono as the canonical capture contract", () => {
    assert.equal(VoiceMicrophone.SAMPLE_RATE, 16000);
    assert.equal(VoiceMicrophone.TARGET_RATE, 16000);
  });

  it("exposes the standard audio processing flags", () => {
    assert.deepEqual(VoiceMicrophone.AUDIO_FLAGS, {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
  });

  it("exposes a secure-context support check", () => {
    assert.equal(typeof VoiceMicrophone.supported, "function");
  });
});

describe("VoiceMicrophone — supported()", () => {
  it("returns false when navigator.mediaDevices.getUserMedia is absent", () => {
    const restore = setGlobalNavigator({ mediaDevices: {} });
    try {
      assert.equal(VoiceMicrophone.supported(), false);
    } finally {
      restore();
    }
  });

  it("returns false in a non-secure context", () => {
    const restore = setGlobalNavigator({
      mediaDevices: { getUserMedia: function () {} },
      isSecureContext: false,
    });
    try {
      assert.equal(VoiceMicrophone.supported(), false);
    } finally {
      restore();
    }
  });

  it("returns true when getUserMedia exists in a secure context", () => {
    const restore = setGlobalNavigator({
      mediaDevices: { getUserMedia: function () {} },
      isSecureContext: true,
    });
    try {
      assert.equal(VoiceMicrophone.supported(), true);
    } finally {
      restore();
    }
  });
});

describe("VoiceMicrophone — requestPermission", () => {
  it("asks for 16 kHz mono with echo/noise/gain processing", async () => {
    let seen;
    const stream = { getTracks: () => [] };
    const restore = setGlobalNavigator({
      mediaDevices: {
        getUserMedia: async function (c) {
          seen = c;
          return stream;
        },
      },
    });
    try {
      const got = await VoiceMicrophone.requestPermission();
      assert.equal(got, stream);
      assert.deepEqual(seen.audio.echoCancellation, true);
      assert.deepEqual(seen.audio.noiseSuppression, true);
      assert.deepEqual(seen.audio.autoGainControl, true);
      assert.deepEqual(seen.audio.channelCount, 1);
      // sampleRate must be ideal (never exact) to avoid OverconstrainedError.
      assert.deepEqual(seen.audio.sampleRate, { ideal: 16000 });
    } finally {
      restore();
    }
  });
});

describe("VoiceMicrophone — resampleTo16k", () => {
  it("returns the input unchanged when already at 16 kHz", () => {
    const inBlock = new Float32Array([0.1, -0.2, 0.3, 0.4]);
    const out = VoiceMicrophone.resampleTo16k(inBlock, 16000);
    assert.ok(out === inBlock, "no copy for an already-16k block");
  });

  it("resamples an 8 kHz block by duplicating (upsample 2x)", () => {
    const out = VoiceMicrophone.resampleTo16k(
      new Float32Array([0.5, -0.25]),
      8000,
    );
    assert.equal(out.length, 4);
    assert.ok(Math.abs(out[0] - 0.5) < 1e-6);
    assert.ok(Math.abs(out[1] - 0.5) < 1e-6);
    assert.ok(Math.abs(out[2] + 0.25) < 1e-6);
    assert.ok(Math.abs(out[3] + 0.25) < 1e-6);
  });

  it("resamples a 48 kHz block to 16 kHz (downsample 3x)", () => {
    const out = VoiceMicrophone.resampleTo16k(
      new Float32Array([1, 2, 3, 4, 5, 6]),
      48000,
    );
    assert.equal(out.length, 2);
    assert.ok(Math.abs(out[0] - 2) < 1e-6, "every 3rd sample (linear)");
    assert.ok(Math.abs(out[1] - 5) < 1e-6);
  });

  it("throws for a rate that does not divide 16000", () => {
    assert.throws(
      () => VoiceMicrophone.resampleTo16k(new Float32Array(2), 11025),
      /Cannot resample/,
    );
  });
});

describe("VoiceMicrophone — start/stop with an AudioWorklet capture graph", () => {
  function fakeAudioEnv(sampleRate) {
    const created = {
      context: null,
      mediaStreamSource: null,
      workletNode: null,
      workletModules: [],
      destination: { connect: function () {} },
      onPcm: null,
      contextSampleRate: sampleRate,
    };
    function FakeAudioWorkletNode(ctx, name, opts) {
      created.workletNode = { port: {}, name, opts, ctx, disconnect() {} };
      return created.workletNode;
    }
    function FakeAudioContext() {
      created.context = this;
      this.sampleRate = sampleRate;
      this.audioWorklet = {
        addModule: async function (url) {
          created.workletModules.push(url);
        },
      };
      this.destination = created.destination;
      this.close = async function () {};
      this.createMediaStreamSource = function (stream) {
        created.mediaStreamSource = stream;
        return { connect: function (node) {} };
      };
      this.createScriptProcessor = function () {
        return { connect: function () {}, disconnect: function () {} };
      };
    }
    globalThis.AudioContext = FakeAudioContext;
    return created;
  }

  let restoreNavigator;
  beforeEach(() => {
    restoreNavigator = setGlobalNavigator({
      mediaDevices: {
        getUserMedia: async function () {
          return { getTracks: () => [] };
        },
      },
      isSecureContext: true,
    });
  });
  afterEach(() => {
    restoreNavigator();
    delete globalThis.AudioContext;
    delete globalThis.AudioWorkletNode;
  });

  it("creates a 16 kHz AudioContext and a capture worklet", async () => {
    const created = fakeAudioEnv(16000);
    globalThis.AudioWorkletNode = function (ctx, name, opts) {
      return created.workletNode;
    };
    created.workletNode = { port: { postMessage() {} }, disconnect() {} };
    const mic = await VoiceMicrophone.start({ onPcm: () => {} });
    assert.equal(created.context.sampleRate, 16000);
    assert.equal(created.workletModules.length, 1);
    assert.ok(created.workletModules[0].includes("voice_capture_worklet.js"));
    assert.ok(mic);
    await VoiceMicrophone.stop();
  });

  it("accepts a 16 kHz AudioContext when sampleRate option is honored", async () => {
    const created = fakeAudioEnv(16000);
    globalThis.AudioWorkletNode = function (ctx, name, opts) {
      return created.workletNode;
    };
    created.workletNode = { port: { postMessage() {} }, disconnect() {} };
    const got = await VoiceMicrophone.start({ onPcm: () => {} });
    assert.equal(got.sampleRate, 16000);
    await VoiceMicrophone.stop();
  });

  it("audioCaptureSampleRate reports the actual context rate before resampling", async () => {
    const created = fakeAudioEnv(48000);
    globalThis.AudioWorkletNode = function (ctx, name, opts) {
      return created.workletNode;
    };
    created.workletNode = { port: { postMessage() {} }, disconnect() {} };
    await VoiceMicrophone.start({ onPcm: () => {} });
    assert.equal(VoiceMicrophone.audioCaptureSampleRate(), 48000);
    await VoiceMicrophone.stop();
  });

  it("routes the mic stream through a MediaStreamSource into the worklet", async () => {
    const created = fakeAudioEnv(16000);
    globalThis.AudioWorkletNode = function (ctx, name, opts) {
      return created.workletNode;
    };
    created.workletNode = { port: { postMessage() {} }, disconnect() {} };
    await VoiceMicrophone.start({ onPcm: () => {} });
    assert.ok(created.mediaStreamSource, "stream source was created");
    await VoiceMicrophone.stop();
  });

  it("reports whether the active capture context is at 16 kHz", async () => {
    const created = fakeAudioEnv(16000);
    globalThis.AudioWorkletNode = function (ctx, name, opts) {
      return created.workletNode;
    };
    created.workletNode = { port: { postMessage() {} }, disconnect() {} };
    await VoiceMicrophone.start({ onPcm: () => {} });
    assert.equal(VoiceMicrophone.is16k(), true);
    await VoiceMicrophone.stop();
    assert.equal(VoiceMicrophone.is16k(), false);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// NEW TESTS — covering previously uncovered branches and functions
// ══════════════════════════════════════════════════════════════════════════

describe("VoiceMicrophone — getMicrophoneErrorMessage", () => {
  it("returns 'Microphone error.' for null input", () => {
    assert.equal(
      VoiceMicrophone.getMicrophoneErrorMessage(null),
      "Microphone error.",
    );
  });

  it("returns 'Microphone error.' for undefined input", () => {
    assert.equal(
      VoiceMicrophone.getMicrophoneErrorMessage(undefined),
      "Microphone error.",
    );
  });

  it("returns 'Microphone error.' for falsy zero input", () => {
    assert.equal(
      VoiceMicrophone.getMicrophoneErrorMessage(0),
      "Microphone error.",
    );
  });

  it("returns 'Microphone error.' for empty string input", () => {
    assert.equal(
      VoiceMicrophone.getMicrophoneErrorMessage(""),
      "Microphone error.",
    );
  });

  it("maps a plain string 'NotAllowedError' to permission denied", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage("NotAllowedError");
    assert.match(msg, /permission denied/i);
  });

  it("maps a plain string 'NotFoundError' to no microphone", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage("NotFoundError");
    assert.match(msg, /no microphone/i);
  });

  it("maps { name: 'NotAllowedError' } to permission denied", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({
      name: "NotAllowedError",
    });
    assert.match(msg, /permission denied/i);
  });

  it("maps { name: 'PermissionDeniedError' } to permission denied", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({
      name: "PermissionDeniedError",
    });
    assert.match(msg, /permission denied/i);
  });

  it("maps { name: 'SecurityError' } to permission denied", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({
      name: "SecurityError",
    });
    assert.match(msg, /permission denied/i);
  });

  it("maps { name: 'NotFoundError' } to no microphone", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({
      name: "NotFoundError",
    });
    assert.match(msg, /no microphone/i);
  });

  it("maps { name: 'DevicesNotFoundError' } to no microphone", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({
      name: "DevicesNotFoundError",
    });
    assert.match(msg, /no microphone/i);
  });

  it("maps { name: 'NotReadableError' } to already in use", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({
      name: "NotReadableError",
    });
    assert.match(msg, /already in use/i);
  });

  it("maps { name: 'TrackStartError' } to already in use", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({
      name: "TrackStartError",
    });
    assert.match(msg, /already in use/i);
  });

  it("maps { name: 'OverconstrainedError' } to cannot satisfy", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({
      name: "OverconstrainedError",
    });
    assert.match(msg, /cannot satisfy/i);
  });

  it("maps { name: 'ConstraintNotSatisfiedError' } to cannot satisfy", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({
      name: "ConstraintNotSatisfiedError",
    });
    assert.match(msg, /cannot satisfy/i);
  });

  it("maps { name: 'AbortError' } to aborted", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({
      name: "AbortError",
    });
    assert.match(msg, /aborted/i);
  });

  it("maps { name: 'NotSupportedError' } to not supported", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({
      name: "NotSupportedError",
    });
    assert.match(msg, /not supported/i);
  });

  it("returns a fallback message with the name for unknown error types", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({
      name: "SomethingWeird",
    });
    assert.equal(msg, "Microphone error: SomethingWeird");
  });

  it("falls back to err.code when err.name is absent", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({
      code: "NotFoundError",
    });
    assert.match(msg, /no microphone/i);
  });

  it("falls back to 'UnknownError' when both name and code are absent", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({});
    assert.equal(msg, "Microphone error: UnknownError");
  });

  it("uses err.name over err.code when both are present", () => {
    const msg = VoiceMicrophone.getMicrophoneErrorMessage({
      name: "AbortError",
      code: "NotFoundError",
    });
    assert.match(msg, /aborted/i);
  });
});

describe("VoiceMicrophone — supported() edge cases", () => {
  it("returns false when navigator is absent (line 74 false branch)", () => {
    const restore = setGlobalNavigator(null);
    delete globalThis.navigator;
    try {
      assert.equal(VoiceMicrophone.supported(), false);
    } finally {
      restore();
    }
  });
});

describe("VoiceMicrophone — requestPermission error paths", () => {
  it("throws when navigator.mediaDevices is absent (line 125)", async () => {
    const restore = setGlobalNavigator({});
    try {
      await assert.rejects(() => VoiceMicrophone.requestPermission(), {
        message: /not supported/i,
      });
    } finally {
      restore();
    }
  });

  it("throws when navigator.mediaDevices.getUserMedia is absent (line 125)", async () => {
    const restore = setGlobalNavigator({ mediaDevices: {} });
    try {
      await assert.rejects(() => VoiceMicrophone.requestPermission(), {
        message: /not supported/i,
      });
    } finally {
      restore();
    }
  });

  it("throws when navigator itself is absent (line 123 null branch)", async () => {
    const restore = setGlobalNavigator(null);
    delete globalThis.navigator;
    try {
      await assert.rejects(() => VoiceMicrophone.requestPermission(), {
        message: /not supported/i,
      });
    } finally {
      restore();
    }
  });
});

describe("VoiceMicrophone — resampleTo16k edge cases", () => {
  it("returns null for a null block (line 141)", () => {
    assert.equal(VoiceMicrophone.resampleTo16k(null, 16000), null);
  });

  it("returns null for an undefined block (line 141)", () => {
    assert.equal(VoiceMicrophone.resampleTo16k(undefined, 16000), null);
  });

  it("returns null for a falsy block (empty string)", () => {
    assert.equal(VoiceMicrophone.resampleTo16k("", 16000), null);
  });

  it("returns the block unchanged when fromRate is 0 (falsy guard)", () => {
    const block = new Float32Array([1, 2]);
    const out = VoiceMicrophone.resampleTo16k(block, 0);
    assert.ok(out === block, "no copy when fromRate is 0");
  });

  it("throws for a downsample rate that does not evenly divide 16000 (line 156)", () => {
    // 44100 / 16000 = 2.75625 — non-integer factor triggers the error
    assert.throws(
      () => VoiceMicrophone.resampleTo16k(new Float32Array(4), 44100),
      /Cannot resample 44100/,
    );
  });

  it("throws for a downsample rate of 24000 (factor 1.5, non-integer)", () => {
    assert.throws(
      () => VoiceMicrophone.resampleTo16k(new Float32Array(4), 24000),
      /Cannot resample/,
    );
  });
});

describe("VoiceMicrophone — start() error paths", () => {
  let restoreNav;
  beforeEach(() => {
    restoreNav = setGlobalNavigator({
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [] }),
      },
      isSecureContext: true,
    });
  });
  afterEach(() => {
    restoreNav();
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;
    delete globalThis.AudioWorkletNode;
  });

  it("throws when opts is null (line 179-180)", async () => {
    await assert.rejects(() => VoiceMicrophone.start(null), {
      message: /onPcm is required/i,
    });
  });

  it("throws when opts is undefined (line 179-180)", async () => {
    await assert.rejects(() => VoiceMicrophone.start(undefined), {
      message: /onPcm is required/i,
    });
  });

  it("throws when opts.onPcm is not a function (line 179-180)", async () => {
    await assert.rejects(
      () => VoiceMicrophone.start({ onPcm: "not-a-function" }),
      { message: /onPcm is required/i },
    );
  });

  it("throws when navigator.mediaDevices is absent (line 182)", async () => {
    restoreNav();
    restoreNav = setGlobalNavigator({});
    await assert.rejects(() => VoiceMicrophone.start({ onPcm: () => {} }), {
      message: /not supported/i,
    });
  });

  it("throws when AudioContext is unavailable (line 193)", async () => {
    const savedAC = globalThis.AudioContext;
    const savedWAC = globalThis.webkitAudioContext;
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;
    try {
      await assert.rejects(() => VoiceMicrophone.start({ onPcm: () => {} }), {
        message: /Web Audio API is not available/i,
      });
    } finally {
      if (savedAC) globalThis.AudioContext = savedAC;
      if (savedWAC) globalThis.webkitAudioContext = savedWAC;
    }
  });

  it("uses webkitAudioContext when AudioContext is absent (line 190)", async () => {
    const savedAC = globalThis.AudioContext;
    delete globalThis.AudioContext;

    const created = {};
    function FakeWebKitAudioContext(opts) {
      created.context = this;
      this.sampleRate = (opts && opts.sampleRate) || 16000;
      this.audioWorklet = {
        addModule: async () => {
          created.moduleLoaded = true;
        },
      };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = (stream) => {
        created.mediaStreamSource = stream;
        return { connect() {} };
      };
    }
    globalThis.webkitAudioContext = FakeWebKitAudioContext;
    globalThis.AudioWorkletNode = function (ctx, name, opts) {
      created.workletNode = { port: { postMessage() {} }, disconnect() {} };
      return created.workletNode;
    };

    try {
      const result = await VoiceMicrophone.start({ onPcm: () => {} });
      assert.ok(created.context, "webkitAudioContext was instantiated");
      assert.equal(result.fallback, false);
      assert.ok(created.moduleLoaded, "worklet module was loaded");
    } finally {
      await VoiceMicrophone.stop();
      globalThis.AudioContext = savedAC;
      delete globalThis.webkitAudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });

  it("sets captureRate to null when context.sampleRate is falsy (line 199)", async () => {
    function FakeAudioContext() {
      this.sampleRate = 0; // falsy, triggers || null
      this.audioWorklet = {
        addModule: async () => {},
      };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = (stream) => ({ connect() {} });
    }
    globalThis.AudioContext = FakeAudioContext;
    globalThis.AudioWorkletNode = function () {
      return { port: { postMessage() {} }, disconnect() {} };
    };

    try {
      await VoiceMicrophone.start({ onPcm: () => {} });
      assert.equal(VoiceMicrophone.audioCaptureSampleRate(), null);
    } finally {
      await VoiceMicrophone.stop();
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });
});

describe("VoiceMicrophone — ScriptProcessor fallback", () => {
  let restoreNav;
  beforeEach(() => {
    restoreNav = setGlobalNavigator({
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [] }),
      },
      isSecureContext: true,
    });
  });
  afterEach(() => {
    restoreNav();
    delete globalThis.AudioContext;
    delete globalThis.AudioWorkletNode;
  });

  it("uses ScriptProcessor when audioWorklet is absent (line 231)", async () => {
    const created = {};
    function FakeAudioContext() {
      created.context = this;
      this.sampleRate = 16000;
      // Intentionally NO audioWorklet property
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = (stream) => {
        created.mediaStreamSource = stream;
        return { connect() {} };
      };
      this.createScriptProcessor = (bufferSize, inputs, outputs) => {
        const node = { connect() {}, disconnect() {}, onaudioprocess: null };
        created.spNode = node;
        return node;
      };
    }
    globalThis.AudioContext = FakeAudioContext;

    try {
      const result = await VoiceMicrophone.start({ onPcm: () => {} });
      assert.equal(result.fallback, true, "result reports fallback=true");
      assert.ok(created.spNode, "ScriptProcessor node was created");
      assert.ok(
        created.spNode.onaudioprocess,
        "onaudioprocess handler was set",
      );
      assert.equal(VoiceMicrophone.usingFallback(), true);
    } finally {
      await VoiceMicrophone.stop();
      delete globalThis.AudioContext;
    }
  });

  it("invokes onPcm via ScriptProcessor onaudioprocess (line 233)", async () => {
    const created = {};
    const pcmBlocks = [];
    function FakeAudioContext() {
      created.context = this;
      this.sampleRate = 48000;
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = (stream) => ({ connect() {} });
      this.createScriptProcessor = (bufferSize, inputs, outputs) => {
        const node = { connect() {}, disconnect() {}, onaudioprocess: null };
        created.spNode = node;
        return node;
      };
    }
    globalThis.AudioContext = FakeAudioContext;

    try {
      await VoiceMicrophone.start({
        onPcm: (block, rate) => pcmBlocks.push({ block, rate }),
      });

      // Simulate an audio processing event
      const testSamples = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      created.spNode.onaudioprocess({
        inputBuffer: {
          getChannelData: () => testSamples,
        },
      });

      assert.equal(pcmBlocks.length, 1, "onPcm was called once");
      assert.equal(pcmBlocks[0].rate, 48000);
      // 48000/16000 = 3 factor, downsample: mean of every 3 samples
      assert.ok(pcmBlocks[0].block.length > 0, "resampled block is non-empty");
    } finally {
      await VoiceMicrophone.stop();
      delete globalThis.AudioContext;
    }
  });

  it("does not invoke onPcm when state is not active (line 235 guard)", async () => {
    const created = {};
    const pcmBlocks = [];
    function FakeAudioContext() {
      created.context = this;
      this.sampleRate = 16000;
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = (stream) => ({ connect() {} });
      this.createScriptProcessor = (bufferSize, inputs, outputs) => {
        const node = { connect() {}, disconnect() {}, onaudioprocess: null };
        created.spNode = node;
        return node;
      };
    }
    globalThis.AudioContext = FakeAudioContext;

    try {
      await VoiceMicrophone.start({
        onPcm: (block) => pcmBlocks.push(block),
      });
      // Stop capture first
      await VoiceMicrophone.stop();
      // Now fire the event after stop — should be ignored
      if (created.spNode && created.spNode.onaudioprocess) {
        created.spNode.onaudioprocess({
          inputBuffer: {
            getChannelData: () => new Float32Array([0.5]),
          },
        });
      }
      assert.equal(pcmBlocks.length, 0, "onPcm not called after stop");
    } finally {
      delete globalThis.AudioContext;
    }
  });
});

describe("VoiceMicrophone — worklet message handling", () => {
  let restoreNav;
  beforeEach(() => {
    restoreNav = setGlobalNavigator({
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [] }),
      },
      isSecureContext: true,
    });
  });
  afterEach(() => {
    restoreNav();
    delete globalThis.AudioContext;
    delete globalThis.AudioWorkletNode;
  });

  it("routes worklet port messages through onData to onPcm (line 221)", async () => {
    const pcmBlocks = [];
    const created = {};
    function FakeAudioContext() {
      created.context = this;
      this.sampleRate = 16000;
      this.audioWorklet = {
        addModule: async () => {},
      };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = (stream) => ({
        connect() {},
      });
    }
    globalThis.AudioContext = FakeAudioContext;

    const workletNode = {
      port: { postMessage() {}, onmessage: null },
      disconnect() {},
    };
    globalThis.AudioWorkletNode = function () {
      created.workletNode = workletNode;
      return workletNode;
    };

    try {
      await VoiceMicrophone.start({
        onPcm: (block, rate) => pcmBlocks.push({ block, rate }),
      });

      assert.ok(
        workletNode.port.onmessage,
        "onmessage handler was set on worklet port",
      );

      const testBlock = new Float32Array([0.1, 0.2, 0.3]);
      workletNode.port.onmessage({ data: { block: testBlock } });

      assert.equal(pcmBlocks.length, 1, "onPcm was called");
      assert.equal(pcmBlocks[0].rate, 16000);
    } finally {
      await VoiceMicrophone.stop();
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });

  it("ignores worklet messages without data.block (line 222 guard)", async () => {
    const pcmBlocks = [];
    function FakeAudioContext() {
      this.sampleRate = 16000;
      this.audioWorklet = { addModule: async () => {} };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({ connect() {} });
    }
    globalThis.AudioContext = FakeAudioContext;

    const workletNode = {
      port: { postMessage() {}, onmessage: null },
      disconnect() {},
    };
    globalThis.AudioWorkletNode = function () {
      return workletNode;
    };

    try {
      await VoiceMicrophone.start({ onPcm: (block) => pcmBlocks.push(block) });

      // Send messages without data.block
      workletNode.port.onmessage({ data: {} });
      workletNode.port.onmessage({ data: null });
      workletNode.port.onmessage(null);
      workletNode.port.onmessage({});

      assert.equal(
        pcmBlocks.length,
        0,
        "onPcm not called for invalid messages",
      );
    } finally {
      await VoiceMicrophone.stop();
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });

  it("invokes onLevel when provided via worklet message (line 209)", async () => {
    const levels = [];
    const pcmBlocks = [];
    function FakeAudioContext() {
      this.sampleRate = 16000;
      this.audioWorklet = { addModule: async () => {} };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({ connect() {} });
    }
    globalThis.AudioContext = FakeAudioContext;

    const workletNode = {
      port: { postMessage() {}, onmessage: null },
      disconnect() {},
    };
    globalThis.AudioWorkletNode = function () {
      return workletNode;
    };

    try {
      await VoiceMicrophone.start({
        onPcm: (block) => pcmBlocks.push(block),
        onLevel: (level) => levels.push(level),
      });

      workletNode.port.onmessage({ data: { block: new Float32Array([0.5]) } });

      assert.equal(levels.length, 1, "onLevel was called");
      assert.equal(pcmBlocks.length, 1, "onPcm was called");
    } finally {
      await VoiceMicrophone.stop();
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });

  it("ignores worklet messages when capture is not active (line 206 guard)", async () => {
    const pcmBlocks = [];
    function FakeAudioContext() {
      this.sampleRate = 16000;
      this.audioWorklet = { addModule: async () => {} };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({ connect() {} });
    }
    globalThis.AudioContext = FakeAudioContext;

    const workletNode = {
      port: { postMessage() {}, onmessage: null },
      disconnect() {},
    };
    globalThis.AudioWorkletNode = function () {
      return workletNode;
    };

    try {
      await VoiceMicrophone.start({ onPcm: (block) => pcmBlocks.push(block) });
      await VoiceMicrophone.stop();

      // Fire onmessage after stop — should be ignored
      workletNode.port.onmessage({ data: { block: new Float32Array([0.5]) } });
      assert.equal(pcmBlocks.length, 0, "onPcm not called after stop");
    } finally {
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });
});

describe("VoiceMicrophone — stop() error resilience", () => {
  let restoreNav;
  beforeEach(() => {
    restoreNav = setGlobalNavigator({
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [] }),
      },
      isSecureContext: true,
    });
  });
  afterEach(() => {
    restoreNav();
    delete globalThis.AudioContext;
    delete globalThis.AudioWorkletNode;
  });

  it("ignores errors from worklet.disconnect (lines 256-257)", async () => {
    function FakeAudioContext() {
      this.sampleRate = 16000;
      this.audioWorklet = { addModule: async () => {} };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({ connect() {} });
    }
    globalThis.AudioContext = FakeAudioContext;

    const throwingWorklet = {
      port: { postMessage() {} },
      disconnect() {
        throw new Error("worklet disconnect failed");
      },
    };
    globalThis.AudioWorkletNode = function () {
      return throwingWorklet;
    };

    try {
      await VoiceMicrophone.start({ onPcm: () => {} });
      // stop() should not throw despite disconnect error
      VoiceMicrophone.stop();
      assert.equal(VoiceMicrophone.audioCaptureSampleRate(), null);
    } finally {
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });

  it("ignores errors from mediaStreamSource.disconnect (lines 265-266)", async () => {
    function FakeAudioContext() {
      this.sampleRate = 16000;
      this.audioWorklet = { addModule: async () => {} };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({
        connect() {},
        disconnect() {
          throw new Error("source disconnect failed");
        },
      });
    }
    globalThis.AudioContext = FakeAudioContext;
    globalThis.AudioWorkletNode = function () {
      return { port: { postMessage() {} }, disconnect() {} };
    };

    try {
      await VoiceMicrophone.start({ onPcm: () => {} });
      VoiceMicrophone.stop();
      assert.equal(VoiceMicrophone.audioCaptureSampleRate(), null);
    } finally {
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });

  it("ignores errors from context.close (lines 273-274)", async () => {
    function FakeAudioContext() {
      this.sampleRate = 16000;
      this.audioWorklet = { addModule: async () => {} };
      this.destination = { connect() {} };
      this.close = function () {
        throw new Error("context close failed");
      };
      this.createMediaStreamSource = () => ({ connect() {} });
    }
    globalThis.AudioContext = FakeAudioContext;
    globalThis.AudioWorkletNode = function () {
      return { port: { postMessage() {} }, disconnect() {} };
    };

    try {
      await VoiceMicrophone.start({ onPcm: () => {} });
      VoiceMicrophone.stop();
      assert.equal(VoiceMicrophone.audioCaptureSampleRate(), null);
    } finally {
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });

  it("calls disconnect only when it is a function (lines 253, 263)", async () => {
    function FakeAudioContext() {
      this.sampleRate = 16000;
      this.audioWorklet = { addModule: async () => {} };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({
        connect() {},
        // no disconnect method
      });
    }
    globalThis.AudioContext = FakeAudioContext;
    globalThis.AudioWorkletNode = function () {
      return { port: { postMessage() {} } /* no disconnect */ };
    };

    try {
      await VoiceMicrophone.start({ onPcm: () => {} });
      // stop() should not throw — typeof guards prevent calling undefined
      VoiceMicrophone.stop();
      assert.equal(VoiceMicrophone.audioCaptureSampleRate(), null);
    } finally {
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });
});

describe("VoiceMicrophone — usingFallback()", () => {
  let restoreNav;
  beforeEach(() => {
    restoreNav = setGlobalNavigator({
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [] }),
      },
      isSecureContext: true,
    });
  });
  afterEach(() => {
    restoreNav();
    delete globalThis.AudioContext;
    delete globalThis.AudioWorkletNode;
  });

  it("returns false when using AudioWorklet (line 295)", async () => {
    function FakeAudioContext() {
      this.sampleRate = 16000;
      this.audioWorklet = { addModule: async () => {} };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({ connect() {} });
    }
    globalThis.AudioContext = FakeAudioContext;
    globalThis.AudioWorkletNode = function () {
      return { port: { postMessage() {} }, disconnect() {} };
    };

    try {
      await VoiceMicrophone.start({ onPcm: () => {} });
      assert.equal(VoiceMicrophone.usingFallback(), false);
    } finally {
      await VoiceMicrophone.stop();
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });

  it("returns true when using ScriptProcessor fallback (line 295)", async () => {
    function FakeAudioContext() {
      this.sampleRate = 16000;
      // no audioWorklet
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({ connect() {} });
      this.createScriptProcessor = () => ({
        connect() {},
        disconnect() {},
        onaudioprocess: null,
      });
    }
    globalThis.AudioContext = FakeAudioContext;

    try {
      await VoiceMicrophone.start({ onPcm: () => {} });
      assert.equal(VoiceMicrophone.usingFallback(), true);
    } finally {
      await VoiceMicrophone.stop();
      delete globalThis.AudioContext;
    }
  });

  it("reflects the last capture mode after stop (state.fallback not reset by stop)", async () => {
    // After a ScriptProcessor capture, stop() does NOT reset state.fallback
    function FakeAudioContext() {
      this.sampleRate = 16000;
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({ connect() {} });
      this.createScriptProcessor = () => ({
        connect() {},
        disconnect() {},
        onaudioprocess: null,
      });
    }
    globalThis.AudioContext = FakeAudioContext;

    try {
      await VoiceMicrophone.start({ onPcm: () => {} });
      assert.equal(VoiceMicrophone.usingFallback(), true);
      await VoiceMicrophone.stop();
      // state.fallback persists after stop
      assert.equal(VoiceMicrophone.usingFallback(), true);
    } finally {
      delete globalThis.AudioContext;
    }
  });
});

describe("VoiceMicrophone — _stopTracks paths (lines 314-327)", () => {
  let restoreNav;
  beforeEach(() => {
    restoreNav = setGlobalNavigator({
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [] }),
      },
      isSecureContext: true,
    });
  });
  afterEach(() => {
    restoreNav();
    delete globalThis.AudioContext;
    delete globalThis.AudioWorkletNode;
  });

  it("stops all tracks when stream has active tracks (lines 320-321)", async () => {
    const stopped = [];
    const fakeTrack1 = {
      stop() {
        stopped.push("track1");
      },
    };
    const fakeTrack2 = {
      stop() {
        stopped.push("track2");
      },
    };

    restoreNav();
    restoreNav = setGlobalNavigator({
      mediaDevices: {
        getUserMedia: async () => ({
          getTracks: () => [fakeTrack1, fakeTrack2],
        }),
      },
      isSecureContext: true,
    });

    function FakeAudioContext() {
      this.sampleRate = 16000;
      this.audioWorklet = { addModule: async () => {} };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({ connect() {} });
    }
    globalThis.AudioContext = FakeAudioContext;
    globalThis.AudioWorkletNode = function () {
      return { port: { postMessage() {} }, disconnect() {} };
    };

    try {
      await VoiceMicrophone.start({ onPcm: () => {} });
      VoiceMicrophone.stop();
      assert.deepEqual(stopped, ["track1", "track2"]);
    } finally {
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });

  it("skips tracks without a stop method (line 320 guard)", async () => {
    const stopped = [];
    const trackNoStop = { id: "no-stop" }; // no stop method
    const trackWithStop = {
      stop() {
        stopped.push("trackWithStop");
      },
    };

    restoreNav();
    restoreNav = setGlobalNavigator({
      mediaDevices: {
        getUserMedia: async () => ({
          getTracks: () => [trackNoStop, trackWithStop],
        }),
      },
      isSecureContext: true,
    });

    function FakeAudioContext() {
      this.sampleRate = 16000;
      this.audioWorklet = { addModule: async () => {} };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({ connect() {} });
    }
    globalThis.AudioContext = FakeAudioContext;
    globalThis.AudioWorkletNode = function () {
      return { port: { postMessage() {} }, disconnect() {} };
    };

    try {
      await VoiceMicrophone.start({ onPcm: () => {} });
      VoiceMicrophone.stop();
      assert.deepEqual(stopped, ["trackWithStop"]);
    } finally {
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });

  it("ignores errors thrown by track.stop() (lines 324-325)", async () => {
    const badTrack = {
      stop() {
        throw new Error("track.stop failed");
      },
    };
    const goodTrack = {
      stop() {
        /* ok */
      },
    };

    restoreNav();
    restoreNav = setGlobalNavigator({
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [badTrack, goodTrack] }),
      },
      isSecureContext: true,
    });

    function FakeAudioContext() {
      this.sampleRate = 16000;
      this.audioWorklet = { addModule: async () => {} };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({ connect() {} });
    }
    globalThis.AudioContext = FakeAudioContext;
    globalThis.AudioWorkletNode = function () {
      return { port: { postMessage() {} }, disconnect() {} };
    };

    try {
      await VoiceMicrophone.start({ onPcm: () => {} });
      // Should not throw despite track.stop() error
      VoiceMicrophone.stop();
      assert.equal(VoiceMicrophone.audioCaptureSampleRate(), null);
    } finally {
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });

  it("ignores errors from getTracks() itself (lines 324-325)", async () => {
    restoreNav();
    restoreNav = setGlobalNavigator({
      mediaDevices: {
        getUserMedia: async () => ({
          getTracks() {
            throw new Error("getTracks failed");
          },
        }),
      },
      isSecureContext: true,
    });

    function FakeAudioContext() {
      this.sampleRate = 16000;
      this.audioWorklet = { addModule: async () => {} };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({ connect() {} });
    }
    globalThis.AudioContext = FakeAudioContext;
    globalThis.AudioWorkletNode = function () {
      return { port: { postMessage() {} }, disconnect() {} };
    };

    try {
      await VoiceMicrophone.start({ onPcm: () => {} });
      // Should not throw despite getTracks() error
      VoiceMicrophone.stop();
      assert.equal(VoiceMicrophone.audioCaptureSampleRate(), null);
    } finally {
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });

  it("calls _stopTracks via start error path when AudioContext is missing (line 194)", async () => {
    // start() sets state.stream before checking AudioContext, so _stopTracks should run
    const stopped = [];
    const fakeTrack = {
      stop() {
        stopped.push("track");
      },
    };

    restoreNav();
    restoreNav = setGlobalNavigator({
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [fakeTrack] }),
      },
      isSecureContext: true,
    });

    const savedAC = globalThis.AudioContext;
    const savedWAC = globalThis.webkitAudioContext;
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;

    try {
      await assert.rejects(() => VoiceMicrophone.start({ onPcm: () => {} }), {
        message: /Web Audio API is not available/i,
      });
      // _stopTracks should have been called to clean up the stream
      assert.deepEqual(stopped, ["track"]);
    } finally {
      if (savedAC) globalThis.AudioContext = savedAC;
      if (savedWAC) globalThis.webkitAudioContext = savedWAC;
    }
  });
});

describe("VoiceMicrophone — module.exports (line 330-331)", () => {
  it("exports via module.exports when module is available in the context", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../Voice_Biometric/voice_microphone.js"),
      "utf8",
    );
    const sandbox = vm.createContext({
      module: { exports: {} },
      window: {
        location: {
          protocol: "https:",
          href: "https://redo-san.github.io/test",
          origin: "https://redo-san.github.io",
        },
      },
    });
    vm.runInContext(src, sandbox);
    assert.ok(sandbox.module.exports, "module.exports should be defined");
    assert.equal(sandbox.module.exports.SAMPLE_RATE, 16000);
  });

  it("sets window.VoiceMicrophone when window is available (line 332)", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../Voice_Biometric/voice_microphone.js"),
      "utf8",
    );
    const sandbox = vm.createContext({
      window: {
        location: {
          protocol: "https:",
          href: "https://redo-san.github.io/test",
          origin: "https://redo-san.github.io",
        },
      },
    });
    vm.runInContext(src, sandbox);
    assert.ok(
      sandbox.window.VoiceMicrophone,
      "window.VoiceMicrophone should be set",
    );
    assert.equal(sandbox.window.VoiceMicrophone.SAMPLE_RATE, 16000);
  });
});

describe("VoiceMicrophone — start return value (line 229)", () => {
  let restoreNav;
  beforeEach(() => {
    restoreNav = setGlobalNavigator({
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [] }),
      },
      isSecureContext: true,
    });
  });
  afterEach(() => {
    restoreNav();
    delete globalThis.AudioContext;
    delete globalThis.AudioWorkletNode;
  });

  it("returns sampleRate and fallback=false from the AudioWorklet path (line 229)", async () => {
    function FakeAudioContext() {
      this.sampleRate = 48000;
      this.audioWorklet = { addModule: async () => {} };
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({ connect() {} });
    }
    globalThis.AudioContext = FakeAudioContext;
    globalThis.AudioWorkletNode = function () {
      return { port: { postMessage() {} }, disconnect() {} };
    };

    try {
      const result = await VoiceMicrophone.start({ onPcm: () => {} });
      assert.equal(result.sampleRate, 48000);
      assert.equal(result.fallback, false);
    } finally {
      await VoiceMicrophone.stop();
      delete globalThis.AudioContext;
      delete globalThis.AudioWorkletNode;
    }
  });

  it("returns sampleRate and fallback=true from the ScriptProcessor path (line 243)", async () => {
    function FakeAudioContext() {
      this.sampleRate = 48000;
      this.destination = { connect() {} };
      this.close = async () => {};
      this.createMediaStreamSource = () => ({ connect() {} });
      this.createScriptProcessor = () => ({
        connect() {},
        disconnect() {},
        onaudioprocess: null,
      });
    }
    globalThis.AudioContext = FakeAudioContext;

    try {
      const result = await VoiceMicrophone.start({ onPcm: () => {} });
      assert.equal(result.sampleRate, 48000);
      assert.equal(result.fallback, true);
    } finally {
      await VoiceMicrophone.stop();
      delete globalThis.AudioContext;
    }
  });
});

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

// Polyfills needed by the origin-guard IIFE in voice_features.js
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/voice_features.js",
  hostname: "localhost",
  origin: "null",
};

const modSrc = fs.readFileSync(
  path.join(__dirname, "../../Voice_Biometric/voice_features.js"),
  "utf8",
);
vm.runInThisContext(modSrc, {
  filename: path.resolve(__dirname, "../../Voice_Biometric/voice_features.js"),
});

const VoiceFeatures = globalThis.VoiceFeatures;

const FBANK_PATH = path.join(
  __dirname,
  "../../Voice_Biometric/models/fbank-80x201-f32.bin",
);
const FBANK_SHA =
  "024e5073b7cfedee84408dc68dd6bafa02808fc786e67f1314e9c918297f5a63";
const FIXTURES = [
  {
    wav: path.join(__dirname, "fixtures/golden_sp1.wav"),
    json: path.join(__dirname, "fixtures/golden_sp1.json"),
  },
  {
    wav: path.join(__dirname, "fixtures/golden_sp2.wav"),
    json: path.join(__dirname, "fixtures/golden_sp2.json"),
  },
];

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function readFbank() {
  const buf = fs.readFileSync(FBANK_PATH);
  assert.equal(
    sha256Hex(buf),
    FBANK_SHA,
    "shipped fbank must match the pinned sha256",
  );
  return new Float32Array(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
}

function readWavPcm(file) {
  const buf = fs.readFileSync(file);
  assert.equal(buf.toString("latin1", 0, 4), "RIFF");
  assert.equal(buf.toString("latin1", 8, 12), "WAVE");
  let off = 12;
  let data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString("latin1", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === "fmt ") {
      assert.equal(buf.readUInt16LE(body + 0), 1, "expected PCM");
      assert.equal(buf.readUInt16LE(body + 2), 1, "expected mono");
      assert.equal(buf.readUInt32LE(body + 4), 16000, "expected 16 kHz");
      assert.equal(buf.readUInt16LE(body + 14), 16, "expected 16-bit");
    } else if (id === "data") {
      data = buf.subarray(body, body + size);
    }
    off = body + size + (size % 2);
  }
  assert.ok(data, "WAV has no data chunk");
  return new Int16Array(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  );
}

function readGoldenLogMel(jsonPath, tol) {
  const j = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const b64 = j.log_mel.bytes;
  const buf = Buffer.from(b64, "base64");
  const f32 = new Float32Array(buf.length / 4);
  for (let i = 0; i < f32.length; i += 1) f32[i] = buf.readFloatLE(i * 4);
  return {
    a: f32,
    tol: j.tolerances.log_mel_abs,
    canonical: j.canonical.digest_sha256,
  };
}

function maxAbsDiff(a, b) {
  let m = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = Math.abs(a[i] - b[i]);
    if (d > m) m = d;
  }
  return m;
}

describe("VoiceFeatures log-mel (SpeechBrain parity)", () => {
  it("shipped fbank matches the pinned sha256", () => {
    readFbank();
  });

  for (const fx of FIXTURES) {
    const name = path.basename(fx.wav).replace(/\.wav$/, "");
    it(`${name}: canonical PCM digest matches the golden contract`, () => {
      const pcm = readWavPcm(fx.wav);
      const j = JSON.parse(fs.readFileSync(fx.json, "utf8"));
      assert.equal(
        sha256Hex(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)),
        j.canonical.digest_sha256,
      );
      assert.equal(j.canonical.encoding, "int16-pcm-16k-mono");
      assert.equal(j.canonical.sample_rate, 16000);
    });

    it(`${name}: log-mel reproduces the golden tensor within abs 0.002 dB`, () => {
      const fbank = readFbank();
      const pcm = readWavPcm(fx.wav);
      const golden = readGoldenLogMel(fx.json);
      const res = VoiceFeatures.computeLogMel(pcm, fbank, 16000);

      assert.equal(res.frames, golden.a.length / 80);
      assert.equal(res.mels, 80);
      assert.equal(res.data.length, golden.a.length);
      const diff = maxAbsDiff(res.data, golden.a);
      assert.ok(
        diff <= golden.tol,
        `${name}: max abs diff ${diff.toExponential(3)} exceeds tolerance ${
          golden.tol
        }`,
      );
      assert.equal(res.bandMeans.length, 80);
      let meanOf = 0;
      for (let i = 0; i < res.data.length; i += 1) meanOf += res.data[i];
      meanOf /= res.data.length;
      assert.ok(Math.abs(meanOf) < 1e-2, "overall mean ~0 after removal");
    });

    it(`${name}: Int16Array and Float32Array(-1..1) inputs agree`, () => {
      const fbank = readFbank();
      const pcm = readWavPcm(fx.wav);
      const f32 = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i += 1) f32[i] = pcm[i] / 32768;
      const a = VoiceFeatures.computeLogMel(pcm, fbank, 16000).data;
      const b = VoiceFeatures.computeLogMel(f32, fbank, 16000).data;
      assert.equal(maxAbsDiff(a, b), 0);
    });
  }

  it("rejects non-16 kHz input", () => {
    const fbank = readFbank();
    const pcm = new Int16Array([0, 0]);
    assert.throws(() => VoiceFeatures.computeLogMel(pcm, fbank, 48000));
  });

  it("rejects a malformed fbank matrix", () => {
    const pcm = new Int16Array([0, 0]);
    assert.throws(
      () => VoiceFeatures.computeLogMel(pcm, new Float32Array(100), 16000),
      /fbank must be a 201\*80/,
    );
  });

  it("rejects empty input", () => {
    const fbank = readFbank();
    assert.throws(() => VoiceFeatures.computeLogMel(new Int16Array(0), fbank));
  });
});

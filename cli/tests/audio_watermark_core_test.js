const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};
globalThis.document = {
  createElement: () => null,
  addEventListener: () => {},
  getElementById: () => null,
};
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

const src = fs.readFileSync(
  path.join(__dirname, "../../Audio_Watermark/audio_watermark_core.js"),
  "utf8",
);
vm.runInThisContext(src, {
  filename: path.resolve(
    __dirname,
    "../../Audio_Watermark/audio_watermark_core.js",
  ),
});
const utils = fs.readFileSync(
  path.join(__dirname, "../../Watermark/utils.js"),
  "utf8",
);
vm.runInThisContext(utils, {
  filename: path.resolve(__dirname, "../../Watermark/utils.js"),
});

function makeTestWav(numSamples, sr) {
  sr = sr || 44100;
  const bps = 16,
    ch = 1,
    ba = ch * (bps / 8);
  const dataSize = numSamples * ba;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const w = (o, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * ba, true);
  v.setUint16(32, ba, true);
  v.setUint16(34, bps, true);
  w(36, "data");
  v.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) {
    const val = Math.floor(Math.sin((2 * Math.PI * 440 * i) / sr) * 16000);
    v.setInt16(44 + i * 2, val, true);
  }
  return buf;
}

const KEY = "key123";
const MSG_A = new TextEncoder().encode("a");
const MSG_HI = new TextEncoder().encode("hi");

function embedAndExtract(embedFn, extractFn, s16, payload, sr, numBits) {
  const embedded = embedFn(new Int16Array(s16), payload, sr);
  const bits = extractFn(embedded, sr, numBits);
  const result = awExtractPayload(bits, KEY);
  if (!result || result === "bad-password") return null;
  return new TextDecoder().decode(result);
}

describe("Audio Watermark — WAV I/O", () => {
  it("awReadWav should parse a valid WAV file", () => {
    const buf = makeTestWav(4410, 44100);
    const wav = awReadWav(buf);
    assert.equal(wav.sr, 44100);
    assert.equal(wav.ch, 1);
    assert.equal(wav.bps, 16);
    assert.ok(wav.samples instanceof Int16Array);
    assert.equal(wav.samples.length, 4410);
  });

  it("awReadWav should throw for non-RIFF", () => {
    const buf = new ArrayBuffer(44);
    assert.throws(() => awReadWav(buf), /Not a RIFF/);
  });

  it("awWriteWav should produce a valid WAV", () => {
    const mono = new Int16Array(100);
    for (let i = 0; i < 100; i++) mono[i] = i;
    const buf = awWriteWav(mono, 44100, 1, null, 16);
    const back = awReadWav(buf);
    assert.equal(back.sr, 44100);
    assert.equal(back.ch, 1);
    for (let i = 0; i < 100; i++) assert.equal(back.samples[i], i);
  });
});

describe("Audio Watermark — FFT", () => {
  it("awFft and awIfft should roundtrip", () => {
    const n = 1024;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      re[i] =
        Math.sin((2 * Math.PI * 50 * i) / n) +
        Math.sin((2 * Math.PI * 120 * i) / n);
    }
    const orig = new Float64Array(re);
    awFft(re, im);
    awIfft(re, im);
    for (let i = 0; i < n; i++) {
      assert.ok(
        Math.abs(re[i] - orig[i]) < 1e-10,
        `FFT roundtrip mismatch at ${i}`,
      );
    }
  });
});

describe("Audio Watermark — Payload Helpers", () => {
  it("awFormatPayload and awExtractPayload should roundtrip with key", () => {
    const bitsStr = awFormatPayload(MSG_A, KEY);
    const result = awExtractPayload(bitsStr, KEY);
    assert.ok(result instanceof Uint8Array);
    assert.equal(new TextDecoder().decode(result), "a");
  });

  it("awExtractPayload should return null for short input", () => {
    assert.equal(awExtractPayload("", KEY), null);
    assert.equal(awExtractPayload("1010", KEY), null);
  });

  it("awExtractPayload should handle wrong key gracefully", () => {
    const bitsStr = awFormatPayload(MSG_A, KEY);
    const result = awExtractPayload(bitsStr, "wrong-key");
    // XOR with wrong key may produce 0xAA,0xBB markers by coincidence (~1/65536)
    // Accept either 'bad-password' detection or a garbled Uint8Array
    if (result === "bad-password") {
      assert.ok(true, "wrong key detected");
    } else if (result instanceof Uint8Array) {
      const decoded = new TextDecoder().decode(result);
      // Garbled text is acceptable; just ensure it doesn't throw
      assert.ok(typeof decoded === "string");
    } else {
      assert.equal(result, null);
    }
  });
});

describe("Audio Watermark — Algorithm 1: LSB (1 sample/bit)", () => {
  it("should embed and extract a message", () => {
    const payload = awFormatPayload(MSG_HI, KEY);
    const buf = makeTestWav(200, 44100);
    const s16 = new Int16Array(awReadWav(buf).samples);
    const embedded = aw1_embed(s16, payload);
    const bits = aw1_extract(embedded, embedded.length);
    const result = awExtractPayload(bits, KEY);
    assert.equal(new TextDecoder().decode(result), "hi");
  });
});

describe("Audio Watermark — Algorithm 2: FFT-QIM (2048 samples/bit)", () => {
  it("should embed and extract a message", () => {
    const payload = awFormatPayload(MSG_HI, KEY);
    const neededSamples = payload.length * 2048;
    const buf = makeTestWav(neededSamples + 2048, 44100);
    const s16 = new Int16Array(awReadWav(buf).samples);
    const embedded = aw2_embed(s16, payload, 44100);
    const bits = aw2_extract(embedded, 44100, s16.length);
    const result = awExtractPayload(bits, KEY);
    assert.equal(new TextDecoder().decode(result), "hi");
  });
});

describe("Audio Watermark — Algorithm 3: DCT-QIM (4096 samples/bit)", () => {
  it("should embed and extract a short message", () => {
    const payload = awFormatPayload(MSG_A, KEY);
    const neededSamples = payload.length * 4096;
    const buf = makeTestWav(neededSamples + 4096, 44100);
    const s16 = new Int16Array(awReadWav(buf).samples);
    const embedded = aw3_embed(s16, payload, 44100);
    const bits = aw3_extract(embedded, 44100, s16.length);
    const result = awExtractPayload(bits, KEY);
    assert.equal(new TextDecoder().decode(result), "a");
  });
});

describe("Audio Watermark — Algorithm 4: DSSS (2048 samples/bit)", () => {
  it("should embed and extract a message", () => {
    const payload = awFormatPayload(MSG_HI, KEY);
    const neededSamples = payload.length * 2048;
    const buf = makeTestWav(neededSamples + 2048, 44100);
    const s16 = new Int16Array(awReadWav(buf).samples);
    const embedded = aw4_embed(s16, payload, 44100);
    const bits = aw4_extract(embedded, 44100, s16.length);
    const result = awExtractPayload(bits, KEY);
    assert.equal(new TextDecoder().decode(result), "hi");
  });
});

describe("Audio Watermark — Algorithm 5: QIM (1 sample/bit)", () => {
  it("should embed and extract a message", () => {
    const payload = awFormatPayload(MSG_HI, KEY);
    const buf = makeTestWav(200, 44100);
    const s16 = new Int16Array(awReadWav(buf).samples);
    const embedded = aw5_embed(s16, payload, 44100);
    const bits = aw5_extract(embedded, 44100, s16.length);
    const result = awExtractPayload(bits, KEY);
    assert.equal(new TextDecoder().decode(result), "hi");
  });
});

describe("Audio Watermark — Algorithm 6: DWT (1024 samples/bit)", () => {
  it("should embed and extract a message", () => {
    const payload = awFormatPayload(MSG_HI, KEY);
    const neededSamples = payload.length * 1024;
    const buf = makeTestWav(neededSamples + 1024, 44100);
    const s16 = new Int16Array(awReadWav(buf).samples);
    const embedded = aw6_embed(s16, payload, 44100);
    const bits = aw6_extract(embedded, 44100, s16.length);
    const result = awExtractPayload(bits, KEY);
    assert.equal(new TextDecoder().decode(result), "hi");
  });
});

describe("Audio Watermark — Algorithm 7: DCT-QIM (512 samples/bit)", () => {
  it("should embed and extract a short message", () => {
    const payload = awFormatPayload(MSG_A, KEY);
    const neededSamples = payload.length * 512;
    const buf = makeTestWav(neededSamples + 512, 44100);
    const s16 = new Int16Array(awReadWav(buf).samples);
    const embedded = aw7_embed(s16, payload, 44100);
    const bits = aw7_extract(embedded, 44100, s16.length);
    const result = awExtractPayload(bits, KEY);
    assert.equal(new TextDecoder().decode(result), "a");
  });
});

describe("Audio Watermark — Algorithm 8: DCT (1024 samples/bit, sync)", () => {
  it("should embed and extract a message", () => {
    const payload = awFormatPayload(MSG_HI, KEY);
    const neededSamples = payload.length * 1024;
    const buf = makeTestWav(neededSamples + 1024, 44100);
    const s16 = new Int16Array(awReadWav(buf).samples);
    const embedded = aw8_embed(s16, payload, 44100);
    const bits = aw8_extract(embedded, 44100, s16.length);
    const result = awExtractPayload(bits, KEY);
    assert.equal(new TextDecoder().decode(result), "hi");
  });
});

describe("Audio Watermark — Algorithm 8: DCT (async)", () => {
  it("should embed and extract asynchronously", async () => {
    const payload = awFormatPayload(MSG_HI, KEY);
    const neededSamples = payload.length * 1024;
    const buf = makeTestWav(neededSamples + 1024, 44100);
    const s16 = new Int16Array(awReadWav(buf).samples);
    const embedded = await aw8_embed_async(new Int16Array(s16), payload, 44100);
    const bits = await aw8_extract_async(embedded, 44100, s16.length);
    const result = awExtractPayload(bits, KEY);
    assert.equal(new TextDecoder().decode(result), "hi");
  });
});

describe("Audio Watermark — capacity helpers (maxBits)", () => {
  it("aw4_maxBits should compute DSSS capacity", () => {
    // aw4_maxBits returns floor(audioLen / 2048)
    var bits = aw4_maxBits(20480, 44100); // AWM4_FRAME = 2048
    assert.equal(bits, 10);
    bits = aw4_maxBits(0, 44100);
    assert.equal(bits, 0);
  });

  it("aw6_maxBits should compute DWT capacity (floor(audioLen / 1024))", () => {
    var bits = aw6_maxBits(10240, 44100);
    assert.equal(bits, 10);
    bits = aw6_maxBits(0, 44100);
    assert.equal(bits, 0);
  });

  it("aw7_maxBits should compute DCT-QIM capacity (floor(audioLen / 512))", () => {
    var bits = aw7_maxBits(10240, 44100); // AWM7_FRAME = 512
    assert.equal(bits, 20);
    bits = aw7_maxBits(0, 44100);
    assert.equal(bits, 0);
  });

  it("aw8_maxBits should compute DCT capacity (floor(audioLen / 1024))", () => {
    var bits = aw8_maxBits(20480, 44100); // AWM8_FRAME = 1024
    assert.equal(bits, 20);
    bits = aw8_maxBits(0, 44100);
    assert.equal(bits, 0);
  });

  it("aw2_maxBits should compute Phase Coding capacity (line 327-329)", () => {
    // aw2_maxBits returns floor(audioLen / AWM2_FRAME) where AWM2_FRAME = 2048
    var bits = aw2_maxBits(20480, 44100);
    assert.equal(bits, 10);
    bits = aw2_maxBits(0, 44100);
    assert.equal(bits, 0);
  });

  it("aw3_maxBits should compute Echo Hiding capacity (line 407-409)", () => {
    // aw3_maxBits returns floor(audioLen / AWM3_FRAME) where AWM3_FRAME = 4096
    var bits = aw3_maxBits(40960, 44100);
    assert.equal(bits, 10);
    bits = aw3_maxBits(0, 44100);
    assert.equal(bits, 0);
  });
});

// ── Additional coverage: awReadWavRaw, awReadRightChannel, awWriteWav dual path ──
describe("Audio Watermark — awReadWavRaw", () => {
  it("should read raw interleaved samples from a WAV", () => {
    const buf = makeTestWav(1000, 44100);
    const result = awReadWavRaw(buf);
    assert.ok(result.samples instanceof Int16Array);
    assert.equal(result.samples.length, 1000);
    assert.ok(result.raw instanceof Int16Array);
    assert.equal(result.raw.length, 1000);
    assert.equal(result.ch, 1);
    assert.equal(result.sr, 44100);
  });
});

describe("Audio Watermark — awReadRightChannel", () => {
  it("should return null for mono WAV", () => {
    const monoBuf = makeTestWav(1000, 44100);
    const result = awReadRightChannel(monoBuf);
    assert.equal(result, null);
  });

  it("should extract right channel from stereo WAV", () => {
    // Build a stereo WAV manually
    const numSamples = 200;
    const sr = 44100;
    const bps = 16,
      ch = 2,
      ba = ch * (bps / 8);
    const dataSize = numSamples * ba;
    const buf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(buf);
    const w = (o, s) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
    };
    w(0, "RIFF");
    v.setUint32(4, 36 + dataSize, true);
    w(8, "WAVE");
    w(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, ch, true);
    v.setUint32(24, sr, true);
    v.setUint32(28, sr * ba, true);
    v.setUint16(32, ba, true);
    v.setUint16(34, bps, true);
    w(36, "data");
    v.setUint32(40, dataSize, true);
    // Fill left=1000, right=2000
    for (let i = 0; i < numSamples; i++) {
      v.setInt16(44 + i * ba, 1000, true); // left
      v.setInt16(44 + i * ba + 2, 2000, true); // right
    }
    const result = awReadRightChannel(buf);
    assert.ok(result instanceof Int16Array);
    assert.equal(result.length, numSamples);
    assert.equal(result[0], 2000);
    assert.equal(result[99], 2000);
  });
});

describe("Audio Watermark — awWriteWav dual path", () => {
  it("should write stereo from dual mono arrays", () => {
    const sr = 44100;
    const len = 100;
    const left = new Int16Array(len);
    const right = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      left[i] = 100;
      right[i] = 200;
    }
    const buf = awWriteWav([left, right], sr, 2);
    // Verify the WAV has proper RIFF header
    const v = new DataView(buf);
    const riff = String.fromCharCode(
      v.getUint8(0),
      v.getUint8(1),
      v.getUint8(2),
      v.getUint8(3),
    );
    assert.equal(riff, "RIFF");
    const wave = String.fromCharCode(
      v.getUint8(8),
      v.getUint8(9),
      v.getUint8(10),
      v.getUint8(11),
    );
    assert.equal(wave, "WAVE");
    // Check channels = 2
    assert.equal(v.getUint16(22, true), 2);
    // Check sample rate
    assert.equal(v.getUint32(24, true), sr);
    // Check left and right channel data
    assert.equal(v.getInt16(44, true), 100);
    assert.equal(v.getInt16(46, true), 200);
  });
});

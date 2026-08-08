const { describe, it } = require("node:test");
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
globalThis.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

const coreSrc = fs.readFileSync(
  path.join(__dirname, "../../Pixel_Injection/watermark_core_advanced.js"),
  "utf8",
);
vm.runInThisContext(coreSrc, {
  filename: path.resolve(
    __dirname,
    "../../Pixel_Injection/watermark_core_advanced.js",
  ),
});
const transformsSrc = fs.readFileSync(
  path.join(__dirname, "../../Pixel_Injection/watermark_core_transforms.js"),
  "utf8",
);
vm.runInThisContext(transformsSrc, {
  filename: path.resolve(
    __dirname,
    "../../Pixel_Injection/watermark_core_transforms.js",
  ),
});
const algorithmsSrc = fs.readFileSync(
  path.join(__dirname, "../../Pixel_Injection/watermark_core_algorithms.js"),
  "utf8",
);
vm.runInThisContext(algorithmsSrc, {
  filename: path.resolve(
    __dirname,
    "../../Pixel_Injection/watermark_core_algorithms.js",
  ),
});

const advSrc = fs.readFileSync(
  path.join(__dirname, "../../Pixel_Injection/advanced_watermarking.js"),
  "utf8",
);
vm.runInThisContext(advSrc, {
  filename: path.resolve(
    __dirname,
    "../../Pixel_Injection/advanced_watermarking.js",
  ),
});

function makeImage(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 128;
    data[i + 3] = 255;
  }
  return new ImageData(data, w, h);
}

describe("AdvancedWatermarking — constructor", () => {
  it("should instantiate without error", () => {
    const aw = new AdvancedWatermarking();
    assert.ok(aw instanceof AdvancedWatermarking);
    assert.ok(aw.algorithms);
    assert.ok(aw.detection);
  });

  it("should expose 19 algorithms", () => {
    const aw = new AdvancedWatermarking();
    const names = Object.keys(aw.algorithms);
    assert.equal(names.length, 19);
  });

  it("should expose 5 detection methods", () => {
    const aw = new AdvancedWatermarking();
    const names = Object.keys(aw.detection);
    assert.equal(names.length, 5);
  });
});

describe("AdvancedWatermarking — delegation to WatermarkCore", () => {
  it("should delegate enhanced_lsb to WatermarkCore", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.enhanced_lsb(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate multi_channel_lsb", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.multi_channel_lsb(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate random_lsb", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.random_lsb(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate adaptive_lsb", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.adaptive_lsb(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate dct", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.dct(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate dwt", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.dwt(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate dft", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.dft(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate hybrid_dct_dwt", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.hybrid_dct_dwt(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate vine", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.vine(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate pixel_seal", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.pixel_seal(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate nullguard", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.nullguard(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate shallow_diffuse", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.shallow_diffuse(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate diffusion_based", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.diffusion_based(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate imagewmark", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.imagewmark(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate meta_seal", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.meta_seal(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate stardustmark", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.stardustmark(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate invisimark", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.invisimark(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });

  it("should delegate elevenlikes", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.elevenlikes(img, "test msg", "pw", {});
    assert.ok(wm instanceof ImageData);
  });
});

describe("AdvancedWatermarking — detection delegation", () => {
  it("should extract DCT via _core.extractDCT", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.dct(img, "hello", "key", {});
    const result = aw._core.extractDCT(wm);
    assert.equal(result, "hello");
  });

  it("should delegate blind_decoding for lsb", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.enhanced_lsb(img, "hello", "key", {});
    const result = aw.detection.blind_decoding(wm, "enhanced_lsb");
    assert.ok(typeof result === "string");
  });

  it("should delegate quality_metrics", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.enhanced_lsb(img, "hello", "key", {});
    const q = aw.detection.quality_metrics(img, wm);
    assert.ok(q.psnr > 0);
    assert.ok(q.ssim > 0);
  });
});

describe("AdvancedWatermarking — utility methods", () => {
  it("should have stringToBinary", () => {
    const aw = new AdvancedWatermarking();
    const bin = aw.stringToBinary("A");
    assert.equal(bin, "01000001");
  });

  it("should have binaryToString", () => {
    const aw = new AdvancedWatermarking();
    const str = aw.binaryToString("01000001");
    assert.equal(str, "A");
  });

  it("should have calculatePSNR for identical images", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(4, 4);
    const psnr = aw.calculatePSNR(img, img);
    assert.equal(psnr, Infinity);
  });

  it("should have calculatePSNR for different images", () => {
    const aw = new AdvancedWatermarking();
    const img1 = makeImage(4, 4);
    const data2 = new Uint8ClampedArray(img1.data);
    data2[0] = 255; // Change one pixel
    const img2 = new ImageData(data2, 4, 4);
    const psnr = aw.calculatePSNR(img1, img2);
    assert.ok(psnr > 0 && psnr !== Infinity);
    assert.ok(Number.isFinite(psnr));
  });

  it("should have calculateSSIM for identical images", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(4, 4);
    const ssim = aw.calculateSSIM(img, img);
    assert.equal(ssim, 1);
  });

  it("should have calculateSSIM for different images", () => {
    const aw = new AdvancedWatermarking();
    const img1 = makeImage(4, 4);
    const data2 = new Uint8ClampedArray(img1.data);
    data2[0] = 0;
    const img2 = new ImageData(data2, 4, 4);
    const ssim = aw.calculateSSIM(img1, img2);
    assert.ok(ssim > 0);
    assert.ok(ssim <= 1);
  });

  it("should have calculateCRC32", () => {
    const aw = new AdvancedWatermarking();
    const crc = aw.calculateCRC32("hello");
    assert.ok(typeof crc === "string");
    assert.equal(crc.length, 8);
  });

  it("calculateCRC32 should be deterministic", () => {
    const aw = new AdvancedWatermarking();
    assert.equal(aw.calculateCRC32("hello"), aw.calculateCRC32("hello"));
    assert.notEqual(aw.calculateCRC32("hello"), aw.calculateCRC32("world"));
  });
});

// ══════════════════════════════════════════════════════════════════
// New tests for methods not previously covered
// ══════════════════════════════════════════════════════════════════

describe("AdvancedWatermarking — Math utilities (MSE, Mean, StdDev, Covariance)", () => {
  it("calculateMSE should return 0 for identical images", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(4, 4);
    assert.equal(aw.calculateMSE(img, img), 0);
  });

  it("calculateMSE should return positive for different images", () => {
    const aw = new AdvancedWatermarking();
    const img1 = makeImage(4, 4);
    const data2 = new Uint8ClampedArray(img1.data);
    data2[0] = 0;
    const img2 = new ImageData(data2, 4, 4);
    assert.ok(aw.calculateMSE(img1, img2) > 0);
  });

  it("calculateMean should compute average pixel value", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(2, 2);
    // All pixels are RGBA(128,128,128,255) = 16 values, sum = 128*4=512 per pixel? No...
    // 2*2*4 = 16 values, all 128 except the last channel (alpha=255)
    // Actually makeImage creates 128 for R,G,B and 255 for A
    // So 3 channels at 128 = 384, plus 1 channel at 255 = 639 for first pixel
    // But it's simpler: the mean depends on actual values
    const mean = aw.calculateMean(img);
    // (128*12 + 255*4) / 16 = (1536 + 1020) / 16 = 2556/16 = 159.75
    assert.equal(mean, 159.75);
  });

  it("calculateMean for uniform data returns correct value", () => {
    const aw = new AdvancedWatermarking();
    const data = new Uint8ClampedArray([100, 100, 100, 255]);
    const img = new ImageData(data, 1, 1);
    const mean = aw.calculateMean(img);
    assert.equal(mean, 138.75);
  });

  it("calculateStdDev should compute standard deviation", () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(2, 2);
    const mean = aw.calculateMean(img);
    const stddev = aw.calculateStdDev(img, mean);
    assert.ok(stddev > 0);
    // All pixels identical, so stddev is determined by the difference of 255 vs 128
    // variance = ((128-159.75)^2*12 + (255-159.75)^2*4) / 16
    // = (1007.0625*12 + 9070.5625*4) / 16
    // = (12084.75 + 36282.25) / 16 = 48367/16 = 3022.9375
    // stddev = sqrt(3022.9375) ≈ 54.98
    assert.ok(stddev > 50 && stddev < 60);
  });

  it("calculateCovariance should compute covariance between two images", () => {
    const aw = new AdvancedWatermarking();
    const img1 = makeImage(2, 2);
    const img2 = makeImage(2, 2);
    const mean1 = aw.calculateMean(img1);
    const mean2 = aw.calculateMean(img2);
    const cov = aw.calculateCovariance(img1, img2, mean1, mean2);
    // Identical images -> covariance = variance
    assert.ok(cov > 0);
  });

  it("calculateCovariance should handle different images", () => {
    const aw = new AdvancedWatermarking();
    const img1 = makeImage(2, 2);
    const data2 = new Uint8ClampedArray(img1.data);
    data2[0] = 255;
    const img2 = new ImageData(data2, 2, 2);
    const mean1 = aw.calculateMean(img1);
    const mean2 = aw.calculateMean(img2);
    const cov = aw.calculateCovariance(img1, img2, mean1, mean2);
    assert.ok(typeof cov === "number");
  });
});

describe("AdvancedWatermarking — Error correction and redundancy", () => {
  it("addErrorCorrection should append CRC32", () => {
    const aw = new AdvancedWatermarking();
    const result = aw.addErrorCorrection("01");
    assert.ok(result.startsWith("01|"));
    assert.ok(result.length > 3);
    // CRC32 hex string (8 chars, possibly with leading minus due to signed 32-bit)
    const crc = result.substring(3);
    assert.ok(crc.length === 8 || (crc.startsWith("-") && crc.length === 9));
  });

  it("addRedundancy should repeat each bit N times", () => {
    const aw = new AdvancedWatermarking();
    const result = aw.addRedundancy("hi", 3);
    // "h" = 0x68 = 01101000, "i" = 0x69 = 01101001
    // Each bit repeated 3 times
    assert.ok(result.length > 0);
    assert.equal(result.length % 3, 0);
  });
});

describe("AdvancedWatermarking — DCT/IDCT transforms", () => {
  it("applyDCT should produce a DCT block", () => {
    const aw = new AdvancedWatermarking();
    const block = [
      [100, 100, 100],
      [100, 100, 100],
      [100, 100, 100],
    ];
    const dctBlock = aw.applyDCT(block);
    assert.equal(dctBlock.length, 3);
    assert.equal(dctBlock[0].length, 3);
    // DC coefficient should be non-zero
    assert.ok(dctBlock[0][0] !== 0);
  });

  it("applyInverseDCT should reconstruct block", () => {
    const aw = new AdvancedWatermarking();
    const block = [
      [100, 100, 100],
      [100, 100, 100],
      [100, 100, 100],
    ];
    const dctBlock = aw.applyDCT(block);
    const reconstructed = aw.applyInverseDCT(dctBlock);
    assert.equal(reconstructed.length, 3);
    assert.equal(reconstructed[0].length, 3);
    // Values should be close to original (some rounding error is fine)
    assert.ok(Math.abs(reconstructed[0][0] - 100) < 1);
  });
});

describe("AdvancedWatermarking — Block operations (extractBlock, putBlock)", () => {
  it("extractBlock should extract a block from image data", () => {
    const aw = new AdvancedWatermarking();
    const w = 8;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    // Fill with test pattern: pixel at (2,2) in red channel should be unique
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 50; // R
      data[i + 1] = 100; // G
      data[i + 2] = 150; // B
      data[i + 3] = 255; // A
    }
    // Set a specific pixel to a different value for verification
    const pixelIdx = (2 * w + 3) * 4; // (x=3, y=2)
    data[pixelIdx] = 200;

    const block = aw.extractBlock(data, 0, 0, w, 4);
    assert.equal(block.length, 4);
    assert.equal(block[0].length, 4);
    // Check that pixel (3,2) in block coords equals the value we set
    assert.equal(block[2][3], 200);
  });

  it("putBlock should insert a block into image data", () => {
    const aw = new AdvancedWatermarking();
    const w = 8;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;
    }
    const block = [
      [1, 2],
      [3, 4],
    ];
    aw.putBlock(data, block, 0, 0, w);
    // Verify pixel (0,0) = 1, (1,0) = 2, (0,1) = 3, (1,1) = 4
    assert.equal(data[0], 1);
    assert.equal(data[4], 2); // (1,0): 1*4=4 bytes offset
    assert.equal(data[w * 4], 3); // (0,1): 8*4=32 bytes offset
    assert.equal(data[w * 4 + 4], 4); // (1,1)
  });

  it("extractBlock and putBlock should round-trip", () => {
    const aw = new AdvancedWatermarking();
    const w = 16;
    const h = 16;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 42;
    }
    const extracted = aw.extractBlock(data, 4, 4, w, 4);
    assert.equal(extracted[0][0], 42);
    // Modify and put back
    extracted[0][0] = 99;
    aw.putBlock(data, extracted, 4, 4, w);
    const pixelIdx = (4 * w + 4) * 4;
    assert.equal(data[pixelIdx], 99);
  });
});

describe("AdvancedWatermarking — Coefficient modification", () => {
  it("modifyCoefficient should embed bit via quantization", () => {
    const aw = new AdvancedWatermarking();
    // coefficient=100, strength=10, bit=1
    const result = aw.modifyCoefficient(100, 1, 10);
    // quantized = round(100/10) = 10, modified = (10 & ~1) | 1 = 11, result = 11*10 = 110
    assert.equal(result, 110);
  });

  it("modifyCoefficient should embed bit=0", () => {
    const aw = new AdvancedWatermarking();
    const result = aw.modifyCoefficient(100, 0, 10);
    // quantized = 10, modified = (10 & ~1) | 0 = 10, result = 100
    assert.equal(result, 100);
  });

  it("embedInCoefficient should set LSB", () => {
    const aw = new AdvancedWatermarking();
    // 100 = 0b1100100, LSB = 0
    assert.equal(aw.embedInCoefficient(100, 1), 101); // 0b1100101
    assert.equal(aw.embedInCoefficient(100, 0), 100); // stays 100
    assert.equal(aw.embedInCoefficient(101, 0), 100); // 101 -> 100
    assert.equal(aw.embedInCoefficient(101, 1), 101); // stays 101
  });
});

describe("AdvancedWatermarking — JND and perceptual masking", () => {
  it("getJNDThreshold should return correct threshold for brightness levels (number)", () => {
    const aw = new AdvancedWatermarking();
    assert.equal(aw.getJNDThreshold(0), 2);
    assert.equal(aw.getJNDThreshold(63), 2);
    assert.equal(aw.getJNDThreshold(64), 4);
    assert.equal(aw.getJNDThreshold(127), 4);
    assert.equal(aw.getJNDThreshold(128), 8);
    assert.equal(aw.getJNDThreshold(255), 8);
  });

  it("getJNDThreshold should handle object with r,g,b", () => {
    const aw = new AdvancedWatermarking();
    assert.equal(aw.getJNDThreshold({ r: 0, g: 0, b: 0 }), 2);
    assert.equal(aw.getJNDThreshold({ r: 64, g: 64, b: 64 }), 4);
    assert.equal(aw.getJNDThreshold({ r: 128, g: 128, b: 128 }), 8);
    assert.equal(aw.getJNDThreshold({ r: 200, g: 200, b: 200 }), 8);
  });

  it("calculateJNDMask should return JND array for pixel", () => {
    const aw = new AdvancedWatermarking();
    const data = new Uint8ClampedArray([10, 10, 10, 255]); // dark pixel
    const mask = aw.calculateJNDMask(data, 0, 0, 0);
    assert.equal(mask.length, 3);
    assert.equal(mask[0], 2);
    assert.equal(mask[1], 2);
    assert.equal(mask[2], 2);
  });

  it("calculateJNDMask for bright pixel", () => {
    const aw = new AdvancedWatermarking();
    const data = new Uint8ClampedArray([200, 200, 200, 255]); // bright pixel
    const mask = aw.calculateJNDMask(data, 0, 0, 0);
    assert.equal(mask[0], 8);
  });

  it("applyPerceptualMask should modify pixel with JND", () => {
    const aw = new AdvancedWatermarking();
    // pixel=100, bit=1, pattern=1
    // JND for 100 = 4, modification = 1 * 1 * 4 = 4, result = 104
    const result = aw.applyPerceptualMask(100, 1, 1);
    assert.equal(result, 104);
  });

  it("applyPerceptualMask with bit=0 should return original", () => {
    const aw = new AdvancedWatermarking();
    const result = aw.applyPerceptualMask(100, 0, 1);
    assert.equal(result, 100);
  });

  it("applyPerceptualMask should clamp to [0, 255]", () => {
    const aw = new AdvancedWatermarking();
    assert.equal(aw.applyPerceptualMask(250, 1, 10), 255);
    assert.equal(aw.applyPerceptualMask(5, 1, -10), 0);
  });
});

describe("AdvancedWatermarking — Spread spectrum and PN sequence", () => {
  it("generatePNSequence should produce sequence of ±1 values", () => {
    const aw = new AdvancedWatermarking();
    const seq = aw.generatePNSequence(10);
    assert.equal(seq.length, 10);
    seq.forEach((v) => {
      assert.ok(v === 1 || v === -1);
    });
  });

  it("generatePNSequence should be deterministic for same length", () => {
    const aw = new AdvancedWatermarking();
    const seq1 = aw.generatePNSequence(10);
    const seq2 = aw.generatePNSequence(10);
    assert.deepEqual(seq1, seq2);
  });

  it("generatePNSequence should have valid ±1 entries", () => {
    const aw = new AdvancedWatermarking();
    const seq = aw.generatePNSequence(100);
    assert.equal(seq.length, 100);
    seq.forEach((v) => {
      assert.ok(v === 1 || v === -1, `expected ±1 but got ${v}`);
    });
  });

  it("applySpreadSpectrum should multiply pattern by PN sequence", () => {
    const aw = new AdvancedWatermarking();
    const pattern = [1, -1, 1, -1];
    const result = aw.applySpreadSpectrum(pattern);
    assert.equal(result.length, pattern.length);
    // Each element should be pattern[i] * pnSequence[i]
    // The first value: pattern[0]=1 * pnSequence[0] (which is ±1)
    assert.ok(result[0] === 1 || result[0] === -1);
  });

  it("applySpreadSpectrum for zero pattern should produce zeros", () => {
    const aw = new AdvancedWatermarking();
    // Actually if pattern has zeros... but the method doesn't change pattern values
    const pattern = [0, 0, 0];
    const result = aw.applySpreadSpectrum(pattern);
    assert.equal(result.length, 3);
    assert.equal(result[0], 0);
    assert.equal(result[1], 0);
    assert.equal(result[2], 0);
  });
});

describe("AdvancedWatermarking — Adversarial pattern generation", () => {
  it("generateAdversarialPattern should produce spread spectrum pattern", () => {
    const aw = new AdvancedWatermarking();
    const message = "1010";
    const pattern = aw.generateAdversarialPattern(message);
    assert.ok(Array.isArray(pattern));
    assert.equal(pattern.length, message.length);
    // Each value should be ±1 * PN sequence value
    pattern.forEach((v) => {
      assert.ok(typeof v === "number");
    });
  });

  it("generateAdversarialPattern should handle zero message", () => {
    const aw = new AdvancedWatermarking();
    const pattern = aw.generateAdversarialPattern("");
    assert.equal(pattern.length, 0);
  });
});

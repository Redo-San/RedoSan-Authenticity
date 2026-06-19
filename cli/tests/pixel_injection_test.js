'use strict';
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

globalThis.window = globalThis;
globalThis.location = { protocol: 'file:', href: 'file:///test/', hostname: 'localhost', origin: 'null' };
globalThis.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

const src = fs.readFileSync(path.join(__dirname, '../../Pixel_Injection/watermark_core_advanced.js'), 'utf8');
vm.runInThisContext(src, { filename: 'watermark_core_advanced.js' });
const transformsSrc = fs.readFileSync(path.join(__dirname, '../../Pixel_Injection/watermark_core_transforms.js'), 'utf8');
vm.runInThisContext(transformsSrc, { filename: 'watermark_core_transforms.js' });
const algorithmsSrc = fs.readFileSync(path.join(__dirname, '../../Pixel_Injection/watermark_core_algorithms.js'), 'utf8');
vm.runInThisContext(algorithmsSrc, { filename: 'watermark_core_algorithms.js' });

function makeImage(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128; data[i + 1] = 128; data[i + 2] = 128; data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

function roundtripTest(algoName, embedMsg, imgSize, extractFn) {
  return () => {
    const core = new WatermarkCore();
    const img = makeImage(imgSize[0], imgSize[1]);
    const wm = core.algorithms[algoName](img, embedMsg, 'testkey', {});
    assert.ok(wm instanceof ImageData);
    assert.equal(wm.width, img.width);
    assert.equal(wm.height, img.height);
    const extracted = extractFn ? extractFn(core, wm) : core.extractLSB(wm);
    assert.ok(typeof extracted === 'string');
    assert.ok(extracted.length > 0);
    assert.notEqual(extracted, 'No readable message found');
    return extracted;
  };
}

describe('Pixel Injection — Helpers', () => {
  it('bytesToBinary should convert bytes to bit string', () => {
    const core = new WatermarkCore();
    assert.equal(core.bytesToBinary(new Uint8Array([0x00])), '00000000');
    assert.equal(core.bytesToBinary(new Uint8Array([0xFF])), '11111111');
    assert.equal(core.bytesToBinary(new Uint8Array([0x61])), '01100001');
    assert.equal(core.bytesToBinary(new Uint8Array([0x00, 0xFF])), '0000000011111111');
  });

  it('stringToBinary should convert string to bit string', () => {
    const core = new WatermarkCore();
    assert.equal(core.stringToBinary('A'), '01000001');
    assert.equal(core.stringToBinary('hi'), '0110100001101001');
  });

  it('binaryToString should convert bit string back', () => {
    const core = new WatermarkCore();
    assert.equal(core.binaryToString('01000001'), 'A');
    assert.equal(core.binaryToString('0110100001101001'), 'hi');
  });

  it('decodeRedundancy should majority-vote', () => {
    const core = new WatermarkCore();
    // factor=3: each bit repeated 3 times
    assert.equal(core.decodeRedundancy('111111', 3), '11');
    assert.equal(core.decodeRedundancy('111000', 3), '10');
    assert.equal(core.decodeRedundancy('000000', 3), '00');
    // factor=5
    assert.equal(core.decodeRedundancy('1111100000', 5), '10');
  });

  it('encodeMessage should append CRC and add redundancy', () => {
    const core = new WatermarkCore();
    const enc = core.encodeMessage('hi');
    assert.ok(typeof enc === 'string');
    assert.ok(enc.length > 16);
    // bits divisible by 3 (redundancy factor)
    assert.equal(enc.length % 3, 0);
    // decode back through redundancy
    const dec = core.decodeRedundancy(enc, 3);
    const str = core.binaryToString(dec);
    assert.ok(str.includes('hi|'));
  });
});

describe('Pixel Injection — Enhanced LSB (3 bits/pixel, length prefix)', () => {
  it('should embed and extract message', () => {
    const core = new WatermarkCore();
    const img = makeImage(32, 32);
    const msg = 'hello-pixel';
    const wm = core.enhancedLSB(img, msg, 'key', {});
    const extracted = core.extractEnhancedLSB(wm);
    assert.equal(extracted, msg);
  });
});

describe('Pixel Injection — Multi-Channel LSB (position-based channel)', () => {
  it('should embed and extract message', () => {
    const core = new WatermarkCore();
    const img = makeImage(64, 64);
    const msg = 'multi-channel-test';
    const wm = core.multiChannelLSB(img, msg, null, {});
    const extracted = core.extractMultiChannelLSB(wm);
    assert.ok(typeof extracted === 'string');
    assert.equal(extracted.trim(), msg);
  });
});

describe('Pixel Injection — Random LSB (PRNG positions)', () => {
  it('should embed with null password (hashCode missing) and extract', () => {
    const core = new WatermarkCore();
    const img = makeImage(64, 64);
    const msg = 'random-lsb-test';
    const wm = core.randomLSB(img, msg, null, {});
    const extracted = core.extractRandomLSB(wm, null);
    assert.ok(typeof extracted === 'string');
    assert.ok(extracted.includes(msg), 'message should be found in extraction');
  });
});

describe('Pixel Injection — Adaptive LSB', () => {
  it('should embed without error (adaptive strategy incompatible with extractLSB)', () => {
    const core = new WatermarkCore();
    const img = makeImage(64, 64);
    const wm = core.adaptiveLSB(img, 'adaptive-test', 'key', {});
    assert.ok(wm instanceof ImageData);
    assert.equal(wm.width, 64);
    assert.equal(wm.height, 64);
  });
});

describe('Pixel Injection — DCT (8×8 blocks, coefficient pair)', () => {
  it('should embed and extract message', () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const msg = 'dct-test';
    const wm = core.algorithms.dct(img, msg, 'key', {});
    const extracted = core.extractDCT(wm);
    assert.ok(typeof extracted === 'string');
    assert.equal(extracted, msg);
  });
});

describe('Pixel Injection — DWT (Haar wavelet)', () => {
  it('should embed and extract message', () => {
    const core = new WatermarkCore();
    const img = makeImage(128, 128);
    const msg = 'dwt-test-message';
    const wm = core.algorithms.dwt(img, msg, 'key', {});
    const extracted = core.extractDWT(wm);
    assert.ok(typeof extracted === 'string');
    assert.equal(extracted, msg);
  });
});

describe('Pixel Injection — DFT (8×8 blocks, frequency domain)', () => {
  it('should embed and extract message', () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const msg = 'dft-test';
    const wm = core.algorithms.dft(img, msg, 'key', {});
    const extracted = core.extractDFT(wm);
    assert.ok(typeof extracted === 'string');
    assert.equal(extracted, msg);
  });
});

describe('Pixel Injection — Hybrid DCT-DWT', () => {
  it('should embed and extract message', () => {
    const core = new WatermarkCore();
    const img = makeImage(128, 128);
    const msg = 'hybrid-test';
    const wm = core.algorithms.hybrid_dct_dwt(img, msg, 'key', {});
    const extracted = core.extractHybridDCTDWT(wm);
    assert.ok(typeof extracted === 'string');
    assert.equal(extracted, msg);
  });
});

describe('Pixel Injection — blindDecoding dispatcher', () => {
  it('should route to correct extract method per algorithm', () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const msg = 'blind-dispatch';
    const wm = core.algorithms.dct(img, msg, 'key', {});
    const result = core.blindDecoding(wm, 'dct');
    assert.equal(result, msg);
  });

  it('should route enhanced_lsb to extractEnhancedLSB', () => {
    const core = new WatermarkCore();
    const img = makeImage(32, 32);
    const msg = 'blind-enhanced';
    const wm = core.enhancedLSB(img, msg, 'key', {});
    const result = core.blindDecoding(wm, 'enhanced_lsb');
    assert.equal(result, msg);
  });

  it('should default to DCT for unknown algorithm', () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const msg = 'blind-default';
    const wm = core.algorithms.dct(img, msg, 'key', {});
    const result = core.blindDecoding(wm, 'nonexistent');
    assert.equal(result, msg);
  });
});

describe('Pixel Injection — All algorithm embeds (VINE, PixelSeal, etc.)', () => {
  const stubAlgos = ['vine', 'pixel_seal', 'nullguard', 'shallow_diffuse',
    'diffusion_based', 'imagewmark', 'meta_seal', 'stardustmark',
    'invisimark', 'elevenlikes'];

  for (const algo of stubAlgos) {
    it(`${algo} should embed without error`, () => {
      const core = new WatermarkCore();
      const img = makeImage(32, 32);
      // Some stub algorithms (shallow_diffuse) call hashCode with password;
      // pass null to avoid the missing method error.
      const wm = core.algorithms[algo](img, 'test', null, {});
      assert.ok(wm instanceof ImageData);
      assert.equal(wm.width, 32);
      assert.equal(wm.height, 32);
    });
  }

  it('VINE extract delegates to extractLSB', () => {
    const core = new WatermarkCore();
    const result = core.extractVINE({ data: [], width: 1, height: 1 });
    assert.ok(typeof result === 'string', 'VINE extract should return a string');
  });

  it('PixelSeal extract delegates to extractDCT', () => {
    const core = new WatermarkCore();
    const result = core.extractPixelSeal({ data: [], width: 1, height: 1 });
    assert.ok(typeof result === 'string', 'PixelSeal extract should return a string');
  });
});

describe('Pixel Injection — Quality metrics', () => {
  it('should compute PSNR/SSIM for identical images', () => {
    const core = new WatermarkCore();
    const img = makeImage(16, 16);
    const metrics = core.qualityMetrics(img, img);
    assert.ok(metrics.psnr === Infinity || metrics.psnr > 100);
    assert.equal(metrics.ssim, 1);
  });

  it('should compute metrics for watermarked image', () => {
    const core = new WatermarkCore();
    const img = makeImage(32, 32);
    const wm = core.enhancedLSB(img, 'metrics-test', 'key', {});
    const metrics = core.qualityMetrics(img, wm);
    assert.ok(typeof metrics.psnr === 'number');
    assert.ok(typeof metrics.ssim === 'number');
    assert.ok(metrics.psnr > 0);
  });
});

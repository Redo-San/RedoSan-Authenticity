'use strict';
const { describe, it } = require('node:test');
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

const coreSrc = fs.readFileSync(path.join(__dirname, '../../Pixel_Injection/watermark_core_advanced.js'), 'utf8');
vm.runInThisContext(coreSrc, { filename: 'watermark_core_advanced.js' });
const transformsSrc = fs.readFileSync(path.join(__dirname, '../../Pixel_Injection/watermark_core_transforms.js'), 'utf8');
vm.runInThisContext(transformsSrc, { filename: 'watermark_core_transforms.js' });
const algorithmsSrc = fs.readFileSync(path.join(__dirname, '../../Pixel_Injection/watermark_core_algorithms.js'), 'utf8');
vm.runInThisContext(algorithmsSrc, { filename: 'watermark_core_algorithms.js' });

const advSrc = fs.readFileSync(path.join(__dirname, '../../Pixel_Injection/advanced_watermarking.js'), 'utf8');
vm.runInThisContext(advSrc, { filename: 'advanced_watermarking.js' });

function makeImage(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128; data[i + 1] = 128; data[i + 2] = 128; data[i + 3] = 255;
  }
  return new ImageData(data, w, h);
}

describe('AdvancedWatermarking — constructor', () => {
  it('should instantiate without error', () => {
    const aw = new AdvancedWatermarking();
    assert.ok(aw instanceof AdvancedWatermarking);
    assert.ok(aw.algorithms);
    assert.ok(aw.detection);
  });

  it('should expose 19 algorithms', () => {
    const aw = new AdvancedWatermarking();
    const names = Object.keys(aw.algorithms);
    assert.equal(names.length, 19);
  });

  it('should expose 5 detection methods', () => {
    const aw = new AdvancedWatermarking();
    const names = Object.keys(aw.detection);
    assert.equal(names.length, 5);
  });
});

describe('AdvancedWatermarking — delegation to WatermarkCore', () => {
  it('should delegate enhanced_lsb to WatermarkCore', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.enhanced_lsb(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate multi_channel_lsb', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.multi_channel_lsb(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate random_lsb', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.random_lsb(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate adaptive_lsb', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.adaptive_lsb(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate dct', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.dct(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate dwt', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.dwt(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate dft', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.dft(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate hybrid_dct_dwt', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.hybrid_dct_dwt(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate vine', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.vine(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate pixel_seal', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.pixel_seal(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate nullguard', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.nullguard(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate shallow_diffuse', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.shallow_diffuse(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate diffusion_based', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.diffusion_based(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate imagewmark', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.imagewmark(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate meta_seal', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.meta_seal(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate stardustmark', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.stardustmark(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate invisimark', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.invisimark(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });

  it('should delegate elevenlikes', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.elevenlikes(img, 'test msg', 'pw', {});
    assert.ok(wm instanceof ImageData);
  });
});

describe('AdvancedWatermarking — detection delegation', () => {
  it('should extract DCT via _core.extractDCT', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(200, 200);
    const wm = aw.algorithms.dct(img, 'hello', 'key', {});
    const result = aw._core.extractDCT(wm);
    assert.equal(result, 'hello');
  });

  it('should delegate blind_decoding for lsb', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.enhanced_lsb(img, 'hello', 'key', {});
    const result = aw.detection.blind_decoding(wm, 'enhanced_lsb');
    assert.ok(typeof result === 'string');
  });

  it('should delegate quality_metrics', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(16, 16);
    const wm = aw.algorithms.enhanced_lsb(img, 'hello', 'key', {});
    const q = aw.detection.quality_metrics(img, wm);
    assert.ok(q.psnr > 0);
    assert.ok(q.ssim > 0);
  });
});

describe('AdvancedWatermarking — utility methods preserved', () => {
  it('should have stringToBinary', () => {
    const aw = new AdvancedWatermarking();
    const bin = aw.stringToBinary('A');
    assert.equal(bin, '01000001');
  });

  it('should have binaryToString', () => {
    const aw = new AdvancedWatermarking();
    const str = aw.binaryToString('01000001');
    assert.equal(str, 'A');
  });

  it('should have calculatePSNR', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(4, 4);
    const psnr = aw.calculatePSNR(img, img);
    assert.equal(psnr, Infinity);
  });

  it('should have calculateSSIM', () => {
    const aw = new AdvancedWatermarking();
    const img = makeImage(4, 4);
    const ssim = aw.calculateSSIM(img, img);
    assert.equal(ssim, 1);
  });

  it('should have calculateCRC32', () => {
    const aw = new AdvancedWatermarking();
    const crc = aw.calculateCRC32('hello');
    assert.ok(typeof crc === 'string');
    assert.equal(crc.length, 8);
  });
});

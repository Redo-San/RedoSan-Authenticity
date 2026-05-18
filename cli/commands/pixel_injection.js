// ── CLI: Pixel Injection Command ──
// Advanced watermark algorithms via WatermarkCore

'use strict';

const { createCanvas, loadImage, ImageData } = require('canvas');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { readFileBytes, getFileInfo, validateFile } = require('../utils');

// Patch browser APIs
const mockDocument = {
  createElement: function(tag) {
    const { createCanvas } = require('canvas');
    if (tag === 'canvas') return createCanvas(1, 1);
    throw new Error(`createElement('${tag}') not supported`);
  },
  addEventListener: function() {},
  getElementById: function() { return null; },
};
globalThis.document = mockDocument;
if (typeof globalThis.ImageData === 'undefined') globalThis.ImageData = ImageData;
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

const vm = require('vm');
const advancedSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'Pixel_Injection', 'watermark_core_advanced.js'), 'utf8');
vm.runInThisContext(advancedSrc, { filename: 'watermark_core_advanced.js' });

let core = null;
try { core = new globalThis.WatermarkCore(); } catch(e) {}

async function runPixelInjection(mode, opts) {
  if (!core) { console.error('WatermarkCore not available'); process.exit(1); }
  if (typeof globalThis.document === 'undefined') globalThis.document = mockDocument;

  const imageFile = opts.image;
  if (!imageFile) { console.error('--image (-i) required'); process.exit(1); }
  const absPath = path.resolve(imageFile);
  const allowDangerous = opts.allowDangerous || process.argv.includes('--allow-dangerous');
  try { validateFile(absPath, { allowDangerous }); } catch (e) {
    console.error(`Validation failed: ${e.message}`);
    if (e.message.includes('Blocked dangerous file type')) console.error('Use --allow-dangerous to bypass');
    process.exit(1);
  }
  if (opts.secret) {
    try { validateFile(path.resolve(opts.secret), { allowDangerous }); } catch (e) {
      console.error(`Validation failed for secret: ${e.message}`); process.exit(1);
    }
  }
  const info = getFileInfo(imageFile);
  const algoName = (opts.algo || 'dct').toLowerCase();
  const password = opts.password || '';

  if (!core.algorithms[algoName]) {
    console.error(`Unknown algorithm: ${algoName}`);
    console.error('Available: ' + Object.keys(core.algorithms).join(', '));
    process.exit(1);
  }

  const img = await loadImage(absPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  if (mode === 'embed') {
    const secretFile = opts.secret;
    const outputFile = opts.output;
    if (!outputFile) { console.error('--output (-o) required'); process.exit(1); }
    const message = secretFile ? new TextDecoder('utf-8', { fatal: false }).decode(readFileBytes(secretFile)) : 'RedoSanPixelInjection';
    const result = core.algorithms[algoName](imageData, message, password, {});
    ctx.putImageData(result, 0, 0);
    fs.writeFileSync(path.resolve(outputFile), canvas.toBuffer('image/png'));
    console.log(`Pixel injection (${algoName}): message embedded (${message.length} chars)`);
    console.log(`Output: ${path.resolve(outputFile)}`);
  } else if (mode === 'extract') {
    const outputFile = opts.output;
    const extractMap = {
      enhanced_lsb: 'extractEnhancedLSB', adaptive_lsb: 'extractLSB',
      multi_channel_lsb: 'extractMultiChannelLSB', random_lsb: 'extractRandomLSB',
      dct: 'extractDCT', dwt: 'extractDWT', dft: 'extractDFT',
      hybrid_dct_dwt: 'extractDCT',
      vine: 'extractVINE', pixel_seal: 'extractPixelSeal',
      nullguard: 'extractNullGuard', shallow_diffuse: 'extractShallowDiffuse',
      diffusion_based: 'extractLSB',
      imagewmark: 'extractImageWMark', meta_seal: 'extractMetaSeal',
      stardustmark: 'extractLSB', invisimark: 'extractLSB', elevenlikes: 'extractLSB',
    };
    const method = extractMap[algoName] || 'extractLSB';
    let result;
    if (typeof core[method] === 'function') result = core[method](imageData, password);
    else result = core.blind_decoding(imageData, algoName, password);
    if (result && result !== 'No readable message found') {
      const buf = Buffer.from(result, 'utf-8');
      if (outputFile) {
        fs.writeFileSync(path.resolve(outputFile), buf);
        console.log(`Extracted (${result.length} chars): ${outputFile}`);
      } else {
        console.log(`Extracted: ${result}`);
      }
    } else {
      console.log('No watermark found.');
    }
  }
}

module.exports = { runPixelInjection };
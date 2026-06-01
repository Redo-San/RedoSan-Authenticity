'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ── Polyfills for Node.js ──
if (typeof globalThis.Int16Array === 'undefined') globalThis.Int16Array = Int16Array;
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

// Load audio watermark core
const coreSrc = fs.readFileSync(path.join(__dirname, '../../Audio_Watermark/audio_watermark_core.js'), 'utf8');
vm.runInThisContext(coreSrc, { filename: 'audio_watermark_core.js' });

// ── Helpers ──
function loadWav(filePath) {
  const buf = fs.readFileSync(filePath).buffer;
  return awReadWavRaw(buf);
}

function computeSNR(original, cleaned) {
  const len = Math.min(original.length, cleaned.length);
  let signal = 0, noise = 0;
  for (let i = 0; i < len; i++) {
    signal += original[i] * original[i];
    const diff = original[i] - cleaned[i];
    noise += diff * diff;
  }
  if (noise === 0) return Infinity;
  return 10 * Math.log10(signal / noise);
}

function computeQuantizationNoiseRatio(signal) {
  const len = Math.min(signal.length, 44100);
  let lsbFlips = 0;
  for (let i = 1; i < len; i++) {
    const lsb = signal[i] & 1;
    const prevLsb = signal[i-1] & 1;
    if (lsb !== prevLsb) lsbFlips++;
  }
  const flipRate = lsbFlips / len;
  const entropy = flipRate < 0.001 ? 0 : (-flipRate * Math.log2(flipRate) - (1-flipRate) * Math.log2(1-flipRate));
  return entropy;
}

function analyzeAudio(label, samples, sr, originalSamples) {
  console.log(`\n── ${label} ──`);
  console.log(`  Samples: ${samples.length}`);
  console.log(`  Sample rate: ${sr} Hz`);

  // Dynamic range
  let maxVal = 0, minVal = 0, avg = 0;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] > maxVal) maxVal = samples[i];
    if (samples[i] < minVal) minVal = samples[i];
    avg += samples[i];
  }
  avg /= samples.length;
  console.log(`  Dynamic range: [${minVal}, ${maxVal}] (${maxVal - minVal} units)`);

  // Unique values (quantization indicator)
  const uniqueVals = new Set();
  const step = Math.max(1, Math.floor(samples.length / 10000));
  for (let i = 0; i < samples.length; i += step) uniqueVals.add(samples[i]);
  console.log(`  Unique sample values (approx): ${uniqueVals.size}`);

  // Quantization detection: find the most common step between consecutive values
  const steps = {};
  for (let i = 1; i < Math.min(samples.length, 50000); i++) {
    const s = Math.abs(samples[i] - samples[i-1]);
    if (s > 0 && s < 10000) {
      steps[s] = (steps[s] || 0) + 1;
    }
  }
  let maxStepCount = 0, dominantStep = 0;
  for (const [stepVal, count] of Object.entries(steps)) {
    if (count > maxStepCount) { maxStepCount = count; dominantStep = parseInt(stepVal); }
  }
  console.log(`  Dominant quantization step: ${dominantStep} (appears ${maxStepCount}x in first 50k samples)`);

  // Noise floor estimate (first 100ms)
  let noiseFloor = 0;
  for (let i = 0; i < Math.min(samples.length, 4410); i++) {
    const a = Math.abs(samples[i]);
    if (a > noiseFloor) noiseFloor = a;
  }
  console.log(`  Noise floor estimate (first 100ms): ${noiseFloor}`);

  // LSB entropy
  const lsbEntropy = computeQuantizationNoiseRatio(samples);
  console.log(`  LSB entropy: ${lsbEntropy.toFixed(4)} (higher = more natural)`);

  if (originalSamples) {
    const snr = computeSNR(originalSamples, samples);
    console.log(`  SNR vs original: ${snr.toFixed(2)} dB`);

    // Difference analysis
    const diffLen = Math.min(originalSamples.length, samples.length);
    let maxDiff = 0, sumDiff = 0;
    for (let i = 0; i < diffLen; i++) {
      const d = Math.abs(originalSamples[i] - samples[i]);
      if (d > maxDiff) maxDiff = d;
      sumDiff += d;
    }
    console.log(`  Avg sample difference: ${(sumDiff / diffLen).toFixed(2)}`);
    console.log(`  Max sample difference: ${maxDiff}`);
  }
}

console.log('══════════════════════════════════════════════════');
console.log('   Audio Clean Quality Analysis');
console.log('══════════════════════════════════════════════════\n');

// ── Part 1: Analyze user's files ──
console.log('► PART 1: User File Analysis');
console.log('──────────────────────────────────────\n');

const srcPath = 'G:\\img\\raaed\\iCloud Photos\\watermarked_Ani Warda 22.wav';
const cleanedPath = 'G:\\img\\raaed\\iCloud Photos\\watermarked_Ani Warda 22_cleaned.wav';

const srcInfo = loadWav(srcPath);
const cleanedInfo = loadWav(cleanedPath);

analyzeAudio('SOURCE (Watermarked)', srcInfo.samples, srcInfo.sr);
analyzeAudio('CLEANED (User cleaned)', cleanedInfo.samples, cleanedInfo.sr, srcInfo.samples);

// ── Part 2: Test cleaning with current algorithm ──
console.log('\n\n► PART 2: Current cleanAudioFile algorithm test');
console.log('──────────────────────────────────────\n');

// Simulate current cleanAudioFile logic
function currentCleanAudio(samples, sr) {
  const s16 = new Int16Array(samples);
  for (let i = 0; i < s16.length; i++) s16[i] &= ~1;
  const destroyStep = Math.round(sr / 50);
  for (let j = 0; j < s16.length; j++) s16[j] = Math.round(s16[j] / destroyStep) * destroyStep;
  return s16;
}

const currentCleaned = currentCleanAudio(srcInfo.samples, srcInfo.sr);
analyzeAudio('CURRENT CLEAN (simulated)', currentCleaned, srcInfo.sr, srcInfo.samples);

// Save for comparison
const currentBuf = awWriteWav(currentCleaned, srcInfo.sr, 1, null, 16);
fs.writeFileSync(path.join(__dirname, 'current_clean_output.wav'), Buffer.from(currentBuf));
console.log('\n  → Saved to cli/tests/current_clean_output.wav');

// ── Part 3: Test FIXED cleaning (gentle step=2) ──
console.log('\n\n► PART 3: FIXED cleaning (gentle step=2)');
console.log('──────────────────────────────────────\n');

function fixedCleanAudio(samples) {
  const s16 = new Int16Array(samples);
  for (let i = 0; i < s16.length; i++) s16[i] &= ~1;
  for (let j = 0; j < s16.length; j++) s16[j] = Math.round(s16[j] / 2) * 2;
  return s16;
}

const fixedCleaned = fixedCleanAudio(srcInfo.samples);
analyzeAudio('FIXED CLEAN (step=2)', fixedCleaned, srcInfo.sr, srcInfo.samples);

const fixedBuf = awWriteWav(fixedCleaned, srcInfo.sr, 1, null, 16);
fs.writeFileSync(path.join(__dirname, 'fixed_clean_output.wav'), Buffer.from(fixedBuf));
console.log('\n  → Saved to cli/tests/fixed_clean_output.wav');

// ── Part 4: Test improved cleaning (LSB only) ──
console.log('\n\n► PART 4: LSB-only cleaning');
console.log('──────────────────────────────────────\n');

function lsbOnlyClean(samples) {
  const s16 = new Int16Array(samples);
  for (let i = 0; i < s16.length; i++) s16[i] &= ~1;
  return s16;
}

const lsbCleaned = lsbOnlyClean(srcInfo.samples);
analyzeAudio('LSB-ONLY CLEAN', lsbCleaned, srcInfo.sr, srcInfo.samples);

const lsbBuf = awWriteWav(lsbCleaned, srcInfo.sr, 1, null, 16);
fs.writeFileSync(path.join(__dirname, 'lsb_only_output.wav'), Buffer.from(lsbBuf));
console.log('\n  → Saved to cli/tests/lsb_only_output.wav');

// ── Part 4: Test with different algorithms ──
console.log('\n\n► PART 4: Algorithm-by-algorithm cleaning test');
console.log('──────────────────────────────────────\n');

// Generate clean test tone
const testSr = 44100;
const durationSec = 2;
const numSamples = testSr * durationSec;
const cleanTone = new Int16Array(numSamples);
for (let i = 0; i < numSamples; i++) {
  cleanTone[i] = Math.sin(2 * Math.PI * 440 * i / testSr) * 16000 +
                 Math.sin(2 * Math.PI * 880 * i / testSr) * 8000;
}

const password = 'test123';
async function runTests() {
  // Polyfill crypto for key derivation
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    const crypto = require('crypto');
    globalThis.crypto = {
      subtle: {
        digest: async (algo, data) => {
          const n = typeof algo === 'string' ? algo : algo.name || 'SHA-256';
          const h = crypto.createHash(n.toLowerCase().replace('-', '')).update(Buffer.from(data)).digest();
          return h.buffer;
        },
        importKey: async (f, kd, algo, ext, us) => ({ type: 'secret', algorithm: algo, keyData: kd }),
        deriveBits: async (algo, baseKey, len) => {
          const pw = Buffer.from(baseKey.keyData);
          const s = algo.salt || pw;
          const it = algo.iterations || 100000;
          const h = typeof algo.hash === 'string' ? algo.hash.replace('-', '').toLowerCase() : 'sha256';
          const d = crypto.pbkdf2Sync(pw, s, it, len / 8, h);
          return d.buffer;
        }
      }
    };
  }
  if (typeof globalThis.TextEncoder === 'undefined') globalThis.TextEncoder = require('util').TextEncoder;
  if (typeof globalThis.TextDecoder === 'undefined') globalThis.TextDecoder = require('util').TextDecoder;

  // Define awFormatPayload
  globalThis.awFormatPayload = function(data, key) {
    const enc = new TextEncoder();
    const msg = enc.encode('AUDIO_WATERMARK_V1');
    const combined = new Uint8Array(msg.length + data.length);
    combined.set(msg);
    combined.set(data, msg.length);
    const xored = new Uint8Array(combined.length);
    for (let i = 0; i < combined.length; i++) xored[i] = combined[i] ^ key[i % key.length];
    const lenBytes = [(xored.length >> 24) & 0xFF, (xored.length >> 16) & 0xFF, (xored.length >> 8) & 0xFF, xored.length & 0xFF];
    const payload = new Uint8Array(4 + xored.length);
    payload.set(lenBytes);
    payload.set(xored, 4);
    return payload;
  };

  let key;
  try {
    key = await globalThis.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new TextEncoder().encode('salt'), iterations: 1000, hash: 'SHA-256' },
      { type: 'secret', algorithm: 'PBKDF2', keyData: new TextEncoder().encode(password) },
      256
    );
    key = new Uint8Array(key);
  } catch (e) {
    key = new TextEncoder().encode(password.padEnd(32, '\0').slice(0, 32));
  }

  const secret = new TextEncoder().encode('TestSecret123!');
  const payload = awFormatPayload(secret, key);

  const algorithms = [
    { name: 'aw1 (LSB Audio)', embed: (s, p) => { for(let i=0;i<Math.min(p.length*8,s.length*0.9);i++){ const byteIdx=Math.floor(i/8); const bitIdx=7-(i%8); if(byteIdx<p.length){s[i]=(s[i]&~1)|((p[byteIdx]>>bitIdx)&1);}} } },
    { name: 'aw5 (QIM)', embed: (s, p) => { const step=4; for(let i=0;i<Math.min(p.length*8,s.length*0.9);i++){ const byteIdx=Math.floor(i/8); const bitIdx=7-(i%8); if(byteIdx<p.length){ const b=(p[byteIdx]>>bitIdx)&1; const q=Math.round(s[i]/step); s[i]=((q%2===b)?q:q+1)*step;}} } }
  ];

  const cleanSteps = [
    { name: 'LSB clear only', fn: (s) => { for(let i=0;i<s.length;i++) s[i] &= ~1; } },
    { name: 'FIXED: LSB + gentle quantize (step=2)', fn: (s) => { for(let i=0;i<s.length;i++) s[i] &= ~1; for(let j=0;j<s.length;j++) s[j]=Math.round(s[j]/2)*2; } },
    { name: 'LSB + medium quantize (step=20)', fn: (s) => { for(let i=0;i<s.length;i++) s[i] &= ~1; for(let j=0;j<s.length;j++) s[j]=Math.round(s[j]/20)*20; } },
    { name: 'CURRENT: LSB + hard quantize (sr/50=' + Math.round(testSr/50) + ')', fn: (s) => { for(let i=0;i<s.length;i++) s[i] &= ~1; const ds=Math.round(testSr/50); for(let j=0;j<s.length;j++) s[j]=Math.round(s[j]/ds)*ds; } }
  ];

  for (const algo of algorithms) {
    console.log(`\n  Algorithm: ${algo.name}`);

    // Embed
    const embedded = new Int16Array(cleanTone);
    algo.embed(embedded, payload);

    // Analyze before cleaning
    const beforeSnr = computeSNR(cleanTone, embedded);
    console.log(`    SNR after embed: ${beforeSnr.toFixed(2)} dB`);

    for (const clean of cleanSteps) {
      const cleaned = new Int16Array(embedded);
      clean.fn(cleaned);
      const afterSnr = computeSNR(cleanTone, cleaned);
      const snrDrop = beforeSnr - afterSnr;
      const lsbE = computeQuantizationNoiseRatio(cleaned);

      // Check if watermark still extractable (simple LSB check)
      let stillHasData = false;
      if (algo.name.includes('LSB')) {
        for (let i = 0; i < Math.min(100, payload.length * 8); i++) {
          const byteIdx = Math.floor(i/8);
          const bitIdx = 7-(i%8);
          if (byteIdx < payload.length) {
            const bit = (cleaned[i] & 1);
            const expected = (payload[byteIdx] >> bitIdx) & 1;
            if (bit === expected) { stillHasData = true; break; }
          }
        }
      }

      console.log(`    ${clean.name.padEnd(35)} \u2192 SNR: ${afterSnr.toFixed(2)} dB (drop: ${snrDrop.toFixed(1)} dB) | LSB ent: ${lsbE.toFixed(4)}${stillHasData ? ' \u26A0\uFE0F DATA REMAINS' : ''}`);
    }
  }

  // ── Summary ──
  console.log('\n\n══════════════════════════════════════════════════');
  console.log('   SUMMARY');
  console.log('══════════════════════════════════════════════════\n');
  console.log('The current cleanAudioFile algorithm uses:');
  console.log('  1. LSB clear (imperceptible)');
  console.log('  2. Quantization step = sr/50 = ' + Math.round(testSr/50));
  console.log('');
  console.log('This aggressive quantization REDUCES 16-bit audio');
  console.log('(65536 levels) to only ~' + Math.round(65536/Math.round(testSr/50)) + ' levels,');
  console.log('creating audible quantization noise.');
  console.log('');
  console.log('Recommendation: Remove or drastically reduce the');
  console.log('quantization step (use 2-4 instead of ' + Math.round(testSr/50) + ').');
  console.log('');
}

runTests().catch(e => { console.error('Fatal:', e); process.exit(1); });

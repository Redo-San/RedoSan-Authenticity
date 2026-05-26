const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;
global.crypto = { subtle: crypto.webcrypto.subtle };
global.window = global;
global.window.crypto = global.crypto;
global.document = { createElement: () => ({ appendChild: () => {}, innerHTML: '' }) };

const utils = fs.readFileSync(path.join(__dirname, '..', '..', 'Watermark', 'utils.js'), 'utf8');
const core = fs.readFileSync(path.join(__dirname, '..', '..', 'Audio_Watermark', 'audio_watermark_core.js'), 'utf8');
eval(utils.replace(/^\(function.*?\)\(\);\n?/, ''));
eval(core.replace(/^\(function.*?\)\(\);\n?/, ''));

async function test() {
    const sr = 44100, dur = 3;
    const samples = new Int16Array(sr * dur);
    for (let i = 0; i < samples.length; i++)
        samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 10000);

    const key = await pw_key('test123');
    const secretBytes = new TextEncoder().encode('Hi');
    const payload = awFormatPayload(secretBytes, key);

    console.log('Payload:', payload.length, 'bits, first 64:', payload.substring(0, 64));

    // Test Phase Coding without overlap
    const F = 2048;
    const totalFrames = Math.floor(samples.length / F);
    const LO = Math.floor(F * 0.10), HI = Math.floor(F * 0.30);
    const usableBins = HI - LO;
    const REPS = 3;
    const bitsPerFrame = Math.max(1, Math.floor(usableBins / REPS));
    console.log('Frames:', totalFrames, 'Bins/frame:', bitsPerFrame, 'Capacity:', totalFrames * bitsPerFrame);

    // Embed without overlap
    const copy = new Int16Array(samples);
    for (let f = 0; f < totalFrames && f * bitsPerFrame < payload.length; f++) {
        const off = f * F;
        const re = new Float64Array(F), im = new Float64Array(F);
        for (let i = 0; i < F; i++) re[i] = copy[off + i];
        awFft(re, im);
        const startBit = f * bitsPerFrame;
        let binIdx = 0;
        for (let b = startBit; b < startBit + bitsPerFrame && b < payload.length; b++) {
            const bit = payload[b];
            for (let r = 0; r < REPS && binIdx < usableBins; r++) {
                const bin = LO + binIdx; binIdx++;
                const phase = bit === '1' ? Math.PI / 2 : -Math.PI / 2;
                const mag = Math.sqrt(re[bin]*re[bin] + im[bin]*im[bin]);
                re[bin] = mag * Math.cos(phase);
                im[bin] = mag * Math.sin(phase);
                const mirror = F - bin;
                re[mirror] = re[bin]; im[mirror] = -im[bin];
            }
        }
        awIfft(re, im);
        for (let i = 0; i < F; i++)
            copy[off + i] = Math.max(-32768, Math.min(32767, Math.round(re[i])));
    }

    // Extract without overlap
    let votes = [];
    for (let f = 0; f < totalFrames && votes.length < payload.length * REPS; f++) {
        const off = f * F;
        const re = new Float64Array(F), im = new Float64Array(F);
        for (let i = 0; i < F; i++) re[i] = copy[off + i];
        awFft(re, im);
        let binIdx = 0;
        for (let b = 0; b < bitsPerFrame && b < payload.length; b++) {
            for (let r = 0; r < REPS && binIdx < usableBins; r++) {
                const bin = LO + binIdx; binIdx++;
                const phase = Math.atan2(im[bin], re[bin]);
                votes.push(phase >= 0 ? '1' : '0');
            }
        }
    }

    let b = '';
    for (let i = 0; i < votes.length; i += REPS) {
        const chunk = votes.slice(i, i + REPS);
        const ones = chunk.filter(x => x === '1').length;
        b += ones >= Math.ceil(REPS / 2) ? '1' : '0';
    }

    let correct = 0;
    for (let i = 0; i < Math.min(payload.length, b.length); i++)
        if (payload[i] === b[i]) correct++;
    console.log(`\nPhase Coding (no overlap):`);
    console.log(`  BER: ${(1-correct/Math.min(payload.length,b.length))*100}%`);
    console.log(`  IN:  ${payload.substring(0, 48)}`);
    console.log(`  OUT: ${b.substring(0, 48)}`);

    const result = awExtractPayload(b, key);
    console.log(`  awExtractPayload: ${result === null ? 'null' : result === 'bad-password' ? 'bad-password' : '✅ ' + new TextDecoder().decode(result)}`);

    // Also check first frame phase
    console.log('\n  First frame phase check:');
    const off1 = 0;
    const re1 = new Float64Array(F), im1 = new Float64Array(F);
    for (let i = 0; i < F; i++) re1[i] = copy[off1 + i];
    awFft(re1, im1);
    for (let bin = LO; bin < LO + 6; bin++) {
        const phase = Math.atan2(im1[bin], re1[bin]);
        console.log(`  bin ${bin}: phase=${(phase*180/Math.PI).toFixed(1)}° mag=${Math.sqrt(re1[bin]*re1[bin] + im1[bin]*im1[bin]).toFixed(1)}`);
    }
}

test().catch(e => console.error('Fatal:', e));

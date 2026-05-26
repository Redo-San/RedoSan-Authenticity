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
    const sr = 44100, dur = 5;
    const samples = new Int16Array(sr * dur);
    for (let i = 0; i < samples.length; i++) {
        const val = Math.sin(2 * Math.PI * 440 * i / sr) * 10000
                  + Math.sin(2 * Math.PI * 880 * i / sr) * 5000;
        samples[i] = Math.round(val);
    }

    const key = await pw_key('test');

    for (const msg of ['Hi', 'AB']) {
        const secretBytes = new TextEncoder().encode(msg);
        const fullPayload = awFormatPayload(secretBytes, key);
        const maxB = aw4_maxBits(samples.length, sr);
        console.log(`\nDSSS "${msg}": payload=${fullPayload.length} bits, max=${maxB}`);

        const mod = aw4_embed(new Int16Array(samples), fullPayload, sr);
        const bits = aw4_extract(mod, sr, Math.max(fullPayload.length, 5000));

        console.log(`  Extracted: ${bits.length} bits`);
        console.log(`  IN:  ${fullPayload.substring(0, 40)}`);
        console.log(`  OUT: ${bits.substring(0, 40)}`);

        let match = 0;
        for (let i = 0; i < Math.min(32, bits.length); i++)
            if (bits[i] === fullPayload[i]) match++;
        console.log(`  First 32 bits match: ${match}/32`);

        const result = awExtractPayload(bits, key);
        console.log(`  Result: ${result === null ? 'null' : result === 'bad-password' ? 'bad-password' : '✅'}`);
    }

    // Test just the PN correlation with known embedding
    const F = 2048;
    const totalFrames = Math.floor(samples.length / F);
    console.log(`\n  totalFrames=${totalFrames}`);
    
    // Check first frame magnitude correlation
    const off = 0;
    const re = new Float64Array(F), im = new Float64Array(F);
    for (let i = 0; i < F; i++) re[i] = samples[off + i];
    awFft(re, im);
    
    const lo = Math.floor(F * 0.10), hi = Math.floor(F * 0.30);
    const chipsPerBit = Math.min(256, hi - lo);
    console.log(`  lo=${lo} hi=${hi} usable=${hi-lo} chipsPerBit=${chipsPerBit}`);
    
    // Check original frame's magnitude correlation
    const PN = _aw4_pn;
    let corr = 0;
    for (let c = 0; c < chipsPerBit; c++) {
        const bin = lo + c;
        const mag = Math.sqrt(re[bin]*re[bin] + im[bin]*im[bin]);
        corr += mag * PN[c];
    }
    console.log(`  Original corr: ${corr}`);
    
    // After embedding "Hi" (first bit = '0')
    const mod = aw4_embed(new Int16Array(samples), awFormatPayload(new TextEncoder().encode('Hi'), key), sr);
    const re2 = new Float64Array(F), im2 = new Float64Array(F);
    for (let i = 0; i < F; i++) re2[i] = mod[off + i];
    awFft(re2, im2);
    
    let corr2 = 0;
    for (let c = 0; c < chipsPerBit; c++) {
        const bin = lo + c;
        const mag = Math.sqrt(re2[bin]*re2[bin] + im2[bin]*im2[bin]);
        corr2 += mag * PN[c];
    }
    console.log(`  Embedded corr: ${corr2}`);
    console.log(`  Diff: ${corr2 - corr}`);
    
    // Check individual bins
    let changes = 0;
    for (let c = 0; c < 10; c++) {
        const bin = lo + c;
        const mag1 = Math.sqrt(re[bin]*re[bin] + im[bin]*im[bin]);
        const mag2 = Math.sqrt(re2[bin]*re2[bin] + im2[bin]*im2[bin]);
        console.log(`  bin ${bin}: original=${mag1.toFixed(1)} embedded=${mag2.toFixed(1)} diff=${(mag2-mag1).toFixed(1)}`);
        if (Math.abs(mag2 - mag1) > 1) changes++;
    }
    console.log(`  Changes in first 10 bins: ${changes}`);
}

test().catch(e => console.error('Fatal:', e));

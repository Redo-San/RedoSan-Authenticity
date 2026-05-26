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
    const msg = 'Hi';
    const secretBytes = new TextEncoder().encode(msg);
    const payload = awFormatPayload(secretBytes, key);
    console.log('Payload length:', payload.length, 'bits');
    console.log('First 40 bits:', payload.substring(0, 40));
    
    const F = 2048;
    const totalFrames = Math.floor(samples.length / F);
    const lo = 204, hi = 614;
    const chipsPerBit = Math.min(256, hi - lo);
    
    // For each of first 5 frames, measure correlation before and after
    const mod = aw4_embed(new Int16Array(samples), payload, sr);
    
    for (let f = 0; f < Math.min(5, totalFrames); f++) {
        const bit = payload[f];
        const chipStart = lo + (f * chipsPerBit) % ((hi - lo) - chipsPerBit);
        
        // Original
        const re1 = new Float64Array(F), im1 = new Float64Array(F);
        for (let i = 0; i < F; i++) re1[i] = samples[f * F + i];
        awFft(re1, im1);
        
        // Modified
        const re2 = new Float64Array(F), im2 = new Float64Array(F);
        for (let i = 0; i < F; i++) re2[i] = mod[f * F + i];
        awFft(re2, im2);
        
        const PN = _aw4_pn;
        let corr1 = 0, corr2 = 0;
        for (let c = 0; c < chipsPerBit; c++) {
            const bin = chipStart + c;
            const mag1 = Math.sqrt(re1[bin]*re1[bin] + im1[bin]*im1[bin]);
            const mag2 = Math.sqrt(re2[bin]*re2[bin] + im2[bin]*im2[bin]);
            corr1 += mag1 * PN[c];
            corr2 += mag2 * PN[c];
        }
        console.log(`Frame ${f} (bit=${bit}, chipStart=${chipStart}): orig_corr=${corr1.toFixed(0)} mod_corr=${corr2.toFixed(0)} diff=${(corr2-corr1).toFixed(0)} → "${corr2>0?'1':'0'}"`);
        
        // Also check magnitudes in first few bins
        console.log(`  First 3 bins: ${chipStart},${chipStart+1},${chipStart+2}`);
        for (let c = 0; c < 3; c++) {
            const bin = chipStart + c;
            const m1 = Math.sqrt(re1[bin]*re1[bin] + im1[bin]*im1[bin]);
            const m2 = Math.sqrt(re2[bin]*re2[bin] + im2[bin]*im2[bin]);
            console.log(`  bin ${bin}: ${m1.toFixed(1)} → ${m2.toFixed(1)} (PN=${PN[c]})`);
        }
    }
}

test().catch(e => console.error('Fatal:', e));

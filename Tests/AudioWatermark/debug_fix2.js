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

function computeSNR(original, modified) {
    const len = Math.min(original.length, modified.length);
    let signal = 0, noise = 0;
    for (let i = 0; i < len; i++) {
        signal += original[i] * original[i];
        const diff = original[i] - modified[i];
        noise += diff * diff;
    }
    if (noise === 0) return Infinity;
    return 10 * Math.log10(signal / noise);
}

async function test() {
    const sr = 44100, dur = 10;
    const samples = new Int16Array(sr * dur);
    for (let i = 0; i < samples.length; i++)
        samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 10000);

    const key = await pw_key('test123');
    const tests = [
        { id: 2, name: 'Phase Coding', msg: 'Hello World! This is a test of phase coding algorithm.', embed: (s,p) => aw2_embed(s,p,sr), extract: (s,r) => aw2_extract(s,sr,r), maxBits: (l) => aw2_maxBits(l,sr) },
        { id: 6, name: 'DWT (Haar)', msg: 'Hello World! DWT test message here.', embed: (s,p) => aw6_embed(s,p,300), extract: (s,r) => aw6_extract(s,r,300), maxBits: (l) => aw6_maxBits(l,sr) },
        { id: 8, name: 'DCT-based', msg: 'Hello World! DCT test message.', embed: (s,p) => aw8_embed(s,p,400), extract: (s,r) => aw8_extract(s,r,400), maxBits: (l) => aw8_maxBits(l,sr) }
    ];

    for (const t of tests) {
        const secretBytes = new TextEncoder().encode(t.msg);
        const fullPayload = awFormatPayload(secretBytes, key);
        const maxB = t.maxBits(samples.length);
        const payload = fullPayload.length <= maxB ? fullPayload : fullPayload.substring(0, maxB);

        console.log(`\n${t.name}:`);
        console.log(`  Payload: ${payload.length}/${fullPayload.length} bits (max ${maxB})`);
        console.log(`  Message: "${t.msg.substring(0, 50)}${t.msg.length > 50 ? '...' : ''}"`);

        try {
            const original = new Int16Array(samples);
            const t0 = Date.now();
            const mod = t.embed(new Int16Array(samples), payload);
            const embedTime = Date.now() - t0;
            const snr = computeSNR(original, mod);

            const extra = Math.max(payload.length, 5000);
            const t1 = Date.now();
            const bits = t.extract(mod, extra);
            const extractTime = Date.now() - t1;

            const result = awExtractPayload(bits, key);
            let status;
            if (!result) status = '❌ No watermark';
            else if (result === 'bad-password') status = '❌ bad-password';
            else {
                const decoded = new TextDecoder().decode(result);
                status = decoded === t.msg ? '✅ exact' : `⚠️ partial (${decoded.length}/${t.msg.length})`;
                if (decoded !== t.msg) {
                    let same = 0;
                    for (let i = 0; i < Math.min(decoded.length, t.msg.length); i++)
                        if (decoded[i] === t.msg[i]) same++;
                    status += ` match:${same}/${t.msg.length}`;
                }
            }
            console.log(`  Embed: ${(embedTime/1000).toFixed(2)}s | Extract: ${(extractTime/1000).toFixed(2)}s | SNR: ${snr.toFixed(1)} dB`);
            console.log(`  ${status}`);
        } catch (e) {
            console.log(`  💥 ${e.message}`);
        }
    }
}

test().catch(e => console.error('Fatal:', e));

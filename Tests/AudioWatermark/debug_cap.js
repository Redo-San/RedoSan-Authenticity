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
    const sr = 44100, dur = 10;
    const samples = new Int16Array(sr * dur);
    for (let i = 0; i < samples.length; i++)
        samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 10000);

    const key = await pw_key('test123');

    // Phase Coding
    console.log('=== Phase Coding ===');
    const max2 = aw2_maxBits(samples.length, sr);
    console.log('Capacity:', max2, 'bits');
    for (const msg of ['Hi', 'Hello!', 'Hello World!']) {
        const bytes = new TextEncoder().encode(msg);
        const payload = awFormatPayload(bytes, key);
        console.log(`  "${msg}" → ${payload.length} bits (${payload.length <= max2 ? '✅ fits' : '❌ too big'})`);
        if (payload.length <= max2) {
            const mod = aw2_embed(new Int16Array(samples), payload, sr);
            const bits = aw2_extract(mod, sr, Math.max(payload.length, 5000));
            const result = awExtractPayload(bits, key);
            if (!result) console.log(`    ❌ No watermark`);
            else if (result === 'bad-password') {
                // Debug: check first 64 bits
                console.log(`    ❌ bad-password`);
                console.log(`    IN:  ${payload.substring(0, 48)}`);
                console.log(`    OUT: ${bits.substring(0, 48)}`);
                const dlen = parseInt(bits.substring(0, 32), 2);
                console.log(`    IN dlen: ${parseInt(payload.substring(0, 32), 2)}, OUT dlen: ${dlen}`);
            }
            else console.log(`    ✅ ${new TextDecoder().decode(result)}`);
        }
    }

    // DCT
    console.log('\n=== DCT-based ===');
    const max8 = aw8_maxBits(samples.length, sr);
    console.log('Capacity:', max8, 'bits');
    for (const msg of ['Hi', 'Hello!', 'Hello World!']) {
        const bytes = new TextEncoder().encode(msg);
        const payload = awFormatPayload(bytes, key);
        console.log(`  "${msg}" → ${payload.length} bits (${payload.length <= max8 ? '✅ fits' : '❌ too big'})`);
        if (payload.length <= max8) {
            const t0 = Date.now();
            const mod = aw8_embed(new Int16Array(samples), payload, 400);
            console.log(`  Embed time: ${(Date.now()-t0)/1000}s`);
            const bits = aw8_extract(mod, Math.max(payload.length, 5000), 400);
            const result = awExtractPayload(bits, key);
            if (!result) console.log(`    ❌ No watermark`);
            else if (result === 'bad-password') {
                console.log(`    ❌ bad-password`);
                const dlen = parseInt(bits.substring(0, 32), 2);
                console.log(`    IN dlen: ${parseInt(payload.substring(0, 32), 2)}, OUT dlen: ${dlen}`);
                console.log(`    IN:  ${payload.substring(0, 48)}`);
                console.log(`    OUT: ${bits.substring(0, 48)}`);
            }
            else console.log(`    ✅ ${new TextDecoder().decode(result)}`);
        }
    }

    // DWT
    console.log('\n=== DWT (Haar) ===');
    const max6 = aw6_maxBits(samples.length, sr);
    console.log('Capacity:', max6, 'bits');
    for (const msg of ['Hi', 'Hello!', 'Hello World!']) {
        const bytes = new TextEncoder().encode(msg);
        const payload = awFormatPayload(bytes, key);
        console.log(`  "${msg}" → ${payload.length} bits (${payload.length <= max6 ? '✅ fits' : '❌ too big'})`);
        if (payload.length <= max6) {
            const mod = aw6_embed(new Int16Array(samples), payload, 300);
            const bits = aw6_extract(mod, Math.max(payload.length, 5000), 300);
            const result = awExtractPayload(bits, key);
            if (!result) console.log(`    ❌ No watermark`);
            else if (result === 'bad-password') console.log(`    ❌ bad-password`);
            else console.log(`    ✅ ${new TextDecoder().decode(result)}`);
        }
    }
}

test().catch(e => console.error('Fatal:', e));

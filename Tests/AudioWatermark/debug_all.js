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
    // Generate 5 seconds of audio with multiple tones
    const sr = 44100, dur = 5;
    const samples = new Int16Array(sr * dur);
    for (let i = 0; i < samples.length; i++) {
        const val = Math.sin(2 * Math.PI * 440 * i / sr) * 10000
                  + Math.sin(2 * Math.PI * 880 * i / sr) * 5000
                  + Math.sin(2 * Math.PI * 1760 * i / sr) * 2500;
        samples[i] = Math.round(Math.max(-32768, Math.min(32767, val)));
    }

    const key = await pw_key('test123');

    // Test Phase Coding with "Hello!" (6 chars = 80 bits including overhead)
    for (const msg of ['Hi', 'Hello!', 'Hello World!']) {
        const secretBytes = new TextEncoder().encode(msg);
        const fullPayload = awFormatPayload(secretBytes, key);
        const maxB = aw2_maxBits(samples.length, sr);
        console.log(`\n=== Phase Coding: "${msg}" (payload=${fullPayload.length} bits, max=${maxB}) ===`);
        
        if (fullPayload.length > maxB) {
            console.log('  SKIP - payload too large');
            continue;
        }

        const mod = aw2_embed(new Int16Array(samples), fullPayload, sr);
        const bits = aw2_extract(mod, sr, Math.max(fullPayload.length, 5000));
        
        console.log(`  Extracted ${bits.length} bits`);
        console.log(`  First 40 extracted: ${bits.substring(0, 40)}`);
        console.log(`  Expected first 32:  ${fullPayload.substring(0, 32)}`);

        // Check first 32 bits match
        let match = 0;
        for (let i = 0; i < Math.min(32, bits.length); i++)
            if (bits[i] === fullPayload[i]) match++;
        console.log(`  First 32 bits match: ${match}/32 (${(match/32*100).toFixed(0)}%)`);

        const result = awExtractPayload(bits, key);
        if (!result) console.log('  Result: null');
        else if (result === 'bad-password') console.log('  Result: bad-password');
        else console.log(`  Result: ✅ "${new TextDecoder().decode(result)}"`);
    }

    // Test Echo Hiding
    console.log('\n=== Echo Hiding ===');
    for (const msg of ['Hi', 'Hello!', 'ABCD']) {
        const secretBytes = new TextEncoder().encode(msg);
        const fullPayload = awFormatPayload(secretBytes, key);
        const maxB = aw3_maxBits(samples.length, sr);
        console.log(`\n  "${msg}" (payload=${fullPayload.length} bits, max=${maxB}):`);
        if (fullPayload.length > maxB) { console.log('  SKIP'); continue; }
        const mod = aw3_embed(new Int16Array(samples), fullPayload, sr);
        const bits = aw3_extract(mod, sr, Math.max(fullPayload.length, 5000));
        const result = awExtractPayload(bits, key);
        if (!result) console.log('  null');
        else if (result === 'bad-password') {
            // debug
            console.log('  bad-password');
            const dlen = parseInt(bits.substring(0, 32), 2);
            console.log(`  Expected dlen: ${parseInt(fullPayload.substring(0, 32), 2)} got: ${dlen}`);
        }
        else console.log(`  ✅ "${new TextDecoder().decode(result)}"`);
    }

    // Test DSSS
    console.log('\n=== DSSS ===');
    for (const msg of ['Hi', 'Hello!', 'ABCDEFGHIJ']) {
        const secretBytes = new TextEncoder().encode(msg);
        const fullPayload = awFormatPayload(secretBytes, key);
        const maxB = aw4_maxBits(samples.length, sr);
        console.log(`\n  "${msg}" (payload=${fullPayload.length} bits, max=${maxB}):`);
        if (fullPayload.length > maxB) { console.log('  SKIP'); continue; }
        const mod = aw4_embed(new Int16Array(samples), fullPayload, sr);
        const bits = aw4_extract(mod, sr, Math.max(fullPayload.length, 5000));
        const result = awExtractPayload(bits, key);
        if (!result) console.log('  null');
        else if (result === 'bad-password') {
            console.log('  bad-password');
            const dlen = parseInt(bits.substring(0, 32), 2);
            console.log(`  Expected dlen: ${parseInt(fullPayload.substring(0, 32), 2)} got: ${dlen}`);
        }
        else console.log(`  ✅ "${new TextDecoder().decode(result)}"`);
    }

    // Test Patchwork
    console.log('\n=== Patchwork ===');
    for (const msg of ['Hi', 'ABCD']) {
        const secretBytes = new TextEncoder().encode(msg);
        const fullPayload = awFormatPayload(secretBytes, key);
        const maxB = aw7_maxBits(samples.length, sr);
        console.log(`\n  "${msg}" (payload=${fullPayload.length} bits, max=${maxB}):`);
        if (fullPayload.length > maxB) { console.log('  SKIP'); continue; }
        const mod = aw7_embed(new Int16Array(samples), fullPayload, sr);
        const bits = aw7_extract(mod, sr, Math.max(fullPayload.length, 5000));
        const result = awExtractPayload(bits, key);
        if (!result) console.log('  null');
        else if (result === 'bad-password') {
            console.log('  bad-password');
            const dlen = parseInt(bits.substring(0, 32), 2);
            console.log(`  Expected dlen: ${parseInt(fullPayload.substring(0, 32), 2)} got: ${dlen}`);
        }
        else console.log(`  ✅ "${new TextDecoder().decode(result)}"`);
    }
}

test().catch(e => console.error('Fatal:', e));

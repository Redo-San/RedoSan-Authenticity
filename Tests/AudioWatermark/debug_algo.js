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
    const secret = 'Hello!';
    const secretBytes = new TextEncoder().encode(secret);
    const key = await pw_key('test123');
    const payload = awFormatPayload(secretBytes, key);

    console.log('Original:', secret, '(' + secretBytes.length + ' bytes)');
    console.log('Payload bits:', payload.length);

    const sr = 44100, dur = 10;
    const samples = new Int16Array(sr * dur);
    for (let i = 0; i < samples.length; i++)
        samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 10000);

    // Embed
    console.time('aw2_embed');
    const embedded = aw2_embed(new Int16Array(samples), payload, sr);
    console.timeEnd('aw2_embed');

    // Extract
    console.time('aw2_extract');
    const bitsStr = aw2_extract(embedded, sr, Math.max(payload.length, 5000));
    console.timeEnd('aw2_extract');
    console.log('Extracted bits:', bitsStr.length);
    console.log('First 40 extracted:', bitsStr.substring(0, 40));

    const result = awExtractPayload(bitsStr, key);
    if (!result) console.log('Result: null');
    else if (result === 'bad-password') console.log('Result: bad password');
    else {
        const decoded = new TextDecoder().decode(result);
        console.log('Result:', JSON.stringify(decoded));
        console.log('Match:', decoded === secret);
    }

    // Also test LSB for comparison
    console.log('\n--- LSB (reference) ---');
    const lsbEmbedded = aw1_embed(new Int16Array(samples), payload);
    const lsbBits = aw1_extract(lsbEmbedded, lsbEmbedded.length);
    const lsbResult = awExtractPayload(lsbBits, key);
    if (lsbResult && lsbResult !== 'bad-password')
        console.log('LSB OK:', JSON.stringify(new TextDecoder().decode(lsbResult)));
    else
        console.log('LSB failed:', lsbResult);

    // Also test Echo Hiding
    console.log('\n--- Echo Hiding ---');
    try {
        console.time('aw3_embed');
        const e3 = aw3_embed(new Int16Array(samples), payload, sr);
        console.timeEnd('aw3_embed');
        console.time('aw3_extract');
        const b3 = aw3_extract(e3, sr, Math.max(payload.length, 5000));
        console.timeEnd('aw3_extract');
        const r3 = awExtractPayload(b3, key);
        if (r3 && r3 !== 'bad-password')
            console.log('Echo OK:', JSON.stringify(new TextDecoder().decode(r3)));
        else
            console.log('Echo failed:', r3);
    } catch (e) { console.log('Echo error:', e.message); }

    // Test DSSS
    console.log('\n--- DSSS ---');
    try {
        console.time('aw4_embed');
        const e4 = aw4_embed(new Int16Array(samples), payload, sr);
        console.timeEnd('aw4_embed');
        console.time('aw4_extract');
        const b4 = aw4_extract(e4, sr, Math.max(payload.length, 5000));
        console.timeEnd('aw4_extract');
        const r4 = awExtractPayload(b4, key);
        if (r4 && r4 !== 'bad-password')
            console.log('DSSS OK:', JSON.stringify(new TextDecoder().decode(r4)));
        else
            console.log('DSSS failed:', r4);
    } catch (e) { console.log('DSSS error:', e.message); }

    // Test Patchwork
    console.log('\n--- Patchwork ---');
    try {
        console.time('aw7_embed');
        const e7 = aw7_embed(new Int16Array(samples), payload, sr);
        console.timeEnd('aw7_embed');
        console.time('aw7_extract');
        const b7 = aw7_extract(e7, sr, Math.max(payload.length, 5000));
        console.timeEnd('aw7_extract');
        const r7 = awExtractPayload(b7, key);
        if (r7 && r7 !== 'bad-password')
            console.log('Patchwork OK:', JSON.stringify(new TextDecoder().decode(r7)));
        else
            console.log('Patchwork failed:', r7);
    } catch (e) { console.log('Patchwork error:', e.message); }
}

test().catch(e => console.error('Fatal:', e));

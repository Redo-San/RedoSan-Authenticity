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
    const secret = 'ABCDEFGH'; // 8 bytes
    const secretBytes = new TextEncoder().encode(secret);
    const key = await pw_key('test123');
    const payload = awFormatPayload(secretBytes, key);

    console.log('Secret:', secret, '(' + secretBytes.length + ' bytes)');
    console.log('Payload:', payload.length, 'bits');
    console.log('Payload prefix:', payload.substring(0, 64));

    const sr = 44100, dur = 3;
    const samples = new Int16Array(sr * dur);
    for (let i = 0; i < samples.length; i++)
        samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 10000);

    // Phase Coding - check bit error rate
    const embedded = aw2_embed(new Int16Array(samples), payload, sr);
    const bitsStr = aw2_extract(embedded, sr, Math.max(payload.length, 5000));
    
    // Compare input vs output bits
    let correct = 0, total = Math.min(payload.length, bitsStr.length);
    for (let i = 0; i < total; i++) if (payload[i] === bitsStr[i]) correct++;
    console.log('\nPhase Coding BER:');
    console.log('  Input bits:', payload.length);
    console.log('  Output bits:', bitsStr.length);
    console.log('  Correct:', correct, '/' + total, '(' + (correct/total*100).toFixed(1) + '%)');
    console.log('  Errors:', total - correct);
    
    // Show the first 96 bits comparison
    const showBits = 96;
    console.log('\n  First ' + showBits + ' bits:');
    console.log('  IN:  ' + payload.substring(0, showBits));
    console.log('  OUT: ' + bitsStr.substring(0, showBits));
    let diff = '';
    for (let i = 0; i < showBits; i++) diff += payload[i] === bitsStr[i] ? ' ' : '^';
    console.log('  DIF: ' + diff);

    // Check awExtractPayload
    const result = awExtractPayload(bitsStr, key);
    console.log('\n  awExtractPayload:', result === null ? 'null' : result === 'bad-password' ? 'bad-password' : 'OK');

    // Now test DSSS BER
    console.log('\n--- DSSS ---');
    const dsssEmb = aw4_embed(new Int16Array(samples), payload, sr);
    const dsssBits = aw4_extract(dsssEmb, sr, Math.max(payload.length, 5000));
    
    let dCorrect = 0, dTotal = Math.min(payload.length, dsssBits.length);
    for (let i = 0; i < dTotal; i++) if (payload[i] === dsssBits[i]) dCorrect++;
    console.log('  Correct:', dCorrect, '/' + dTotal, '(' + (dCorrect/dTotal*100).toFixed(1) + '%)');
    console.log('  IN:  ' + payload.substring(0, 64));
    console.log('  OUT: ' + dsssBits.substring(0, 64));

    // Now test Echo Hiding BER  
    console.log('\n--- Echo Hiding ---');
    const echoEmb = aw3_embed(new Int16Array(samples), payload, sr);
    const echoBits = aw3_extract(echoEmb, sr, Math.max(payload.length, 5000));
    let eCorrect = 0, eTotal = Math.min(payload.length, echoBits.length);
    for (let i = 0; i < eTotal; i++) if (payload[i] === echoBits[i]) eCorrect++;
    console.log('  Correct:', eCorrect, '/' + eTotal, '(' + (eCorrect/eTotal*100).toFixed(1) + '%)');
    console.log('  IN:  ' + payload.substring(0, 64));
    console.log('  OUT: ' + echoBits.substring(0, 64));

    // Now test Patchwork BER
    console.log('\n--- Patchwork ---');
    const patEmb = aw7_embed(new Int16Array(samples), payload, sr);
    const patBits = aw7_extract(patEmb, sr, Math.max(payload.length, 5000));
    let pCorrect = 0, pTotal = Math.min(payload.length, patBits.length);
    for (let i = 0; i < pTotal; i++) if (payload[i] === patBits[i]) pCorrect++;
    console.log('  Correct:', pCorrect, '/' + pTotal, '(' + (pCorrect/pTotal*100).toFixed(1) + '%)');
    console.log('  IN:  ' + payload.substring(0, 64));
    console.log('  OUT: ' + patBits.substring(0, 64));
}

test().catch(e => console.error('Fatal:', e));

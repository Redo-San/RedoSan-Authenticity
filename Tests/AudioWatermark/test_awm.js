const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;
global.crypto = { subtle: crypto.webcrypto.subtle };
global.window = global;
global.window.crypto = global.crypto;
global.document = { createElement: () => ({ appendChild: () => {}, innerHTML: '' }) };
global.Int16Array = Int16Array;
global.requestAnimationFrame = function(cb) { return setTimeout(cb, 0); };

const utils = fs.readFileSync(path.join(__dirname, '..', '..', 'Watermark', 'utils.js'), 'utf8');
const core = fs.readFileSync(path.join(__dirname, '..', '..', 'Audio_Watermark', 'audio_watermark_core.js'), 'utf8');
eval(utils.replace(/^\(function.*?\)\(\);\n?/, ''));
eval(core.replace(/^\(function.*?\)\(\);\n?/, ''));

function toWav(p, sr, maxSec) {
    const tmp = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
    const b = 't_' + path.basename(p).replace(/[<>:"/\\|?*]/g, '_') + sr + '.wav';
    const o = path.join(tmp, b);
    execSync(`ffmpeg -y -t ${maxSec||30} -i "${p}" -ar ${sr} -ac 1 -sample_fmt s16 "${o}" 2>nul`, { timeout: 60000, shell: 'cmd.exe' });
    return o;
}
function rWav(p) { const b = fs.readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
function snr(o, m) {
    let s=0, n=0; const l=Math.min(o.length,m.length);
    for(let i=0;i<l;i++){s+=o[i]*o[i];const d=o[i]-m[i];n+=d*d}
    return n===0?Infinity:10*Math.log10(s/n);
}
function fSize(n) { return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }

async function run() {
    const SR = 44100;
    const PASS = 'test123';

    // Messages per algorithm tier
    const M = {
        huge:  'This is a long document text for testing high-capacity algorithms like LSB and QIM which can embed thousands of characters into audio.', // 178 chars
        medium:'Hello World! This is a test message.',  // 35 chars
        small: 'Hello!',                                // 6 chars
        tiny:  'Hi'                                     // 2 chars
    };

    const algos = [
        { id:1, name:'LSB Audio',   msg:M.huge,  embed:(s,p)=>aw1_embed(s,p), extract:(s,n)=>aw1_extract(s,n), maxBits:(l)=>l },
        { id:2, name:'FFT-QIM',     msg:M.small,  embed:(s,p)=>aw2_embed(s,p,SR), extract:(s,n)=>aw2_extract(s,SR,n), maxBits:(l)=>aw2_maxBits(l,SR) },
        { id:3, name:'Echo Hiding', msg:M.tiny,   embed:(s,p)=>aw3_embed(s,p,SR), extract:(s,n)=>aw3_extract(s,SR,n), maxBits:(l)=>aw3_maxBits(l,SR) },
        { id:5, name:'QIM',         msg:M.huge,   embed:(s,p)=>aw5_embed(s,p,SR), extract:(s,n)=>aw5_extract(s,SR,n), maxBits:(l)=>l },
        { id:6, name:'DWT (Haar)',  msg:M.medium, embed:(s,p)=>aw6_embed(s,p,SR), extract:(s,n)=>aw6_extract(s,SR,n), maxBits:(l)=>aw6_maxBits(l,SR) },
        { id:8, name:'DCT-based',   msg:M.medium, embed:async (s,p)=>await aw8_embed_async(s,p,SR), extract:async (s,n)=>await aw8_extract_async(s,SR,n), maxBits:(l)=>aw8_maxBits(l,SR) }
    ];

    const audio = [
        { p:'G:\\Music\\نصرت البدر\\Ani Warda 22.mp3', l:'MP3 (voice+synthesizer)' },
        { p:'G:\\Music\\نصرت البدر\\سألني الليل - موسيقى.WAV', l:'WAV (instrumental)' }
    ];

    console.log('═══════════════════════════════════════════════════════');
    console.log('  AUDIO WATERMARKING — VERIFIED ALGORITHMS');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('  LSB + QIM → full documents   |   FFT-QIM + DWT + DCT → short messages');
    console.log('  Echo → 2-3 chars only        |   DSSS + Patchwork → removed (not reliable)\n');

    for (const a of audio) {
        const wav = toWav(a.p, SR, 30);
        const info = awReadWavRaw(rWav(wav));
        const orig = new Int16Array(info.samples);
        const sec = (info.samples.length / SR).toFixed(1);
        console.log(`━━━ 🔊 ${a.l} (${sec}s, ${fSize(fs.statSync(wav).size)}) ━━━\n`);

        for (const algo of algos) {
            const key = await pw_key(PASS);
            const secretBytes = new TextEncoder().encode(algo.msg);
            const payload = awFormatPayload(secretBytes, key);
            const maxB = algo.maxBits(info.samples.length);

            if (payload.length > maxB) {
                console.log(`  ⏭️ #${algo.id} ${algo.name.padEnd(14)} SKIP (payload ${payload.length}b > capacity ${maxB}b)`);
                continue;
            }

            const t0 = Date.now();
            let status, detail, snrVal = 0;

            try {
                const mod = await algo.embed(new Int16Array(orig), payload);
                snrVal = snr(orig, mod);
                const bits = await algo.extract(mod, Math.max(payload.length, 5000));
                const result = awExtractPayload(bits, key);

                if (!result) { status = '❌'; detail = 'No watermark'; }
                else if (result === 'bad-password') { status = '❌'; detail = 'Bad password'; }
                else {
                    const decoded = new TextDecoder().decode(result);
                    const exact = decoded === algo.msg;
                    status = exact ? '✅' : '⚠️';
                    detail = exact ? `"${algo.msg.substring(0,40)}${algo.msg.length>40?'...':''}"` : `Partial "${decoded.substring(0,20)}..."`;
                }
            } catch (e) { status = '💥'; detail = e.message.slice(0,60); }

            const t = ((Date.now()-t0)/1000).toFixed(2);
            const ss = snrVal ? ` ${snrVal.toFixed(1)}dB` : '';
            console.log(`  ${status} #${algo.id} ${algo.name.padEnd(14)} ${t.padStart(5)}s ${ss.padStart(9)}  ${detail}`);
        }
        console.log('');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('  CAPACITY TABLE (@ 30s, 44.1kHz)');
    console.log('═══════════════════════════════════════════════════════\n');
    const ref = { length: 44100 * 30 };
    for (const algo of algos) {
        const cap = algo.maxBits(ref.length);
        const msgBytes = Math.max(0, Math.floor((cap - 48) / 8));
        console.log(`  #${algo.id} ${algo.name.padEnd(14)} ${String(cap).padStart(7)} bits  ~ ${msgBytes} chars`);
    }
    console.log('\n  DSSS (#4) and Patchwork (#7) excluded — unreliable in FFT domain.');
}

run().catch(e => console.error('Fatal:', e));

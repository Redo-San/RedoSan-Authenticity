(function(){if(typeof window!='undefined'&&window.location&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
// ── Watermark-specific utilities ──

function bits(data) {
    let s = '';
    for (let i = 0; i < data.length; i++)
        s += data[i].toString(2).padStart(8, '0');
    return s;
}
function from_bits(s) {
    const len = Math.floor(s.length / 8), b = new Uint8Array(len);
    for (let i = 0; i < len; i++) b[i] = parseInt(s.substr(i * 8, 8), 2);
    return b;
}
function xor_bytes(data, key) {
    if (!key || !key.length) return data;
    const r = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) r[i] = data[i] ^ key[i % key.length];
    return r;
}
async function pw_key(password) {
    if (!password) return new Uint8Array(0);
    const enc = new TextEncoder();
    const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(password), iterations: 100000, hash: 'SHA-256' }, km, 256));
}
function mulberry32(seed) {
    return function() { seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function seededShuffle(arr, seed) {
    const rng = mulberry32(seed);
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
}

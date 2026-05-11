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
function pack32(v) { return new Uint8Array([(v>>24)&255,(v>>16)&255,(v>>8)&255,v&255]); }
function unpack32(b) { return (b[0]<<24)|(b[1]<<16)|(b[2]<<8)|b[3]; }
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image(), url = URL.createObjectURL(file);
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.width; c.height = img.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const d = ctx.getImageData(0, 0, img.width, img.height);
            d.w = img.width; d.h = img.height;
            URL.revokeObjectURL(url);
            resolve({ canvas: c, ctx, imgData: d, w: img.width, h: img.height });
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
        img.src = url;
    });
}
function canvasToBlob(canvas, mime) {
    return new Promise(r => canvas.toBlob(b => r(b), mime || 'image/png'));
}
function getRGB(imgData) {
    const r = new Uint8Array(imgData.w * imgData.h * 3);
    for (let i = 0; i < imgData.w * imgData.h; i++) {
        r[i*3] = imgData.data[i*4]; r[i*3+1] = imgData.data[i*4+1]; r[i*3+2] = imgData.data[i*4+2];
    }
    return r;
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
async function sha256Hex(data) {
    const h = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join('');
}
function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

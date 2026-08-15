/* c8 ignore start */
(function(){if(typeof window!=='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
/* c8 ignore stop */
// ── Face Fuzzy: fuzzy commitment key extraction (ISO/IEC 24745-style) ──
// Juels-Wattenberg fuzzy commitment over quantized face-descriptor bits with
// repetition-code error correction. Encodes a random secret, binds it to the
// biometric bits (helper data = codeword XOR bits), and extracts a stable
// SHA-256 key from noisy re-readings.
// NOTE: repetition-code ECC is a DEMONSTRATIVE construction (documented
// security limits, see README/plan section 9). Production-grade schemes use
// BCH/Reed-Solomon secure sketches. Requires FaceBioHash (for SHA-256).

(function () {
    'use strict';

    var sha256Hex = (typeof FaceBioHash !== 'undefined' && FaceBioHash._sha256Hex) ? FaceBioHash._sha256Hex : null;

    function getBit(bytes, k) {
        return (bytes[k >> 3] >> (7 - (k & 7))) & 1;
    }

    function setBit(bytes, k, v) {
        if (v) bytes[k >> 3] |= (1 << (7 - (k & 7)));
        else bytes[k >> 3] &= ~(1 << (7 - (k & 7)));
    }

    /**
     * Quantize a float descriptor into packed bits (1 bit per element).
     * Bit = 1 when the element is above the descriptor median (scale-invariant).
     * @param {Float32Array|number[]} descriptor
     * @returns {Uint8Array} packed bits (length = ceil(dim/8))
     */
    function quantize(descriptor) {
        var sorted, median, byteLen, out, i;
        if (!descriptor || typeof descriptor.length !== 'number' || descriptor.length === 0) throw new Error('A face descriptor is required.');
        sorted = Array.prototype.slice.call(descriptor).sort(function (a, b) { return a - b; });
        median = sorted.length % 2 === 1
            ? sorted[(sorted.length - 1) >> 1]
            : (sorted[sorted.length >> 1] + sorted[(sorted.length >> 1) - 1]) / 2;
        byteLen = Math.ceil(descriptor.length / 8);
        out = new Uint8Array(byteLen);
        for (i = 0; i < descriptor.length; i++) {
            if (descriptor[i] > median) setBit(out, i, 1);
        }
        return out;
    }

    function randomBytes(n) {
        var out, i;
        out = new Uint8Array(n);
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            crypto.getRandomValues(out);
        } else if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
            globalThis.crypto.getRandomValues(out);
        } else {
            for (i = 0; i < n; i++) out[i] = (Math.random() * 256) | 0;
        }
        return out;
    }

    /**
     * Repeat each bit `rep` times (repetition code).
     * @param {Uint8Array} packedBits
     * @param {number} bitCount number of valid bits in packedBits
     * @param {number} rep repetition factor
     * @returns {Uint8Array} packed codeword bits (bitCount*rep)
     */
    function repeatCode(packedBits, bitCount, rep) {
        var byteLen, out, i, v, r;
        byteLen = Math.ceil((bitCount * rep) / 8);
        out = new Uint8Array(byteLen);
        for (i = 0; i < bitCount; i++) {
            v = getBit(packedBits, i);
            for (r = 0; r < rep; r++) setBit(out, i * rep + r, v);
        }
        return out;
    }

    function xorBytes(a, b) {
        var n, out, i;
        n = Math.min(a.length, b.length);
        out = new Uint8Array(n);
        for (i = 0; i < n; i++) out[i] = a[i] ^ b[i];
        return out;
    }

    /**
     * Encode: bind a fresh random secret to quantized biometric bits.
     * @param {Uint8Array} bits packed quantized descriptor bits
     * @param {object} [opts]
     * @param {number} [opts.rep=15] repetition factor (error tolerance < 50% per group)
     * @param {string} [opts.secret] optional deterministic secret (hex) — tests only
     * @returns {{helper: Uint8Array, params: {rep: number, version: string}, key: string}}
     */
    function encode(bits, opts) {
        var rep, version, totalBits, secretBitLen, secretBytes, hex, i, secretPacked, j, hashedBytes, k, codeword, helper, key;
        opts = opts || {};
        rep = opts.rep || 15;
        version = opts.version || 'redosan-fuzzy-v1';
        if (!bits || bits.length === 0) throw new Error('Biometric bits are required.');
        totalBits = bits.length * 8;
        secretBitLen = Math.floor(totalBits / rep);
        if (secretBitLen < 8) throw new Error('Not enough biometric bits for repetition factor ' + rep + ' (need at least 8*' + rep + ').');

        if (opts.secret) {
            hex = String(opts.secret).replace(/^0x/i, '');
            if (hex.length % 2 !== 0) hex = '0' + hex;
            secretBytes = new Uint8Array(hex.length / 2);
            for (i = 0; i < secretBytes.length; i++) secretBytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        } else {
            secretBytes = randomBytes(Math.ceil(secretBitLen / 8));
        }
        secretPacked = new Uint8Array(Math.ceil(secretBitLen / 8));
        for (j = 0; j < secretBitLen; j++) {
            setBit(secretPacked, j, getBit(secretBytes, j));
        }
        hashedBytes = new Uint8Array(Math.ceil(secretBitLen / 8));
        for (k = 0; k < secretBitLen; k++) setBit(hashedBytes, k, getBit(secretPacked, k));
        codeword = repeatCode(secretPacked, secretBitLen, rep);
        helper = xorBytes(codeword, bits);
        key = sha256Hex ? sha256Hex(Array.prototype.map.call(hashedBytes, function (b) { return String.fromCharCode(b); }).join('')) : '';
        return { helper: helper, params: { rep: rep, version: version, secretBits: secretBitLen }, key: key };
    }

    /**
     * Decode: recover the key from helper data + a noisy biometric reading.
     * @param {Uint8Array} helper stored helper data
     * @param {Uint8Array} bits new quantized descriptor bits
     * @param {object} [opts] must match encode opts (rep)
     * @returns {{key: string, secretBytes: Uint8Array, corrected: number}} corrected = bit groups fixed
     */
    function decode(helper, bits, opts) {
        var rep, totalBits, secretBitLen, est, secretPacked, corrected, g, ones, r, majority, orig, secretBytes, j, key;
        opts = opts || {};
        rep = opts.rep || 15;
        if (!helper || !bits) throw new Error('Helper data and biometric bits are required.');
        if (helper.length !== bits.length) throw new Error('Helper and biometric bit lengths differ.');
        totalBits = bits.length * 8;
        secretBitLen = Math.floor(totalBits / rep);
        if (secretBitLen < 8) throw new Error('Not enough bits for repetition factor ' + rep + '.');

        est = xorBytes(helper, bits);
        secretPacked = new Uint8Array(Math.ceil(secretBitLen / 8));
        corrected = 0;
        for (g = 0; g < secretBitLen; g++) {
            ones = 0;
            for (r = 0; r < rep; r++) ones += getBit(est, g * rep + r);
            majority = ones >= Math.ceil(rep / 2) ? 1 : 0;
            orig = getBit(est, g * rep);
            if (majority !== orig) corrected++;
            setBit(secretPacked, g, majority);
        }
        secretBytes = new Uint8Array(Math.ceil(secretBitLen / 8));
        for (j = 0; j < secretBitLen; j++) setBit(secretBytes, j, getBit(secretPacked, j));
        key = sha256Hex ? sha256Hex(Array.prototype.map.call(secretBytes, function (b) { return String.fromCharCode(b); }).join('')) : '';
        return { key: key, secretBytes: secretBytes, corrected: corrected };
    }

    var FaceFuzzy = {
        VERSION: '1',
        quantize: quantize,
        encode: encode,
        decode: decode,
    };

    /* c8 ignore start */
    if (typeof window !== 'undefined') window.FaceFuzzy = FaceFuzzy;
    if (typeof module !== 'undefined' && module.exports) module.exports = FaceFuzzy;
    /* c8 ignore stop */
})();

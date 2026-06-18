(function(){if(globalThis.window!==undefined&&globalThis.location&&globalThis.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(globalThis.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();

// ── Frequency Domain Algorithms ──

// 3. Robust DCT Watermarking with advanced techniques
WatermarkCore.prototype.dct = function(imageData, message, password = null, options = {}) {
    const blockSize = 8;
    const K = (options && options.strength) || 15;
    const width = imageData.width;
    const height = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);
    
    // Encode message with redundancy (each bit × 3 for majority-vote correction)
    const encoded = this.encodeMessage(message);
    let bitIdx = 0;
    
    // Embed one bit per 8×8 block using coefficient pair comparison
    for (let y = 0; y < height - blockSize + 1 && bitIdx < encoded.length; y += blockSize) {
        for (let x = 0; x < width - blockSize + 1 && bitIdx < encoded.length; x += blockSize) {
            const block = this.extractBlock(data, x, y, width, blockSize);
            const dctBlock = this.applyDCT(block);
            
            // Read bit: 0 → c[5,2] > c[4,3], 1 → c[4,3] > c[5,2]
            const idxA = 5 * 8 + 2, idxB = 4 * 8 + 3;
            const bit = Number.parseInt(encoded[bitIdx++], 2);
            const gap = Math.abs(dctBlock[idxA] - dctBlock[idxB]);
            const avg = (dctBlock[idxA] + dctBlock[idxB]) / 2;
            const needed = Math.max(gap, 5) + K;
            if (bit === 0) {
                dctBlock[idxA] = avg + needed / 2;
                dctBlock[idxB] = avg - needed / 2;
            } else {
                dctBlock[idxA] = avg - needed / 2;
                dctBlock[idxB] = avg + needed / 2;
            }
            
            const watermarkedBlock = this.applyInverseDCT(dctBlock);
            this.putBlock(data, watermarkedBlock, x, y, width);
        }
    }
    
    return new ImageData(data, width, height);
};

// 4. Multi-resolution DWT with advanced embedding
WatermarkCore.prototype.dwt = function(imageData, message, password = null, options = {}) {
    const levels = options.levels || 1;
    const wavelet = options.wavelet || 'haar';
    const width = imageData.width;
    const height = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);
    
    // Apply multi-level DWT decomposition
    const waveletDecomposition = this.applyDWT(data, width, height, levels, wavelet);
    
    // Intelligent message distribution across sub-bands
    const encodedMessage = this.encodeMessage(message);
    const distribution = this.optimizeMessageDistribution(encodedMessage, waveletDecomposition);
    
    let messageIndex = 0;
    for (const band of ['LH', 'HL', 'HH']) {
        const coeffs = distribution[band];
        if (!coeffs) continue;
        for (let i = 0; i < coeffs.length && messageIndex < encodedMessage.length; i++) {
            coeffs[i] = this.embedInCoefficient(Math.round(coeffs[i]), 
                Number.parseInt(encodedMessage[messageIndex++], 2));
        }
    }
    
    // Reconstruct with inverse DWT
    const watermarkedData = this.applyInverseDWT(waveletDecomposition, width, height, levels, wavelet);
    
    return new ImageData(watermarkedData, width, height);
};

// 5. DFT Watermarking for rotation invariance
WatermarkCore.prototype.dft = function(imageData, message, password = null, options = {}) {
    const blockSize = 8;
    const K = (options && options.strength) || 15;
    const width = imageData.width;
    const height = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);
    
    const encoded = this.encodeMessage(message);
    let bitIdx = 0;
    
    for (let y = 0; y < height - blockSize + 1 && bitIdx < encoded.length; y += blockSize) {
        for (let x = 0; x < width - blockSize + 1 && bitIdx < encoded.length; x += blockSize) {
            const block = this.extractBlock(data, x, y, width, blockSize);
            const dftBlock = this.applyDFT(block);
            
            const idxA = 5 * 8 + 2, idxB = 4 * 8 + 3;
            const bit = Number.parseInt(encoded[bitIdx++], 2);
            const gap = Math.abs(dftBlock[idxA].real - dftBlock[idxB].real);
            const avg = (dftBlock[idxA].real + dftBlock[idxB].real) / 2;
            const needed = Math.max(gap, 5) + K;
            if (bit === 0) {
                dftBlock[idxA].real = avg + needed / 2;
                dftBlock[idxB].real = avg - needed / 2;
            } else {
                dftBlock[idxA].real = avg - needed / 2;
                dftBlock[idxB].real = avg + needed / 2;
            }
            
            const conjA = 3 * 8 + 6, conjB = 4 * 8 + 5;
            dftBlock[conjA].real = dftBlock[idxA].real;
            dftBlock[conjA].imag = -dftBlock[idxA].imag;
            dftBlock[conjB].real = dftBlock[idxB].real;
            dftBlock[conjB].imag = -dftBlock[idxB].imag;
            
            const watermarkedBlock = this.applyInverseDFT(dftBlock);
            this.putBlock(data, watermarkedBlock, x, y, width);
        }
    }
    
    return new ImageData(data, width, height);
};

// 6. Hybrid DCT-DWT for maximum robustness
WatermarkCore.prototype.hybridDCTDWT = function(imageData, message, options = {}) {
    const {
        dctStrength = 15
    } = options;
    
    const width = imageData.width;
    const height = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);
    const blockSize = 8;
    
    const encodedMessage = this.encodeMessage(message);
    const messageLength = encodedMessage.length;
    
    // DCT portion: one bit per 8x8 block via coefficient pair comparison
    const K = dctStrength;
    const idxA = 5 * 8 + 2, idxB = 4 * 8 + 3;
    let messageIndex = 0;
    
    for (let y = 0; y < height - blockSize + 1 && messageIndex < messageLength; y += blockSize) {
        for (let x = 0; x < width - blockSize + 1 && messageIndex < messageLength; x += blockSize) {
            const block = this.extractBlock(data, x, y, width, blockSize);
            const dctBlock = this.applyDCT(block);
            
            const bit = Number.parseInt(encodedMessage[messageIndex++], 2);
            const gap = Math.abs(dctBlock[idxA] - dctBlock[idxB]);
            const avg = (dctBlock[idxA] + dctBlock[idxB]) / 2;
            const needed = Math.max(gap, 5) + K;
            if (bit === 0) {
                dctBlock[idxA] = avg + needed / 2;
                dctBlock[idxB] = avg - needed / 2;
            } else {
                dctBlock[idxA] = avg - needed / 2;
                dctBlock[idxB] = avg + needed / 2;
            }
            
            const watermarkedBlock = this.applyInverseDCT(dctBlock);
            this.putBlock(data, watermarkedBlock, x, y, width);
        }
    }
    
    // DWT portion: step-2 LSB embedding for remaining bits (if any)
    if (messageIndex < messageLength) {
        const decomp = this.applyDWT(data, width, height, 1, 'haar');
        
        // Count available DWT coefficients
        const dwtCapacity = decomp._bandLen * 3; // LH + HL + HH
        const dwtBits = messageLength - messageIndex;
        if (dwtBits <= dwtCapacity) {
            for (const band of ['LH', 'HL', 'HH']) {
                const coeffs = decomp[band];
                const bandLen = decomp._bandLen;
                for (let i = 0; i < bandLen && messageIndex < messageLength; i++) {
                    coeffs[i] = this.embedInCoefficient(coeffs[i], Number.parseInt(encodedMessage[messageIndex++], 2));
                }
            }
            
            const reconstructed = this.applyInverseDWT(decomp, width, height, 1, 'haar');
            for (let i = 0; i < data.length; i++) {
                data[i] = reconstructed[i];
            }
        }
    }
    
    return new ImageData(data, width, height);
};

// ── Transform Methods ──

// DCT operations
WatermarkCore.prototype.applyDCT = function(block) {
    const N = 8;
    const transformed = Array.from({length: N * N});
    
    for (let u = 0; u < N; u++) {
        for (let v = 0; v < N; v++) {
            let sum = 0;
            for (let x = 0; x < N; x++) {
                for (let y = 0; y < N; y++) {
                    const pixelValue = block[y * N + x];
                    if (isNaN(pixelValue)) continue; // Skip NaN values
                    sum += pixelValue * 
                           Math.cos((2 * x + 1) * u * Math.PI / (2 * N)) *
                           Math.cos((2 * y + 1) * v * Math.PI / (2 * N));
                }
            }
            const result = sum * 0.25 * 
                          ((u === 0) ? 1/Math.sqrt(2) : Math.sqrt(2)) *
                          ((v === 0) ? 1/Math.sqrt(2) : Math.sqrt(2));
            transformed[u * N + v] = isNaN(result) ? 0 : result; // Handle NaN results
        }
    }
    return transformed;
};

WatermarkCore.prototype.applyDFT = function(block) {
    const N = 8;
    const transformed = [];
    for (let u = 0; u < N; u++) {
        for (let v = 0; v < N; v++) {
            let real = 0, imag = 0;
            for (let x = 0; x < N; x++) {
                for (let y = 0; y < N; y++) {
                    const val = block[y * N + x];
                    const angle = -2 * Math.PI * (u * x / N + v * y / N);
                    real += val * Math.cos(angle);
                    imag += val * Math.sin(angle);
                }
            }
            transformed[u * N + v] = { real, imag };
        }
    }
    return transformed;
};

WatermarkCore.prototype.applyInverseDFT = function(spectrum) {
    const N = 8;
    const block = Array.from({length: N * N});
    for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
            let sum = 0;
            for (let u = 0; u < N; u++) {
                for (let v = 0; v < N; v++) {
                    const idx = u * N + v;
                    const angle = 2 * Math.PI * (u * x / N + v * y / N);
                    sum += spectrum[idx].real * Math.cos(angle) - spectrum[idx].imag * Math.sin(angle);
                }
            }
            block[y * N + x] = sum / (N * N);
        }
    }
    return block;
};

WatermarkCore.prototype.applyInverseDCT = function(dctBlock) {
    const N = 8;
    const block = Array.from({length: N * N});
    
    for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
            let sum = 0;
            for (let u = 0; u < N; u++) {
                for (let v = 0; v < N; v++) {
                    const coeffIndex = u * N + v;
                    const coefficient = dctBlock[coeffIndex];
                    if (isNaN(coefficient)) continue; // Skip NaN values
                    sum += coefficient * 
                           Math.cos((2 * x + 1) * u * Math.PI / (2 * N)) *
                           Math.cos((2 * y + 1) * v * Math.PI / (2 * N)) *
                           ((u === 0) ? 1/Math.sqrt(2) : Math.sqrt(2)) *
                           ((v === 0) ? 1/Math.sqrt(2) : Math.sqrt(2));
                }
            }
            const result = sum * 0.25;
            block[y * N + x] = isNaN(result) ? 0 : result; // Handle NaN results
        }
    }
    return block;
};

// Get block from image data
WatermarkCore.prototype.getBlock = function(data, x, y, width) {
    const block = [];
    for (let dy = 0; dy < 8; dy++) {
        for (let dx = 0; dx < 8; dx++) {
            const pixelIndex = ((y + dy) * width + (x + dx)) * 4;
            block[dy * 8 + dx] = (data[pixelIndex] + data[pixelIndex + 1] + data[pixelIndex + 2]) / 3;
        }
    }
    return block;
};

// Put block back to image data
WatermarkCore.prototype.putBlock = function(data, block, x, y, width) {
    for (let dy = 0; dy < 8; dy++) {
        for (let dx = 0; dx < 8; dx++) {
            const pixelIndex = ((y + dy) * width + (x + dx)) * 4;
            const value = block[dy * 8 + dx];
            // Clamp values to valid range and ensure they're numbers
            const clampedValue = Math.max(0, Math.min(255, isNaN(value) ? 0 : value));
            data[pixelIndex] = clampedValue;
            data[pixelIndex + 1] = clampedValue;
            data[pixelIndex + 2] = clampedValue;
            // Alpha channel remains unchanged
            data[pixelIndex + 3] = data[pixelIndex + 3] || 255;
        }
    }
};

// DWT operations (simplified Haar)
WatermarkCore.prototype.applyDWT = function(data, width, height, levels, wavelet) {
    const halfW = Math.floor(width / 2);
    const halfH = Math.floor(height / 2);
    const LL = new Uint8ClampedArray(data.length);
    const LH = new Uint8ClampedArray(data.length);
    const HL = new Uint8ClampedArray(data.length);
    const HH = new Uint8ClampedArray(data.length);
    for (let y = 0; y < halfH * 2; y += 2) {
        for (let x = 0; x < halfW * 2; x += 2) {
            const idx00 = (y * width + x) * 4;
            const idx01 = (y * width + x + 1) * 4;
            const idx10 = ((y + 1) * width + x) * 4;
            const idx11 = ((y + 1) * width + x + 1) * 4;
            const outIdx = ((y / 2) * halfW + (x / 2)) * 4;
            for (let c = 0; c < 4; c++) {
                const a = data[idx00 + c], b = data[idx01 + c];
                const d = data[idx10 + c], e = data[idx11 + c];
                LL[outIdx + c] = (a + b + d + e) / 2;
                LH[outIdx + c] = (a + b - d - e) / 2;
                HL[outIdx + c] = (a - b + d - e) / 2;
                HH[outIdx + c] = (a - b - d + e) / 2;
            }
        }
    }
    return { LL, LH, HL, HH, _bandLen: halfW * halfH * 4 };
};

WatermarkCore.prototype.optimizeMessageDistribution = function(message, waveletDecomposition) {
    return waveletDecomposition;
};

// Apply inverse 1-level 2D Haar DWT
WatermarkCore.prototype.applyInverseDWT = function(decomposition, width, height, levels, wavelet = 'haar') {
    const { LL, LH, HL, HH } = decomposition;
    const halfW = Math.floor(width / 2);
    const halfH = Math.floor(height / 2);
    const data = new Uint8ClampedArray(width * height * 4);
    
    for (let y = 0; y < halfH * 2; y += 2) {
        for (let x = 0; x < halfW * 2; x += 2) {
            const outIdx00 = (y * width + x) * 4;
            const outIdx01 = (y * width + x + 1) * 4;
            const outIdx10 = ((y + 1) * width + x) * 4;
            const outIdx11 = ((y + 1) * width + x + 1) * 4;
            const inIdx = ((y / 2) * halfW + (x / 2)) * 4;
            
            for (let c = 0; c < 4; c++) {
                const ll = LL[inIdx + c];
                const lh = LH[inIdx + c];
                const hl = HL[inIdx + c];
                const hh = HH[inIdx + c];
                
                data[outIdx00 + c] = Math.max(0, Math.min(255, Math.round((ll + lh + hl + hh) / 2)));
                data[outIdx01 + c] = Math.max(0, Math.min(255, Math.round((ll + lh - hl - hh) / 2)));
                data[outIdx10 + c] = Math.max(0, Math.min(255, Math.round((ll - lh + hl - hh) / 2)));
                data[outIdx11 + c] = Math.max(0, Math.min(255, Math.round((ll - lh - hl + hh) / 2)));
            }
        }
    }
    
    return data;
};

// Apply 2D DFT
WatermarkCore.prototype.apply2DDFT = function(data, width, height) {
    const spectrum = [];
    const N = Math.max(width, height);
    
    for (let u = 0; u < height; u++) {
        spectrum[u] = [];
        for (let v = 0; v < width; v++) {
            let sum = { real: 0, imag: 0 };
            
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    const pixel = data[(y * width + x) * 4] / 255; // Normalize
                    const angle = -2 * Math.PI * (u * y / height + v * x / width);
                    
                    sum.real += pixel * Math.cos(angle);
                    sum.imag += pixel * Math.sin(angle);
                }
            }
            
            spectrum[u][v] = {
                real: sum.real,
                imag: sum.imag
            };
        }
    }
    
    return spectrum;
};

// Apply inverse 2D DFT
WatermarkCore.prototype.applyInverse2DDFT = function(spectrum, width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            let sum = { real: 0, imag: 0 };
            
            for (let u = 0; u < height; u++) {
                for (let v = 0; v < width; v++) {
                    const angle = 2 * Math.PI * (u * y / height + v * x / width);
                    const freq = spectrum[u][v];
                    
                    sum.real += freq.real * Math.cos(angle) - freq.imag * Math.sin(angle);
                    sum.imag += freq.real * Math.sin(angle) + freq.imag * Math.cos(angle);
                }
            }
            
            const pixelIndex = (y * width + x) * 4;
            const value = Math.max(0, Math.min(255, sum.real));
            
            for (let c = 0; c < 3; c++) {
                data[pixelIndex + c] = value;
            }
        }
    }
    
    return data;
};

// Extract block from image data
WatermarkCore.prototype.extractBlock = function(data, x, y, width, blockSize) {
    const block = new Array(blockSize * blockSize);
    for (let i = 0; i < blockSize; i++) {
        for (let j = 0; j < blockSize; j++) {
            const pixelIndex = ((y + i) * width + (x + j)) * 4;
            block[i * blockSize + j] = data[pixelIndex];
        }
    }
    return block;
};

// Modify DCT coefficient
WatermarkCore.prototype.modifyCoefficient = function(coefficient, bit, weight) {
    if (isNaN(coefficient) || isNaN(weight) || weight === 0) {
        return coefficient; // Return original if invalid
    }
    const quantized = Math.round(coefficient / weight);
    const modified = (quantized & ~1) | bit;
    return modified * weight;
};

// Embed in wavelet coefficient (step=2 to survive inverse/forward DWT rounding)
WatermarkCore.prototype.embedInCoefficient = function(coefficient, bit) {
    const rounded = Math.round(coefficient);
    const quantized = Math.floor(rounded / 2);
    return (quantized & ~1 | bit) * 2;
};

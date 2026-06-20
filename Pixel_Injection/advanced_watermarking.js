(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();
class AdvancedWatermarking {
    constructor() {
        this._core = new WatermarkCore();
        this.algorithms = this._core.algorithms;
        this.detection = this._core.detection;
    }

    stringToBinary(str) {
        return str.split('').map(char =>
            char.charCodeAt(0).toString(2).padStart(8, '0')).join('');
    }

    binaryToString(binary) {
        return binary.match(/.{1,8}/g).map(byte =>
            String.fromCharCode(parseInt(byte, 2))).join('');
    }

    addErrorCorrection(message) {
        const crc = this.calculateCRC32(message);
        return message + '|' + crc;
    }

    addRedundancy(message, factor) {
        const binary = this.stringToBinary(message);
        return binary.split('').map(bit => bit.repeat(factor)).join('');
    }

    generateAdversarialPattern(message) {
        const pattern = [];
        for (let i = 0; i < message.length; i++) {
            pattern.push(message[i] === '1' ? 1 : -1);
        }
        return this.applySpreadSpectrum(pattern);
    }

    applyPerceptualMask(pixel, bit, pattern) {
        const jnd = this.getJNDThreshold(pixel);
        const modification = bit ? pattern * jnd : 0;
        return Math.max(0, Math.min(255, pixel + modification));
    }

    applyDCT(block) {
        const N = block.length;
        const dctBlock = new Array(N).fill().map(() => new Array(N).fill(0));
        for (let u = 0; u < N; u++) {
            for (let v = 0; v < N; v++) {
                let sum = 0;
                for (let x = 0; x < N; x++) {
                    for (let y = 0; y < N; y++) {
                        sum += block[x][y] *
                            Math.cos((2 * x + 1) * u * Math.PI / (2 * N)) *
                            Math.cos((2 * y + 1) * v * Math.PI / (2 * N));
                    }
                }
                dctBlock[u][v] = sum * 2 / N *
                    (u === 0 ? 1 / Math.sqrt(2) : 1) *
                    (v === 0 ? 1 / Math.sqrt(2) : 1);
            }
        }
        return dctBlock;
    }

    applyInverseDCT(dctBlock) {
        const N = dctBlock.length;
        const block = new Array(N).fill().map(() => new Array(N).fill(0));
        for (let x = 0; x < N; x++) {
            for (let y = 0; y < N; y++) {
                let sum = 0;
                for (let u = 0; u < N; u++) {
                    for (let v = 0; v < N; v++) {
                        sum += dctBlock[u][v] *
                            Math.cos((2 * x + 1) * u * Math.PI / (2 * N)) *
                            Math.cos((2 * y + 1) * v * Math.PI / (2 * N)) *
                            (u === 0 ? 1 / Math.sqrt(2) : 1) *
                            (v === 0 ? 1 / Math.sqrt(2) : 1);
                    }
                }
                block[x][y] = sum * 2 / N;
            }
        }
        return block;
    }

    calculatePSNR(original, watermarked) {
        const mse = this.calculateMSE(original, watermarked);
        return 10 * Math.log10(255 * 255 / mse);
    }

    calculateSSIM(original, watermarked) {
        const mu1 = this.calculateMean(original);
        const mu2 = this.calculateMean(watermarked);
        const sigma1 = this.calculateStdDev(original, mu1);
        const sigma2 = this.calculateStdDev(watermarked, mu2);
        const sigma12 = this.calculateCovariance(original, watermarked, mu1, mu2);
        const c1 = 0.01 * 255;
        const c2 = 0.03 * 255;
        const ssim = ((2 * mu1 * mu2 + c1) * (2 * sigma12 + c2)) /
                   ((mu1 * mu1 + mu2 * mu2 + c1) * (sigma1 * sigma1 + sigma2 * sigma2 + c2));
        return Math.max(0, ssim);
    }

    calculateMSE(original, watermarked) {
        let sum = 0;
        const n = original.data.length;
        for (let i = 0; i < n; i++) {
            const diff = original.data[i] - watermarked.data[i];
            sum += diff * diff;
        }
        return sum / n;
    }

    calculateMean(imageData) {
        let sum = 0;
        const n = imageData.data.length;
        for (let i = 0; i < n; i++) {
            sum += imageData.data[i];
        }
        return sum / n;
    }

    calculateStdDev(imageData, mean) {
        let sum = 0;
        const n = imageData.data.length;
        for (let i = 0; i < n; i++) {
            const diff = imageData.data[i] - mean;
            sum += diff * diff;
        }
        return Math.sqrt(sum / n);
    }

    calculateCovariance(data1, data2, mean1, mean2) {
        let sum = 0;
        const n = data1.data.length;
        for (let i = 0; i < n; i++) {
            sum += (data1.data[i] - mean1) * (data2.data[i] - mean2);
        }
        return sum / n;
    }

    extractBlock(data, x, y, width, blockSize) {
        const block = new Array(blockSize).fill().map(() => new Array(blockSize).fill(0));
        for (let i = 0; i < blockSize; i++) {
            for (let j = 0; j < blockSize; j++) {
                const pixelIndex = ((y + i) * width + (x + j)) * 4;
                block[i][j] = data[pixelIndex];
            }
        }
        return block;
    }

    putBlock(data, block, x, y, width) {
        const blockSize = block.length;
        for (let i = 0; i < blockSize; i++) {
            for (let j = 0; j < blockSize; j++) {
                const pixelIndex = ((y + i) * width + (x + j)) * 4;
                data[pixelIndex] = block[i][j];
            }
        }
    }

    modifyCoefficient(coefficient, bit, strength) {
        const quantized = Math.round(coefficient / strength);
        const modified = (quantized & ~1) | bit;
        return modified * strength;
    }

    embedInCoefficient(coefficient, bit) {
        return (coefficient & ~1) | bit;
    }

    calculateCRC32(str) {
        let crc = 0xFF_FF_FF_FF;
        for (let i = 0; i < str.length; i++) {
            crc ^= str.charCodeAt(i);
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (crc & 1 ? 0xED_B8_83_20 : 0);
            }
        }
        return (crc ^ 0xFF_FF_FF_FF).toString(16).toUpperCase();
    }

    calculateJNDMask(data, pixelIndex, x, y) {
        const brightness = (data[pixelIndex] + data[pixelIndex + 1] + data[pixelIndex + 2]) / 3;
        return [
            brightness < 64 ? 2 : brightness < 128 ? 4 : 8,
            brightness < 64 ? 2 : brightness < 128 ? 4 : 8,
            brightness < 64 ? 2 : brightness < 128 ? 4 : 8
        ];
    }

    getJNDThreshold(pixel) {
        if (typeof pixel === 'number') {
            if (pixel < 64) return 2;
            if (pixel < 128) return 4;
            return 8;
        }
        const brightness = (pixel.r + pixel.g + pixel.b) / 3;
        if (brightness < 64) return 2;
        if (brightness < 128) return 4;
        return 8;
    }

    applySpreadSpectrum(pattern) {
        const spread = [];
        const pnSequence = this.generatePNSequence(pattern.length);
        for (let i = 0; i < pattern.length; i++) {
            spread.push(pattern[i] * pnSequence[i]);
        }
        return spread;
    }

    generatePNSequence(length) {
        const sequence = [];
        let seed = 12_345;
        for (let i = 0; i < length; i++) {
            seed = (seed * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
            sequence.push(seed % 2 === 0 ? 1 : -1);
        }
        return sequence;
    }
}

window.AdvancedWatermarking = AdvancedWatermarking;

/* c8 ignore next 3 */
(function () {
  if (
    typeof window != "undefined" &&
    window.location &&
    window.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      window.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();

// ── Frequency Domain Algorithms ──

// 3. Robust DCT Watermarking with advanced techniques
WatermarkCore.prototype.dct = function (
  imageData,
  message,
  password = null,
  options = {},
) {
  const blockSize = 8;
  const K = (options && options.strength) || 15;
  const width = imageData.width;
  const height = imageData.height;
  const data = new Uint8ClampedArray(imageData.data);

  // Encode message with redundancy (each bit × 3 for majority-vote correction)
  const encoded = this.encodeMessage(message);
  this.assertEmbedCapacity(width, height, encoded.length, blockSize);
  let bitIdx = 0;

  // Embed one bit per 8×8 block per color channel using coefficient pair comparison
  for (
    let y = 0;
    y < height - blockSize + 1 && bitIdx < encoded.length;
    y += blockSize
  ) {
    for (
      let x = 0;
      x < width - blockSize + 1 && bitIdx < encoded.length;
      x += blockSize
    ) {
      for (let channel = 0; channel < 3 && bitIdx < encoded.length; channel++) {
        const block = this.extractBlock(data, x, y, width, blockSize, channel);
        const dctBlock = this.applyDCT(block);

        // Read bit: 0 → c[5,2] > c[4,3], 1 → c[4,3] > c[5,2]
        const idxA = 5 * 8 + 2,
          idxB = 4 * 8 + 3;
        const bit = parseInt(encoded[bitIdx++], 2);
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
        this.putBlock(data, watermarkedBlock, x, y, width, channel);
      }
    }
  }

  return new ImageData(data, width, height);
};

// 4. Multi-resolution DWT with advanced embedding
WatermarkCore.prototype.dwt = function (
  imageData,
  message,
  password = null,
  options = {},
) {
  const levels = options.levels || 1;
  const wavelet = options.wavelet || "haar";
  const width = imageData.width;
  const height = imageData.height;
  const data = new Uint8ClampedArray(imageData.data);

  // Apply multi-level DWT decomposition
  const waveletDecomposition = this.applyDWT(
    data,
    width,
    height,
    levels,
    wavelet,
  );

  // Intelligent message distribution across sub-bands
  const encodedMessage = this.encodeMessage(message);
  const distribution = this.optimizeMessageDistribution(
    encodedMessage,
    waveletDecomposition,
  );

  // Only coefficients up to _bandLen are written by applyDWT; anything
  // beyond is zero padding that would silently swallow bits on extraction.
  const bandLen = waveletDecomposition._bandLen;
  const dwtCapacity = bandLen * 3;
  if (encodedMessage.length > dwtCapacity) {
    throw new Error(
      "Message too long for image capacity: needs " +
        encodedMessage.length +
        " bits but image supports " +
        dwtCapacity +
        " (" +
        width +
        "x" +
        height +
        "). Use a larger image or a shorter message.",
    );
  }

  let messageIndex = 0;
  for (const band of ["LH", "HL", "HH"]) {
    const coeffs = distribution[band];
    if (!coeffs) continue;
    for (
      let i = 0;
      i < coeffs.length && messageIndex < encodedMessage.length;
      i++
    ) {
      // embedInCoefficient rounds internally, so no Math.round() here.
      coeffs[i] = this.embedInCoefficient(
        coeffs[i],
        parseInt(encodedMessage[messageIndex++], 2),
      );
    }
  }

  // Reconstruct with inverse DWT
  const watermarkedData = this.applyInverseDWT(
    waveletDecomposition,
    width,
    height,
    levels,
    wavelet,
  );

  return new ImageData(watermarkedData, width, height);
};

// 5. DFT Watermarking for rotation invariance
WatermarkCore.prototype.dft = function (
  imageData,
  message,
  password = null,
  options = {},
) {
  const blockSize = 8;
  const K = (options && options.strength) || 15;
  const width = imageData.width;
  const height = imageData.height;
  const data = new Uint8ClampedArray(imageData.data);

  const encoded = this.encodeMessage(message);
  this.assertEmbedCapacity(width, height, encoded.length, blockSize);
  let bitIdx = 0;

  for (
    let y = 0;
    y < height - blockSize + 1 && bitIdx < encoded.length;
    y += blockSize
  ) {
    for (
      let x = 0;
      x < width - blockSize + 1 && bitIdx < encoded.length;
      x += blockSize
    ) {
      for (let channel = 0; channel < 3 && bitIdx < encoded.length; channel++) {
        const block = this.extractBlock(data, x, y, width, blockSize, channel);
        const dftBlock = this.applyDFT(block);

        const idxA = 5 * 8 + 2,
          idxB = 4 * 8 + 3;
        const bit = parseInt(encoded[bitIdx++], 2);
        const magA = Math.hypot(dftBlock[idxA].real, dftBlock[idxA].imag) || 1;
        const magB = Math.hypot(dftBlock[idxB].real, dftBlock[idxB].imag) || 1;
        const gap = Math.abs(magA - magB);
        // The inverse DFT divides by N*N (64) and conjugate symmetry doubles
        // the contribution, so an amplitude gap needs a ~32x boost to survive
        const needed = (Math.max(gap, 5) + K) * 32;
        let targetA, targetB;
        if (bit === 0) {
          targetA = magA + needed / 2;
          targetB = Math.max(magB - needed / 2, 0.5);
        } else {
          targetA = Math.max(magA - needed / 2, 0.5);
          targetB = magB + needed / 2;
        }
        // Scale the full vectors (real + imag) so Hermitian symmetry is preserved
        const scaleA = targetA / magA;
        const scaleB = targetB / magB;
        const applyScale = (idx, scale) => {
          const r = dftBlock[idx].real * scale;
          const im = dftBlock[idx].imag * scale;
          return { real: r, imag: im };
        };
        const newA = applyScale(idxA, scaleA);
        const newB = applyScale(idxB, scaleB);
        dftBlock[idxA] = newA;
        dftBlock[idxB] = newB;

        const conjA = 3 * 8 + 6,
          conjB = 4 * 8 + 5;
        dftBlock[conjA].real = newA.real;
        dftBlock[conjA].imag = -newA.imag;
        dftBlock[conjB].real = newB.real;
        dftBlock[conjB].imag = -newB.imag;

        const watermarkedBlock = this.applyInverseDFT(dftBlock);
        this.putBlock(data, watermarkedBlock, x, y, width, channel);
      }
    }
  }

  return new ImageData(data, width, height);
};

// 6. Hybrid DCT-DWT for maximum robustness
WatermarkCore.prototype.hybridDCTDWT = function (
  imageData,
  message,
  password = null,
  options = {},
) {
  const { dctStrength = 15 } = options || {};

  const width = imageData.width;
  const height = imageData.height;
  const data = new Uint8ClampedArray(imageData.data);
  const blockSize = 8;

  const encodedMessage = this.encodeMessage(message);
  // Capacity = DCT blocks + full DWT coefficient pool (LH/HL/HH)
  const dctCapacity =
    Math.floor(width / blockSize) * Math.floor(height / blockSize) * 3;
  const dwtCapacity = Math.floor(width / 2) * Math.floor(height / 2) * 4 * 3;
  if (encodedMessage.length > dctCapacity + dwtCapacity) {
    throw new Error(
      "Message too long for image capacity: needs " +
        encodedMessage.length +
        " bits but image supports " +
        (dctCapacity + dwtCapacity) +
        " (" +
        width +
        "x" +
        height +
        "). Use a larger image or a shorter message.",
    );
  }
  const messageLength = encodedMessage.length;

  // DCT portion: one bit per 8x8 block per channel via coefficient pair comparison
  const K = dctStrength;
  const idxA = 5 * 8 + 2,
    idxB = 4 * 8 + 3;
  let messageIndex = 0;

  for (
    let y = 0;
    y < height - blockSize + 1 && messageIndex < messageLength;
    y += blockSize
  ) {
    for (
      let x = 0;
      x < width - blockSize + 1 && messageIndex < messageLength;
      x += blockSize
    ) {
      for (
        let channel = 0;
        channel < 3 && messageIndex < messageLength;
        channel++
      ) {
        const block = this.extractBlock(data, x, y, width, blockSize, channel);
        const dctBlock = this.applyDCT(block);

        const bit = parseInt(encodedMessage[messageIndex++], 2);
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
        this.putBlock(data, watermarkedBlock, x, y, width, channel);
      }
    }
  }

  // DWT portion: step-2 LSB embedding for remaining bits (if any)
  if (messageIndex < messageLength) {
    const decomp = this.applyDWT(data, width, height, 1, "haar");

    // Count available DWT coefficients
    const dwtCapacity = decomp._bandLen * 3; // LH + HL + HH
    const dwtBits = messageLength - messageIndex;
    if (dwtBits <= dwtCapacity) {
      for (const band of ["LH", "HL", "HH"]) {
        const coeffs = decomp[band];
        const bandLen = decomp._bandLen;
        for (let i = 0; i < bandLen && messageIndex < messageLength; i++) {
          coeffs[i] = this.embedInCoefficient(
            coeffs[i],
            parseInt(encodedMessage[messageIndex++], 2),
          );
        }
      }

      const reconstructed = this.applyInverseDWT(
        decomp,
        width,
        height,
        1,
        "haar",
      );
      for (let i = 0; i < data.length; i++) {
        data[i] = reconstructed[i];
      }
    }
  }

  return new ImageData(data, width, height);
};

// ── Transform Methods ──

// DCT operations
WatermarkCore.prototype.applyDCT = function (block) {
  const N = 8;
  const transformed = new Array(N * N);

  for (let u = 0; u < N; u++) {
    for (let v = 0; v < N; v++) {
      let sum = 0;
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          const pixelValue = block[y * N + x];
          if (isNaN(pixelValue)) continue; // Skip NaN values
          sum +=
            pixelValue *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
        }
      }
      const result =
        sum *
        0.25 *
        (u === 0 ? 1 / Math.sqrt(2) : 1) *
        (v === 0 ? 1 / Math.sqrt(2) : 1);
      transformed[u * N + v] = isNaN(result) ? 0 : result; // Handle NaN results
    }
  }
  return transformed;
};

WatermarkCore.prototype.applyDFT = function (block) {
  const N = 8;
  const transformed = [];
  for (let u = 0; u < N; u++) {
    for (let v = 0; v < N; v++) {
      let real = 0,
        imag = 0;
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          const val = block[y * N + x];
          const angle = -2 * Math.PI * ((u * x) / N + (v * y) / N);
          real += val * Math.cos(angle);
          imag += val * Math.sin(angle);
        }
      }
      transformed[u * N + v] = { real, imag };
    }
  }
  return transformed;
};

WatermarkCore.prototype.applyInverseDFT = function (spectrum) {
  const N = 8;
  const block = new Array(N * N);
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      let sum = 0;
      for (let u = 0; u < N; u++) {
        for (let v = 0; v < N; v++) {
          const idx = u * N + v;
          const angle = 2 * Math.PI * ((u * x) / N + (v * y) / N);
          sum +=
            spectrum[idx].real * Math.cos(angle) -
            spectrum[idx].imag * Math.sin(angle);
        }
      }
      block[y * N + x] = sum / (N * N);
    }
  }
  return block;
};

WatermarkCore.prototype.applyInverseDCT = function (dctBlock) {
  const N = 8;
  const block = new Array(N * N);

  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      let sum = 0;
      for (let u = 0; u < N; u++) {
        for (let v = 0; v < N; v++) {
          const coeffIndex = u * N + v;
          const coefficient = dctBlock[coeffIndex];
          if (isNaN(coefficient)) continue; // Skip NaN values
          sum +=
            coefficient *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N)) *
            (u === 0 ? 1 / Math.sqrt(2) : 1) *
            (v === 0 ? 1 / Math.sqrt(2) : 1);
        }
      }
      const result = sum * 0.25;
      block[y * N + x] = isNaN(result) ? 0 : result; // Handle NaN results
    }
  }
  return block;
};

// Get block from image data (single channel to preserve color)
WatermarkCore.prototype.getBlock = function (data, x, y, width, channel = 1) {
  const block = [];
  for (let dy = 0; dy < 8; dy++) {
    for (let dx = 0; dx < 8; dx++) {
      const pixelIndex = ((y + dy) * width + (x + dx)) * 4;
      block[dy * 8 + dx] = data[pixelIndex + channel];
    }
  }
  return block;
};

// Put block back to image data (single channel to preserve color)
WatermarkCore.prototype.putBlock = function (
  data,
  block,
  x,
  y,
  width,
  channel = 1,
) {
  for (let dy = 0; dy < 8; dy++) {
    for (let dx = 0; dx < 8; dx++) {
      const pixelIndex = ((y + dy) * width + (x + dx)) * 4;
      const value = block[dy * 8 + dx];
      // Clamp values to valid range and ensure they're numbers
      const clampedValue = Math.max(0, Math.min(255, isNaN(value) ? 0 : value));
      data[pixelIndex + channel] = clampedValue;
      // Alpha channel remains unchanged
      data[pixelIndex + 3] = data[pixelIndex + 3] || 255;
    }
  }
};

// DWT operations (simplified Haar)
WatermarkCore.prototype.applyDWT = function (
  data,
  width,
  height,
  levels,
  wavelet,
) {
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  const bandLen = halfW * halfH * 4;
  // Float64: coefficients must not be clamped/rounded, otherwise embedding
  // bits (and the reconstructed colors) are destroyed by saturation. Only
  // bandLen entries are written, so allocate exactly that instead of the
  // 4x-wasteful full image size.
  const LL = new Float64Array(bandLen);
  const LH = new Float64Array(bandLen);
  const HL = new Float64Array(bandLen);
  const HH = new Float64Array(bandLen);
  for (let y = 0; y < halfH * 2; y += 2) {
    for (let x = 0; x < halfW * 2; x += 2) {
      const idx00 = (y * width + x) * 4;
      const idx01 = (y * width + x + 1) * 4;
      const idx10 = ((y + 1) * width + x) * 4;
      const idx11 = ((y + 1) * width + x + 1) * 4;
      const outIdx = ((y / 2) * halfW + x / 2) * 4;
      for (let c = 0; c < 4; c++) {
        const a = data[idx00 + c],
          b = data[idx01 + c];
        const d = data[idx10 + c],
          e = data[idx11 + c];
        LL[outIdx + c] = (a + b + d + e) / 4;
        LH[outIdx + c] = (a + b - d - e) / 4;
        HL[outIdx + c] = (a - b + d - e) / 4;
        HH[outIdx + c] = (a - b - d + e) / 4;
      }
    }
  }
  return { LL, LH, HL, HH, _bandLen: bandLen };
};

WatermarkCore.prototype.optimizeMessageDistribution = function (
  message,
  waveletDecomposition,
) {
  return waveletDecomposition;
};

// Apply inverse 1-level 2D Haar DWT
WatermarkCore.prototype.applyInverseDWT = function (
  decomposition,
  width,
  height,
  levels,
  wavelet = "haar",
) {
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
      const inIdx = ((y / 2) * halfW + x / 2) * 4;

      for (let c = 0; c < 4; c++) {
        const ll = LL[inIdx + c];
        const lh = LH[inIdx + c];
        const hl = HL[inIdx + c];
        const hh = HH[inIdx + c];

        data[outIdx00 + c] = Math.max(
          0,
          Math.min(255, Math.round(ll + lh + hl + hh)),
        );
        data[outIdx01 + c] = Math.max(
          0,
          Math.min(255, Math.round(ll + lh - hl - hh)),
        );
        data[outIdx10 + c] = Math.max(
          0,
          Math.min(255, Math.round(ll - lh + hl - hh)),
        );
        data[outIdx11 + c] = Math.max(
          0,
          Math.min(255, Math.round(ll - lh - hl + hh)),
        );
      }
    }
  }

  return data;
};

// Apply 2D DFT
WatermarkCore.prototype.apply2DDFT = function (data, width, height) {
  const spectrum = [];
  const N = Math.max(width, height);

  for (let u = 0; u < height; u++) {
    spectrum[u] = [];
    for (let v = 0; v < width; v++) {
      let sum = { real: 0, imag: 0 };

      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          const pixel = data[(y * width + x) * 4] / 255; // Normalize
          const angle = -2 * Math.PI * ((u * y) / height + (v * x) / width);

          sum.real += pixel * Math.cos(angle);
          sum.imag += pixel * Math.sin(angle);
        }
      }

      spectrum[u][v] = {
        real: sum.real,
        imag: sum.imag,
      };
    }
  }

  return spectrum;
};

// Apply inverse 2D DFT
WatermarkCore.prototype.applyInverse2DDFT = function (spectrum, width, height) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let sum = { real: 0, imag: 0 };

      for (let u = 0; u < height; u++) {
        for (let v = 0; v < width; v++) {
          const angle = 2 * Math.PI * ((u * y) / height + (v * x) / width);
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

// Extract block from image data (single channel to preserve color)
WatermarkCore.prototype.extractBlock = function (
  data,
  x,
  y,
  width,
  blockSize,
  channel = 0,
) {
  const block = new Array(blockSize * blockSize);
  for (let i = 0; i < blockSize; i++) {
    for (let j = 0; j < blockSize; j++) {
      const pixelIndex = ((y + i) * width + (x + j)) * 4;
      block[i * blockSize + j] = data[pixelIndex + channel];
    }
  }
  return block;
};

// Modify DCT coefficient
WatermarkCore.prototype.modifyCoefficient = function (
  coefficient,
  bit,
  weight,
) {
  if (isNaN(coefficient) || isNaN(weight) || weight === 0) {
    return coefficient; // Return original if invalid
  }
  const quantized = Math.round(coefficient / weight);
  const modified = (quantized & ~1) | bit;
  return modified * weight;
};

// Embed a bit in the LSB of a wavelet coefficient (change ≤1, survives the
// Uint8ClampedArray rounding introduced by the balanced /4 decomposition)
WatermarkCore.prototype.embedInCoefficient = function (coefficient, bit) {
  const rounded = Math.round(coefficient);
  return (rounded & ~1) | bit;
};

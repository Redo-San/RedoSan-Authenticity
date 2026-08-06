// ── CLI: Watermark Command ──
// Supports all 9 core algorithms + 14+ advanced algorithms

const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { createCanvas, loadImage, ImageData } = require("canvas");
const {
  readFileBytes,
  getFileInfo,
  fmtSize,
  saveImageData,
  loadImageData,
  validateFile,
  stripC2PA,
} = require("../utils");

// ── Patch browser APIs for Node.js ──
const mockDocument = {
  createElement: (tag) => {
    if (tag === "canvas") return createCanvas(1, 1);
    throw new Error(`createElement('${tag}') not supported in CLI`);
  },
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
};
globalThis.document = mockDocument;

// Polyfill ImageData for Node.js (canvas package expects width/height)
if (globalThis.ImageData === undefined) {
  globalThis.ImageData = ImageData;
}

// Polyfill crypto.subtle with PBKDF2 support (for pw_key)
if (globalThis.crypto === undefined || !globalThis.crypto.subtle) {
  globalThis.crypto = {
    subtle: {
      digest: async (algo, data) => {
        const name = typeof algo === "string" ? algo : algo.name || "SHA-256";
        const hash = crypto.createHash(name.toLowerCase().replace("-", "")).update(Buffer.from(data)).digest();
        return hash.buffer;
      },
      importKey: async (_format, keyData, algorithm, _extractable, _keyUsages) => {
        return { type: "secret", algorithm, keyData };
      },
      deriveBits: async (algorithm, baseKey, length) => {
        const pw = Buffer.from(baseKey.keyData);
        const salt = algorithm.salt || pw;
        const iterations = algorithm.iterations || 100_000;
        const hash = algorithm.hash || "SHA-256";
        const hashName = typeof hash === "string" ? hash.replace("-", "").toLowerCase() : "sha256";
        const derived = crypto.pbkdf2Sync(pw, salt, iterations, length / 8, hashName);
        return derived.buffer;
      },
    },
  };
}

if (globalThis.window === undefined) {
  globalThis.window = globalThis;
}

// Polyfill missing browser functions
if (globalThis.sha256Hex === undefined) {
  globalThis.sha256Hex = async (data) => {
    const hash = crypto.createHash("sha256").update(Buffer.from(data)).digest();
    return Array.from(hash)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };
}

// Load watermark modules via vm.runInThisContext
const vm = require("node:vm");
globalThis.LSB_MAX_BITS = 100_000;

const coreSrc = fs.readFileSync(path.join(__dirname, "..", "..", "Watermark", "watermark_core.js"), "utf8");
vm.runInThisContext(coreSrc, { filename: "watermark_core.js" });

// Load watermark utils (bits, from_bits, xor_bytes, pw_key)
const utilsSrc = fs.readFileSync(path.join(__dirname, "..", "..", "Watermark", "utils.js"), "utf8");
vm.runInThisContext(utilsSrc, { filename: "utils.js" });

// Load watermark.js (orchestrators watermarkEmbed/watermarkExtract)
const wmSrc = fs.readFileSync(path.join(__dirname, "..", "..", "Watermark", "watermark.js"), "utf8");
vm.runInThisContext(wmSrc, { filename: "watermark.js" });

// Load WatermarkCore from advanced watermark module for all advanced algorithms
const advancedSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Pixel_Injection", "watermark_core_advanced.js"),
  "utf8",
);
vm.runInThisContext(advancedSrc, { filename: "watermark_core_advanced.js" });
const transformsSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Pixel_Injection", "watermark_core_transforms.js"),
  "utf8",
);
vm.runInThisContext(transformsSrc, {
  filename: "watermark_core_transforms.js",
});
const algorithmsSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Pixel_Injection", "watermark_core_algorithms.js"),
  "utf8",
);
vm.runInThisContext(algorithmsSrc, {
  filename: "watermark_core_algorithms.js",
});

// Create instance of WatermarkCore for advanced algorithms
let watermarkCore = null;
try {
  watermarkCore = new globalThis.WatermarkCore();
} catch {
  // Will be checked at runtime
}

// ── Algorithm Maps ──
const CORE_ALGOS = {
  lsb: 1,
  dct: 2,
  random_lsb: 3,
  neural_lsb: 4,
  zero_bit: 5,
  multi_bit: 6,
  forensic: 7,
  fragile: 8,
  imatag: 9,
};

const ADVANCED_ALGOS = [
  "enhanced_lsb",
  "adaptive_lsb",
  "multi_channel_lsb",
  "dwt",
  "dft",
  "hybrid_dct_dwt",
  "vine",
  "pixel_seal",
  "nullguard",
  "shallow_diffuse",
  "diffusion_based",
  "imagewmark",
  "meta_seal",
  "stardustmark",
  "invisimark",
  "elevenlikes",
];

const ALL_ALGOS = { ...CORE_ALGOS };
for (const a of ADVANCED_ALGOS) ALL_ALGOS[a] = a;

// ── Embed payload helpers (matches watermark.js format) ──
/**
 *
 * @param data
 */
function bytesToBits(data) {
  let s = "";
  for (let i = 0; i < data.length; i++) s += data[i].toString(2).padStart(8, "0");
  return s;
}

/**
 *
 * @param s
 */
function bitsFromStr(s) {
  const len = Math.floor(s.length / 8),
    b = new Uint8Array(len);
  for (let i = 0; i < len; i++) b[i] = parseInt(s.substr(i * 8, 8), 2);
  return b;
}

/**
 *
 * @param v
 */
function pack32(v) {
  return new Uint8Array([(v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255]);
}

/**
 *
 * @param data
 * @param key
 */
function xorBytes(data, key) {
  if (!key?.length) return data;
  const r = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) r[i] = data[i] ^ key[i % key.length];
  return r;
}

/**
 *
 * @param password
 */
async function deriveKey(password) {
  if (!password) return new Uint8Array(0);
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: enc.encode(password),
        iterations: 100_000,
        hash: "SHA-256",
      },
      km,
      256,
    ),
  );
}

/**
 *
 * @param secretData
 * @param key
 */
function makePayload(secretData, key) {
  const magic = new Uint8Array([0xaa, 0xbb]);
  const rawData = new Uint8Array(2 + secretData.length);
  rawData.set(magic);
  rawData.set(secretData, 2);
  const xored = xorBytes(rawData, key);
  const lenBytes = pack32(2 + secretData.length);
  const payload = new Uint8Array(4 + xored.length);
  payload.set(lenBytes);
  payload.set(xored, 4);
  return { payload, bits: bytesToBits(payload) };
}

/**
 *
 * @param bitsStr
 * @param key
 */
function extractPayload(bitsStr, key) {
  if (bitsStr.length < 32) return null;
  const dlen = parseInt(bitsStr.substr(0, 32), 2);
  if (isNaN(dlen) || dlen <= 0 || dlen > 100_000) return null;
  if (bitsStr.length < 32 + dlen * 8) return null;
  const enc = bitsFromStr(bitsStr.substr(32, dlen * 8));
  const dec = xorBytes(enc, key);
  if (dec.length >= 2 && dec[0] === 0xaa && dec[1] === 0xbb) return dec.slice(2);
  return null;
}

// ── Main Command ──
/**
 *
 * @param mode
 * @param opts
 */
async function runWatermark(mode, opts) {
  try {
    const imageFile = opts.image;
    if (!imageFile) {
      console.error("Error: --image (-i) is required");
      process.exit(1);
    }

    const absPath = path.resolve(imageFile);
    const allowDangerous = opts.allowDangerous || process.argv.includes("--allow-dangerous");
    try {
      validateFile(absPath, { allowDangerous });
    } catch (error) {
      console.error(`Validation failed for image: ${error.message}`);
      if (error.message.includes("Blocked dangerous file type")) {
        console.error("Use --allow-dangerous to bypass file validation");
      }
      process.exit(1);
    }
    if (opts.secret) {
      try {
        validateFile(path.resolve(opts.secret), { allowDangerous });
      } catch (error) {
        console.error(`Validation failed for secret: ${error.message}`);
        process.exit(1);
      }
    }
    const info = getFileInfo(imageFile);
    const algoName = (opts.algo || "lsb").toLowerCase();
    const isAdvanced = ADVANCED_ALGOS.includes(algoName);
    const algoNum = CORE_ALGOS[algoName];
    const password = opts.password || "";

    if (!isAdvanced && !algoNum) {
      console.error(`Unknown algorithm: ${algoName}`);
      console.error("Core: lsb, dct, random_lsb, neural_lsb, zero_bit, multi_bit, forensic, fragile, imatag");
      console.error("Advanced: " + ADVANCED_ALGOS.join(", "));
      process.exit(1);
    }

    // Load image (strip c2pa chunks first — canvas can't handle them)
    const rawBuf = readFileBytes(absPath);
    const cleanBuf = stripC2PA(rawBuf);
    const img = await loadImage(cleanBuf);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, img.width, img.height);
    imgData.w = img.width;
    imgData.h = img.height;

    if (mode === "embed") {
      await doEmbed(canvas, ctx, imgData, opts, algoName, algoNum, isAdvanced, password);
    } else if (mode === "extract") {
      await doExtract(canvas, ctx, imgData, opts, algoName, algoNum, isAdvanced, password);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 *
 * @param canvas
 * @param ctx
 * @param imgData
 * @param opts
 * @param algoName
 * @param algoNum
 * @param isAdvanced
 * @param password
 */
async function doEmbed(canvas, ctx, imgData, opts, algoName, algoNum, isAdvanced, password) {
  const secretFile = opts.secret;
  const outputFile = opts.output;
  if (!outputFile) {
    console.error("Error: --output (-o) is required for embed mode");
    process.exit(1);
  }

  const { w, h } = imgData;
  const maxPixels = w * h * 3;
  const secretData = secretFile ? readFileBytes(secretFile) : null;
  const key = await deriveKey(password);
  const keyVal = key.length >= 4 ? ((key[0] << 24) | (key[1] << 16) | (key[2] << 8) | key[3]) >>> 0 : 12_345;

  if (isAdvanced) {
    // ── Advanced algorithms via WatermarkCore ──
    if (!watermarkCore) {
      console.error("WatermarkCore not available");
      process.exit(1);
    }
    const embedFn = watermarkCore.algorithms[algoName];
    if (!embedFn) {
      console.error(`Algorithm ${algoName} not found in WatermarkCore`);
      process.exit(1);
    }

    const message = secretData ? new TextDecoder().decode(secretData) : "RedoSan";
    const result = embedFn(imgData, message, password, {});
    ctx.putImageData(result, 0, 0);
    const outBuf = canvas.toBuffer("image/png");
    fs.writeFileSync(path.resolve(outputFile), outBuf);
    console.log(`Advanced watermark embedded (${algoName})`);
    console.log(`Output: ${path.resolve(outputFile)}`);
  } else
    switch (algoNum) {
      case 1: {
        // LSB
        const payload = makePayload(secretData || new Uint8Array(0), key);
        if (payload.bits.length > maxPixels) {
          console.error("Image too small");
          process.exit(1);
        }
        globalThis.wm1_embed(imgData, payload.bits.split("").map(Number));
        ctx.putImageData(imgData, 0, 0);
        saveEmbed(path.resolve(outputFile), payload.bits.length);

        break;
      }
      case 3: {
        // Random LSB (seeded shuffle)
        const payload = makePayload(secretData || new Uint8Array(0), key);
        if (payload.bits.length > maxPixels) {
          console.error("Image too small");
          process.exit(1);
        }
        globalThis.wm3_embed(imgData, payload.bits.split("").map(Number), keyVal);
        ctx.putImageData(imgData, 0, 0);
        saveEmbed(path.resolve(outputFile), payload.bits.length);

        break;
      }
      case 6: {
        // Multi-bit (2-bit LSB)
        const payload = makePayload(secretData || new Uint8Array(0), key);
        if (payload.bits.length > (maxPixels * 2) / 3) {
          console.error("Image too small");
          process.exit(1);
        }
        globalThis.wm6_embed(imgData, payload.bits.split("").map(Number));
        ctx.putImageData(imgData, 0, 0);
        saveEmbed(path.resolve(outputFile), payload.bits.length);

        break;
      }
      case 8: {
        // Fragile (SHA-256 hash)
        if (!secretData) {
          console.error("Secret required for fragile algorithm");
          process.exit(1);
        }
        if (512 > maxPixels) {
          console.error("Image too small (need >= 171 pixels)");
          process.exit(1);
        }
        await globalThis.wm8_embed(imgData, secretData, key);
        ctx.putImageData(imgData, 0, 0);
        saveEmbed(path.resolve(outputFile), 512);

        break;
      }
      default: {
        if ([2, 4, 5, 7, 9].includes(algoNum)) {
          // DCT-based algorithms
          const ycbcr = globalThis.rgbToYcbcr(imgData);
          const cap = globalThis.maxDCTBits(w, h, 11);

          if (algoNum === 5) {
            const sig = new TextEncoder().encode("RedoSanZeroBit");
            const sigBits = bytesToBits(sig);
            globalThis.embedInDCT(ycbcr.Y, w, h, sigBits, 25);
            console.log("Zero-bit: embedding presence signature");
          } else {
            const payload = makePayload(secretData || new Uint8Array(0), key);
            switch (algoNum) {
              case 4: {
                if (payload.bits.length * 3 > cap) {
                  console.error("Secret too large for redundant embedding");
                  process.exit(1);
                }
                globalThis.embedInDCT(ycbcr.Y, w, h, payload.bits + payload.bits + payload.bits, 30);

                break;
              }
              case 7: {
                if (payload.bits.length > cap) {
                  console.error("Secret too large");
                  process.exit(1);
                }
                globalThis.embedInDCT(ycbcr.Y, w, h, payload.bits, 20);

                break;
              }
              case 9: {
                if (payload.bits.length > cap) {
                  console.error("Secret too large");
                  process.exit(1);
                }
                globalThis.embedInDCT(ycbcr.Y, w, h, payload.bits, 15);
                globalThis.embedInDCT(ycbcr.Cb, w, h, payload.bits, 10);

                break;
              }
              default: {
                if (payload.bits.length > cap) {
                  console.error("Secret too large");
                  process.exit(1);
                }
                globalThis.embedInDCT(ycbcr.Y, w, h, payload.bits, 25);
              }
            }
          }

          const result = globalThis.ycbcrToImageData(ycbcr.Y, ycbcr.Cb, ycbcr.Cr, w, h);
          ctx.putImageData(result.imgData, 0, 0);
          const outBuf = canvas.toBuffer("image/png");
          fs.writeFileSync(path.resolve(outputFile), outBuf);
          console.log(`Watermark embedded (${algoName})`);
          console.log(`Output: ${path.resolve(outputFile)}`);
        }
      }
    }

  /**
   *
   * @param outPath
   * @param bitsCount
   */
  function saveEmbed(outPath, bitsCount) {
    const outBuf = canvas.toBuffer("image/png");
    fs.writeFileSync(outPath, outBuf);
    console.log(`Watermark embedded (${algoName})`);
    console.log(`Output: ${outPath}`);
    console.log(`Payload: ${bitsCount} bits`);
  }
}

/**
 *
 * @param canvas
 * @param ctx
 * @param _canvas
 * @param _ctx
 * @param imgData
 * @param opts
 * @param algoName
 * @param algoNum
 * @param isAdvanced
 * @param password
 */
async function doExtract(_canvas, _ctx, imgData, opts, algoName, algoNum, isAdvanced, password) {
  const outputFile = opts.output;
  const { w, h } = imgData;
  const key = await deriveKey(password);
  const keyVal = key.length >= 4 ? ((key[0] << 24) | (key[1] << 16) | (key[2] << 8) | key[3]) >>> 0 : 12_345;

  if (isAdvanced) {
    if (!watermarkCore) {
      console.error("WatermarkCore not available");
      process.exit(1);
    }

    // Try WatermarkCore extract first, fallback to core LSB/DCT extraction
    const spatialAdvanced = ["enhanced_lsb", "adaptive_lsb", "multi_channel_lsb", "random_lsb"];
    const freqAdvanced = ["dct", "dwt", "dft", "hybrid_dct_dwt"];

    if (spatialAdvanced.includes(algoName)) {
      // Fallback to core wm1_extract for spatial advanced algos
      const bits = globalThis.wm1_extract(imgData);
      const data = extractPayload(bits, key);
      if (data) {
        writeExtracted(data, outputFile, algoName);
      } else {
        console.log("No watermark found. Try a different algorithm or password.");
      }
    } else if (freqAdvanced.includes(algoName)) {
      const ycbcr = globalThis.rgbToYcbcr(imgData);
      const bits = globalThis.extractFromDCT(ycbcr.Y, w, h, 100_000);
      const data = extractPayload(bits, key);
      if (data) {
        writeExtracted(data, outputFile, algoName);
      } else {
        console.log("No watermark found. Try a different algorithm or password.");
      }
    } else {
      // DL/Professional: try WatermarkCore native extraction
      const extractMethods = {
        vine: "extractVINE",
        pixel_seal: "extractPixelSeal",
        nullguard: "extractNullGuard",
        shallow_diffuse: "extractShallowDiffuse",
        diffusion_based: "extractDiffusionBased",
        imagewmark: "extractImageWMark",
        meta_seal: "extractMetaSeal",
        stardustmark: "extractStardustMark",
        invisimark: "extractInvisiMark",
        elevenlikes: "extractElevenLikes",
      };
      const methodName = extractMethods[algoName];
      let result;
      result =
        methodName && typeof watermarkCore[methodName] === "function"
          ? watermarkCore[methodName](imgData, password)
          : watermarkCore.blind_decoding(imgData, algoName, password);
      if (result && result !== "No readable message found") {
        const buf = Buffer.from(result, "utf-8");
        writeExtracted(buf, outputFile, algoName);
      } else {
        console.log("No watermark found with this algorithm.");
      }
    }
    return;
  }

  switch (algoNum) {
    case 1:
    case 3:
    case 6: {
      const fn = algoNum === 1 ? "wm1_extract" : algoNum === 3 ? "wm3_extract" : "wm6_extract";
      const args = algoNum === 3 ? [imgData, keyVal] : [imgData];
      const bits = globalThis[fn](...args);
      if (typeof bits === "string") {
        /* already string */
      }
      const data = extractPayload(bits, key);
      if (data) {
        writeExtracted(data, outputFile, algoName);
      } else {
        console.log("No watermark found. Try a different algorithm or password.");
      }

      break;
    }
    case 5: {
      const sig = new TextEncoder().encode("RedoSanZeroBit");
      const ycbcr = globalThis.rgbToYcbcr(imgData);
      const b = globalThis.extractFromDCT(ycbcr.Y, w, h, sig.length * 8);
      if (b.length < sig.length * 8) {
        console.log("No watermark detected");
        return;
      }
      const data = bitsFromStr(b.substr(0, sig.length * 8));
      let matches = 0;
      for (let i = 0; i < data.length; i++) if (data[i] === sig[i]) matches++;
      const ratio = matches / sig.length;
      if (ratio > 0.85) {
        console.log(`Presence confirmed (${Math.round(ratio * 100)}% match)`);
      } else {
        console.log(`No watermark (${Math.round(ratio * 100)}% match)`);
      }

      break;
    }
    case 8: {
      const hash = globalThis.wm8_extract(imgData, key);
      if (hash) {
        const hex = Array.from(hash)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        console.log(`SHA-256 hash extracted: ${hex}`);
      } else {
        console.log("No fragile watermark found.");
      }

      break;
    }
    default: {
      if ([2, 4, 7, 9].includes(algoNum)) {
        const ycbcr = globalThis.rgbToYcbcr(imgData);
        let b = globalThis.extractFromDCT(ycbcr.Y, w, h, 32);
        if (b.length < 32) {
          console.log("No watermark found");
          return;
        }
        const dlen = parseInt(b.substr(0, 32), 2);
        if (dlen <= 0 || dlen > 100_000) {
          console.log("No watermark found");
          return;
        }

        if (algoNum === 4) {
          const totalBits = 32 + dlen * 8 * 3;
          b = globalThis.extractFromDCT(ycbcr.Y, w, h, totalBits);
          if (b.length < totalBits) {
            console.log("No watermark found");
            return;
          }
        } else if ([2, 7].includes(algoNum)) {
          b = globalThis.extractFromDCT(ycbcr.Y, w, h, 32 + dlen * 8);
          if (b.length < 32 + dlen * 8) {
            console.log("No watermark found");
            return;
          }
        } else if (algoNum === 9) {
          // Imatag: extract from Cb (more robust), fallback to Y
          b = globalThis.extractFromDCT(ycbcr.Cb, w, h, 32 + dlen * 8);
          if (b.length < 32 + dlen * 8) {
            b = globalThis.extractFromDCT(ycbcr.Y, w, h, 32 + dlen * 8);
            if (b.length < 32 + dlen * 8) {
              console.log("No watermark found");
              return;
            }
          }
        }

        const data = extractPayload(b, key);
        if (data) {
          writeExtracted(data, outputFile, algoName);
        } else {
          console.log("Wrong password or no watermark.");
        }
      }
    }
  }
}

/**
 *
 * @param data
 * @param outputFile
 * @param algoName
 * @param _algoName
 */
function writeExtracted(data, outputFile, _algoName) {
  if (outputFile) {
    fs.writeFileSync(path.resolve(outputFile), data);
    console.log(`Extracted data (${data.length} bytes) saved to: ${path.resolve(outputFile)}`);
  } else {
    try {
      const text = new TextDecoder().decode(data);
      console.log(`Extracted text: ${text}`);
    } catch {
      console.log(`Extracted ${data.length} bytes (binary). Use --output to save.`);
    }
  }
}

module.exports = { runWatermark };

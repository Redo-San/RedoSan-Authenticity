#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- every path is
   built as path.join(ROOT, <entry>.dest) from the pinned ASSETS manifest
   plus the fixed repo ROOT; no user or network input reaches these calls */
// Fetch the desktop offline assets into vendor/ (gitignored; plan A3).
// Every entry is pinned by URL + SHA-256 + size; downloads are verified
// before landing and skipped entirely when already valid (idempotent).
// Required before `npx tauri build` (enforced by tauri-prepare-assets.mjs);
// the web build keeps its CDN fallbacks and does not need this script.
// Usage:
//   node scripts/fetch-desktop-assets.mjs          # fetch/repair
//   node scripts/fetch-desktop-assets.mjs --check  # verify only, no network
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_ONLY = process.argv.includes("--check");

const JSDELIVR = "https://cdn.jsdelivr.net/npm";
const ASSETS = [
  // FFmpeg.wasm single-threaded core (Converter/converter.js)
  {
    dest: "vendor/ffmpeg/ffmpeg-core.js",
    url: `${JSDELIVR}/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js`,
    sha256: "84423d4c31d3ac8771eb7a0a1636fb524e17e85c15155c3927bae9bee3884257",
    size: 86_313,
  },
  {
    dest: "vendor/ffmpeg/ffmpeg-core.wasm",
    url: `${JSDELIVR}/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.wasm`,
    sha256: "68b094c2dd90d813d5c0894c991499e297479e6c2dcd7e9b4940b5a22eb62701",
    size: 24_383_038,
  },
  {
    dest: "vendor/ffmpeg/ffmpeg-core.worker.js",
    url: `${JSDELIVR}/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.worker.js`,
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    size: 0,
  },
  // onnxruntime-web UMD + wasm (Voice_Biometric/*, Face_Biometric/*)
  {
    dest: "vendor/ort/ort.min.js",
    url: `${JSDELIVR}/onnxruntime-web@1.20.1/dist/ort.min.js`,
    sha256: "be6e560b64c03c99252eedc0e1989e9e51e44d9f191e7655c9bf011bf9f576c8",
    size: 446_284,
  },
  {
    dest: "vendor/ort/ort-wasm-simd-threaded.mjs",
    url: `${JSDELIVR}/onnxruntime-web@1.20.1/dist/ort-wasm-simd-threaded.mjs`,
    sha256: "745eb7c0ce6f18a6aa521971b2877babc7ffb27eecb58ab3bc6e5ef4692672e8",
    size: 24_618,
  },
  {
    dest: "vendor/ort/ort-wasm-simd-threaded.wasm",
    url: `${JSDELIVR}/onnxruntime-web@1.20.1/dist/ort-wasm-simd-threaded.wasm`,
    sha256: "207d02be4591c156b0a98f024f3d58005b5b04c92274d759fb390338c63559ea",
    size: 11_246_032,
  },
  // @vladmandic/human models (Face_Biometric/face_engine.js)
  ...[
    [
      "models.json",
      1630,
      "2381a421e897d0f3f4d229249e381dbbe75e1df49cd2e5a25485d3e2084dd567",
    ],
    [
      "blazeface.json",
      79_038,
      "cd7bbfc078270572beb39f9e5ae67aadbd50b5e67cff37e6d4f6b3ea39312e5f",
    ],
    [
      "blazeface.bin",
      538_928,
      "dc9a97fdc50bc43216554bdd69aa3e7b9361a519ee7bdd996a2f69a98a6f9b72",
    ],
    [
      "faceres.json",
      71_432,
      "5b83d49c0385d2e68a05122441b94226313677cae9fcc40b9587ad50079eb4df",
    ],
    [
      "faceres.bin",
      6_978_814,
      "2c7d2d62b76c97528b736527aa09d310ea71743c9e3e79fb6c62d4b2d73af79b",
    ],
    [
      "facemesh.json",
      95_845,
      "b60ca26f404724f43bd2b1575761d8265180e1f053cc0731caa68462927309e7",
    ],
    [
      "facemesh.bin",
      1_477_958,
      "3826da640b0a3021161605369ee6af293f75d518040355b960ec71a3390c1c0b",
    ],
    [
      "iris.json",
      122_025,
      "49038ac9dcc09aa05474d91d98e9db5b47af4830929bcf102ed5a56bfbabb465",
    ],
    [
      "iris.bin",
      2_599_092,
      "d7f296d184274213d4642681ae186112cbbec77fd2ab066257d3c56a1940bc71",
    ],
    [
      "emotion.json",
      17_980,
      "56f7e557eb0c863a8b9ab04ac7ccba756e93bf2c27dce135ef0e8712b80b7ad2",
    ],
    [
      "emotion.bin",
      820_516,
      "927ac8224f356ab1e68c2bcfbfa07b0c8567047d1bcf817388ba6e38214c4987",
    ],
  ].map(([name, size, sha256]) => ({
    dest: `vendor/human-models/${name}`,
    url: `${JSDELIVR}/@vladmandic/human@3.3.6/models/${name}`,
    sha256,
    size,
  })),
  // @contentauth/c2pa-web engine (C2PA/c2pa.js) — wasm hash is the
  // authoritative EXPECTED_WASM_HASH enforced at runtime.
  {
    dest: "vendor/c2pa/index.js",
    url: `${JSDELIVR}/@contentauth/c2pa-web@0.8.1/dist/index.js`,
    sha256: "b0d994aa6a8288cfe12c126446d59983b62c560df01ff6a65f84ca64dd453733",
    size: 156,
  },
  {
    dest: "vendor/c2pa/c2pa-DKxSS-my.js",
    url: `${JSDELIVR}/@contentauth/c2pa-web@0.8.1/dist/c2pa-DKxSS-my.js`,
    sha256: "89367b35ee71e2aee17dc2a69a45c5b7d69572cb250af78bbc9a7597de9755a0",
    size: 30_676,
  },
  {
    dest: "vendor/c2pa/c2pa_bg.wasm",
    url: `${JSDELIVR}/@contentauth/c2pa-web@0.8.1/dist/resources/c2pa_bg.wasm`,
    sha256: "640d8e02f9d6d8e2c919f3795126d049c4800ce2e71611322ae352a9e075c9ea",
    size: 8_742_950,
  },
  // Face ONNX models (Face_Biometric/face_embed_onnx.js, face_antispoof.js)
  {
    dest: "vendor/face/w600k_mbf.onnx",
    url: "https://huggingface.co/ykk648/face_lib/resolve/main/face_embedding/w600k_mbf.onnx",
    sha256: "9cc6e4a75f0e2bf0b1aed94578f144d15175f357bdc05e815e5c4a02b319eb4f",
    size: 13_616_099,
  },
  {
    dest: "vendor/face/minifasnet_v2.onnx",
    url: "https://huggingface.co/garciafido/minifasnet-v2-anti-spoofing-onnx/resolve/main/minifasnet_v2.onnx",
    sha256: "d7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b",
    size: 1_744_116,
  },
];

/**
 * @param {Buffer} buf - raw bytes to digest
 * @returns {string} lowercase hex SHA-256
 */
function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * @param {string} abs - absolute path of the candidate file
 * @param {{sha256: string, size: number}} asset - pinned manifest entry
 * @returns {boolean} true when the file exists with the pinned hash + size
 */
function isValid(abs, asset) {
  if (!existsSync(abs)) return false;
  const buf = readFileSync(abs);
  return buf.length === asset.size && sha256(buf) === asset.sha256;
}

/**
 * Download one asset, verify the pin, then land it atomically.
 * @param {(typeof ASSETS)[number]} asset - pinned manifest entry to fetch
 * @returns {Promise<void>} rejects on any verification failure
 */
async function download(asset) {
  const res = await fetch(asset.url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${asset.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length !== asset.size) {
    throw new Error(
      `size mismatch: got ${buf.length}, pinned ${asset.size} (${asset.url})`,
    );
  }
  const got = sha256(buf);
  if (got !== asset.sha256) {
    throw new Error(`sha256 mismatch: got ${got} (${asset.url})`);
  }
  const abs = path.join(ROOT, asset.dest);
  const part = abs + ".part";
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(part, buf);
  if (existsSync(abs)) unlinkSync(abs);
  renameSync(part, abs);
}

/**
 * @returns {Promise<void>} exits 1 when any asset is missing or invalid
 */
async function main() {
  let fetched = 0;
  let skipped = 0;
  const failed = [];
  for (const asset of ASSETS) {
    const abs = path.join(ROOT, asset.dest);
    if (isValid(abs, asset)) {
      skipped += 1;
      continue;
    }
    if (CHECK_ONLY) {
      failed.push(`${asset.dest} (missing or hash mismatch)`);
      continue;
    }
    try {
      await download(asset);
      fetched += 1;
      console.log(`fetched ${asset.dest} (${asset.size} bytes)`);
    } catch (error) {
      failed.push(`${asset.dest}: ${error.message}`);
    }
  }
  console.log(
    `[assets:desktop] fetched=${fetched} valid=${skipped} total=${ASSETS.length}` +
      (CHECK_ONLY ? " (check-only)" : ""),
  );
  if (failed.length > 0) {
    for (const line of failed) console.error(`  FAILED ${line}`);
    console.error(
      "[assets:desktop] FAIL: offline assets incomplete - rerun `npm run assets:desktop` " +
        "or fix the network/proxy before building the desktop app",
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[assets:desktop] FAIL: ${error.message}`);
  process.exit(1);
});

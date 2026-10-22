// Pinned offline-asset manifest for the desktop (Tauri) build, plan A3.
// Single source of truth consumed by:
//   - scripts/fetch-desktop-assets.mjs  (downloads ASSETS, verifies all)
//   - scripts/tauri-prepare-assets.mjs  (derives REQUIRED_ASSETS, build gate)
// Pure data - no fs/network/process access - so importing it is side-effect
// free and lint treats it as a module (not a script).
//
// Pinning: every sha256/size below was computed from the artifact downloaded
// from its pinned `url` when this manifest was authored (plan A3), then
// re-verified on every fetch and by `--check`.
// Re-pinning (upstream version bump): point `url` at the new release,
// download it once, recompute that entry's sha256 and size, run
// `npm run assets:desktop -- --check`, and commit the manifest update
// together with the upstream version note.

const JSDELIVR = "https://cdn.jsdelivr.net/npm";

// Heavy downloads: gitignored (see .gitignore), fetched into vendor/ by
// `npm run assets:desktop` before `npx tauri build`.
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
    // Intentional 0 bytes: @ffmpeg/core-st@0.11.1 ships this placeholder
    // empty upstream (verified live 2026-10: HTTP 200, empty body, sha256
    // below = sha256 of the empty string). The single-threaded core never
    // spawns a worker (no Worker usage in ffmpeg-core.js or converter.js);
    // the entry stays pinned so the REQUIRED_ASSETS gate and this manifest
    // cannot drift apart, and a future upstream change fails the size/hash
    // check loudly instead of being silently accepted.
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

// Committed small vendor libs (in git since before plan A3; force-added, not
// gitignored). Check-only entries: `--check` guards them against corruption or
// EOL rewrites, and scripts/tauri-prepare-assets.mjs derives its REQUIRED list
// from this table so the two cannot drift. Never downloaded - restore a
// mismatched file with `git checkout -- <dest>`.
// sha256/size pin the committed blob bytes (LF). `url` documents the live-
// verified byte-identical upstream (2026-10) for provenance / re-pinning.
const COMMITTED_VENDOR = [
  {
    dest: "vendor/human.js",
    url: `${JSDELIVR}/@vladmandic/human@3.3.6/dist/human.js`,
    sha256: "5f240e5d2d60459f07aaa7df2cb129fd3f954c78dd05581cf6f8a30646779013",
    size: 1_583_774,
    committed: true,
  },
  {
    dest: "vendor/lame.all.min.js",
    url: `${JSDELIVR}/lamejs@1.2.1/lame.all.min.js`,
    sha256: "120a056f3628c124ac5739ccd8a308bc2f5036936101f3944c21a695e5722f90",
    size: 157_043,
    committed: true,
  },
  {
    dest: "vendor/jszip.min.js",
    url: `${JSDELIVR}/jszip@3.10.1/dist/jszip.min.js`,
    sha256: "acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e",
    size: 97_630,
    committed: true,
  },
  {
    dest: "vendor/docx.umd.min.js",
    url: `${JSDELIVR}/docx@8.5.0/build/index.umd.js`,
    sha256: "02d568d203c0180af37609bcf5ff6c0919d220f933a88ca896eba0556a08faad",
    size: 742_858,
    committed: true,
  },
  {
    // Upstream build minus the trailing `//# sourceMappingURL=` line.
    dest: "vendor/jspdf.umd.min.js",
    url: `${JSDELIVR}/jspdf@2.5.1/dist/jspdf.umd.min.js`,
    sha256: "ad6f488d08db2b2ab965c0a97e077602509e48121d0cd422fe7f681ad9cf8f0a",
    size: 364_421,
    committed: true,
  },
  {
    // Upstream build minus the trailing `//# sourceMappingURL=` line.
    dest: "vendor/qrious.min.js",
    url: `${JSDELIVR}/qrious@4.0.2/dist/qrious.min.js`,
    sha256: "c46f564908ff10943a59e6f56f5de4bc5b6e827813b4750eef55353e7085157c",
    size: 17_540,
    committed: true,
  },
  {
    // Upstream build minus the trailing `//# sourceMappingURL=` line.
    dest: "vendor/pdf-lib.min.js",
    url: `${JSDELIVR}/pdf-lib@1.17.1/dist/pdf-lib.min.js`,
    sha256: "278627f3a5e3efa95e77ab565f10831d3cdb9cbb617ef8388d6ff4bf962d4887",
    size: 525_059,
    committed: true,
  },
  {
    // In-repo build since 85a24fd (2026-05-29); no public byte-identical CDN
    // artifact found (npm ships src only). `url` = upstream project for
    // reference; re-pin only if an official bundle ever appears.
    dest: "vendor/opentimestamps.min.js",
    url: "https://github.com/opentimestamps/opentimestamps-js",
    sha256: "f6181ae00cce58773f8710894c99d0656058f6a1e08c57360b263cd46c54fbf2",
    size: 1_599_354,
    committed: true,
  },
];

export { ASSETS, COMMITTED_VENDOR };

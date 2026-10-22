#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- all fs paths are
   derived from the fixed repo ROOT, the fixed dist-tauri/ copy, or the
   explicit ALLOWLIST/REQUIRED_ASSETS constants; no user input reaches them */
// Tauri prepack: copy the static site into dist-tauri/ and rewrite the
// root-absolute "/RedoSan-Authenticity/" navigation prefix to relative so
// pages work under Tauri's tauri://localhost custom protocol.
// Wired as beforeDevCommand/beforeBuildCommand in src-tauri/tauri.conf.json.
// Exits 1 if any root-absolute prefix survives the rewrite (build gate).
// Plan: .Plans/TAURI-WXT-DISTRIBUTION-PLAN.md section A3.
// Debug: TAURI_PREPACK_VERBOSE=1 lists every verified offline asset.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ASSETS, COMMITTED_VENDOR } from "./desktop-assets-manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist-tauri");

// Explicit allowlist — never a blind recursive copy of the repo (plan A3.1).
const ALLOWLIST = [
  "index.html",
  "favicon.ico",
  "Style",
  "Watermark",
  "Audio_Watermark",
  "Pixel_Injection",
  "Document_Watermark",
  "Fingerprint",
  "C2PA",
  "Certificate",
  "Decentralized_Identity_DID",
  "Timestamp",
  "Metadata",
  "Forensic",
  "ID_Forge",
  "Converter",
  "Assistant",
  "Face_Biometric",
  "Iris_Biometric",
  "Voice_Biometric",
  "vendor",
  "manifest.webmanifest",
];

const TEXT_EXT = new Set([".html", ".js", ".json", ".webmanifest", ".css"]);

// Root-absolute prefix occurrences: "/RedoSan-Authenticity/ , '/RedoSan-Authenticity/
// and the backtick form. https:// URLs (canonical, OG, GitHub) are untouched.
const REWRITE_PAIRS = [
  ['"/RedoSan-Authenticity/', '"./'],
  ["'/RedoSan-Authenticity/", "'./"],
  ["`/RedoSan-Authenticity/", "`./"],
];

// A surviving root-absolute reference: the slash before "RedoSan-Authenticity/"
// is not preceded by a URL host character (letters, digits, :, ., _, ~, -).
const ROOT_ABS_RE = /(^|[^A-Za-z0-9:._~-])\/RedoSan-Authenticity\//;

// Plan A5: Tauri pages run under a strict CSP with no remote origins, so the
// CDN preconnect hints are dead weight in the desktop bundle only (the web
// build keeps them). Matches both shapes with/without crossorigin. Repo markup
// is uniform (rel before href, double quotes; verified 0 survivors after the
// strip run) — update this regex together with the link templates if that
// shape ever changes.
const PRECONNECT_RE =
  /[ \t]*<link\s+rel="preconnect"\s+href="https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|huggingface\.co)"[^>]*\/?>\r?\n?/g;

// Offline inventory (plan A3): derived from the pinned manifest in
// scripts/fetch-desktop-assets.mjs (22 fetched + 8 committed libs) so the two
// lists cannot drift; missing entries fail the build fast (the allowlist copy
// would silently package holes).
const REQUIRED_ASSETS = [
  ...ASSETS.map((asset) => asset.dest),
  ...COMMITTED_VENDOR.map((asset) => asset.dest),
];

// Voice ONNX weights stay runtime-fetched by design (pre-existing SRI design,
// ~200 MB): warn-only, never a build failure (plan A3 excluded them). In the
// Tauri build the strict CSP (no remote origins) blocks that runtime fetch, so
// voice embedding is unavailable in the desktop app until the weights are
// vendored (tracked as a follow-up).
const OPTIONAL_VOICE_MODELS = [
  "Voice_Biometric/models/silero_vad.onnx",
  "Voice_Biometric/models/ecapa-speaker-v1.onnx",
  "Voice_Biometric/models/model_quantized.onnx",
  "Voice_Biometric/models/aasist.onnx",
  "Voice_Biometric/models/aasist-l.onnx",
];

/**
 * Fail the build when the offline asset set is incomplete; warn only for the
 * intentionally runtime-fetched voice weights.
 * @returns {void} exits 1 on a missing required asset
 */
function checkOfflineAssets() {
  const missing = REQUIRED_ASSETS.filter(
    (rel) => !existsSync(path.join(ROOT, rel)),
  );
  if (missing.length > 0) {
    for (const rel of missing)
      console.error(`[tauri-prepack] missing asset: ${rel}`);
    console.error(
      `[tauri-prepack] FAIL: ${missing.length} offline asset(s) missing - ` +
        "run `npm run assets:desktop` (scripts/fetch-desktop-assets.mjs) first",
    );
    process.exit(1);
  }
  console.log(
    `[tauri-prepack] offline assets ok: ${REQUIRED_ASSETS.length} present`,
  );
  if (process.env.TAURI_PREPACK_VERBOSE) {
    for (const rel of REQUIRED_ASSETS) console.log(`[tauri-prepack]   ${rel}`);
  }
  const voiceMissing = OPTIONAL_VOICE_MODELS.filter(
    (rel) => !existsSync(path.join(ROOT, rel)),
  );
  if (voiceMissing.length > 0) {
    console.warn(
      `[tauri-prepack] warn: ${voiceMissing.length} voice model(s) absent - ` +
        "voice features fall back to the network at runtime",
    );
  }
}

/**
 * Recursively list files under dir, skipping dotfiles and Thumbs.db.
 * @param {string} dir - directory to walk
 * @returns {string[]} absolute paths of all files
 */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "Thumbs.db" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/**
 * Copy the allowlisted site into dist-tauri/, rewrite the root-absolute
 * prefix, then fail the build if any survivor remains.
 * @returns {void} exits 1 on missing allowlist entry or gate failure
 */
function main() {
  checkOfflineAssets();
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  let fileCount = 0;
  let totalBytes = 0;
  let rewrittenFiles = 0;
  let rewrittenHits = 0;
  let preconnectStripped = 0;
  let cspIpcInjected = 0;

  for (const entry of ALLOWLIST) {
    const src = path.join(ROOT, entry);
    if (!existsSync(src)) {
      if (entry === "manifest.webmanifest") continue; // optional (plan A3.1)
      console.error(`[tauri-prepack] missing allowlist entry: ${entry}`);
      process.exit(1);
    }
    const dst = path.join(DIST, entry);
    mkdirSync(path.dirname(dst), { recursive: true });
    cpSync(src, dst, {
      recursive: true,
      filter: (from) => {
        const base = path.basename(from);
        return !base.startsWith(".") && base !== "Thumbs.db";
      },
    });
  }

  for (const file of walk(DIST)) {
    fileCount += 1;
    totalBytes += statSync(file).size;
    if (!TEXT_EXT.has(path.extname(file).toLowerCase())) continue;
    const before = readFileSync(file, "utf8");
    let after = before;
    let hits = 0;
    let fileIpcInjected = 0;
    for (const [from, to] of REWRITE_PAIRS) {
      let idx = after.indexOf(from);
      while (idx !== -1) {
        hits += 1;
        idx = after.indexOf(from, idx + from.length);
      }
      after = after.split(from).join(to);
    }
    const stripped = (after.match(PRECONNECT_RE) || []).length;
    if (stripped > 0) after = after.replace(PRECONNECT_RE, "");
    // The page meta CSP also applies in WebView2 (both header and meta are
    // enforced) but lacks the Tauri IPC sources, so every invoke logged 3
    // CSP errors and fell back to postMessage. Desktop bundle only — the
    // web build keeps its own meta untouched. Idempotent per file.
    if (
      after.includes("Content-Security-Policy") &&
      after.includes("connect-src 'self'") &&
      !after.includes("ipc.localhost")
    ) {
      after = after.replace(
        "connect-src 'self'",
        // eslint-disable-next-line unicorn/prefer-https -- Tauri IPC origin must be the http ipc.localhost scheme by spec
        "connect-src ipc: http://ipc.localhost 'self'",
      );
      cspIpcInjected += 1;
      fileIpcInjected = 1;
    }
    if (hits > 0 || stripped > 0 || fileIpcInjected > 0) {
      writeFileSync(file, after);
      rewrittenFiles += 1;
      rewrittenHits += hits;
      preconnectStripped += stripped;
    }
  }

  // Build gate (plan A3.2): zero root-absolute occurrences may remain.
  const survivors = [];
  for (const file of walk(DIST)) {
    if (!TEXT_EXT.has(path.extname(file).toLowerCase())) continue;
    const text = readFileSync(file, "utf8");
    if (ROOT_ABS_RE.test(text)) survivors.push(path.relative(DIST, file));
  }
  if (survivors.length > 0) {
    for (const rel of survivors) {
      console.error(`[tauri-prepack] root-absolute prefix survives: ${rel}`);
    }
    console.error(
      `[tauri-prepack] FAIL: ${survivors.length} file(s) still reference /RedoSan-Authenticity/`,
    );
    process.exit(1);
  }

  const mb = (totalBytes / 1024 / 1024).toFixed(2);
  console.log(
    `[tauri-prepack] ${fileCount} files, ${mb} MiB -> dist-tauri/; ` +
      `rewrote ${rewrittenHits} prefix occurrence(s) in ${rewrittenFiles} file(s); ` +
      `stripped ${preconnectStripped} preconnect hint(s); ` +
      `injected IPC CSP source into ${cspIpcInjected} file(s); gate: 0 survivors`,
  );
}

main();

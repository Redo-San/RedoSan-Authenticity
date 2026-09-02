<p align="center">
  <img src="https://img.shields.io/github/v/release/Redo-San/RedoSan-Authenticity?style=flat-square&label=Release&color=blue" alt="Release">
  <img src="https://img.shields.io/github/license/Redo-San/RedoSan-Authenticity?style=flat-square&label=License&color=green" alt="License">
  <img src="https://img.shields.io/github/downloads/Redo-San/RedoSan-Authenticity/total?style=flat-square&label=Downloads&color=orange" alt="Downloads">
  <img src="https://img.shields.io/github/deployments/Redo-San/RedoSan-Authenticity/github-pages?style=flat-square&label=Pages&color=6C5CE7" alt="GitHub Pages">
  <a href="https://redo-san.github.io/RedoSan-Authenticity/"><img src="https://img.shields.io/badge/Try%20Online-GitHub%20Pages-6C5CE7?style=flat-square&logo=github&logoColor=white" alt="Try Online"></a>
  <img src="https://img.shields.io/github/actions/workflow/status/Redo-San/RedoSan-Authenticity/ci.yml?branch=main&style=flat-square&label=CI&logo=github" alt="CI">
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square&logo=node.js" alt="Node">
  <img src="https://img.shields.io/badge/100%25-Client%20Side-FAB972?style=flat-square" alt="Client Side">
</p>

<h1 align="center"> RedoSan Authenticity</h1>

<p align="center">
  <strong>Prove authenticity. Detect tampering. All in your browser — zero uploads.</strong>
</p>

<p align="center">
  <a href="https://redo-san.github.io/RedoSan-Authenticity/"><strong> Web Try Online</strong></a> ·
  <a href="#-installation"><strong> CLI</strong></a> ·
  <a href="#-usage"><strong> Docs</strong></a> ·
  <a href="https://github.com/Redo-San/RedoSan-Authenticity/releases"><strong> Releases</strong></a>
</p>

---

## What's New in v1.7.1

- **Face Biometric hardening** — WebAuthn PRF vault (passphrase replaced), session-scoped consent, anti-spoof + liveness, ArcFace ONNX, auto-register passkey; 100% test coverage (Face_Biometric + E2E pipeline/UI specs)
- **i18n keyless fallback** — Google Web Translate + MyMemory fallback for missing keys (no API key required); translation bot regression fix; all 125 `face.*` keys translated to Arabic
- **SEO** — canonical URLs, followable MPA links, sitemap + robots for all pages
- **Security** — CodeQL XSS fix (`iris_ui.js`), SECURITY.md disclosure policy, Dependabot fast-uri/qs patches (0 npm vulnerabilities remaining), supply chain bumps
- **Responsive** — classic media-query syntax for legacy browsers; skip SW in in-app webviews
- **CI** — conventional PR title enforcement, prettier before commit, all Actions SHAs bumped

<details>
<summary><b>v1.7</b> — Face Biometric, Pixel Injection Reliability, Security Hardening</summary>

- **Face Biometric (21st tool)** — New browser tool + standalone MPA page: register and verify face biometric descriptors for visual rights protection. Detection, registration, and matching all run in-browser — nothing is uploaded.
- **Pixel Injection reliability** — Colors are now fully restored after embedding and extraction round-trip works for all algorithms (DCT/DFT/DWT/Hybrid fixes); secret-file-only input is enforced with an embed-capacity guard; DWT round-trip fixed.
- **Live-site stability** — Production breakdowns fixed (downloads, MPA navigation, i18n, caching); MPA router hides stale results on page swap; wizard lazy-load; MPA drop zones; email input limit.
- **Security hardening** — nanoid pinned to patched versions, js-yaml upgraded, 10 npm audit vulnerabilities patched (tar, brace-expansion, body-parser), 30 zizmor alerts closed, `npm ci` lockfile enforcement, GitHub Action SHAs pinned to real tag commits.
- **i18n quality** — 68 Arabic mistranslations corrected across 5 batches, i18n value-change detection + automatic sync, LibreTranslate translation backend added.
- **Expanded About & Privacy pages** — Comprehensive content, plus a Security Vulnerability issue template.
- **CI modernization** — Gemini CLI review workflow; obsolete OpenRouter review workflow removed; dev tooling centralized in `.tools/Developer_Toolkit`; E2E coverage guard.
- **Certificate fix** — didSig object bug and phonecode null-safety.
- **Scale** — 22 MPA pages, 68 unit test files + 58 E2E suites (3,500+ tests), 59 CI/CD workflows.

</details>

<details>
<summary><b>v1.6</b> — MPA Migration, Document Watermark, Full CLI Parity</summary>

- **MPA (Multi-Page Architecture)** — The SPA was split into 20 standalone HTML pages, one per service, each with its own direct URL (`Style/pages/{name}/index.html`). Hash-based SPA routing still works, but tools are now accessible directly without the mode-selection overlay. Music playback persists across MPA navigation via AJAX content swapping.
- **Document Watermark** — New tool: embed/extract hidden messages in TXT/DOCX/PDF using whitespace encoding, zero-width characters, synonym replacement, line-shift, and word-shift. Password-protected payload.
- **Full CLI parity** — All 12 tools available via CLI: `redosan watermark`, `audio-watermark`, `fingerprint`, `metadata`, `timestamp`, `c2pa`, `did`, `certificate`, `converter`, `document-watermark`, `pixel-injection`, `forensic`. Interactive menu mode included.
- **Audio Watermark** — 8 algorithms (LSB, Phase Coding, Echo Hiding, DSSS, QIM, DWT Haar, Patchwork, DCT) for WAV files with Auto Detect and dual extract (fingerprint + DID).
- **DID (Decentralized Identity)** — W3C DID Core compliant (`did:key:z…`). Generate keys (Ed25519/ECDSA P-256/RSA), create DID Documents, sign and verify messages.
- **C2PA provenance** — Sign JPEG/PNG with ECDSA P-256, read and verify C2PA manifests (APP11 / custom `c2pa` PNG chunk).
- **Digital Certificate** — Generate PDF/DOCX/EPUB certificates with identity, social links, QR verification code.
- **File Converter** — Browser-side conversion for images (PNG/JPEG/WebP/BMP/GIF), audio (11 formats), video-to-audio, documents, and subtitles.
- **i18n (8 languages)** — Full Arabic, German, Spanish, French, Japanese, Korean, Chinese translations alongside English. Real-time switching, RTL support.

</details>

---

**RedoSan Authenticity** is a 100% client-side digital authenticity toolkit. Embed invisible watermarks, timestamp with OpenTimestamps, sign C2PA provenance metadata, cryptographically fingerprint files, inject pixel-level messages, and watermark documents — all without uploading data to any server.

---

## Features

| Feature | Description |
|---------|-------------|
| **Dual Mode UI** | Simplified step wizard + Professional full-tool interface with sidebar navigation; SPA and MPA modes |
| **Watermark** | 9 core algorithms (LSB, DCT, Neural SS, Latent DCT, Zero-bit, Multi-bit, Forensic, Fragile, Imatag) + 4 perceptual hash detection modes |
| **Audio Watermark** | 8 algorithms (LSB, Phase Coding, Echo Hiding, DSSS, QIM, DWT Haar, Patchwork, DCT) for WAV with Auto Detect |
| **Document Watermark** | Embed/extract hidden messages in TXT/DOCX/PDF — whitespace, zero-width chars, synonyms, line-shift, word-shift |
| **Pixel Injection** | 23 advanced algorithms across spatial, frequency, deep learning, and professional domains |
| **C2PA Provenance** | Sign JPEG/PNG with C2PA metadata (ECDSA P-256), read and verify manifests |
| **Fingerprint** | 17 cryptographic hashes + 4 perceptual image hashes; export JSON/CSV/TXT/XML/PDF/DOCX |
| **Decentralized Identity (DID)** | W3C DID Core — `did:key:z…`, Ed25519/P-256/RSA, DID Documents, signing & verification |
| **Metadata** | Full EXIF reader, image dimensions, format detection, audio/video metadata |
| **Timestamp** | OpenTimestamps (.ots) creation via calendar aggregation, verification, and upgrade |
| **Digital Certificate** | Generate PDF/DOCX/EPUB certificates with QR verification, identity, social links |
| **File Converter** | Browser-side image/audio/video-to-audio/document/subtitle conversion |
| **Face Biometric** | WebAuthn PRF vault, session-scoped consent, anti-spoof + liveness, ArcFace ONNX; register & verify face descriptors for visual rights protection |
| **Forensic Analyzer** | ELA, noise inconsistency, JPEG structure, copy-move detection |
| **ID Forge** | Generate UUID v4/v7, ULID, NanoID, SWHID; copy/download (JSON/CSV/TXT/XML/PDF/DOCX) |
| **Removal Tools** | Strip watermarks, fingerprints, metadata, EXIF, thumbnails, GPS from images/audio |
| **AI Assistant Raido** | Built-in bilingual (AR/EN) rule-based chatbot, no API needed |
| **CLI** | Cross-platform Node.js CLI: 12 commands + interactive menu |
| **Security Threat Blocker** | Service Worker + 404 page blocks dangerous extensions, validates whitelisted scripts |

---

## Quick Start

### Web App (No Installation)

Visit **[https://redo-san.github.io/RedoSan-Authenticity/](https://redo-san.github.io/RedoSan-Authenticity/)** in any modern browser. Choose:

- **Simplified Mode** — Upload a file and follow the smart wizard
- **Professional Mode** — Full sidebar access to all tools
- **Direct MPA Links** — Use any tool directly at `Style/pages/{tool}/index.html`

### CLI (Node.js 20+)

#### Interactive Menu

| Platform | Command |
|----------|---------|
| Windows | Double-click **`cli_start.bat`** |
| Linux / macOS | `chmod +x cli_start.sh && ./cli_start.sh` |

#### Command Line

```bash
git clone https://github.com/Redo-San/RedoSan-Authenticity.git
cd RedoSan-Authenticity
npm install
npm link    # makes 'redosan' available globally
```

---

## CLI Reference

### Commands

| Command | Description |
|---------|-------------|
| `redosan watermark embed -i <img> -s <secret> -o <out>` | Embed watermark (9 core algorithms) |
| `redosan watermark extract -i <img>` | Extract watermark (single or auto-detect) |
| `redosan audio-watermark embed -i <wav> -s <secret> -o <out>` | Embed audio watermark (8 algorithms) |
| `redosan audio-watermark extract -i <wav>` | Extract audio watermark |
| `redosan pixel-injection embed -i <img> -s <msg> -o <out>` | Embed with 23 advanced algorithms |
| `redosan pixel-injection extract -i <img>` | Extract from advanced algorithms |
| `redosan fingerprint <file>` | 17 cryptographic hashes + 4 perceptual image hashes |
| `redosan metadata <file>` | Read EXIF, dimensions, format info |
| `redosan timestamp create <file>` | Create OpenTimestamps `.ots` proof |
| `redosan timestamp verify <file>` | Verify file against `.ots` proof |
| `redosan timestamp upgrade <file>` | Upgrade incomplete `.ots` proof |
| `redosan c2pa sign <file>` | Sign with C2PA provenance metadata |
| `redosan c2pa read <file>` | Read C2PA manifest from JPEG/PNG |
| `redosan c2pa verify <file>` | Verify C2PA digital signatures |
| `redosan did generate` | Generate DID key pair (Ed25519/P-256/RSA) |
| `redosan did sign <file>` | Sign file with DID private key |
| `redosan did verify <file>` | Verify DID signature |
| `redosan certificate generate` | Generate PDF/DOCX/EPUB certificate |
| `redosan forensic <file>` | Analyze image for tampering |
| `redosan converter <file>` | Convert files between formats |
| `redosan document-watermark embed -i <doc> -s <msg> -o <out>` | Embed document watermark |
| `redosan document-watermark extract -i <doc>` | Extract document watermark |
| `node cli/lib/id_forge.js <type>` | Generate UUID v4/v7, ULID, NanoID, SWHID |

### Global Flags

| Flag | Description |
|------|-------------|
| `--allow-dangerous` | Bypass all 6-layer file validation (trusted files only) |

### Examples

```bash
# Fingerprint
redosan fingerprint photo.png --json -o hashes.json

# Watermark
redosan watermark embed -i cover.png -s secret.txt -o output.png -a dct -p "mypassword"
redosan watermark extract -i watermarked.png -a dct -p "mypassword"

# Audio Watermark
redosan audio-watermark embed -i audio.wav -s "secret" -o out.wav -a phase

# Pixel Injection
redosan pixel-injection embed -i image.png -s "hidden message" -o output.png -a enhanced_lsb

# Document Watermark
redosan document-watermark embed -i doc.txt -s "secret" -o watermarked.txt -a whitespace

# C2PA
redosan c2pa sign document.pdf --claim "Created by Me" --author "Name"

# DID
redosan did generate --algorithm Ed25519
redosan did sign document.txt --private-key key.pem
redosan did verify document.txt --signature sig.json --did-doc doc.json

# Timestamp
redosan timestamp create document.pdf -o proof.ots

# Forensic
redosan forensic image.png --json

# Converter
redosan converter image.png --format webp

# Windows paths
redosan fingerprint "C:\Users\You\photo.png" --json -o hashes.json
```

> **Linux system deps for `canvas` module:**  
> `sudo apt install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`  
> **macOS:** `brew install pkg-config cairo pango libpng jpeg giflib librsvg`  
> Windows binaries are bundled.

---

## Algorithm Reference

### 9 Core Watermark Algorithms

| # | Name | Domain | Technique | Robustness |
|---|------|--------|-----------|------------|
| 1 | Spatial LSB | Pixel LSB | 3 bits/pixel in R,G,B | Low |
| 2 | Frequency DCT | DCT 8×8 | Coefficient pair comparison (c[5,2] vs c[4,3]), K=15, ×3 redundancy | Medium |
| 3 | Neural SS | Pixel LSB | Seeded-shuffle order embedding | Low |
| 4 | Latent DCT | DCT 8×8 | 3× redundant DCT embedding, strength=30 | High |
| 5 | Zero-bit | DCT 8×8 | Fixed signature "RedoSanZeroBit" (presence only) | Medium |
| 6 | Multi-bit | Pixel 2-bit LSB | 2 bits/channel, 6 bits/pixel | Low |
| 7 | Forensic | DCT 8×8 | DCT mid-frequency, strength=20 | Medium |
| 8 | Fragile | Pixel LSB | SHA-256 hash (512 bits), tamper-evident | Very Low |
| 9 | Imatag-style | DCT 8×8 | Dual-channel Y (K=15) + Cb (K=10) | High |

**Payload format:** `[32-bit length][XOR-encrypted [0xAA, 0xBB || secret]]`  
**Encryption:** PBKDF2-derived key via `pw_key(password)` with 100k iterations  
**Redundancy:** ×3 repetition code with majority voting

### 8 Audio Watermark Algorithms

| # | Name | Domain | Technique |
|---|------|--------|-----------|
| 1 | LSB | Sample LSB | 16-bit sample LSB embedding |
| 2 | Phase Coding | Phase | Quantize phase of first N frames |
| 3 | Echo Hiding | Time | Echo delay modulation (1ms/2ms) |
| 4 | DSSS | Spread Spectrum | Direct-sequence spread spectrum |
| 5 | QIM | Quantization | Quantization index modulation |
| 6 | DWT Haar | Wavelet | 1-level Haar DWT coefficient modification |
| 7 | Patchwork | Statistical | Mean-shift of two subsets |
| 8 | DCT | Frequency | DCT coefficient pair comparison |

### 5 Document Watermark Algorithms

| # | Name | Technique | Capacity |
|---|------|-----------|----------|
| 1 | Whitespace | Space/tab encoding at line endings | ~1 bit/line |
| 2 | Zero-Width | Zero-width joiners/non-joiners between chars | ~2 bits/char |
| 3 | Synonym | Synonym substitution (WordNet-based) | ~1 bit/sentence |
| 4 | Line-Shift | Vertical line position modulation | ~1 bit/line |
| 5 | Word-Shift | Horizontal word spacing modulation | ~1 bit/word |

### 23 Advanced Pixel Injection Algorithms

| Algorithm | Domain | Key Technique |
|-----------|--------|---------------|
| `enhanced_lsb` | Spatial | Adaptive complexity map, bit-positions 1-2 |
| `adaptive_lsb` | Spatial | Region-adaptive strategy (complexity/edge/texture) |
| `multi_channel_lsb` | Spatial | Channel-alternating LSB |
| `random_lsb` | Spatial | Seeded PRNG positioning |
| `dct` | Frequency | DCT 8×8 coefficient pair comparison (gap ≥20) |
| `dwt` | Frequency | 1-level Haar DWT, step-2 embedding |
| `dft` | Frequency | DFT 8×8 pair comparison (conjugate-symmetry) |
| `hybrid_dct_dwt` | Hybrid | DCT + DWT sequential embedding |
| `vine` | Deep Learning | Adversarial simulation for AI-editing resistance |
| `pixel_seal` | Deep Learning | JND-based perceptual masking |
| `nullguard` | Deep Learning | Null-space region detection |
| `shallow_diffuse` | Deep Learning | Fast diffusion-based modulation |
| `diffusion_based` | Deep Learning | Diffusion process simulation |
| `imagewmark` | Professional | Configurable profile-based watermarking |
| `meta_seal` | Professional | Multi-media protection profile |
| `stardustmark` | Professional | Forensic-grade watermarking |
| `invisimark` | Professional | AI-generated image protection |
| `elevenlikes` | Professional | Industrial-grade solution |

---

## Architecture

### MPA (Multi-Page Architecture)

The project supports both SPA and MPA modes:

```text
RedoSan-Authenticity/
├── index.html                 ← SPA entry (hash-based routing, 4743 lines)
├── sw.js                      ← Service Worker (cache whitelist, threat blocking)
├── 404.html                   ← Offline + threat detection page
├── Style/
│   ├── pages/                 ← 21 standalone MPA pages
│   │   ├── watermark/index.html
│   │   ├── audio-watermark/index.html
│   │   ├── fingerprint/index.html
│   │   ├── c2pa/index.html
│   │   ├── did/index.html
│   │   ├── face-biometric/index.html
│   │   ├── document-watermark/index.html
│   │   ├── pixel-injection/index.html
│   │   └── ... (22 total)
│   ├── mpa-router.js          ← AJAX navigation with audio persistence
│   ├── music-player.js        ← Background music with first-click activation
│   ├── i18n.js                ← Translation system (8 languages)
│   ├── navigation.js          ← SPA hash routing + standalone detection
│   ├── shared.js              ← Common utilities (download, canvas, DOM)
│   ├── shared_validation.js   ← File validation (6 layers)
│   ├── music-player.css       ← Audio player styles
│   ├── style.css              ← Main styles (2998 lines)
│   ├── responsive.css         ← Mobile breakpoints
│   ├── rtl.css                ← RTL overrides for Arabic
│   └── lang/                  ← i18n data files (8 languages)
├── Watermark/
│   ├── watermark.js           ← UI + 9 algorithm dispatcher
│   ├── watermark_core.js      ← Pure algorithm math
│   └── utils.js               ← Crypto helpers
├── Pixel_Injection/
│   ├── pixel_injection.js     ← 23 algorithms UI
│   ├── watermark_core_advanced.js
│   └── watermark_advanced_ui.js
├── Audio_Watermark/
│   ├── audio_watermark.js     ← 8 algorithms UI
│   └── audio_watermark_core.js
├── Document_Watermark/
│   ├── document_watermark.js  ← 5 algorithms UI
│   ├── document_watermark_core.js
│   ├── document_watermark_pdf.js
│   ├── document_watermark_report.js
│   └── text_extractor.js
├── Fingerprint/
│   ├── fingerprint_ui.js
│   ├── hashing.js             ← 17 crypto + 4 perceptual hashes
│   └── hash_worker.js
├── C2PA/
│   ├── c2pa.js                ← Provenance signing + verification
│   └── cbor.js                ← Minimal CBOR encode/decode
├── Decentralized_Identity_DID/
│   └── did.js                 ← W3C DID Core implementation
├── Certificate/
│   └── certificate.js         ← PDF/DOCX/EPUB certificate generation
├── Metadata/
│   └── metadata.js            ← EXIF reader
├── Timestamp/
│   └── timestamp.js           ← OpenTimestamps
├── Forensic/
│   ├── forensic.js            ← UI + diff
│   └── forensic_core.js       ← ELA, noise, JPEG analysis
├── Converter/
│   └── converter.js           ← Format conversion
├── ID_Forge/
│   └── id_forge.js            ← UUID/ULID/NanoID/SWHID
├── Face_Biometric/
│   ├── face_engine.js            ← Detection + matching
│   ├── face_registry.js          ← Registered face storage
│   └── face_ui.js                ← UI handlers
├── Removal_Tools/
│   └── ...                    ← Image + audio sanitization
├── Assistant/
│   └── assistant.js           ← Raido chatbot (80+ patterns, AR/EN)
├── cli/
│   ├── index.js               ← Commander entry (12 commands)
│   ├── menu.js                ← Interactive menu
│   ├── utils.js               ← CLI polyfills + file helpers
│   ├── commands/              ← 12 command implementations
│   ├── lib/id_forge.js        ← CLI ID generation
│   └── tests/                 ← 68 test files (3,500+ tests)
└── .github/workflows/         ← 40+ CI/CD workflows
```

### MPA Navigation Flow

```text
User clicks sidebar link
        ↓
mpa-router.js intercepts click
        ↓
Fetch HTML of target page (AJAX, no full navigation)
        ↓
DOMParser extracts target <section>
        ↓
Replace current page content in #app
        ↓
Save/restore audio state → music continues uninterrupted
        ↓
Re-init page features + re-run translations
```

### Key Design Decisions

- **100% client-side** — All crypto, hashing, and embedding happens in-browser or via CLI
- **8-language i18n** — Arabic, German, Spanish, French, English, Japanese, Korean, Chinese. Real-time switching via `data-i18n` attributes, RTL support
- **W3C DID Core compliant** — `did:key:z…` format using base58btc multibase. Ed25519, P-256, RSA support
- **PBKDF2 password derivation** — 100k iterations for watermark payload encryption
- **C2PA JPEG APP11 / PNG chunk** — Custom ECDSA P-256 implementation
- **OpenTimestamps** — Merkle tree proof via Bitcoin blockchain calendar aggregation
- **Coefficient pair comparison** — `c[5,2]` vs `c[4,3]` with guaranteed gap ≥20 for DCT/DFT
- **Step-2 DWT embedding** — Survives Haar rounding loss
- **×3 redundancy with majority voting** — 98.6% decode accuracy

### File Validation (6 Layers)

1. Extension blocklist
2. Magic bytes verification
3. Content signature scan
4. Document threat analysis
5. Structural integrity
6. Size limits

Bypass with `--allow-dangerous` for testing trusted files.

---

## Testing

68 unit test files + 58 E2E suites with 3,500+ tests using `node:test` (zero external test dependencies) + Playwright:

```bash
npm test                         # All tests
npm run test:core                # Core unit tests
npm run test:pixel               # Pixel injection
npm run test:c2pa                # C2PA + CBOR
npm run test:audio               # Audio watermark
npm run test:docw                # Document watermark
npm run test:e2e-mpa             # MPA standalone page suites (12 parallel)
npm run test:e2e-watermark       # E2E Playwright tests
npm run test:e2e-all             # All E2E tests (27 suites)
npm run test:e2e-deep            # Deep E2E coverage with V8 capture
npm run coverage                 # c8 coverage report
```

CI runs on Node.js 22/24 via GitHub Actions. E2E tests use Playwright with Chromium.

---

## CI/CD Workflows

The project includes 59 GitHub Actions workflows:

| Category | Workflows |
|----------|-----------|
| **Core** | CI (unit + E2E + coverage), ESLint, Biome, Stylelint, deploy-pages |
| **Security** | Semgrep SAST, CodeQL, TruffleHog, npm audit, ClamAV, OpenSSF Scorecard, dependency-review, supply chain audit, secret scanner, permissions sheriff |
| **Quality** | Pa11y + axe-core accessibility, Lighthouse CI, DOM review, dead CSS, file size budget, E2E coverage guard |
| **Maintenance** | Broken link checker, translation auto-PR, stale issue manager, TODO issue creator, spell check |
| **PR Management** | Conventional Commits lint, auto-assign, PR size label, branch name lint, cross-reference checker |
| **AI Review** | Gemini CLI code review |

---

## Security Threat Blocker

The web app includes a two-layer security system:

1. **Service Worker** (`sw.js`) — Intercepts HTTP requests; blocks dangerous extensions; 5 whitelists for JS/CSS/HTML/YML/CDN
2. **Enhanced 404 page** (`404.html`) — Same threat detection as fallback when SW is inactive

---

## Privacy

- **100% client-side** — No files are ever uploaded to any server
- All processing happens in your browser (Web App) or your local machine (CLI)
- No analytics, no tracking, no telemetry
- Open source — audit the code yourself

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| **UI** | Vanilla HTML/CSS/JS (no frameworks) |
| **Icons** | Font Awesome 5 |
| **CLI** | Node.js 20+, Commander.js |
| **Testing** | `node:test` (68 files, 3,500+ tests) + Playwright (58 E2E suites) |
| **CI** | GitHub Actions (59 workflows, Node 22/24 matrix) |
| **PDF Export** | jsPDF + PDFKit |
| **DOCX Export** | docx |
| **EPUB Export** | Custom HTML-based generator |
| **QR Codes** | QRious |
| **ZIP** | JSZip |
| **C2PA** | Custom ECDSA P-256 implementation |
| **Canvas (CLI)** | `canvas` node package |
| **Audio Encoding** | Pure-JS PCM, lamejs (MP3), MediaRecorder |
| **Video→Audio** | ffmpeg.wasm v0.11.6 |
| **Linting** | ESLint + Biome + Stylelint + Markdownlint + CSpell |
| **Security** | Semgrep, TruffleHog, CodeQL, npm audit |
| **Accessibility** | Pa11y, axe-core/Playwright |
| **Performance** | Lighthouse CI, size-limit |

---

## Contributing

Contributions are welcome. The project is in active development on `main`.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit: `git commit -m "feat: add my feature"` (Conventional Commits, enforced by commitlint + husky)
4. Push: `git push origin feat/my-feature`
5. Open a Pull Request to `main`

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines, and [SECURITY.md](https://github.com/Redo-San/RedoSan-Authenticity/blob/main/.github/SECURITY.md) for the security policy.

### Development Setup

```bash
git clone https://github.com/Redo-San/RedoSan-Authenticity.git
cd RedoSan-Authenticity
npm install
npm link
```

### Pre-commit Checks

```bash
npm run check       # lint + biome + stylelint + madge + core tests
npm run check:fix   # auto-fix all issues
```

---

## License

**GNU General Public License v2.0** — See [LICENSE](LICENSE)

---

<p align="center">Built by <a href="https://github.com/Redo-San">Redo_San</a></p>

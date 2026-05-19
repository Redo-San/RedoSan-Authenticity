<p align="center">
  <img src="https://img.shields.io/github/v/release/Redo-San/RedoSan-Authenticity?style=flat-square&label=Release&color=blue" alt="Release">
  <img src="https://img.shields.io/github/license/Redo-San/RedoSan-Authenticity?style=flat-square&label=License&color=green" alt="License">
  <img src="https://img.shields.io/github/downloads/Redo-San/RedoSan-Authenticity/total?style=flat-square&label=Downloads&color=orange" alt="Downloads">
  <img src="https://img.shields.io/github/deployments/Redo-San/RedoSan-Authenticity/github-pages?style=flat-square&label=Pages&color=6C5CE7" alt="GitHub Pages">
  <a href="https://redo-san.github.io/RedoSan-Authenticity/"><img src="https://img.shields.io/badge/Try%20Online-GitHub%20Pages-6C5CE7?style=flat-square&logo=github&logoColor=white" alt="Try Online"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square&logo=node.js" alt="Node">
  <img src="https://img.shields.io/badge/100%25-Client%20Side-FAB972?style=flat-square" alt="Client Side">
</p>

<h1 align="center">🛡️ RedoSan Authenticity</h1>

<p align="center">
  <strong>Prove authenticity. Detect tampering. All in your browser — zero uploads.</strong>
</p>

<p align="center">
  <a href="https://redo-san.github.io/RedoSan-Authenticity/"><strong>🌐 Try Online</strong></a> ·
  <a href="#-installation"><strong>💻 CLI</strong></a> ·
  <a href="#-usage"><strong>📖 Docs</strong></a>
</p>

---

**RedoSan Authenticity** is a 100% client-side digital authenticity toolkit. Embed invisible watermarks, timestamp with OpenTimestamps, sign C2PA provenance metadata, cryptographically fingerprint files, and inject pixel-level messages — all without uploading data to any server.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Dual Mode UI** | Simplified step wizard for beginners + Professional full-tool interface with sidebar navigation |
| **Watermark** | 9 core algorithms (LSB, DCT, Neural SS, Latent DCT, Zero-bit, Multi-bit, Forensic, Fragile, Imatag) + 4 perceptual hash detection modes |
| **Pixel Injection** | 23 advanced algorithms across spatial, frequency, deep learning, and professional domains |
| **C2PA Provenance** | Sign JPEG/PNG with C2PA metadata (ECDSA P-256), read and verify manifests |
| **Fingerprint** | 17 cryptographic hash algorithms + 4 perceptual image hashes; export as JSON, CSV, TXT, XML, PDF, DOCX |
| **Metadata** | Full EXIF reader, image dimensions, format detection, audio/video metadata |
| **Timestamp** | OpenTimestamps (.ots) creation via calendar aggregation, verification, and upgrade |
| **CLI** | Cross-platform Node.js CLI with interactive menu and direct command mode |

---

## 🚀 Quick Start

### 🌐 Web App (No Installation)

Visit **[https://redo-san.github.io/RedoSan-Authenticity/](https://redo-san.github.io/RedoSan-Authenticity/)** in any modern browser. Choose your mode on startup:

- **Simplified Mode** — Upload a file and follow the step wizard (upload → fingerprint → timestamp → watermark → pixel injection → done)
- **Professional Mode** — Full sidebar access to all tools with granular parameter control

### 💻 CLI (Node.js 18+)

#### 🖱️ Interactive Menu (No Commands Needed)

| Platform | Command |
|----------|---------|
| Windows | Double-click **`start.bat`** |
| Linux / macOS | `chmod +x start.sh && ./start.sh` |

An interactive numbered menu guides you through all operations.

#### ⌨️ Command Line

```bash
git clone https://github.com/Redo-San/RedoSan-Authenticity.git
cd RedoSan-Authenticity
npm install
npm link    # makes 'redosan' available globally
```

---

## 📋 CLI Reference

### Commands

| Command | Description |
|---------|-------------|
| `redosan fingerprint <file>` | 17 cryptographic hashes + 4 perceptual image hashes |
| `redosan watermark embed -i <img> -s <secret> -o <out>` | Embed watermark (9 core algorithms) |
| `redosan watermark extract -i <img>` | Extract watermark (single or auto-detect) |
| `redosan pixel-injection embed -i <img> -s <msg> -o <out>` | Embed with 23 advanced algorithms |
| `redosan pixel-injection extract -i <img>` | Extract from advanced algorithms |
| `redosan c2pa sign <file>` | Sign with C2PA provenance metadata |
| `redosan c2pa read <file>` | Read C2PA manifest from JPEG/PNG |
| `redosan c2pa verify <file>` | Verify C2PA digital signatures |
| `redosan metadata <file>` | Read EXIF, dimensions, format info |
| `redosan timestamp create <file>` | Create OpenTimestamps `.ots` proof |
| `redosan timestamp verify <file>` | Verify file against `.ots` proof |
| `redosan upgrade <file>` | Upgrade incomplete `.ots` proof |

### Global Flags

| Flag | Description |
|------|-------------|
| `--allow-dangerous` | Bypass all 6-layer file validation (for trusted files only) |

### Examples

```bash
# Fingerprint
redosan fingerprint photo.png --json -o hashes.json
redosan fingerprint doc.pdf --algo sha256

# Watermark
redosan watermark embed -i cover.png -s secret.txt -o output.png -a dct -p "mypassword"
redosan watermark extract -i watermarked.png -a dct -p "mypassword"
redosan watermark extract -i watermarked.png --auto-detect

# Pixel Injection
redosan pixel-injection embed -i image.png -s "hidden message" -o output.png -a enhanced_lsb
redosan pixel-injection extract -i output.png -a enhanced_lsb

# C2PA
redosan c2pa sign document.pdf --claim "Created by Me" --author "Name"
redosan c2pa read image.jpg

# Timestamp
redosan timestamp create document.pdf -o proof.ots
redosan timestamp verify document.pdf -o proof.ots

# Windows paths
redosan fingerprint "C:\Users\You\photo.png" --json -o hashes.json
```

> **Linux system deps for `canvas` module:**  
> `sudo apt install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`  
> **macOS:** `brew install pkg-config cairo pango libpng jpeg giflib librsvg`  
> Windows binaries are bundled.

---

## 🔐 Algorithm Reference

### 9 Core Watermark Algorithms

| # | Name | Domain | Technique | Robustness |
|---|------|--------|-----------|------------|
| 1 | Spatial LSB | Pixel LSB | 3 bits/pixel in R,G,B | Low (fails at JPEG Q>0) |
| 2 | Frequency DCT | DCT 8×8 | Coefficient pair comparison (c[5,2] vs c[4,3]), K=15, ×3 redundancy | Medium (survives JPEG to Q70) |
| 3 | Neural SS | Pixel LSB | Seeded-shuffle order embedding | Low |
| 4 | Latent DCT | DCT 8×8 | 3× redundant DCT embedding, strength=30 | High |
| 5 | Zero-bit | DCT 8×8 | Fixed signature "RedoSanZeroBit" (presence only) | Medium |
| 6 | Multi-bit | Pixel 2-bit LSB | 2 bits/channel, 6 bits/pixel | Low |
| 7 | Forensic | DCT 8×8 | DCT mid-frequency, strength=20 | Medium |
| 8 | Fragile | Pixel LSB | SHA-256 hash (512 bits), tamper-evident | Very Low (detects modification) |
| 9 | Imatag-style | DCT 8×8 | Dual-channel Y (K=15) + Cb (K=10) | High |

**Payload format:** `[32-bit length][XOR-encrypted [0xAA, 0xBB || secret]]`  
**Encryption:** PBKDF2-derived key via `pw_key(password)` with 100k iterations  
**Redundancy:** ×3 repetition code with majority voting (corrects 1 error/triplet)

### 23 Advanced Pixel Injection Algorithms

| Algorithm | Domain | Key Technique |
|-----------|--------|---------------|
| `enhanced_lsb` | Spatial | Adaptive complexity map, bit-positions 1-2, channels 3-4, repetition code |
| `adaptive_lsb` | Spatial | Region-adaptive strategy (complexity/edge/texture) |
| `multi_channel_lsb` | Spatial | Channel-alternating LSB with configurable bit depth |
| `random_lsb` | Spatial | Seeded PRNG positioning (uses password for seed) |
| `dct` | Frequency | DCT 8×8 coefficient pair embedding |
| `dwt` | Frequency | Multi-level wavelet decomposition |
| `dft` | Frequency | Phase modulation in frequency domain |
| `hybrid_dct_dwt` | Hybrid | Combined DCT + DWT embedding |
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

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Web App (Browser)                     │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐ │
│  │ Simplified   │  │ Professional  │  │ CLI Interface  │ │
│  │ Mode (Steps) │  │  Mode (Tabs)  │  │ (menu/args)    │ │
│  └──────┬───────┘  └──────┬────────┘  └───────┬────────┘ │
│         │                 │                   │          │
│         └─────────┬───────┴───────────────────┘          │
│                   │                                      │
│  ┌────────────────▼─────────────────────────────────┐    │
│  │              Core Modules (ES5 Browser JS)       │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │    │
│  │  │Watermark │ │ Pixel    │ │ Fingerprint /    │  │    │
│  │  │Core      │ │ Injection│ │ Hashing          │  │    │
│  │  │(9 algos) │ │(23 algos)│ │ (17+4 algos)     │  │    │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │    │
│  │  │ C2PA     │ │Timestamp │ │ Metadata / Other │  │    │
│  │  │(APP11)   │ │(OTS)     │ │                  │  │    │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │           Node.js Polyfills (CLI only)           │    │
│  │crypto.subtle · document.createElement · ImageData│    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **100% client-side** — All crypto, hashing, and embedding happens in-browser or via CLI; no data ever leaves your machine
- **`vm.runInThisContext`** over `require()` — Browser JS files use top-level `function`/`var` declarations; Node.js loads them via `vm.runInThisContext(src, { filename })` with polyfilled browser APIs
- **PBKDF2 password derivation** — 100k iterations via `crypto.pbkdf2Sync` for watermark payload encryption
- **C2PA JPEG APP11 / PNG chunk** — C2PA metadata embedded in JPEG APP11 marker or PNG `c2pa` chunk before IDAT; verified with ECDSA P-256
- **OpenTimestamps** — Merkle tree proof creation and verification via Bitcoin blockchain calendar aggregation
- **Coefficient pair comparison for DCT** — `c[5,2]` vs `c[4,3]` comparison (K=15) replaces LSB-in-DCT for PNG-safe robust watermarking
- **×3 redundancy with majority voting** — Each message bit repeated 3×; decoder corrects 1 bit error per triplet (98.6% accuracy)

### File Validation (6 Layers)

Before processing any file, the CLI applies 6-layer validation:
1. **Extension blocklist** — Rejects known-dangerous extensions
2. **Magic bytes** — Verifies file header matches declared extension
3. **Content signature scan** — Scans for embedded threat signatures
4. **Document threat analysis** — Checks for macros/scripts in documents
5. **Structural integrity** — Validates file structure
6. **Size limits** — Enforces reasonable file size bounds

Bypass with `--allow-dangerous` for testing trusted files.

---

## 🛡️ Privacy

- **100% client-side** — No files are ever uploaded to any server
- All processing happens in your browser using JavaScript (Web App) or your local machine (CLI)
- Your files, messages, passwords, and data never leave your device
- No analytics, no tracking, no telemetry
- Open source — audit the code yourself

---

## 🛠️ Technology Stack

| Component | Technology |
|-----------|-----------|
| **UI** | Vanilla HTML/CSS/JS (no frameworks) |
| **Icons** | Font Awesome 5 |
| **CLI** | Node.js 18+, Commander.js |
| **PDF Export** | jsPDF |
| **DOCX Export** | docx |
| **QR Codes** | QRious |
| **ZIP** | JSZip |
| **C2PA** | Custom ECDSA P-256 implementation |
| **Canvas (CLI)** | `canvas` node package |

---

## 🤝 Contributing

Contributions are welcome. The project is in active development on the `beta-release` branch.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit changes: `git commit -m "feat: add my feature"`
4. Push: `git push origin feat/my-feature`
5. Open a Pull Request

### Development Setup

```bash
git clone https://github.com/Redo-San/RedoSan-Authenticity.git
cd RedoSan-Authenticity
npm install
npm link
```

---

## 📄 License

**GNU General Public License v2.0** — See [LICENSE](LICENSE)

---

<p align="center">Built by <a href="https://github.com/Redo-San">Redo_San</a></p>

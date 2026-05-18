<p align="center">
  <img src="https://img.shields.io/github/v/release/Redo-San/RedoSan-Authenticity?style=flat-square&label=Release&color=blue" alt="Release">
  <img src="https://img.shields.io/github/license/Redo-San/RedoSan-Authenticity?style=flat-square&label=License&color=green" alt="License">
  <img src="https://img.shields.io/github/downloads/Redo-San/RedoSan-Authenticity/total?style=flat-square&label=Downloads&color=orange" alt="Downloads">
  <a href="https://redo-san.github.io/RedoSan-Authenticity/"><img src="https://img.shields.io/badge/Try%20Online-GitHub%20Pages-6C5CE7?style=flat-square&logo=github&logoColor=white" alt="Try Online"></a>
</p>

# RedoSan Authenticity

**RedoSan Authenticity** is an online digital authenticity tool that runs entirely in your browser. Nothing is uploaded to any server — all processing happens client-side.

> **[Try it Online](https://redo-san.github.io/RedoSan-Authenticity/)**

---

## Features

| Feature | Description |
|---------|-------------|
| **Dual Mode** | Simplified step wizard for beginners + Professional full-tool interface |
| **Watermark** | 9 core algorithms + 14 advanced algorithms — embed & extract invisible watermarks |
| **Pixel Injection** | 23 algorithms across spatial, frequency, DL, and professional domains |
| **C2PA Provenance** | Sign content with C2PA metadata (AI-generated, social links) |
| **Fingerprint** | SHA-256 hashing + perceptual image hashes (download as JSON, CSV, TXT, XML, PDF, DOCX) |
| **Metadata** | View EXIF, dimensions, format info |
| **Timestamp** | OpenTimestamps (.ots) creation & verification via calendar aggregation |

---

## Dual Mode Interface

When you open the tool, you can choose between two modes:

### ✨ Simplified Mode
A step-by-step wizard that adapts based on your file type:
1. **Upload** — Drag & drop any file
2. **Type** — (images only) Regular photo or AI-generated?
3. **C2PA** — (AI images) Sign with C2PA provenance metadata
4. **Watermark** — Embed an invisible watermark (9 algorithms)
5. **Pixel Injection** — Hide a secret message in image pixels
6. **Timestamp** — Generate an OpenTimestamp (.ots) proof
7. **Fingerprint** — Generate cryptographic hashes
8. **Done** — Download all results (watermarked image, injected image, .ots file, fingerprint)

### ⚙️ Professional Mode
Full access to all tools via the sidebar navigation:
- **Watermark** — Advanced UI with algorithm selection, secret files, password, capacity calculator
- **Pixel Injection** — Embed, extract, and analyze with advanced options
- **C2PA** — Sign, read, and verify C2PA assertions
- **Fingerprint** — Multiple hash algorithms with format export
- **Metadata** — Detailed media metadata viewer
- **Timestamp** — OTS creation, verification, and upgrade

---

## Algorithm Reference

### 9 Core Watermark Types

| # | Name | Domain | Embedding | Capacity | Robustness |
|---|------|--------|-----------|----------|------------|
| 1 | Spatial LSB | Pixel LSB | 3 bits/pixel in R,G,B | w×h×3 bits | Low |
| 2 | Frequency DCT | DCT 8×8 | 11 mid-freq coeffs/block, strength=25 | ⌊w/8⌋×⌊h/8⌋×11 bits | Medium |
| 3 | Neural SS | Pixel LSB | LSB in seeded-shuffle order | w×h×3 bits | Low |
| 4 | Latent DCT | DCT 8×8 | 3× redundant DCT, strength=30 | ⌊w/8⌋×⌊h/8⌋×11/3 bits | High |
| 5 | Zero-bit | DCT 8×8 | Fixed signature "RedoSanZeroBit" | 0 (presence only) | Medium |
| 6 | Multi-bit | Pixel 2-bit LSB | 2 bits/channel, 6 bits/pixel | w×h×6 bits | Low |
| 7 | Forensic | DCT 8×8 | DCT mid-freq, strength=20 | ⌊w/8⌋×⌊h/8⌋×11 bits | Medium |
| 8 | Fragile | Pixel LSB | SHA-256 hash (512 bits) | 512 bits | Very Low (tamper-evident) |
| 9 | Imatag-style | DCT 8×8 | Y (strength=15) + Cb (strength=10) | Same as type 2 | High |

All payload types 1-7, 9 use format: `[32-bit length] + [XOR-encrypted [0xAA, 0xBB || secret]]`.

### 14 Advanced/Pixel Injection Algorithms

| Algorithm | Domain | Description |
|-----------|--------|-------------|
| enhanced_lsb | Spatial | Adaptive embedding with complexity map |
| adaptive_lsb | Spatial | Region-adaptive strategy |
| multi_channel_lsb | Spatial | Channel-alternating LSB |
| random_lsb | Spatial | Seeded random positioning |
| dct | DCT | Full DCT 8×8 with coefficient selection |
| dwt | DWT | Multi-level wavelet decomposition |
| dft | DFT | Phase modulation in frequency domain |
| hybrid_dct_dwt | Hybrid | Combined DCT + DWT embedding |
| vine | DL | Diffusion-based adversarial simulation |
| pixel_seal | DL | JND-based perceptual masking |
| nullguard | DL | Null-space region detection |
| shallow_diffuse | DL | Diffusion pattern modulation |
| diffusion_based | DL | Diffusion process simulation |
| imagewmark / meta_seal / stardustmark / invisimark / elevenlikes | Pro | Wrapper algorithms with configurable profiles |

---

## Usage

### 🌐 Web App (No Installation)

Visit **[https://redo-san.github.io/RedoSan-Authenticity/](https://redo-san.github.io/RedoSan-Authenticity/)** — just open in any browser.

Select your preferred mode on startup (saved to localStorage for next visit):

- **Simplified Mode** — Upload a file and follow the step wizard. The tool auto-detects your file type (image, audio, video, document) and builds the appropriate pipeline.
- **Professional Mode** — Use the sidebar to access each tool directly with full control over parameters.

### 💻 CLI (Cross-Platform)

A Node.js CLI is available for automation and offline use. Requires **Node.js 18+**.

#### 🖱️ Quick Start (No Commands Needed)

Double-click the file for your system:

| Windows | Linux / macOS |
|---------|---------------|
| **`start.bat`** | **`start.sh`** (`chmod +x start.sh` first) |

An interactive menu will open — just choose an option number, enter file paths when prompted, and the tool does the rest.

```
╔══════════════════════════════════════╗
║     RedoSan Authenticity CLI         ║
╚══════════════════════════════════════╝

Choose an option:
  1  Fingerprint file
  2  Embed watermark
  3  Extract watermark
  ...
  0  Exit
```

#### ⌨️ Command Line (For Power Users)

##### Installation

```bash
# Clone the repo
git clone https://github.com/Redo-San/RedoSan-Authenticity.git
cd RedoSan-Authenticity

# Install dependencies & register the CLI
npm install
npm link    # makes 'redosan' available globally
```

#### Commands

| Command | Description |
|---------|-------------|
| `redosan fingerprint <file>` | Generate cryptographic hashes — 17 algorithms (SHA-1/224/256/384/512, SHA-3-224/256/384/512, BLAKE2b/2s/3, MD2/4/5, RIPEMD-160, Whirlpool) + perceptual image hashes (aHash/dHash/pHash/wHash) |
| `redosan watermark embed -i <img> -o <out>` | Embed watermark — 9 core algorithms (LSB, DCT, Random LSB, Latent DCT, Zero-bit, Multi-bit, Forensic, Fragile, Imatag) |
| `redosan watermark extract -i <img>` | Extract watermark from image |
| `redosan pixel-injection embed -i <img> -o <out>` | Advanced embedding — 18+ spatial/frequency/DL/professional algorithms (enhanced_lsb, adaptive_lsb, dct, dwt, dft, hybrid_dct_dwt, vine, pixel_seal, nullguard, and more) |
| `redosan pixel-injection extract -i <img>` | Extract from advanced algorithms |
| `redosan c2pa sign <file>` | Sign with C2PA provenance metadata (ECDSA P-256) |
| `redosan c2pa read <file>` | Read C2PA manifests from JPEG/PNG |
| `redosan c2pa verify <file>` | Verify C2PA digital signatures |
| `redosan metadata <file>` | Read EXIF, dimensions, format info |
| `redosan timestamp create <file>` | Create an OpenTimestamps `.ots` proof |
| `redosan timestamp verify <file>` | Verify file integrity against an `.ots` proof |
| `redosan upgrade <file>` | Upgrade incomplete `.ots` proof via calendar aggregator |

#### Examples

```bash
# All algorithms fingerprint (17 hashes + perceptual)
redosan fingerprint photo.png --json -o hashes.json

# Single algorithm
redosan fingerprint doc.pdf --algo sha256

# Watermark with DCT (type 2)
redosan watermark embed -i cover.png -s secret.txt -o output.png -a dct -p "mypassword"

# Watermark with all core algorithms available:
# lsb (1), dct (2), random_lsb (3), neural_lsb (4), zero_bit (5),
# multi_bit (6), forensic (7), fragile (8), imatag (9)

# Advanced pixel injection
redosan pixel-injection embed -i image.png -s message.txt -o output.png -a enhanced_lsb

# C2PA provenance signing
redosan c2pa sign document.pdf --claim "Created by Me" --author "Name" -o manifest.json
redosan c2pa read image.jpg

# Timestamp
redosan timestamp create document.pdf -o proof.ots
redosan timestamp verify document.pdf -o proof.ots

# Windows (PowerShell) paths
redosan fingerprint "C:\Users\You\photo.png" --json -o hashes.json
redosan watermark embed -i cover.png -o output.png -a lsb -p "mypassword"
```

> **Note:** On Linux, install system dependencies for the `canvas` module:  
> `sudo apt install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`  
> On macOS: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`  
> Windows binaries are bundled — no extra setup required.

---

## Privacy

- 100% client-side: **no files are ever uploaded**
- All processing is done in your browser using JavaScript
- Your files never leave your device

---

## License

**GNU General Public License v2.0** — See [LICENSE](LICENSE)

---

## Author

Built by [Redo_San](https://github.com/Redo-San)

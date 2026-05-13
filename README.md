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
| **Watermark** | 9 core algorithms + 14 advanced algorithms — embed & extract invisible watermarks |
| **Pixel Injection** | 23 algorithms across spatial, frequency, DL, and professional domains |
| **Fingerprint** | SHA-256 hashing + perceptual image hashes |
| **Metadata** | View EXIF, dimensions, format info |
| **Timestamp** | SHA-256 hashing + OTS hash verification |

---

## Algorithm Audit Reference

### 9 Core Watermark Types (`Watermark/watermark_core.js` + `Watermark/watermark.js`)

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

All payload types 1-7, 9 use format: `[32-bit length] + [XOR-encrypted [0xAA, 0xBB \|\| secret]]`.

### 14 Advanced/Pixel Injection Algorithms (`Watermark/watermark_core_advanced.js`)

| Algorithm | Domain | Status |
|-----------|--------|--------|
| enhanced_lsb | Spatial | ✅ Adaptive embedding with complexity map |
| adaptive_lsb | Spatial | ✅ Region-adaptive strategy |
| multi_channel_lsb | Spatial | ✅ Channel-alternating LSB |
| random_lsb | Spatial | ✅ Seeded random positioning |
| dct | DCT | ✅ Full DCT 8×8 with coefficient selection |
| dwt | DWT | ✅ Multi-level wavelet decomposition |
| dft | DFT | ✅ Phase modulation in frequency domain |
| hybrid_dct_dwt | Hybrid | ✅ Combined DCT + DWT embedding |
| vine | DL | ✅ Diffusion-based adversarial simulation |
| pixel_seal | DL | ✅ JND-based perceptual masking |
| nullguard | DL | ✅ Null-space region detection |
| shallow_diffuse | DL | ✅ Diffusion pattern modulation |
| diffusion_based | DL | ✅ Diffusion process simulation |
| imagewmark / meta_seal / stardustmark / invisimark / elevenlikes | Pro | ✅ Wrapper algorithms with configurable profiles |

### Known Fixes Applied (Session 2026-05-13)

| # | Bug | File | Fix |
|---|-----|------|-----|
| 1 | `enhancedLSB` bit corruption | `watermark_core_advanced.js:79` | Changed `& 0xFE \| (bit << strength)` to proper mask `~(1 << strength)` |
| 2 | `nullguard` bit position mismatch | `watermark_core_advanced.js:456` | Changed `& 0xFE` → `& 0xFD` to mask bit 1 instead of bit 0 |
| 3 | CRC32 double-right-shift | `watermark_core_advanced.js:755` | Removed unconditional `crc >>>= 1`; used ternary |
| 4 | `blindDecoding` mock strings | `watermark_core_advanced.js:637-661` | Replaced `'extracted_*_message'` with real DCT/LSB/DWT extraction |
| 5 | `addRedundancy` string-level repeat | `watermark_core_advanced.js:762` | Changed from `message += '\|' + message` to bit-level `bit.repeat(factor)` |
| 6 | `encodeMessage` double-encoding | `watermark_core_advanced.js:748` | Removed redundant `stringToBinary` call after `addRedundancy` (now returns bits) |
| 7 | DCT type collision in auto-detect | `watermark.js:138-198` | Type 4 validates 3× redundancy pattern; Type 9 validates Y/Cb channel match |

---

## Usage

Just visit **[https://redo-san.github.io/RedoSan-Authenticity/](https://redo-san.github.io/RedoSan-Authenticity/)** — no installation required.

All features are accessible from the navigation bar:
- **Watermark** — Embed or extract watermarks from images
- **Fingerprint** — Generate file hashes
- **Metadata** — Inspect media metadata
- **Timestamp** — Hash files and verify OTS proofs

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

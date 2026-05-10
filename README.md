<p align="center">
  <img src="https://img.shields.io/github/v/release/Redo-San/RedoSan-Authenticity?style=flat-square&label=Release&color=blue" alt="Release">
  <img src="https://img.shields.io/github/license/Redo-San/RedoSan-Authenticity?style=flat-square&label=License&color=green" alt="License">
  <img src="https://img.shields.io/badge/Python-3.8%2B-blue?style=flat-square&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/github/downloads/Redo-San/RedoSan-Authenticity/total?style=flat-square&label=Downloads&color=orange" alt="Downloads">
</p>

# RedoSan Authenticity

> **⚠️ IMPORTANT: BETA SOFTWARE**
> This tool is **still under development and testing**. It is **not complete** and contains **many bugs**, especially in the GUI interface. Some sections and features may not work as expected. Use at your own risk and report issues on GitHub.
>
> **هذه الأداة لا تزال قيد التطوير والاختبار وغير مكتملة.** تحتوي على أخطاء كثيرة خصوصًا في الواجهة الرسومية. بعض الفقرات والأجزاء قد لا تعمل. تستخدمها على مسؤوليتك الخاصة.

**RedoSan Authenticity** is a cross-platform tool that combines **steganography** (via [OpenStego](https://www.openstego.com/)) with **cryptographic timestamping** (via [OpenTimestamps](https://opentimestamps.org/)) to provide a complete workflow for hiding, watermarking, and proving the authenticity of digital files.

> **[Download Latest Release](https://github.com/Redo-San/RedoSan-Authenticity/releases/tag/v1.0-beta.1)**

---

## Features

| # | Feature | Media | Description |
|---|---------|-------|-------------|
| 1 | **Hide + Timestamp** | Image | Embed secret in image (LSB), timestamp the result |
| 2 | **Extract + Verify** | Image | Extract secret from image, verify timestamp |
| 3 | **Timestamp** | Any file | SHA-256 + OpenTimestamps proof |
| 4 | **Verify** | Any file | Verify file integrity against .ots proof |
| 5 | **Watermark + Timestamp** | Image | DWT watermark + timestamp |
| 6 | **Gen Signature** | - | Generate watermarking signature |
| 7 | **Check Watermark** | Image | Detect watermark in image |
| 8 | **Hide in Audio** | WAV | LSB steganography in WAV files (pure Python) |
| 9 | **Extract from Audio** | WAV | Extract hidden data from WAV |
| 10 | **Hide in Video** | Video | Frame-based LSB via ffmpeg + Pillow |
| 11 | **Extract from Video** | Video | Extract hidden data from video |
| 12 | **View Metadata** | Any media | Read EXIF, ID3, video streams, etc. |
| 13 | **Write Metadata** | Images/Audio | Write title, artist, copyright to media files |
| 14 | **Read C2PA** | Images/Video/Audio | Read C2PA provenance / AI content credentials |
| 15 | **Write C2PA** | Images/Video | Sign media with AI/stego provenance claims |
| 16 | **Init C2PA** | Certificate | Generate self-signed C2PA signing certificate |

---

## Requirements

| Dependency | Required For | Install |
|------------|-------------|---------|
| **Python 3.8+** | Core tool | [python.org](https://www.python.org/downloads/) |
| **Java 8+ (JRE)** | Image stego (OpenStego) | [java.com](https://www.java.com/download/) |
| **OpenStego** | Image stego | [openstego.com](https://www.openstego.com/) |
| **ffmpeg** | Video stego (optional) | [ffmpeg.org](https://ffmpeg.org/) |
| `opentimestamps` | Timestamping | `pip install opentimestamps` |
| `Pillow` | Video / Metadata | `pip install Pillow` |
| `mutagen` | Audio metadata | `pip install mutagen` |
| `c2pa-python` | C2PA provenance | `pip install c2pa-python` |
| `cryptography` | C2PA cert generation | `pip install cryptography` |

> **Pure Python features** (no extra deps): Timestamp (3), Verify (4), Audio stego (8, 9)
> **External tools needed**: Image stego (1,2,5,6,7) needs Java + OpenStego; Video stego (10,11) needs ffmpeg + Pillow
> **C2PA features** (14,15,16) need c2pa-python + cryptography

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/Redo-San/RedoSan-Authenticity.git
cd RedoSan-Authenticity
pip install -r requirements.txt
python install.py

# Run
python RedoSan_Authenticity.py          # interactive menu
python RedoSan_Authenticity.py --help   # CLI commands
```

### Windows One-Click Setup
Double-click **`setup.bat`** - installs everything automatically.

### Run Online (no installation)
```bash
python redosan_online.py        # CLI version
python redosan_online_gui.py    # GUI version
```
Downloads the latest code from GitHub, runs it, and cleans up on exit.

---

## Launchers

| Platform | Method | File |
|----------|--------|------|
| Windows | Interactive menu | `RedoSan_Authenticity.bat` |
| Windows | Drag & drop | `RedoSan_Authenticity_dragdrop.vbs` |
| Windows | Send To menu | Right-click > Send To > RedoSan Authenticity |
| Windows | Terminal | `py -3 RedoSan_Authenticity.py` |
| Linux/macOS | Interactive menu | `./RedoSan_Authenticity.sh` |
| Linux/macOS | Terminal | `python3 RedoSan_Authenticity.py` |

First time on Linux/macOS: `chmod +x RedoSan_Authenticity.sh`

---

## Usage Examples

### Hide a secret inside an image + timestamp
```
Menu option 1
Cover image: wallpaper.png
Secret file: secret.txt
Password: mypassword

[1/3] Hiding secret in image...
[2/3] Saving SHA-256...
[3/3] Creating timestamp proof...
```
Output: `wallpaper_stego.png` + `wallpaper_stego.png.sha256.txt` + `wallpaper_stego.png.ots`

### Extract and verify
```
Menu option 2
Stego image: wallpaper_stego.png

[1/2] Verifying timestamp integrity...
      INTEGRITY: Hash matches - file is authentic
[2/2] Extracting hidden data...
```

### Timestamp only
```
Menu option 3
File: document.pdf

[1/2] Calculating SHA-256...
[2/2] Creating timestamp proof...
```

### Drag-and-drop (Windows)
Drop a file on `RedoSan_Authenticity_dragdrop.vbs`, then choose:
```
1 - Timestamp this file
2 - Verify timestamp of this file
3 - Hide secret in this image
4 - Extract secret from this image
```

---

## Output Files

When processing `photo.png`:

| File | Description |
|------|-------------|
| `photo.png.sha256.txt` | SHA-256 hash |
| `photo.png.ots` | OpenTimestamps proof (verifiable) |
| `photo_stego.png` | Stego image with embedded data |
| `photo_watermarked.png` | Watermarked image |

---

## Configuration

| Variable | Default (Windows) | Default (Linux/macOS) |
|----------|-------------------|----------------------|
| `OPENSTEGO_JAR` | `C:\Program Files (x86)\OpenStego\lib\openstego.jar` | `/usr/local/share/openstego/lib/openstego.jar` |

Check your setup: `python RedoSan_Authenticity.py --setup`

---

## How It Works

```
                    +-----------------+
                    |   Cover Image   |
                    +--------+--------+
                             |
              +--------------+--------------+
              |                             |
     +--------v--------+          +---------v---------+
     |  Hide Secret    |          |  Digital Watermark |
     |  (LSB algo)     |          |  (DWT wavelet)     |
     +--------+--------+          +---------+----------+
              |                             |
              +--------------+--------------+
                             |
                      +------v------+
                      |  Stego /    |
                      |  Watermarked|
                      |  Image      |
                      +------+------+
                             |
              +--------------+--------------+
              |                             |
       +------v------+            +---------v---------+
       |  SHA-256    |            |  OpenTimestamp    |
       |  Hash       |            |  Proof (.ots)     |
       +-------------+            +-------------------+
```

---

## License

**GNU General Public License v2.0** - See [LICENSE](LICENSE)

RedoSan Authenticity incorporates:
- [OpenStego](https://www.openstego.com/) (GPL v2) - Steganography engine
- [python-opentimestamps](https://github.com/opentimestamps/python-opentimestamps) (LGPL v3) - Timestamping library

---

## Author

Built by [Redo_San](https://github.com/Redo-San)
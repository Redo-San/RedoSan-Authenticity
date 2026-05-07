# RedoSan Authenticity

**RedoSan Authenticity** is a cross-platform tool that combines **steganography** (via [OpenStego](https://www.openstego.com/)) with **cryptographic timestamping** (via [OpenTimestamps](https://opentimestamps.org/)) to provide a complete workflow for hiding, watermarking, and proving the authenticity of digital files.

---

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Hide + Timestamp** | Embed a secret file into an image (LSB steganography), then create a verifiable timestamp proof |
| 2 | **Extract + Verify** | Extract a hidden file from an image and verify its timestamp integrity |
| 3 | **Timestamp** | Calculate SHA-256 hash and create an OpenTimestamps proof for any file |
| 4 | **Verify** | Verify that a file matches its timestamp proof (integrity check) |
| 5 | **Watermark + Timestamp** | Add an invisible digital watermark (DWT wavelet) to an image and timestamp it |
| 6 | **Gen Signature** | Generate a watermarking signature file |
| 7 | **Check Watermark** | Check if an image contains a specific digital watermark |

---

## Requirements

| Dependency | Required For | Install |
|------------|-------------|---------|
| **Python 3.8+** | Core tool | [python.org](https://www.python.org/downloads/) |
| **Java 8+ (JRE)** | Steganography (OpenStego) | [java.com](https://www.java.com/download/) |
| **OpenStego** | Steganography | [openstego.com](https://www.openstego.com/) |
| `opentimestamps` | Timestamping | `pip install opentimestamps opentimestamps-client` |

> **Note:** Features 3 (Timestamp) and 4 (Verify) work with Python alone.
> Features 1, 2, 5, 6, 7 also require Java + OpenStego.

---

## Installation

### 1. Clone & enter the directory

```bash
git clone https://github.com/Redo_San/RedoSan-Authenticity.git
cd RedoSan-Authenticity
```

### 2. Install Python packages

```bash
pip install opentimestamps opentimestamps-client
```

### 3. Install OpenStego (optional - only for steganography features)

Download from [openstego.com](https://www.openstego.com/) and install.

### 4. Run the setup checker

```bash
python install.py
```

This will verify all dependencies and guide you if anything is missing.

### 5. Start the tool

```bash
python RedoSan_Authenticity.py
```

---

## Platform-Specific Launchers

### Windows

| Method | File | How |
|--------|------|-----|
| **Interactive menu** | Double-click `RedoSan_Authenticity.bat` | Opens menu in terminal |
| **Drag & drop** | Drop file onto `RedoSan_Authenticity.vbs` | Quick action menu |
| **Send To menu** | Right-click file → **Send To** → **RedoSan Authenticity** | Quick action |
| **Terminal** | `py -3 RedoSan_Authenticity.py` | Full control |

### Linux / macOS

| Method | File | How |
|--------|------|-----|
| **Interactive menu** | `./RedoSan_Authenticity.sh` | Opens menu in terminal |
| **Terminal** | `python3 RedoSan_Authenticity.py [file]` | Full control |
| **Alias** | Add to `.bashrc`: `alias redosan='python3 /path/to/RedoSan_Authenticity.py'` | |

Make the shell script executable on first use:
```bash
chmod +x RedoSan_Authenticity.sh
```

---

## Usage Examples

### Hide a secret file inside an image, then timestamp it

```
Menu option 1
Cover image path: wallpaper.png
Secret file path: secret.txt
Output image path: (Enter for auto-name)
Password: mypassword

[1/3] Hiding secret in image...
[2/3] Saving SHA-256...
[3/3] Creating timestamp proof...
```

Output files:
- `wallpaper_stego.png` — the image with hidden data
- `wallpaper_stego.png.sha256.txt` — SHA-256 hash
- `wallpaper_stego.png.ots` — verifiable timestamp proof

### Extract a hidden file and verify timestamp

```
Menu option 2
Stego image path: wallpaper_stego.png
Extract to directory: ./extracted

[1/2] Verifying timestamp integrity...
      INTEGRITY: Hash matches - file is authentic
[2/2] Extracting hidden data...
```

### Timestamp only (SHA-256 + OpenTimestamps proof)

```
Menu option 3
File path: document.pdf

[1/2] Calculating SHA-256...
[2/2] Creating timestamp proof...
```

### Drag-and-drop quick action (Windows or via CLI)

```bash
python RedoSan_Authenticity.py myfile.png
```

Then choose from the quick menu:
```
1 - Timestamp this file
2 - Verify timestamp of this file
3 - Hide secret in this image (requires OpenStego)
4 - Extract secret from this image (requires OpenStego)
```

---

## Output Files

When processing a file like `photo.png`, the tool generates:

| File | Description |
|------|-------------|
| `photo.png.sha256.txt` | SHA-256 hash of the file |
| `photo.png.ots` | OpenTimestamps proof (verifiable timestamp) |
| `photo_stego.png` | Stego image with embedded data (option 1) |
| `photo_watermarked.png` | Watermarked image (option 5) |

---

## How It Works

```
                  ┌─────────────────┐
                  │   Cover Image   │
                  └────────┬────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     ┌────────▼────────┐      ┌─────────▼─────────┐
     │  Hide Secret    │      │  Digital Watermark │
     │  (LSB algo)     │      │  (DWT wavelet)     │
     └────────┬────────┘      └─────────┬──────────┘
              │                         │
              └────────────┬────────────┘
                           │
                    ┌──────▼──────┐
                    │  Stego/     │
                    │  Watermarked│
                    │  Image      │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
       ┌──────▼──────┐          ┌───────▼───────┐
       │  SHA-256    │          │  OpenTimestamp │
       │  Hash       │          │  Proof (.ots)  │
       └─────────────┘          └───────────────┘
```

---

## Configuration

The tool auto-detects dependencies. Override paths via environment variables:

| Variable | Default (Windows) | Default (Linux/macOS) |
|----------|-------------------|----------------------|
| `OPENSTEGO_JAR` | `C:\Program Files (x86)\OpenStego\lib\openstego.jar` | `/usr/local/share/openstego/lib/openstego.jar` |

To check your setup:
```bash
python RedoSan_Authenticity.py --setup
```

---

## License

**GNU General Public License v2.0** — See [LICENSE](LICENSE)

RedoSan Authenticity incorporates:
- [OpenStego](https://www.openstego.com/) (GPL v2) — Steganography engine
- [python-opentimestamps](https://github.com/opentimestamps/python-opentimestamps) (LGPL v3) — Timestamping library

---

## Author

Built by Redo_San

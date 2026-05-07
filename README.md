# RedoSan Authenticity

**RedoSan Authenticity** is an integrated tool that combines **steganography** (via [OpenStego](https://www.openstego.com/)) with **cryptographic timestamping** (via [OpenTimestamps](https://opentimestamps.org/)) to provide a complete workflow for hiding, watermarking, and proving the authenticity of digital files.

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

- **Windows** (currently Windows-only due to path dependencies)
- **Java** (JRE 8+) — [Download](https://www.java.com/download/)
- **Python 3.11** — [Download](https://www.python.org/downloads/)
- **OpenStego** v0.8.6 — [Download](https://www.openstego.com/)
- Python packages: `opentimestamps`, `opentimestamps-client`

---

## Installation

### 1. Install dependencies

```bash
pip install opentimestamps opentimestamps-client
```

### 2. Install OpenStego

Download and install from [openstego.com](https://www.openstego.com/)

### 3. Clone or download RedoSan Authenticity

```bash
git clone https://github.com/yourusername/RedoSan-Authenticity.git
cd RedoSan-Authenticity
```

Or simply copy the files to `C:\RedoSan Authenticity\`.

### 4. Run

**Interactive menu:**
```bash
python RedoSan_Authenticity.py
```

**Drag-and-drop:**
Drop a file onto `RedoSan_Authenticity.vbs`

**Windows Send To:**
Right-click any file → **Send To** → **RedoSan Authenticity**

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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENSTEGO_JAR` | `C:\Program Files (x86)\OpenStego\lib\openstego.jar` | Path to OpenStego JAR |
| `REDOSAN_PYTHON` | Auto-detected | Python interpreter path |

---

## License

**GNU General Public License v2.0** — See [LICENSE](LICENSE)

RedoSan Authenticity incorporates:
- [OpenStego](https://www.openstego.com/) (GPL v2) — Steganography engine
- [python-opentimestamps](https://github.com/opentimestamps/python-opentimestamps) (LGPL v3) — Timestamping library

---

## Author

Built with ❤️ by [Your Name]

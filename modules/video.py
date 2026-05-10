"""
Video steganography module — frame-based LSB via ffmpeg + Pillow
Requires: ffmpeg (in PATH), Pillow
"""
import os, subprocess, tempfile, shutil, struct, hashlib
from pathlib import Path


def _ffmpeg_available():
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        # Try local ffmpeg
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        local_ffmpeg = os.path.join(base_dir, "ffmpeg", "bin", "ffmpeg.exe")
        if os.path.isfile(local_ffmpeg):
            return local_ffmpeg
        return False


def _have_pil():
    try:
        from PIL import Image
        return True
    except ImportError:
        return False


def _lsb_embed_in_png(png_path, payload, pw):
    from PIL import Image
    if pw:
        key = hashlib.pbkdf2_hmac("sha256", pw.encode(), pw.encode(), 100000)
        payload = bytes(payload[i] ^ key[i % len(key)] for i in range(len(payload)))
    img = Image.open(png_path).convert("RGB")
    px = img.load()
    w, h = img.size

    data = struct.pack("<I", len(payload)) + payload
    bits = "".join(format(b, "08b") for b in data)
    idx = 0
    for y in range(h):
        for x in range(w):
            if idx >= len(bits):
                break
            r, g, b = px[x, y]
            px[x, y] = ((r & ~1) | int(bits[idx]),
                        (g & ~1) | int(bits[idx + 1]) if idx + 1 < len(bits) else g,
                        (b & ~1) | int(bits[idx + 2]) if idx + 2 < len(bits) else b)
            idx += 3
        if idx >= len(bits):
            break
    img.save(png_path)
    return True


def _lsb_extract_from_png(png_path, pw):
    from PIL import Image
    img = Image.open(png_path).convert("RGB")
    px = img.load()
    w, h = img.size
    bits = []
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            bits.append(str(r & 1))
            bits.append(str(g & 1))
            bits.append(str(b & 1))
    raw = "".join(bits)
    dlen = int(raw[:32], 2)
    raw_bits = raw[32:32 + dlen * 8]
    data = bytes(int(raw_bits[i:i+8], 2) for i in range(0, len(raw_bits), 8))
    if pw:
        key = hashlib.pbkdf2_hmac("sha256", pw.encode(), pw.encode(), 100000)
        data = bytes(data[i] ^ key[i % len(key)] for i in range(len(data)))
    return data


def embed(video_path, secret_path, output_path, password=None):
    ffmpeg = _ffmpeg_available()
    if not ffmpeg:
        return False, "ffmpeg not found. Install ffmpeg or run install.py"
    if not _have_pil():
        return False, "Pillow not installed (pip install Pillow)"

    # ffmpeg is either "ffmpeg" (in PATH) or full path
    ffmpeg_cmd = ffmpeg if isinstance(ffmpeg, str) else "ffmpeg"
    
    tmp = tempfile.mkdtemp()
    try:
        frames_dir = os.path.join(tmp, "frames")
        os.makedirs(frames_dir)

        r = subprocess.run(
            [ffmpeg_cmd, "-i", video_path, os.path.join(frames_dir, "frame_%05d.png"), "-y"],
            capture_output=True, text=True
        )
        if r.returncode != 0:
            return False, f"ffmpeg extract failed:\n{r.stderr.strip()}"

        frames = sorted(os.listdir(frames_dir))
        if not frames:
            return False, "No frames extracted"

        with open(secret_path, "rb") as f:
            secret = f.read()

        # Embed in middle frame
        mid = len(frames) // 2
        target = os.path.join(frames_dir, frames[mid])
        _lsb_embed_in_png(target, secret, password)

        # Check if input has audio stream
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a:0",
             "-show_entries", "stream=codec_type",
             "-of", "default=nokey=1:noprint_wrappers=1", video_path],
            capture_output=True, text=True
        )
        has_audio = probe.returncode == 0 and probe.stdout.strip() == "audio"

        r2 = subprocess.run(
            ["ffmpeg",
             "-i", os.path.join(frames_dir, "frame_%05d.png"),
             "-i", video_path,
             "-c:v", "libx264", "-pix_fmt", "yuv420p",
             "-map", "0:v:0"] +
            (["-map", "1:a:0", "-c:a", "copy"] if has_audio else []) +
            [output_path, "-y"],
            capture_output=True, text=True
        )
        if r2.returncode != 0:
            return False, f"ffmpeg rebuild failed"

        return True, f"Data hidden in {output_path}"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def extract(video_path, outdir, password=None):
    ffmpeg = _ffmpeg_available()
    if not ffmpeg:
        return False, "ffmpeg not found. Install ffmpeg or run install.py"
    if not _have_pil():
        return False, "Pillow not installed (pip install Pillow)"

    ffmpeg_cmd = ffmpeg if isinstance(ffmpeg, str) else "ffmpeg"

    tmp = tempfile.mkdtemp()
    try:
        frames_dir = os.path.join(tmp, "frames")
        os.makedirs(frames_dir)

        r = subprocess.run(
            ["ffmpeg", "-i", video_path, os.path.join(frames_dir, "frame_%05d.png"), "-y"],
            capture_output=True, text=True
        )
        if r.returncode != 0:
            return False, f"ffmpeg extract failed:\n{r.stderr.strip()}"

        frames = sorted(os.listdir(frames_dir))
        if not frames:
            return False, "No frames extracted"

        mid = len(frames) // 2
        data = _lsb_extract_from_png(os.path.join(frames_dir, frames[mid]), password)

        if len(data) < 4:
            return False, "No hidden data found or corrupted"

        os.makedirs(outdir, exist_ok=True)
        out_path = os.path.join(outdir, "extracted_from_video")
        with open(out_path, "wb") as f:
            f.write(data)
        return True, f"Extracted to {out_path}"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

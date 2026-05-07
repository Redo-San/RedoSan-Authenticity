"""
Metadata module — read/write metadata for images, audio, video
Uses: Pillow (images), mutagen (audio), ffmpeg/exiftool (video)
"""
import os, subprocess, json
from datetime import datetime


def _have_pil():
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS
        return True
    except ImportError:
        return False


def _have_mutagen():
    try:
        import mutagen
        return True
    except ImportError:
        return False


def _have_exiftool():
    try:
        subprocess.run(["exiftool", "-ver"], capture_output=True, check=True)
        return "exiftool"
    except:
        return None


def _have_ffprobe():
    try:
        subprocess.run(["ffprobe", "-version"], capture_output=True, check=True)
        return "ffprobe"
    except:
        return None


def _safe(val):
    if val is None: return ""
    s = str(val).strip()
    return s if len(s) < 200 else s[:197] + "..."

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".webp"}
AUDIO_EXT = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".wma"}
VIDEO_EXT = {".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm"}


def read_metadata(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    meta = {"file": filepath, "size": os.path.getsize(filepath), "format": ext}

    # Image via Pillow
    if ext in IMAGE_EXT and _have_pil():
        from PIL import Image
        from PIL.ExifTags import TAGS
        try:
            img = Image.open(filepath)
            meta["image"] = {"w": img.width, "h": img.height, "mode": img.mode, "format": img.format}
            exif_data = img._getexif()
            if exif_data:
                meta["exif"] = {TAGS.get(k, k): _safe(v) for k, v in exif_data.items()}
            img.close()
        except Exception as e:
            meta["image_error"] = str(e)

    # Audio via mutagen
    if ext in AUDIO_EXT and _have_mutagen():
        import mutagen
        try:
            f = mutagen.File(filepath)
            if f:
                meta["audio"] = {_safe(k): _safe(v) for k, v in f.items()}
                meta["audio"]["length_s"] = round(f.info.length, 2) if hasattr(f.info, "length") else 0
                meta["audio"]["bitrate"] = f.info.bitrate if hasattr(f.info, "bitrate") else 0
        except Exception as e:
            meta["audio_error"] = str(e)

    # Audio via ffprobe (more detailed)
    if ext in AUDIO_EXT and _have_ffprobe():
        try:
            r = subprocess.run(
                ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filepath],
                capture_output=True, text=True
            )
            if r.returncode == 0:
                data = json.loads(r.stdout)
                meta["ffprobe_audio"] = data
        except:
            pass

    # Video via ffprobe
    if ext in VIDEO_EXT:
        if _have_ffprobe():
            try:
                r = subprocess.run(
                    ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filepath],
                    capture_output=True, text=True
                )
                if r.returncode == 0:
                    data = json.loads(r.stdout)
                    streams = data.get("streams", [])
                    fmt = data.get("format", {})
                    meta["video"] = {"streams": len(streams), "duration": fmt.get("duration"), "bitrate": fmt.get("bit_rate"), "size": fmt.get("size")}
                    for i, s in enumerate(streams):
                        meta[f"stream_{i}"] = {"codec": s.get("codec_name"), "type": s.get("codec_type"),
                                               "w": s.get("width"), "h": s.get("height")}
            except Exception as e:
                meta["video_error"] = str(e)
        else:
            meta["video"] = "Install ffprobe (ffmpeg) for video metadata"

    # exiftool (universal, if available)
    et = _have_exiftool()
    if ext in IMAGE_EXT | AUDIO_EXT | VIDEO_EXT and et:
        try:
            r = subprocess.run(
                [et, "-json", filepath],
                capture_output=True, text=True
            )
            if r.returncode == 0:
                exif = json.loads(r.stdout)
                if exif:
                    meta["exiftool"] = {_safe(k): _safe(v) for k, v in exif[0].items()}
        except:
            pass

    return meta


def print_metadata(meta):
    print(f"\n{'=' * 55}")
    print(f"   METADATA: {os.path.basename(meta['file'])}")
    print(f"{'=' * 55}")
    print(f"  Size: {meta['size']:,} bytes  |  Format: {meta['format']}")

    for key, value in meta.items():
        if key in ("file", "size", "format", "image_error", "audio_error", "video_error"):
            continue
        if isinstance(value, dict):
            print(f"\n  [{key.upper()}]")
            for k, v in value.items():
                if v and v != "0" and str(v).strip():
                    print(f"    {k}: {v}")
        elif isinstance(value, str) and len(value) > 50:
            print(f"\n  [{key}]: {value}")
        elif value:
            print(f"\n  [{key}]: {value}")

    for err_key in ("image_error", "audio_error", "video_error"):
        if err_key in meta:
            print(f"\n  [!] {err_key}: {meta[err_key]}")
    print()

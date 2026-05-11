"""
Metadata + C2PA Provenance module — read/write metadata and C2PA for images, audio, video
"""

import os, subprocess, json, shutil
from datetime import datetime, timezone, timedelta


# ---------------------------------------------------------------------------
#  Dependency checks
# ---------------------------------------------------------------------------

def _safe(val):
    if val is None: return ""
    s = str(val).strip()
    return s if len(s) < 200 else s[:197] + "..."


def _have_pil():
    try:
        from PIL import Image
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
    except Exception:
        return None


def _have_ffprobe():
    try:
        subprocess.run(["ffprobe", "-version"], capture_output=True, check=True)
        return "ffprobe"
    except Exception:
        return None


def _have_c2pa():
    try:
        import c2pa
        return True
    except ImportError:
        return False


def _have_cryptography():
    try:
        from cryptography import x509
        return True
    except ImportError:
        return False


def _have_openssl():
    try:
        subprocess.run(["openssl", "version"], capture_output=True, check=True)
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
#  Extension sets
# ---------------------------------------------------------------------------

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp", ".avif", ".heic", ".heif"}
AUDIO_EXT = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".wma"}
VIDEO_EXT = {".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg"}

C2PA_READ_EXT  = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".heic", ".heif", ".mp4", ".mov", ".gif", ".tiff", ".tif", ".flac", ".wav"}
C2PA_WRITE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".mp4", ".mov"}

C2PA_CERT_DIR = os.path.join(os.path.expanduser("~"), ".redosan", "c2pa")
CERT_FILE = os.path.join(C2PA_CERT_DIR, "cert.pem")
KEY_FILE  = os.path.join(C2PA_CERT_DIR, "key.pem")


# ---------------------------------------------------------------------------
#  Metadata — READ
# ---------------------------------------------------------------------------

def read_metadata(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    meta = {"file": filepath, "size": os.path.getsize(filepath), "format": ext}

    if ext in IMAGE_EXT and _have_pil():
        from PIL import Image
        from PIL.ExifTags import TAGS
        try:
            with Image.open(filepath) as img:
                meta["image"] = {"w": img.width, "h": img.height, "mode": img.mode, "format": img.format}
                exif_data = img._getexif()
                if exif_data:
                    meta["exif"] = {TAGS.get(k, k): _safe(v) for k, v in exif_data.items()}
        except Exception as e:
            meta["image_error"] = str(e)

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

    if ext in AUDIO_EXT and _have_ffprobe():
        try:
            r = subprocess.run(
                ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filepath],
                capture_output=True, text=True
            )
            if r.returncode == 0:
                data = json.loads(r.stdout)
                meta["ffprobe_audio"] = data
        except Exception:
            pass

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

    et = _have_exiftool()
    if ext in IMAGE_EXT | AUDIO_EXT | VIDEO_EXT and et:
        try:
            r = subprocess.run([et, "-json", filepath], capture_output=True, text=True)
            if r.returncode == 0:
                exif = json.loads(r.stdout)
                if exif:
                    meta["exiftool"] = {_safe(k): _safe(v) for k, v in exif[0].items()}
        except Exception:
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


# ---------------------------------------------------------------------------
#  Metadata — WRITE (EXIF / ID3)
# ---------------------------------------------------------------------------

def write_metadata(filepath, metadata_dict, output_path=None):
    ext = os.path.splitext(filepath)[1].lower()
    output_path = output_path or filepath

    if ext in IMAGE_EXT and _have_pil():
        return _write_metadata_image(filepath, metadata_dict, output_path)
    if ext in AUDIO_EXT and _have_mutagen():
        return _write_metadata_audio(filepath, metadata_dict, output_path)
    return False, "Unsupported format or missing dependency (Pillow for images, mutagen for audio)"


def _write_metadata_image(filepath, metadata_dict, output_path):
    from PIL import Image
    from PIL.ExifTags import Base
    try:
        with Image.open(filepath) as img:
            exif = img.getexif()

            tag_map = {
                "title": Base.XPTitle,
                "artist": Base.Artist,
                "copyright": Base.Copyright,
                "description": Base.ImageDescription,
                "software": Base.Software,
                "make": Base.Make,
                "model": Base.Model,
            }

            for key, value in metadata_dict.items():
                if key in tag_map:
                    exif[tag_map[key]] = value[:200] if isinstance(value, str) else str(value)[:200]

            img.save(output_path, exif=exif)
        return True, "Metadata written to image"
    except Exception as e:
        return False, str(e)


def _write_metadata_audio(filepath, metadata_dict, output_path):
    import mutagen
    try:
        f = mutagen.File(filepath)
        if f is None:
            return False, "Unrecognized audio format"
        for key, value in metadata_dict.items():
            f[key] = str(value)[:200]
        f.save(output_path)
        return True, "Metadata written to audio file"
    except Exception as e:
        return False, str(e)


# ---------------------------------------------------------------------------
#  C2PA — Certificate management
# ---------------------------------------------------------------------------

def c2pa_cert_available():
    return os.path.isfile(CERT_FILE) and os.path.isfile(KEY_FILE)


def c2pa_init(force=False):
    os.makedirs(C2PA_CERT_DIR, exist_ok=True)
    if not force and c2pa_cert_available():
        return True, "C2PA certificate already exists"

    if _have_cryptography():
        ok, msg = _c2pa_gen_cryptography()
    elif _have_openssl():
        ok, msg = _c2pa_gen_openssl()
    else:
        return False, ("Cannot generate C2PA certificate. "
                       "Install: pip install cryptography\n"
                       "Or place cert.pem and key.pem in: " + C2PA_CERT_DIR)

    return ok, msg


def _c2pa_gen_cryptography():
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
    try:
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, "RedoSan Authenticity"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "RedoSan"),
        ])
        now = datetime.now(timezone.utc)
        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now)
            .not_valid_after(now + timedelta(days=3650))
            .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
            .sign(key, hashes.SHA256())
        )
        with open(CERT_FILE, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        with open(KEY_FILE, "wb") as f:
            f.write(key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption()
            ))
        return True, "C2PA certificate generated (cryptography)"
    except Exception as e:
        return False, str(e)


def _c2pa_gen_openssl():
    subj = "/CN=RedoSan Authenticity/O=RedoSan"
    try:
        subprocess.run([
            "openssl", "req", "-x509", "-newkey", "rsa:2048",
            "-keyout", KEY_FILE, "-out", CERT_FILE,
            "-days", "3650", "-nodes", "-subj", subj
        ], check=True, capture_output=True, text=True)
        return True, "C2PA certificate generated (openssl)"
    except subprocess.CalledProcessError as e:
        return False, e.stderr.strip()
    except FileNotFoundError:
        return False, "openssl not found in PATH"


# ---------------------------------------------------------------------------
#  C2PA — Read
# ---------------------------------------------------------------------------

def c2pa_read(filepath):
    import c2pa
    ext = os.path.splitext(filepath)[1].lower()
    if ext not in C2PA_READ_EXT:
        return None, "Unsupported format for C2PA reading"
    try:
        reader = c2pa.Reader(filepath)
        data = json.loads(reader.json())
        reader.close()
        return data, None
    except (c2pa.C2paError, Exception) as e:
        msg = str(e)
        if "ManifestNotFound" in msg or "no JUMBF" in msg.lower():
            return None, None
        return None, msg
    except Exception as e:
        return None, str(e)


def c2pa_print(manifest, filepath):
    print(f"\n{'=' * 55}")
    print(f"   C2PA PROVENANCE: {os.path.basename(filepath)}")
    print(f"{'=' * 55}")
    if manifest is None:
        print("  No C2PA manifest data found")
        return
    manifests = manifest.get("manifests", {})
    active = manifest.get("active_manifest", "")
    print(f"  Active manifest: {active}")
    for label, m in manifests.items():
        active_tag = " [ACTIVE]" if label == active else ""
        print(f"\n  Manifest: {label}{active_tag}")
        gen = m.get("claim_generator", "")
        if gen:
            print(f"    Generator: {gen}")
        title = m.get("title", "")
        if title:
            print(f"    Title: {title}")
        assertions = m.get("assertions", [])
        for a in assertions:
            label_a = a.get("label", "")
            data = a.get("data", {})
            if isinstance(data, dict):
                actions = data.get("actions", [])
                for act in actions:
                    print(f"    Action: {act.get('action', '')}")
                    dsrc = act.get("digitalSourceType", "")
                    if dsrc:
                        short = dsrc.rsplit("/", 1)[-1]
                        print(f"      Source: {short}")
            print(f"    [{label_a}] {json.dumps(data, ensure_ascii=False)[:120]}")
        sig = m.get("signature_info", {})
        if sig:
            print(f"    Signed by: {sig.get('issuer', 'unknown')}")
            print(f"    Time: {sig.get('time', 'unknown')}")
    print()


# ---------------------------------------------------------------------------
#  C2PA — Build manifests
# ---------------------------------------------------------------------------

DIGITAL_SOURCE_TYPES = {
    "ai_generated":     "trainedAlgorithmicMedia",
    "ai_edited":        "algorithmicMedia",
    "digital_creation": "digitalCreation",
    "digital_capture":  "digitalCapture",
    "composite":        "composite",
    "composite_capture":"compositeCapture",
    "negative":         "negativeFilm",
    "positive":         "positiveFilm",
    "human_edited":     "minorHumanEdits",
    "data_generated":   "dataDrivenMedia",
    "virtual":          "virtualRecording",
}

# Content type options for C2PA
CONTENT_TYPE_OPTIONS = {
    "1": ("AI Generated", "trainedAlgorithmicMedia"),
    "2": ("AI Edited", "algorithmicMedia"),
    "3": ("Digital Creation", "digitalCreation"),
    "4": ("Digital Capture", "digitalCapture"),
    "5": ("Composite", "composite"),
    "6": ("Human Edited", "minorHumanEdits"),
}


def c2pa_build_manifest(
    # Section 1: Identity (Required)
    creator_name="",
    creator_id="",
    
    # Section 2: Content Origin (Required for AI content)
    digital_source="digital_creation",
    ai_model="",
    description="",
    
    # Section 3: Copyright (Required)
    rights_holder="",
    copyright_notice="",
    license_url="",
    
    # Section 4: AI Training Opt-out
    opt_out_ai_training=False,
    
    # Custom assertions (advanced use)
    custom_assertions=None
):
    """
    Build a comprehensive C2PA manifest with all provenance fields.
    
    Args:
        creator_name: Name of the content creator
        creator_id: Unique identifier (URL, ISNI, etc.)
        digital_source: Type of content origin (see CONTENT_TYPE_OPTIONS)
        ai_model: Name of AI model used (if applicable)
        description: Brief description of the content
        rights_holder: Name of the rights holder
        copyright_notice: Copyright notice text
        license_url: URL to the license (optional)
        opt_out_ai_training: Whether to opt-out of AI training
        custom_assertions: Additional custom assertions
    
    Returns:
        dict: C2PA manifest JSON structure
    """
    from datetime import datetime, timezone
    
    # Get digital source type URL
    ds_type = DIGITAL_SOURCE_TYPES.get(digital_source, "digitalCreation")
    ds_url = f"http://cv.iptc.org/newscodes/digitalsourcetype/{ds_type}"
    
    # Build timestamp
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    # Build the actions assertion
    actions_data = {
        "actions": [{
            "action": "c2pa.created",
            "when": timestamp,
            "softwareAgent": {
                "name": ai_model if ai_model else "RedoSan Authenticity",
                "version": "1.0"
            },
            "digitalSourceType": ds_url,
        }]
    }
    
    # Build the CreativeWork assertion (metadata)
    author = []
    if creator_name:
        author_info = {"@type": "Person", "name": creator_name}
        if creator_id:
            author_info["identifier"] = creator_id
        author.append(author_info)
    
    creative_work_data = {
        "@context": "https://schema.org",
        "@type": "CreativeWork"
    }
    if author:
        creative_work_data["author"] = author
    if description:
        creative_work_data["description"] = description
    if rights_holder:
        creative_work_data["copyrightHolder"] = {"@type": "Organization", "name": rights_holder}
    if copyright_notice:
        creative_work_data["copyrightNotice"] = copyright_notice
    if license_url:
        creative_work_data["license"] = license_url
    
    # Build assertions list
    assertions = [
        {"label": "c2pa.actions", "data": actions_data},
        {"label": "stds.schema-org.CreativeWork", "data": creative_work_data}
    ]
    
    # Add AI training opt-out if requested
    if opt_out_ai_training:
        assertions.append({
            "label": "cawg.training-mining",
            "data": {
                "entries": {
                    "cawg.ai_inference": {"use": "notAllowed"},
                    "cawg.ai_generative_training": {"use": "notAllowed"}
                }
            }
        })
    
    # Add custom assertions if provided
    if custom_assertions:
        assertions.extend(custom_assertions)
    
    # Build final manifest
    manifest = {
        "claim_generator": "RedoSan Authenticity/1.0",
        "claim_generator_info": [{"name": "RedoSan Authenticity", "version": "1.0"}],
        "assertions": assertions
    }
    
    return manifest


def c2pa_build_stego_manifest(algorithm="lsb", description=""):
    """Build a manifest for steganography content."""
    return c2pa_build_manifest(
        description=description or f"Data hidden using {algorithm} steganography",
        digital_source="composite",
        custom_assertions=[{
            "label": "org.redosan.stego",
            "data": {"algorithm": algorithm}
        }]
    )


def c2pa_build_do_not_train_manifest():
    return {
        "claim_generator": "RedoSan Authenticity/1.0",
        "claim_generator_info": [{"name": "RedoSan Authenticity", "version": "1.0"}],
        "assertions": [
            {
                "label": "c2pa.actions",
                "data": {
                    "actions": [{
                        "action": "c2pa.created",
                        "digitalSourceType": "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCreation",
                        "softwareAgent": {"name": "RedoSan Authenticity", "version": "1.0"},
                    }]
                }
            },
            {
                "label": "cawg.training-mining",
                "data": {
                    "entries": {
                        "cawg.ai_inference": {"use": "notAllowed"},
                        "cawg.ai_generative_training": {"use": "notAllowed"},
                    }
                }
            }
        ]
    }


# ---------------------------------------------------------------------------
#  C2PA — Write
# ---------------------------------------------------------------------------

def _find_c2patool():
    """Locate c2patool binary."""
    import shutil
    exe = shutil.which("c2patool")
    if exe:
        return exe
    # Check next to the script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    local = os.path.join(project_dir, "c2patool.exe")
    if os.path.isfile(local):
        return local
    local_nix = os.path.join(project_dir, "c2patool")
    if os.path.isfile(local_nix):
        return local_nix
    local2 = os.path.join(script_dir, "c2patool.exe")
    if os.path.isfile(local2):
        return local2
    return None


def c2pa_write(filepath, manifest_dict):
    import tempfile, subprocess, json
    ext = os.path.splitext(filepath)[1].lower()
    if ext not in C2PA_WRITE_EXT:
        return None, f"C2PA writing not supported for {ext} format"

    tool = _find_c2patool()
    if not tool:
        return None, (
            "c2patool not found.\n"
            "  Download from: https://github.com/contentauth/c2pa-rs/releases\n"
            "  Or place c2patool.exe in the tool directory."
        )

    base, ext_f = os.path.splitext(filepath)
    output = f"{base}_c2pa{ext_f}"

    # Write manifest to temp file
    fd, manifest_path = tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd, "w") as f:
        json.dump(manifest_dict, f, ensure_ascii=False, indent=2)

    try:
        r = subprocess.run(
            [tool, filepath, "-m", manifest_path, "-o", output, "-f", "--no_signing_verify"],
            capture_output=True, text=True, timeout=120
        )
        if r.returncode != 0:
            return None, r.stderr.strip() or r.stdout.strip() or f"Exit code {r.returncode}"
        return output, None
    except subprocess.TimeoutExpired:
        return None, "c2patool timed out"
    except FileNotFoundError:
        return None, "c2patool executable not found"
    except Exception as e:
        return None, str(e)
    finally:
        try:
            os.unlink(manifest_path)
        except Exception:
            pass

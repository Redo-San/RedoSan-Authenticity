"""
Multi-Layer Forensic Fingerprint Module
Creates comprehensive forensic fingerprint packages for legal evidence
"""
import os, json, hashlib, struct, datetime
from pathlib import Path

try:
    import imagehash
    from PIL import Image
    HAS_IMAGEHASH = True
except ImportError:
    HAS_IMAGEHASH = False

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

try:
    import acoustid
    HAS_ACOUSTID = True
except ImportError:
    HAS_ACOUSTID = False

try:
    from PyPDF2 import PdfReader
    HAS_PYPDF2 = True
except ImportError:
    HAS_PYPDF2 = False

try:
    import docx
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

# Comprehensive hash libraries
try:
    import blake3
    HAS_BLAKE3 = True
except ImportError:
    HAS_BLAKE3 = False

try:
    from Crypto.Hash import RIPEMD160, Whirlpool, MD2, MD4
    HAS_PYCRYPTODOME = True
except ImportError:
    HAS_PYCRYPTODOME = False


def _now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _get_file_hash(filepath, algorithm="sha256"):
    h = hashlib.new(algorithm)
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def generate_all_hashes(filepath):
    """Generate a comprehensive dictionary of all hash types for a file."""
    with open(filepath, 'rb') as f:
        data = f.read()

    hashes = {}

    # SHA-2 Family
    hashes['SHA-1'] = hashlib.sha1(data).hexdigest()
    hashes['SHA-224'] = hashlib.sha224(data).hexdigest()
    hashes['SHA-256'] = hashlib.sha256(data).hexdigest()
    hashes['SHA-384'] = hashlib.sha384(data).hexdigest()
    hashes['SHA-512'] = hashlib.sha512(data).hexdigest()

    # SHA-3 Family
    hashes['SHA-3_224'] = hashlib.sha3_224(data).hexdigest()
    hashes['SHA-3_256'] = hashlib.sha3_256(data).hexdigest()
    hashes['SHA-3_384'] = hashlib.sha3_384(data).hexdigest()
    hashes['SHA-3_512'] = hashlib.sha3_512(data).hexdigest()

    # MD Family
    hashes['MD5'] = hashlib.md5(data).hexdigest()
    if HAS_PYCRYPTODOME:
        hashes['MD2'] = MD2.new(data).hexdigest()
        hashes['MD4'] = MD4.new(data).hexdigest()
    else:
        hashes['MD2'] = 'Requires pycryptodome'
        hashes['MD4'] = 'Requires pycryptodome'

    # BLAKE2 (built into hashlib)
    hashes['BLAKE2b'] = hashlib.blake2b(data).hexdigest()
    hashes['BLAKE2s'] = hashlib.blake2s(data).hexdigest()

    # BLAKE3
    if HAS_BLAKE3:
        hashes['BLAKE3'] = blake3.blake3(data).hexdigest()
    else:
        hashes['BLAKE3'] = 'Requires blake3 module'

    # RIPEMD-160
    if HAS_PYCRYPTODOME:
        hashes['RIPEMD-160'] = RIPEMD160.new(data).hexdigest()
    else:
        hashes['RIPEMD-160'] = 'Requires pycryptodome'

    # Whirlpool
    if HAS_PYCRYPTODOME:
        hashes['Whirlpool'] = Whirlpool.new(data).hexdigest()
    else:
        hashes['Whirlpool'] = 'Requires pycryptodome'

    return hashes


def _get_image_dimensions(img_path):
    """Get image dimensions and color mode"""
    try:
        with Image.open(img_path) as img:
            return {
                "width": img.width,
                "height": img.height,
                "color_mode": img.mode,
                "format": img.format
            }
    except:
        return None


def fingerprint_image(img_path, algorithms=None):
    if not HAS_IMAGEHASH:
        return None, "imagehash not installed"
    
    if algorithms is None:
        algorithms = ["ahash", "dhash", "phash", "whash", "sha256"]
    
    result = {}
    try:
        img = Image.open(img_path)
        if "ahash" in algorithms:
            result["ahash"] = str(imagehash.average_hash(img))
        if "dhash" in algorithms:
            result["dhash"] = str(imagehash.dhash(img))
        if "phash" in algorithms:
            result["phash"] = str(imagehash.phash(img))
        if "whash" in algorithms:
            result["whash"] = str(imagehash.whash(img))
        if "sha256" in algorithms:
            result["sha256"] = _get_file_hash(img_path, "sha256")
        
        result["file_type"] = "image"
    except Exception as e:
        return None, str(e)
    
    return result, None


def fingerprint_video(video_path, frame_interval=1, max_frames=30):
    if not HAS_CV2:
        return None, "opencv-python not installed"
    
    result = {}
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return None, "Cannot open video"
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        frame_hashes = []
        frame_idx = 0
        extracted = 0
        
        while extracted < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_idx % (frame_interval * int(fps)) == 0:
                if HAS_IMAGEHASH:
                    img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    phash = str(imagehash.phash(img))
                    frame_hashes.append(phash)
                    extracted += 1
                
                if extracted >= max_frames:
                    break
            
            frame_idx += 1
        
        cap.release()
        
        result["fps"] = fps
        result["total_frames"] = total_frames
        result["extracted_frames"] = extracted
        result["frame_hashes"] = frame_hashes
        
        if frame_hashes:
            combined = "".join(frame_hashes)
            result["combined_phash"] = hashlib.sha256(combined.encode()).hexdigest()[:64]
        
        result["sha256"] = _get_file_hash(video_path, "sha256")
        result["file_type"] = "video"
        
    except Exception as e:
        return None, str(e)
    
    return result, None


def fingerprint_audio(audio_path):
    if not HAS_ACOUSTID:
        return None, "acoustid not installed"
    
    result = {}
    try:
        fp, duration = acoustid.fingerprint_file(audio_path)
        result["fingerprint"] = fp
        result["duration"] = duration
        result["sha256"] = _get_file_hash(audio_path, "sha256")
        result["file_type"] = "audio"
    except Exception as e:
        return None, f"acoustid error: {e}"
    
    return result, None


def fingerprint_document(doc_path):
    result = {}
    ext = Path(doc_path).suffix.lower()
    
    result["sha256"] = _get_file_hash(doc_path, "sha256")
    result["sha512"] = _get_file_hash(doc_path, "sha512")
    
    text_content = []
    
    if ext == ".pdf" and HAS_PYPDF2:
        try:
            reader = PdfReader(doc_path)
            for page in reader.pages:
                text_content.append(page.extract_text())
        except Exception as e:
            return None, f"PDF error: {e}"
    
    elif ext in [".docx", ".doc"] and HAS_DOCX:
        try:
            doc = docx.Document(doc_path)
            for para in doc.paragraphs:
                text_content.append(para.text)
        except Exception as e:
            return None, f"DOCX error: {e}"
    
    elif ext in [".txt", ".md", ".py", ".js", ".html", ".css", ".json", ".xml"]:
        try:
            with open(doc_path, "r", encoding="utf-8", errors="ignore") as f:
                text_content.append(f.read())
        except Exception as e:
            return None, f"Text read error: {e}"
    
    full_text = "\n".join(text_content)
    
    if full_text.strip():
        text_hash = hashlib.sha256(full_text.encode("utf-8")).hexdigest()
        result["text_hash"] = text_hash
        result["text_length"] = len(full_text)
        
        if HAS_IMAGEHASH:
            try:
                img = Image.new("L", (256, 256), color=255)
                from PIL import ImageDraw
                draw = ImageDraw.Draw(img)
                text_sample = full_text[:4096]
                draw.text((10, 10), text_sample[:500], fill=0)
                result["imagehash"] = str(imagehash.average_hash(img))
            except:
                pass
    
    result["file_type"] = "document"
    return result, None


def fingerprint_file(file_path, types=None):
    if not os.path.isfile(file_path):
        return None, "File not found"
    
    ext = Path(file_path).suffix.lower()
    image_exts = [".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tiff", ".webp"]
    video_exts = [".mp4", ".avi", ".mov", ".mkv", ".flv", ".wmv"]
    audio_exts = [".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".wma"]
    doc_exts = [".pdf", ".docx", ".doc", ".txt", ".md", ".py", ".js", ".html", ".css", ".json", ".xml", ".rtf"]
    
    file_type = None
    if ext in image_exts:
        file_type = "image"
    elif ext in video_exts:
        file_type = "video"
    elif ext in audio_exts:
        file_type = "audio"
    elif ext in doc_exts:
        file_type = "document"
    else:
        return None, f"Unsupported file type: {ext}"
    
    if types and file_type not in types:
        return None, f"Skipping {file_type}"
    
    if file_type == "image":
        return fingerprint_image(file_path)
    elif file_type == "video":
        return fingerprint_video(file_path)
    elif file_type == "audio":
        return fingerprint_audio(file_path)
    elif file_type == "document":
        return fingerprint_document(file_path)
    
    return None, "Unknown error"


def create_forensic_fingerprint(file_path, protection_data=None, provenance_data=None, forensic_data=None):
    """
    Create comprehensive multi-layer forensic fingerprint package
    """
    fp, err = fingerprint_file(file_path)
    if err:
        return None, err
    
    # Get basic file info
    stat = os.stat(file_path)
    dims = _get_image_dimensions(file_path) if fp.get("file_type") == "image" else None
    
    # Auto-detect C2PA if available
    c2pa_data = None
    c2pa_detected = False
    try:
        from modules import provenance as prov_mod
        c2pa_data, c2pa_err = prov_mod.c2pa_read(file_path)
        if c2pa_data:
            c2pa_detected = True
    except:
        pass
    
    # Auto-detect from C2PA
    ai_generated = None
    detected_watermark = None
    software_used = []
    creation_steps = []
    
    if c2pa_data:
        manifests = c2pa_data.get("manifests", {})
        active = c2pa_data.get("active_manifest", "")
        if active and active in manifests:
            m = manifests[active]
            
            # Detect AI generation from claim_generator
            generator_info = m.get("claim_generator_info", [])
            for gen in generator_info:
                gen_name = gen.get("name", "")
                software_used.append(gen_name)
                
                # AI generators detection
                ai_keywords = ["AI", "Artificial", "Gemini", "DALL-E", "Midjourney", "Stable Diffusion", "OpenAI", "Google AI", "Meta AI", "Generator", "Core", "Media Processing"]
                if any(kw.lower() in gen_name.lower() for kw in ai_keywords):
                    ai_generated = True
            
            # Extract actions
            assertions = m.get("assertions", [])
            for assertion in assertions:
                if assertion.get("label") == "c2pa.actions.v2":
                    actions_data = assertion.get("data", {})
                    actions_list = actions_data.get("actions", [])
                    for action in actions_list:
                        act_name = action.get("action", "")
                        desc = action.get("description", "")
                        if desc:
                            creation_steps.append(f"{act_name}: {desc}")
                        else:
                            creation_steps.append(act_name)
                        
                        # Detect watermark
                        if "watermark" in desc.lower():
                            detected_watermark = desc
    
    # Build comprehensive package
    package = {
        "version": "1.0",
        "tool": "RedoSan Authenticity",
        "timestamp_created": _now_iso(),
        
        # Layer 1: Basic File Info
        "file_info": {
            "file_name": os.path.basename(file_path),
            "file_path": os.path.abspath(file_path),
            "file_size_bytes": stat.st_size,
            "file_size_mb": round(stat.st_size / (1024 * 1024), 4),
            "date_created": datetime.datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "date_modified": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
        },
        
        # Layer 2: Protection Metadata (auto-detect C2PA)
        "protection": {
            "watermarked": bool(detected_watermark),
            "watermark_type": detected_watermark,
            "c2pa_signed": c2pa_detected,
            "c2pa_manifest": c2pa_data.get("active_manifest") if c2pa_data else None,
            "ots_timestamped": False,
            "certificate_signed": False,
            "protection_date": _now_iso() if c2pa_detected else None
        },
        
        # Layer 3: Provenance Chain (auto-detect from C2PA)
        "provenance": {
            "creator": None,
            "creator_id": c2pa_data.get("active_manifest") if c2pa_data else None,
            "software_used": software_used,
            "creation_steps": creation_steps,
            "parent_file": None,
            "previous_version_hash": None
        },
        
        # Layer 4: Fingerprints
        "fingerprints": fp,
        
        # Layer 5: Forensic Analysis
        "forensic_analysis": {
            "detected_ai_generated": ai_generated,
            "detected_watermark": detected_watermark,
            "software_from_c2pa": software_used,
            "actions_from_c2pa": creation_steps,
            "unique_artifacts": [],
            "analysis_date": _now_iso() if c2pa_detected else None
        },
        
        "file_type": fp.get("file_type", "unknown"),
        "signature": None  # Will be added if signing
    }
    
    package = {
        "version": "1.0",
        "tool": "RedoSan Authenticity",
        "timestamp_created": _now_iso(),
        
        # Layer 1: Basic File Info
        "file_info": {
            "file_name": os.path.basename(file_path),
            "file_path": os.path.abspath(file_path),
            "file_size_bytes": stat.st_size,
            "file_size_mb": round(stat.st_size / (1024 * 1024), 4),
            "date_created": datetime.datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "date_modified": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
        },
        
        # Layer 2: Protection Metadata (auto-detect C2PA)
        "protection": protection_data or {
            "watermarked": bool(detected_watermark),
            "watermark_type": detected_watermark,
            "c2pa_signed": c2pa_detected,
            "c2pa_manifest": c2pa_data.get("active_manifest") if c2pa_data else None,
            "ots_timestamped": False,
            "certificate_signed": False,
            "protection_date": _now_iso() if c2pa_detected else None
        },
        
        # Layer 3: Provenance Chain (auto-detect from C2PA)
        "provenance": provenance_data or {
            "creator": None,
            "creator_id": c2pa_data.get("active_manifest") if c2pa_data else None,
            "software_used": software_used,
            "creation_steps": creation_steps,
            "parent_file": None,
            "previous_version_hash": None
        },
        
        # Layer 4: Fingerprints
        "fingerprints": fp,
        
        # Layer 5: Forensic Analysis
        "forensic_analysis": forensic_data or {
            "detected_ai_generated": ai_generated,
            "detected_watermark": detected_watermark,
            "software_from_c2pa": software_used,
            "actions_from_c2pa": creation_steps,
            "unique_artifacts": [],
            "analysis_date": _now_iso() if c2pa_detected else None
        },
        
        "file_type": fp.get("file_type", "unknown"),
        "signature": None  # Will be added if signing
    }
    
    # Add dimensions for images
    if dims:
        package["file_info"]["dimensions"] = dims
    
    return package, None


def save_forensic_fingerprint(file_path, output_path=None, protection_data=None, provenance_data=None, forensic_data=None):
    """Save comprehensive forensic fingerprint package"""
    package, err = create_forensic_fingerprint(
        file_path, 
        protection_data, 
        provenance_data, 
        forensic_data
    )
    if err:
        return False, err
    
    if output_path is None:
        output_path = file_path + ".forensic.json"
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(package, f, indent=2, ensure_ascii=False)
    
    return True, output_path


def sign_forensic_fingerprint(fingerprint_path, private_key_path):
    """Sign the fingerprint package"""
    try:
        from modules import certification as cert_mod
        
        with open(fingerprint_path, "r", encoding="utf-8") as f:
            package = json.load(f)
        
        # Sign the entire package
        json_str = json.dumps(package, indent=2)
        signature = cert_mod.sign_data(json_str, private_key_path)
        
        if signature:
            package["signature"] = signature
            package["signature_date"] = _now_iso()
            
            with open(fingerprint_path, "w", encoding="utf-8") as f:
                json.dump(package, f, indent=2, ensure_ascii=False)
            
            return True, None
        
        return False, "Signing failed"
    
    except Exception as e:
        return False, str(e)


def verify_forensic_fingerprint(fingerprint_path, public_key_path):
    """Verify the fingerprint signature"""
    try:
        from modules import certification as cert_mod
        
        with open(fingerprint_path, "r", encoding="utf-8") as f:
            package = json.load(f)
        
        signature = package.get("signature")
        if not signature:
            return False, "No signature found"
        
        # Remove signature for verification
        verify_data = package.copy()
        verify_data.pop("signature", None)
        verify_data.pop("signature_date", None)
        
        json_str = json.dumps(verify_data, indent=2)
        
        return cert_mod.verify_signature(json_str, signature, public_key_path), None
    
    except Exception as e:
        return False, str(e)


def generate_perceptual_hashes(img_path):
    """Generate perceptual image hashes. Returns dict or empty dict on failure."""
    if not HAS_IMAGEHASH:
        return {}
    try:
        img = Image.open(img_path)
        ph = {
            'ahash': str(imagehash.average_hash(img)),
            'dhash': str(imagehash.dhash(img)),
            'phash': str(imagehash.phash(img)),
        }
        try:
            ph['whash'] = str(imagehash.whash(img))
        except Exception:
            pass
        img.close()
        return ph
    except Exception:
        return {}


# Legacy function for compatibility
def save_fingerprint(file_path, output_path=None):
    """Save comprehensive fingerprint with all hash families."""
    fp, err = fingerprint_file(file_path)
    if err:
        return False, err
    
    if output_path is None:
        output_path = file_path + ".fingerprint.json"
    
    stat = os.stat(file_path)
    ext = Path(file_path).suffix.lower()
    img_exts = {'.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff', '.webp'}
    
    package = {
        "version": "2.0",
        "tool": "RedoSan Authenticity",
        "timestamp": _now_iso(),
        "file_info": {
            "file_name": os.path.basename(file_path),
            "file_path": os.path.abspath(file_path),
            "file_size_bytes": stat.st_size,
            "file_type": fp.get("file_type", "unknown"),
        },
        "hashes": generate_all_hashes(file_path),
        "perceptual_hashes": generate_perceptual_hashes(file_path) if ext in img_exts else {},
    }
    
    if ext in img_exts:
        dims = _get_image_dimensions(file_path)
        if dims:
            package["file_info"]["dimensions"] = dims
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(package, f, indent=2, ensure_ascii=False)
    
    return True, output_path
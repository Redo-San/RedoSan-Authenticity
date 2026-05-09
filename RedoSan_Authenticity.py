#!/usr/bin/env python3
import os, sys, hashlib, subprocess, platform, shutil, json, argparse

__version__ = "1.0.0"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OTS_SCRIPT = os.path.join(SCRIPT_DIR, "modules", "ots_stamp.py")


# -----------------------------------------------------------------------
#  Lazy module loading - don't import until needed
# -----------------------------------------------------------------------
MODULES = {}

def _load_module(name, import_path):
    """Lazy load a module when needed."""
    if name in MODULES and MODULES[name] is not None:
        return MODULES[name]
    try:
        mod = __import__(import_path, fromlist=[name])
        MODULES[name] = mod
    except ImportError as e:
        MODULES[name] = None
        MODULES[f"_{name}_error"] = str(e)
    return MODULES.get(name)

def get_module(name):
    """Get module by name, loading it if not already loaded."""
    return _load_module(name, f"modules.{name}")


def has_module(name):
    if name not in MODULES:
        _load_module(name, f"modules.{name}")
    return MODULES.get(name) is not None

def module_error(name):
    if name not in MODULES and f"_{name}_error" not in MODULES:
        _load_module(name, f"modules.{name}")
    return MODULES.get(f"_{name}_error", "")


# -----------------------------------------------------------------------
#  Dependency auto-detection
# -----------------------------------------------------------------------

def find_openstego_jar():
    path = os.environ.get("OPENSTEGO_JAR", "")
    if path and os.path.isfile(path):
        return path
    local = os.path.join(SCRIPT_DIR, "openstego.jar")
    if os.path.isfile(local):
        return local
    syst = platform.system()
    pre = [r"C:\Program Files (x86)\OpenStego\lib\openstego.jar",
           r"C:\Program Files\OpenStego\lib\openstego.jar"] if syst == "Windows" else (
        ["/Applications/OpenStego/lib/openstego.jar",
         "/usr/local/share/openstego/lib/openstego.jar",
         "/usr/share/openstego/lib/openstego.jar",
         "/opt/openstego/lib/openstego.jar"] if syst == "Darwin" else
        ["/usr/local/share/openstego/lib/openstego.jar",
         "/usr/share/openstego/lib/openstego.jar",
         "/opt/openstego/lib/openstego.jar"])
    for p in pre:
        if os.path.isfile(p):
            return p
    return None


def find_java():
    try:
        subprocess.run(["java", "-version"], capture_output=True, check=True)
        return "java"
    except (FileNotFoundError, subprocess.CalledProcessError):
        jh = os.environ.get("JAVA_HOME", "")
        if jh:
            exe = os.path.join(jh, "bin", "java.exe" if platform.system() == "Windows" else "java")
            if os.path.isfile(exe):
                return exe
    return None


def find_ffmpeg():
    syst = platform.system()
    # Try system PATH first
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return "ffmpeg"
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass
    
    # Try common install locations (Windows)
    if syst == "Windows":
        paths = [
            os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"), "ffmpeg", "bin", "ffmpeg.exe"),
            os.path.join(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"), "ffmpeg", "bin", "ffmpeg.exe"),
            "C:\\ffmpeg\\bin\\ffmpeg.exe",
            "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
        ]
        for p in paths:
            if os.path.isfile(p):
                return p
    
    # Try common locations (Linux/Mac)
    if syst in ("Linux", "Darwin"):
        paths = [
            "/usr/bin/ffmpeg",
            "/usr/local/bin/ffmpeg",
            "/opt/homebrew/bin/ffmpeg",
            "/opt/homebrew/Cellar/ffmpeg/*/bin/ffmpeg",
        ]
        import glob as _g
        for p in paths:
            matches = glob(p) if "*" in p else ([p] if os.path.isfile(p) else [])
            for m in matches:
                if os.path.isfile(m):
                    return m
    
    return None


def check_pip_packages():
    try:
        import opentimestamps.calendar  # noqa
        return True
    except ImportError:
        return False


# -----------------------------------------------------------------------
#  Helpers
# -----------------------------------------------------------------------

def _s(path):
    return path.strip().strip("\"'")


def hash_file(path):
    """Return (sha1, sha256, sha512) hex digests for a file."""
    h1 = hashlib.sha1()
    h256 = hashlib.sha256()
    h512 = hashlib.sha512()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h1.update(chunk)
            h256.update(chunk)
            h512.update(chunk)
    return h1.hexdigest(), h256.hexdigest(), h512.hexdigest()


def save_hashes(path, name):
    """Save triple-hash files (.sha1, .sha256, .sha512) for path."""
    sha1, sha256, sha512 = hash_file(path)
    bn = os.path.basename(name or path)
    with open(path + ".sha1.txt", "w") as f:
        f.write(f"{sha1}  {bn}\n")
    with open(path + ".sha256.txt", "w") as f:
        f.write(f"{sha256}  {bn}\n")
    with open(path + ".sha512.txt", "w") as f:
        f.write(f"{sha512}  {bn}\n")
    return sha1, sha256, sha512


def run_java(jar, args):
    return subprocess.run(
        ["java", "-jar", jar] + args,
        capture_output=True, text=True
    )


def run_ots(args):
    if len(args) < 2:
        print("Usage: stamp|verify <file>")
        return subprocess.CompletedProcess(args, 1, "")
    cmd, filepath = args[0], args[1]

    # Find a working Python with opentimestamps installed
    py_exe = None
    for name in ["python", "py", "python3"]:
        try:
            r = subprocess.run([name, "-c", "import opentimestamps"], capture_output=True, text=True, timeout=10)
            if r.returncode == 0:
                py_exe = name
                break
        except:
            pass
    if not py_exe:
        try:
            r = subprocess.run(["py", "-3", "-c", "import opentimestamps"], capture_output=True, text=True, timeout=10)
            if r.returncode == 0:
                py_exe = "py -3"
        except:
            pass

    if not py_exe:
        print("ERROR: No Python with opentimestamps module found")
        print("Install: pip install opentimestamps")
        return subprocess.CompletedProcess(args, 1, "")

    # Find ots_stamp.py
    script = OTS_SCRIPT
    if not os.path.isfile(script):
        if getattr(sys, 'frozen', False):
            alt = os.path.join(sys._MEIPASS, 'modules', 'ots_stamp.py')
            if os.path.isfile(alt):
                script = alt
    if not os.path.isfile(script):
        print("ERROR: modules/ots_stamp.py not found")
        return subprocess.CompletedProcess(args, 1, "")

    # Run as subprocess
    full_cmd = [py_exe] + (["-3"] if py_exe == "py" else []) + [script] + args
    print(f"  Python: {py_exe}")
    r = subprocess.run(full_cmd, capture_output=True, text=True)
    if r.stdout:
        print(r.stdout.strip())
    if r.stderr:
        print(f"  {r.stderr.strip()}")
    return r


def h1(t):
    print(f"\n{'=' * 55}\n   {t}\n{'=' * 55}")


def pause():
    print(f"\n{'-' * 55}")
    input("Press Enter to continue...")


def _prompt_export(data, default_name, format_hint=""):
    """Ask user if they want to export metadata as TXT or JSON."""
    inp = input(f"\nExport to file? (txt/json/N): ").strip().lower()
    if inp not in ("txt", "json"):
        return
    out = _s(input(f"Output path (Enter = {default_name}.{inp}): "))
    if not out:
        out = f"{default_name}.{inp}"
    try:
        with open(out, "w", encoding="utf-8") as f:
            if inp == "json":
                import json
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
            else:
                if isinstance(data, str):
                    f.write(data)
                elif isinstance(data, dict):
                    for k, v in _flatten_dict(data).items():
                        f.write(f"{k}: {v}\n")
                else:
                    f.write(str(data))
        print(f"  Exported to: {out}")
    except Exception as e:
        print(f"  Export error: {e}")


def _flatten_dict(d, prefix=""):
    items = []
    for k, v in d.items():
        tag = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.extend(_flatten_dict(v, tag).items())
        elif isinstance(v, list):
            items.append((tag, json.dumps(v, ensure_ascii=False, default=str)[:300]))
        else:
            items.append((tag, str(v)))
    return dict(items)


# -----------------------------------------------------------------------
#  Dependency check
# -----------------------------------------------------------------------

DEP_WARNINGS = []


def check_deps():
    global DEP_WARNINGS
    DEP_WARNINGS = []
    ok = True

    if not check_pip_packages():
        DEP_WARNINGS.append(
            "Python packages missing: opentimestamps\n"
            "  Install:  pip install opentimestamps opentimestamps-client"
        )
        ok = False

    java = find_java()
    if not java:
        DEP_WARNINGS.append(
            "Java not found.\n"
            "  Install Java JRE 8+ from: https://www.java.com/download/"
        )
        ok = False

    jar = find_openstego_jar()
    if not jar:
        DEP_WARNINGS.append(
            "OpenStego JAR not found.\n"
            "  Download from: https://www.openstego.com/\n"
            "  Or set env:  set OPENSTEGO_JAR=C:\\path\\to\\openstego.jar"
        )

    if DEP_WARNINGS:
        print("\n" + "#" * 55)
        print("  DEPENDENCY CHECK")
        print("#" * 55)
        for w in DEP_WARNINGS:
            print(f"\n  [!] {w}")
        print()
    return ok


# -----------------------------------------------------------------------
#  Feature functions
# -----------------------------------------------------------------------

def feature_hide_timestamp(jar):
    h1("HIDE SECRET IN IMAGE + TIMESTAMP")
    cover = _s(input("Cover image path: "))
    secret = _s(input("Secret file path: "))
    output = _s(input("Output image path (Enter = auto): "))
    if not output:
        base, ext = os.path.splitext(cover)
        output = f"{base}_stego{ext}"
    pw = input("Password (Enter = none): ").strip()

    if not os.path.exists(cover):
        return print("ERROR: Cover image not found")
    if not os.path.exists(secret):
        return print("ERROR: Secret file not found")

    print("\n[1/3] Hiding secret in image...")
    args = ["embed", "-a", "RandomLSB", "-mf", secret, "-cf", cover, "-sf", output]
    if pw:
        args += ["-e", "-p", pw]
    r = run_java(jar, args)
    if r.returncode != 0:
        return print(f"ERROR: OpenStego failed:\n{r.stderr}")
    print(f"       Done: {output}")

    print("\n[2/3] Saving hashes (SHA1, SHA256, SHA512)...")
    save_hashes(output, output)
    print(f"       Saved: {output}.sha1.txt")
    print(f"       Saved: {output}.sha256.txt")
    print(f"       Saved: {output}.sha512.txt")

    print("\n[3/3] Creating timestamp proof...")
    r2 = run_ots(["stamp", output])
    if r2.returncode == 0:
        print(f"       OTS: {output}.ots")
        print("\n*** SUCCESS: Secret hidden & timestamped ***")
    else:
        print("WARNING: Timestamp failed")


def feature_extract_verify(jar):
    h1("EXTRACT SECRET + VERIFY TIMESTAMP")
    stego = _s(input("Stego image path: "))
    outdir = _s(input("Extract to directory (Enter = current): "))
    if not outdir:
        outdir = os.path.dirname(stego) or "."
    pw = input("Password (Enter = none): ").strip()

    if not os.path.exists(stego):
        return print("ERROR: Stego image not found")

    print("\n[1/2] Verifying timestamp integrity...")
    if os.path.exists(stego + ".ots"):
        r = run_ots(["verify", stego])
        if r.returncode != 0:
            print("ERROR: Verification failed")
    else:
        print("       No .ots file found, skipping verification")

    print("\n[2/2] Extracting hidden data...")
    args = ["extract", "-a", "RandomLSB", "-sf", stego, "-xd", outdir]
    if pw:
        args += ["-p", pw]
    r = run_java(jar, args)
    if r.returncode == 0:
        print(f"       Extracted to: {outdir}")
    else:
        print(f"ERROR: Extraction failed:\n{r.stderr}")


def feature_timestamp():
    h1("TIMESTAMP A FILE")
    path = _s(input("File path: "))
    if not os.path.exists(path):
        return print("ERROR: File not found")
    print("\n[1/2] Calculating hashes (SHA1, SHA256, SHA512)...")
    save_hashes(path, path)
    print(f"       Saved: {path}.sha1.txt, .sha256.txt, .sha512.txt")
    print("\n[2/2] Creating timestamp proof...")
    r = run_ots(["stamp", path])
    if r.returncode == 0:
        print("*** SUCCESS ***")
    else:
        print("ERROR: Timestamp failed")


def feature_verify():
    h1("VERIFY TIMESTAMP INTEGRITY")
    path = _s(input("File path: "))
    if not os.path.exists(path):
        return print("ERROR: File not found")
    r = run_ots(["verify", path])
    if r.returncode != 0:
        print("ERROR: Verification failed")


def feature_watermark_timestamp(jar):
    h1("WATERMARK IMAGE + TIMESTAMP")
    sig = _s(input("Signature file path: "))
    cover = _s(input("Cover image path: "))
    output = _s(input("Output image path (Enter = auto): "))
    if not output:
        base, ext = os.path.splitext(cover)
        output = f"{base}_watermarked{ext}"

    if not os.path.exists(sig):
        return print("ERROR: Signature not found")
    if not os.path.exists(cover):
        return print("ERROR: Cover image not found")

    print("\n[1/3] Watermarking image...")
    r = run_java(jar, ["embedmark", "-a", "DWTDugad", "-gf", sig, "-cf", cover, "-sf", output])
    if r.returncode != 0:
        return print(f"ERROR: OpenStego failed:\n{r.stderr}")
    print(f"       Done: {output}")

    print("\n[2/3] Saving hashes (SHA1, SHA256, SHA512)...")
    save_hashes(output, output)
    print(f"       Saved: {output}.sha1.txt, .sha256.txt, .sha512.txt")

    print("\n[3/3] Creating timestamp proof...")
    r2 = run_ots(["stamp", output])
    if r2.returncode == 0:
        print("*** SUCCESS ***")
    else:
        print("WARNING: Timestamp failed")


def feature_gen_signature(jar):
    h1("GENERATE WATERMARK SIGNATURE")
    sig = _s(input("Output signature file path: "))
    if not sig:
        return print("ERROR: No path specified")
    pw = input("Password (Enter = none): ").strip()
    print("\nGenerating signature...")
    args = ["gensig", "-a", "DWTDugad", "-gf", sig]
    r = run_java(jar, args)
    if r.returncode == 0:
        print(f"       Signature saved to: {sig}")
    else:
        print(f"ERROR: {r.stderr.strip()}")


def feature_check_watermark(jar):
    h1("CHECK WATERMARK")
    sig = _s(input("Signature file: "))
    stego = _s(input("Stego image: "))
    if not os.path.exists(sig):
        return print("ERROR: Signature not found")
    if not os.path.exists(stego):
        return print("ERROR: Image not found")
    r = run_java(jar, ["checkmark", "-a", "DWTDugad", "-gf", sig, "-sf", stego])
    print(r.stdout.strip() or "       Done")
    if r.stderr:
        print(r.stderr.strip())


# -----------------------------------------------------------------------
#  Watermark type features (pure Python, no OpenStego needed)
# -----------------------------------------------------------------------

def feature_wt_list():
    h1("WATERMARK TYPES")
    if not has_module("watermark"):
        print("ERROR: Watermark module not available"); return
    print(MODULES["watermark"].list_watermarks())


def feature_wt_embed():
    h1("WATERMARK EMBED")
    if not has_module("watermark"):
        print("ERROR: Watermark module not available"); return
    MODULES["watermark"].list_watermarks()
    print()
    wtype = _s(input("Watermark type (1-9): "))
    try:
        wtype = int(wtype)
    except ValueError:
        return print("ERROR: Invalid type")
    cover = _s(input("Cover image path: "))
    secret = _s(input("Secret file path: "))
    output = _s(input("Output image path (Enter = auto): "))
    if not output:
        base, ext = os.path.splitext(cover)
        output = f"{base}_wm{ext}"
    pw = input("Password (Enter = none): ").strip()

    if not os.path.exists(cover):
        return print("ERROR: Cover image not found")
    if not os.path.exists(secret):
        return print("ERROR: Secret file not found")

    print(f"\nEmbedding type {wtype}...")
    ok, msg = MODULES["watermark"].embed(wtype, cover, secret, output, pw or None)
    print(f"\n  {'SUCCESS' if ok else 'ERROR'}: {msg}")


def feature_wt_extract():
    h1("WATERMARK EXTRACT")
    if not has_module("watermark"):
        print("ERROR: Watermark module not available"); return
    wtype = _s(input("Watermark type (1-9): "))
    try:
        wtype = int(wtype)
    except ValueError:
        return print("ERROR: Invalid type")
    stego = _s(input("Stego image path: "))
    outdir = _s(input("Extract to directory (Enter = auto): "))
    if not outdir:
        outdir = os.path.dirname(stego) or "."
    pw = input("Password (Enter = none): ").strip()

    if not os.path.exists(stego):
        return print("ERROR: Stego image not found")

    print(f"\nExtracting type {wtype}...")
    ok, msg = MODULES["watermark"].extract(wtype, stego, outdir, pw or None)
    print(f"\n  {'SUCCESS' if ok else 'ERROR'}: {msg}")


def feature_wt_describe():
    h1("WATERMARK DESCRIPTION")
    if not has_module("watermark"):
        print("ERROR: Watermark module not available"); return
    wtype = _s(input("Watermark type (1-9): "))
    try:
        wtype = int(wtype)
    except ValueError:
        return print("ERROR: Invalid type")
    print(MODULES["watermark"].describe_watermark(wtype))


def cmd_fingerprint(file_path, output=None, file_type=None):
    if not os.path.isfile(file_path):
        return print(f"ERROR: File not found: {file_path}")
    if not has_module("fingerprint"):
        return print("ERROR: Fingerprint module not available. Install: pip install imagehash opencv-python")
    
    print(f"\n[1/2] Extracting forensic fingerprint from {os.path.basename(file_path)}...")
    fp_mod = MODULES["fingerprint"]
    
    # Use new forensic format
    package, err = fp_mod.create_forensic_fingerprint(file_path)
    if err:
        return print(f"ERROR: {err}")
    
    fp = package.get("fingerprints", {})
    
    print(f"  SHA256: {fp.get('sha256', 'N/A')[:32]}...")
    print(f"  File Type: {package.get('file_type')}")
    print(f"  Size: {package.get('file_info', {}).get('file_size_mb')} MB")
    
    if "ahash" in fp:
        print(f"  AHash: {fp['ahash']}")
    if "dhash" in fp:
        print(f"  DHash: {fp['dhash']}")
    if "phash" in fp:
        print(f"  PHash: {fp['phash']}")
    
    print(f"\n[2/2] Saving forensic package to JSON...")
    if output is None:
        output = file_path + ".forensic.json"
    elif not output.endswith(".forensic.json"):
        output = output.replace(".json", ".forensic.json")
    
    import json
    with open(output, "w", encoding="utf-8") as f:
        json.dump(package, f, indent=2, ensure_ascii=False)
    
    print(f"  Saved: {output}")
    print("\n*** FORENSIC FINGERPRINT GENERATED ***")
    print("Layers: file_info, fingerprints, protection, provenance, forensic_analysis")


def cmd_certify(file_path, key_dir, output, skip_fp):
    if not has_module("certification"):
        return print("ERROR: Certification module not available. Install: pip install cryptography")
    if not has_module("fingerprint"):
        return print("ERROR: Fingerprint module not available")
    
    if key_dir is None:
        key_dir = ".keys"
    
    priv_key = os.path.join(key_dir, "cert_private.key")
    pub_key = os.path.join(key_dir, "cert_public.pem")
    
    if not os.path.isfile(priv_key):
        return print(f"ERROR: Private key not found. Run: python RedoSan_Authenticity.py certify-init -k {key_dir}")
    if not os.path.isfile(pub_key):
        return print(f"ERROR: Public key not found: {pub_key}")
    
    if not os.path.isfile(file_path):
        return print(f"ERROR: File not found: {file_path}")
    
    print(f"\n[1/3] Generating fingerprint...")
    fp_mod = MODULES["fingerprint"]
    fp, err = fp_mod.fingerprint_file(file_path)
    if err:
        return print(f"ERROR: {err}")
    
    print(f"  SHA256: {fp.get('sha256', '')[:32]}...")
    
    print(f"\n[2/3] Creating certificate...")
    cert_mod = MODULES["certification"]
    cert_path, err = cert_mod.create_certificate_package(
        file_path, fp, priv_key, pub_key, os.path.dirname(file_path) or "."
    )
    if err:
        return print(f"ERROR: {err}")
    
    print(f"  Certificate: {os.path.basename(cert_path)}")
    
    print(f"\n[3/3] Timestamping certificate...")
    r = run_ots(["stamp", cert_path])
    if r.returncode == 0:
        print(f"  OTS: {os.path.basename(cert_path)}.ots")
    else:
        print("  WARNING: Timestamp failed")
    
    print("\n*** CERTIFICATE CREATED ***")


def cmd_certify_verify(cert_path, key_dir):
    if not has_module("certification"):
        return print("ERROR: Certification module not available")
    
    if key_dir is None:
        key_dir = ".keys"
    
    pub_key = os.path.join(key_dir, "cert_public.pem")
    
    if not os.path.isfile(cert_path):
        return print(f"ERROR: Certificate not found: {cert_path}")
    if not os.path.isfile(pub_key):
        return print(f"ERROR: Public key not found.")
    
    print(f"\n[1/1] Verifying certificate...")
    cert_mod = MODULES["certification"]
    is_valid, cert_data = cert_mod.verify_certificate_package(cert_path, pub_key)
    
    if is_valid:
        print("  SIGNATURE: VALID")
        print(f"  File: {cert_data.get('file_name', 'N/A')}")
        print(f"  SHA256: {cert_data.get('sha256', 'N/A')[:32]}...")
        print(f"  Created: {cert_data.get('created_at', 'N/A')}")
        print(f"  Issuer: {cert_data.get('issuer', 'N/A')}")
        print("\n*** CERTIFICATE VERIFIED ***")
    else:
        print(f"  SIGNATURE: INVALID")
        print(f"  Error: {cert_data}")


def cmd_certify_init(key_dir, force):
    if not has_module("certification"):
        return print("ERROR: Certification module not available. Install: pip install cryptography")
    
    if key_dir is None:
        key_dir = ".keys"
    
    priv_key = os.path.join(key_dir, "cert_private.key")
    
    if os.path.isfile(priv_key) and not force:
        return print(f"ERROR: Keys already exist in {key_dir}. Use -f to force regenerate.")
    
    print(f"\n[1/1] Initializing certification system...")
    cert_mod = MODULES["certification"]
    result, err = cert_mod.init_certification_system(key_dir)
    
    if err:
        return print(f"ERROR: {err}")
    
    print(f"  Private Key: {result.get('private_key')}")
    print(f"  Public Key: {result.get('public_key')}")
    print(f"  Certificate: {result.get('certificate')}")
    print("\n*** CERTIFICATION SYSTEM INITIALIZED ***")
    print("IMPORTANT: Keep your private key safe!")


def cmd_log_create(initial_file, description, output):
    if not has_module("creative_log"):
        return print("ERROR: Creative log module not available")
    
    if not os.path.isfile(initial_file):
        return print(f"ERROR: File not found: {initial_file}")
    
    print(f"\n[1/1] Creating creative log for {os.path.basename(initial_file)}...")
    cl_mod = MODULES["creative_log"]
    path, err = cl_mod.create_log(initial_file, description or "")
    
    if err:
        return print(f"ERROR: {err}")
    
    print(f"  Log created: {path}")
    print("\n*** CREATIVE LOG STARTED ***")
    print("Use 'log-add-step' to add editing steps")


def cmd_log_add_step(log_path, action, tool, description, file_path):
    if not has_module("creative_log"):
        return print("ERROR: Creative log module not available")
    
    if not os.path.isfile(log_path):
        return print(f"ERROR: Log not found: {log_path}")
    
    print(f"\n[1/1] Adding editing step...")
    cl_mod = MODULES["creative_log"]
    path, err = cl_mod.add_step_to_log(log_path, action, tool, description or "", file_path)
    
    if err:
        return print(f"ERROR: {err}")
    
    print(f"  Step '{action}' added using {tool}")
    print(f"  Log updated: {path}")


def cmd_log_final(log_path, final_file):
    if not has_module("creative_log"):
        return print("ERROR: Creative log module not available")
    
    if not os.path.isfile(log_path):
        return print(f"ERROR: Log not found: {log_path}")
    
    if not os.path.isfile(final_file):
        return print(f"ERROR: Final file not found: {final_file}")
    
    print(f"\n[1/1] Setting final file...")
    cl_mod = MODULES["creative_log"]
    path, err = cl_mod.set_final_file(log_path, final_file)
    
    if err:
        return print(f"ERROR: {err}")
    
    print(f"  Final file: {os.path.basename(final_file)}")
    print(f"  Log updated: {path}")


def cmd_log_sign(log_path, key_dir):
    if not has_module("creative_log"):
        return print("ERROR: Creative log module not available")
    
    if key_dir is None:
        key_dir = ".keys"
    
    priv_key = os.path.join(key_dir, "cert_private.key")
    
    if not os.path.isfile(priv_key):
        return print(f"ERROR: Private key not found. Run: certify-init")
    
    print(f"\n[1/1] Signing creative log...")
    cl_mod = MODULES["creative_log"]
    path, err = cl_mod.sign_log(log_path, priv_key)
    
    if err:
        return print(f"ERROR: {err}")
    
    print(f"  Signature added")
    print(f"  Log saved: {path}")
    print("\n*** LOG SIGNED ***")


def cmd_log_view(log_path, format):
    if not has_module("creative_log"):
        return print("ERROR: Creative log module not available")
    
    print(f"\n[1/1] Viewing creative log...")
    cl_mod = MODULES["creative_log"]
    content, err = cl_mod.export_log(log_path, format)
    
    if err:
        return print(f"ERROR: {err}")
    
    print(content)


def _s(path):
    return path.strip().strip("\"'")


def feature_log_create_menu():
    h1("CREATIVE LOG - START NEW")
    file = _s(input("  Initial file: "))
    desc = input("  Description (Enter = none): ").strip()
    if not os.path.isfile(file):
        return print("ERROR: File not found")
    
    cl_mod = MODULES["creative_log"]
    path, err = cl_mod.create_log(file, desc)
    if err:
        return print(f"ERROR: {err}")
    
    print(f"  Log created: {path}")
    print("\n*** CREATIVE LOG STARTED ***")


def feature_log_add_step_menu():
    h1("CREATIVE LOG - ADD STEP")
    log = _s(input("  Log file (.creative_log.json): "))
    action = _s(input("  Action (resize/filter/color_correction/text_overlay/ai_edit): "))
    tool = _s(input("  Tool (Photoshop/CapCut/FL Studio/Sora/other): "))
    desc = input("  Description (Enter = none): ").strip()
    file_path = input("  Modified file (Enter = original): ").strip()
    file_path = file_path or None
    
    if not os.path.isfile(log):
        return print("ERROR: Log not found")
    
    cl_mod = MODULES["creative_log"]
    path, err = cl_mod.add_step_to_log(log, action, tool, desc, file_path)
    if err:
        return print(f"ERROR: {err}")
    
    print(f"  Step '{action}' added")


def feature_log_view_menu():
    h1("CREATIVE LOG - VIEW")
    log = _s(input("  Log file (.creative_log.json): "))
    if not os.path.isfile(log):
        return print("ERROR: Log not found")
    
    cl_mod = MODULES["creative_log"]
    content, err = cl_mod.export_log(log, "text")
    if err:
        return print(f"ERROR: {err}")
    print(content)


def feature_batch_process(filepath, jar):
    h1("BATCH: PROCESS DROPPED FILE")
    print(f"File: {filepath}\n")
    print("Choose action:")
    print("  1 - Timestamp this file")
    print("  2 - Verify timestamp of this file")
    print("  3 - Hide secret in this image")
    print("  4 - Extract secret from this image")
    choice = input("Choice (1-4): ").strip()
    ext = os.path.splitext(filepath)[1].lower()

    if choice == "1":
        save_hashes(filepath, filepath)
        print(f"Hashes saved: {filepath}.sha1.txt, .sha256.txt, .sha512.txt")
        r = run_ots(["stamp", filepath])
        print("*** Timestamped ***" if r.returncode == 0 else "ERROR: Timestamp failed")
    elif choice == "2":
        run_ots(["verify", filepath])
    elif choice == "3":
        if not jar:
            return print("ERROR: OpenStego not available for this operation")
        secret = _s(input("Secret file to hide: "))
        if not os.path.exists(secret):
            return print("ERROR: Secret not found")
        output = os.path.splitext(filepath)[0] + "_stego" + ext
        pw = input("Password (Enter=none): ").strip()
        args = ["embed", "-a", "RandomLSB", "-mf", secret, "-cf", filepath, "-sf", output]
        if pw:
            args += ["-e", "-p", pw]
        r = run_java(jar, args)
        print(f"Secret hidden in: {output}" if r.returncode == 0 else f"ERROR: {r.stderr.strip()}")
    elif choice == "4":
        if not jar:
            return print("ERROR: OpenStego not available for this operation")
        outdir = _s(input("Extract to directory (Enter=auto): "))
        if not outdir:
            outdir = os.path.dirname(filepath) or "."
        pw = input("Password (Enter=none): ").strip()
        args = ["extract", "-a", "RandomLSB", "-sf", filepath, "-xd", outdir]
        if pw:
            args += ["-p", pw]
        r = run_java(jar, args)
        print(f"Extracted to: {outdir}" if r.returncode == 0 else f"ERROR: {r.stderr.strip()}")
    else:
        print("Invalid choice")


# -----------------------------------------------------------------------
#  Audio stego features
# -----------------------------------------------------------------------

def feature_audio_embed():
    h1("HIDE DATA IN AUDIO (WAV LSB)")
    wav = _s(input("Cover audio (WAV) path: "))
    secret = _s(input("Secret file path: "))
    out = _s(input("Output WAV path (Enter = auto): "))
    if not out:
        out = os.path.splitext(wav)[0] + "_stego.wav"
    pw = input("Password (Enter = none): ").strip()

    ok, msg = MODULES["audio"].embed(wav, secret, out, pw or None)
    print(f"\n  {'SUCCESS' if ok else 'ERROR'}: {msg}")


def feature_audio_extract():
    h1("EXTRACT DATA FROM AUDIO (WAV LSB)")
    wav = _s(input("Stego audio (WAV) path: "))
    outdir = _s(input("Extract to directory (Enter = current): "))
    if not outdir:
        outdir = os.path.dirname(wav) or "."
    pw = input("Password (Enter = none): ").strip()

    ok, msg = MODULES["audio"].extract(wav, outdir, pw or None)
    print(f"\n  {'SUCCESS' if ok else 'ERROR'}: {msg}")


# -----------------------------------------------------------------------
#  Video stego features
# -----------------------------------------------------------------------

def feature_video_embed():
    h1("HIDE DATA IN VIDEO (FFMPEG + LSB)")
    vid = _s(input("Cover video path: "))
    secret = _s(input("Secret file path: "))
    out = _s(input("Output video path (Enter = auto): "))
    if not out:
        out = os.path.splitext(vid)[0] + "_stego" + os.path.splitext(vid)[1]
    pw = input("Password (Enter = none): ").strip()

    ok, msg = MODULES["video"].embed(vid, secret, out, pw or None)
    print(f"\n  {'SUCCESS' if ok else 'ERROR'}: {msg}")


def feature_video_extract():
    h1("EXTRACT DATA FROM VIDEO (FFMPEG + LSB)")
    vid = _s(input("Stego video path: "))
    outdir = _s(input("Extract to directory (Enter = current): "))
    if not outdir:
        outdir = os.path.dirname(vid) or "."
    pw = input("Password (Enter = none): ").strip()

    ok, msg = MODULES["video"].extract(vid, outdir, pw or None)
    print(f"\n  {'SUCCESS' if ok else 'ERROR'}: {msg}")


# -----------------------------------------------------------------------
#  Metadata features
# -----------------------------------------------------------------------

def feature_metadata():
    h1("VIEW FILE METADATA")
    path = _s(input("File path: "))
    if not os.path.exists(path):
        print("ERROR: File not found")
        return
    try:
        meta = MODULES["metadata"].read_metadata(path)
    except Exception as e:
        print(f"\n  ERROR: {e}")
        return
    MODULES["metadata"].print_metadata(meta)
    print(f"\n{'-' * 55}")
    inp = input("  Press Enter for export options or type 'skip': ").strip().lower()
    if inp != "skip":
        _prompt_export(meta, os.path.splitext(path)[0] + "_metadata")


def feature_write_metadata():
    h1("WRITE METADATA (EXIF / ID3)")
    path = _s(input("File path: "))
    if not os.path.exists(path):
        return print("ERROR: File not found")
    print("\nEnter metadata fields (leave blank to skip):")
    title = input("  Title: ").strip()
    artist = input("  Artist: ").strip()
    copyright = input("  Copyright: ").strip()
    description = input("  Description: ").strip()
    data = {}
    if title: data["title"] = title
    if artist: data["artist"] = artist
    if copyright: data["copyright"] = copyright
    if description: data["description"] = description
    if not data:
        return print("No fields entered, skipping")
    out = _s(input("Output path (Enter = overwrite): "))
    ok, msg = MODULES["metadata"].write_metadata(path, data, out or None)
    print(f"\n  {'SUCCESS' if ok else 'ERROR'}: {msg}")


def feature_c2pa_read():
    h1("READ C2PA PROVENANCE (AI CONTENT CREDENTIALS)")
    path = _s(input("File path: "))
    if not os.path.exists(path):
        print("ERROR: File not found")
        return
    try:
        meta, err = MODULES["metadata"].c2pa_read(path)
    except Exception as e:
        print(f"\n  ERROR: {e}")
        return
    if err:
        print(f"\n  {err}")
    elif meta:
        MODULES["metadata"].c2pa_print(meta, path)
        print(f"\n{'-' * 55}")
        input("  Press Enter for export options...")
        _prompt_export(meta, os.path.splitext(path)[0] + "_c2pa")
    else:
        print("\n  No C2PA manifest found in this file")


def feature_c2pa_write():
    h1("WRITE C2PA PROVENANCE")
    path = _s(input("File path: "))
    if not os.path.exists(path):
        return print("ERROR: File not found")
    print("\nContent type:")
    print("  1. AI-generated content")
    print("  2. AI-edited content")
    print("  3. Digitally created")
    print("  4. Digitally captured (camera)")
    print("  5. Composite")
    print("  6. Do Not Train (opt-out of AI training)")
    print("  7. Stego embed claim")
    ctype = input("Choice (1-7): ").strip()
    desc = input("Description (optional): ").strip()
    model = input("AI model name (if AI, optional): ").strip()

    meta_mod = MODULES["metadata"]
    if ctype == "1":
        manifest = meta_mod.c2pa_build_manifest(desc, ai_generated=True, model_name=model)
    elif ctype == "2":
        manifest = meta_mod.c2pa_build_manifest(desc, digital_source="ai_edited", model_name=model)
    elif ctype == "3":
        manifest = meta_mod.c2pa_build_manifest(desc, digital_source="digital_creation")
    elif ctype == "4":
        manifest = meta_mod.c2pa_build_manifest(desc, digital_source="digital_capture")
    elif ctype == "5":
        manifest = meta_mod.c2pa_build_manifest(desc, digital_source="composite")
    elif ctype == "6":
        manifest = meta_mod.c2pa_build_do_not_train_manifest()
    elif ctype == "7":
        algo = input("Stego algorithm (e.g. RandomLSB, DWTDugad): ").strip() or "RandomLSB"
        manifest = meta_mod.c2pa_build_stego_manifest(algo, desc)
    else:
        return print("Invalid choice")

    out, err = meta_mod.c2pa_write(path, manifest)
    if err:
        print(f"\n  ERROR: {err}")
    else:
        print(f"\n  SUCCESS: C2PA manifest written to: {out}")


def feature_c2pa_init():
    h1("INITIALIZE C2PA CERTIFICATE")
    force = input("Force regenerate? (y/N): ").strip().lower() == "y"
    ok, msg = MODULES["metadata"].c2pa_init(force=force)
    if ok:
        print(f"\n  [OK] {msg}")
        print(f"  Certificate: {MODULES['metadata'].CERT_FILE}")
        print(f"  Key:         {MODULES['metadata'].KEY_FILE}")
    else:
        print(f"\n  [FAIL] {msg}")


# -----------------------------------------------------------------------
#  Setup
# -----------------------------------------------------------------------

def run_setup():
    h1("RedoSan Authenticity - Setup")
    print("Checking dependencies...\n")

    ok = check_deps()
    if ok:
        print("  [OK] All dependencies met.")
    else:
        print("  Some dependencies are missing. Install them and re-run.")
        print("  After installing, run this script again.")

    print()
    if not check_pip_packages():
        print("  To install Python packages:")
        print(f"    {sys.executable} -m pip install opentimestamps opentimestamps-client")
        print()
    if not find_java():
        print("  To install Java:")
        print("    Windows: https://www.java.com/download/")
        print("    Linux:   sudo apt install default-jre  (or equivalent)")
        print("    macOS:   brew install openjdk")
        print()
    if not find_openstego_jar():
        print("  To install OpenStego:")
        print("    Download from: https://www.openstego.com/")
        print("    Or download the JAR and place it in this directory.")
        print("    Or set OPENSTEGO_JAR environment variable.")
        print()
    pause()


# -----------------------------------------------------------------------
#  CLI argument parser
# -----------------------------------------------------------------------

def build_parser():
    p = argparse.ArgumentParser(
        prog="RedoSan_Authenticity",
        description="RedoSan Authenticity - Steganography + OpenTimestamps + C2PA",
    )
    p.add_argument("--version", "-v", action="store_true", help="Show version")
    p.add_argument("--setup", "--install", action="store_true", help="Check dependencies")

    sub = p.add_subparsers(dest="command", metavar="COMMAND")

    # 1. hide-timestamp
    s = sub.add_parser("hide-timestamp", help="Hide secret in image + Timestamp")
    s.add_argument("cover", help="Cover image path")
    s.add_argument("secret", help="Secret file path")
    s.add_argument("-o", "--output", help="Output image path")
    s.add_argument("-p", "--password", help="Password")

    # 2. extract-verify
    s = sub.add_parser("extract-verify", help="Extract secret + Verify timestamp")
    s.add_argument("stego", help="Stego image path")
    s.add_argument("-o", "--outdir", help="Output directory")
    s.add_argument("-p", "--password", help="Password")

    # 3. timestamp
    s = sub.add_parser("timestamp", help="Timestamp a file")
    s.add_argument("file", help="File to timestamp")

    # 4. verify
    s = sub.add_parser("verify", help="Verify timestamp integrity")
    s.add_argument("file", help="File to verify")

    # 5. watermark-timestamp
    s = sub.add_parser("watermark-timestamp", help="Watermark image + Timestamp")
    s.add_argument("signature", help="Signature file path")
    s.add_argument("cover", help="Cover image path")
    s.add_argument("-o", "--output", help="Output image path")

    # 6. gen-signature
    s = sub.add_parser("gen-signature", help="Generate watermark signature")
    s.add_argument("output", help="Output signature file path")
    s.add_argument("-p", "--password", help="Password")

    # 7. check-watermark
    s = sub.add_parser("check-watermark", help="Check watermark in image")
    s.add_argument("signature", help="Signature file")
    s.add_argument("image", help="Stego image")

    # 8. audio-embed
    s = sub.add_parser("audio-embed", help="Hide data in audio (WAV LSB)")
    s.add_argument("cover", help="Cover audio (WAV) path")
    s.add_argument("secret", help="Secret file path")
    s.add_argument("-o", "--output", help="Output WAV path")
    s.add_argument("-p", "--password", help="Password")

    # 9. audio-extract
    s = sub.add_parser("audio-extract", help="Extract data from audio")
    s.add_argument("stego", help="Stego audio (WAV) path")
    s.add_argument("-o", "--outdir", help="Extract to directory")
    s.add_argument("-p", "--password", help="Password")

    # 10. video-embed
    s = sub.add_parser("video-embed", help="Hide data in video (ffmpeg + LSB)")
    s.add_argument("cover", help="Cover video path")
    s.add_argument("secret", help="Secret file path")
    s.add_argument("-o", "--output", help="Output video path")
    s.add_argument("-p", "--password", help="Password")

    # 11. video-extract
    s = sub.add_parser("video-extract", help="Extract data from video")
    s.add_argument("stego", help="Stego video path")
    s.add_argument("-o", "--outdir", help="Extract to directory")
    s.add_argument("-p", "--password", help="Password")

    # 12. metadata-read
    s = sub.add_parser("metadata-read", help="View file metadata")
    s.add_argument("file", help="File path")
    s.add_argument("--export", choices=["txt", "json"], help="Export format")
    s.add_argument("-o", "--output", help="Export output path")

    # 13. metadata-write
    s = sub.add_parser("metadata-write", help="Write metadata (EXIF/ID3)")
    s.add_argument("file", help="File path")
    s.add_argument("--title", help="Title")
    s.add_argument("--artist", help="Artist")
    s.add_argument("--copyright", help="Copyright")
    s.add_argument("--description", help="Description")
    s.add_argument("-o", "--output", help="Output path (default: overwrite)")

    # 14. c2pa-read
    s = sub.add_parser("c2pa-read", help="Read C2PA provenance")
    s.add_argument("file", help="File path")
    s.add_argument("--export", choices=["txt", "json"], help="Export format")
    s.add_argument("-o", "--output", help="Export output path")

    # 15. c2pa-write
    s = sub.add_parser("c2pa-write", help="Write C2PA provenance")
    s.add_argument("file", help="File path")
    s.add_argument("-t", "--type", choices=["ai-generated", "ai-edited", "digital-creation",
                   "digital-capture", "composite", "do-not-train", "stego"],
                   default="digital-creation", help="Content type")
    s.add_argument("-d", "--description", help="Description")
    s.add_argument("--model", help="AI model name (for AI types)")
    s.add_argument("--algorithm", help="Stego algorithm (for stego type)")

    # 16. c2pa-init
    s = sub.add_parser("c2pa-init", help="Init C2PA certificate (first use)")
    s.add_argument("-f", "--force", action="store_true", help="Force regenerate")

    # 17. watermark-embed
    s = sub.add_parser("watermark-embed", help="Embed watermark of specified type")
    s.add_argument("wtype", type=int, help="Watermark type (1-9)")
    s.add_argument("cover", help="Cover image path")
    s.add_argument("secret", help="Secret file path")
    s.add_argument("-o", "--output", help="Output image path")
    s.add_argument("-p", "--password", help="Password")

    # 18. watermark-extract
    s = sub.add_parser("watermark-extract", help="Extract watermark of specified type")
    s.add_argument("wtype", type=int, help="Watermark type (1-9)")
    s.add_argument("stego", help="Stego image path")
    s.add_argument("-o", "--outdir", help="Extract to directory")
    s.add_argument("-p", "--password", help="Password")

    # 19. watermark-list
    s = sub.add_parser("watermark-list", help="List available watermark types")

    # 20. watermark-describe
    s = sub.add_parser("watermark-describe", help="Describe a watermark type")
    s.add_argument("wtype", type=int, help="Watermark type (1-9)")

    # 21. fingerprint
    s = sub.add_parser("fingerprint", help="Generate fingerprint for file")
    s.add_argument("file", help="File to fingerprint")
    s.add_argument("-o", "--output", help="Output JSON path")
    s.add_argument("-t", "--type", choices=["image", "video", "audio", "document"],
                  help="Force file type")

    # 22. certify
    s = sub.add_parser("certify", help="Sign fingerprint with certificate")
    s.add_argument("file", help="File to certify")
    s.add_argument("-k", "--key-dir", help="Keys directory (default: .keys)")
    s.add_argument("-o", "--output", help="Output certificate path")
    s.add_argument("--skip-fingerprint", action="store_true", help="Skip fingerprint generation")

    # 23. certify-verify
    s = sub.add_parser("certify-verify", help="Verify certificate")
    s.add_argument("certificate", help="Certificate file (.rsa_certificate)")
    s.add_argument("-k", "--key-dir", help="Keys directory (default: .keys)")

    # 24. certify-init
    s = sub.add_parser("certify-init", help="Initialize certification system")
    s.add_argument("-k", "--key-dir", help="Keys directory (default: .keys)")
    s.add_argument("-f", "--force", action="store_true", help="Force regenerate")

    # 25. log-create
    s = sub.add_parser("log-create", help="Start new creative log")
    s.add_argument("file", help="Initial file path")
    s.add_argument("-d", "--description", help="Description of the work")
    s.add_argument("-o", "--output", help="Output log path")

    # 26. log-add-step
    s = sub.add_parser("log-add-step", help="Add editing step to log")
    s.add_argument("log", help="Creative log file (.creative_log.json)")
    s.add_argument("action", help="Action (resize, filter, color_correction, etc.)")
    s.add_argument("tool", help="Tool used (Photoshop, CapCut, etc.)")
    s.add_argument("-d", "--description", help="Description of the edit")
    s.add_argument("-f", "--file", help="Modified file path (if different from original)")

    # 27. log-final
    s = sub.add_parser("log-final", help="Set final file in creative log")
    s.add_argument("log", help="Creative log file (.creative_log.json)")
    s.add_argument("file", help="Final file path")

    # 28. log-sign
    s = sub.add_parser("log-sign", help="Sign creative log")
    s.add_argument("log", help="Creative log file (.creative_log.json)")
    s.add_argument("-k", "--key-dir", help="Keys directory (default: .keys)")

    # 29. log-view
    s = sub.add_parser("log-view", help="View creative log")
    s.add_argument("log", help="Creative log file (.creative_log.json)")
    s.add_argument("-f", "--format", choices=["json", "text"], default="text", help="Output format")

    return p


# -----------------------------------------------------------------------
#  CLI dispatch: inject values into feature functions via input mocking
# -----------------------------------------------------------------------

_CLI_INPUTS = []


def _cli_input(prompt):
    """Replacement for input() during CLI mode — returns pre-set values."""
    if _CLI_INPUTS:
        val = _CLI_INPUTS.pop(0)
        print(f"{prompt}{val}")
        return val
    return input(prompt)


def _patch_input(new_func):
    """Temporarily replace builtins.input with new_func, return original."""
    import builtins
    orig = builtins.input
    builtins.input = new_func
    return orig


def _unpatch_input(orig):
    import builtins
    builtins.input = orig


def run_cli_command(args, jar):
    """Dispatch CLI subcommand by monkey-patching input with pre-set answers."""
    global _CLI_INPUTS

    cmd = args.command

    # Build ordered list of inputs matching the feature function's prompts
    if cmd == "hide-timestamp":
        _CLI_INPUTS[:] = [
            args.cover,
            args.secret,
            args.output or "",
            args.password or "",
        ]
        orig = _patch_input(_cli_input)
        try:
            feature_hide_timestamp(jar)
        finally:
            _unpatch_input(orig)

    elif cmd == "extract-verify":
        _CLI_INPUTS[:] = [
            args.stego,
            args.outdir or "",
            args.password or "",
        ]
        orig = _patch_input(_cli_input)
        try:
            feature_extract_verify(jar)
        finally:
            _unpatch_input(orig)

    elif cmd == "timestamp":
        _CLI_INPUTS[:] = [args.file]
        orig = _patch_input(_cli_input)
        try:
            feature_timestamp()
        finally:
            _unpatch_input(orig)

    elif cmd == "verify":
        _CLI_INPUTS[:] = [args.file]
        orig = _patch_input(_cli_input)
        try:
            feature_verify()
        finally:
            _unpatch_input(orig)

    elif cmd == "watermark-timestamp":
        _CLI_INPUTS[:] = [
            args.signature,
            args.cover,
            args.output or "",
        ]
        orig = _patch_input(_cli_input)
        try:
            feature_watermark_timestamp(jar)
        finally:
            _unpatch_input(orig)

    elif cmd == "gen-signature":
        _CLI_INPUTS[:] = [
            args.output,
            args.password or "",
        ]
        orig = _patch_input(_cli_input)
        try:
            feature_gen_signature(jar)
        finally:
            _unpatch_input(orig)

    elif cmd == "check-watermark":
        _CLI_INPUTS[:] = [
            args.signature,
            args.image,
        ]
        orig = _patch_input(_cli_input)
        try:
            feature_check_watermark(jar)
        finally:
            _unpatch_input(orig)

    elif cmd == "audio-embed":
        _CLI_INPUTS[:] = [
            args.cover,
            args.secret,
            args.output or "",
            args.password or "",
        ]
        orig = _patch_input(_cli_input)
        try:
            feature_audio_embed()
        finally:
            _unpatch_input(orig)

    elif cmd == "audio-extract":
        _CLI_INPUTS[:] = [
            args.stego,
            args.outdir or "",
            args.password or "",
        ]
        orig = _patch_input(_cli_input)
        try:
            feature_audio_extract()
        finally:
            _unpatch_input(orig)

    elif cmd == "video-embed":
        _CLI_INPUTS[:] = [
            args.cover,
            args.secret,
            args.output or "",
            args.password or "",
        ]
        orig = _patch_input(_cli_input)
        try:
            feature_video_embed()
        finally:
            _unpatch_input(orig)

    elif cmd == "video-extract":
        _CLI_INPUTS[:] = [
            args.stego,
            args.outdir or "",
            args.password or "",
        ]
        orig = _patch_input(_cli_input)
        try:
            feature_video_extract()
        finally:
            _unpatch_input(orig)

    elif cmd == "metadata-read":
        _CLI_INPUTS[:] = [args.file]
        orig = _patch_input(lambda p: _export_handler("metadata", p, args))
        try:
            feature_metadata()
        finally:
            _unpatch_input(orig)

    elif cmd == "metadata-write":
        _CLI_INPUTS[:] = [
            args.file,
            args.title or "",
            args.artist or "",
            args.copyright or "",
            args.description or "",
            args.output or "",
        ]
        orig = _patch_input(_cli_input)
        try:
            feature_write_metadata()
        finally:
            _unpatch_input(orig)

    elif cmd == "c2pa-read":
        _CLI_INPUTS[:] = [args.file]
        orig = _patch_input(lambda p: _export_handler("c2pa", p, args))
        try:
            feature_c2pa_read()
        finally:
            _unpatch_input(orig)

    elif cmd == "c2pa-write":
        type_map = {
            "ai-generated": "1", "ai-edited": "2",
            "digital-creation": "3", "digital-capture": "4",
            "composite": "5", "do-not-train": "6", "stego": "7",
        }
        _CLI_INPUTS[:] = [
            args.file,
            type_map.get(args.type, "3"),
            args.description or "",
            args.model or "",
        ]
        if args.type == "stego":
            _CLI_INPUTS.append(args.algorithm or "RandomLSB")
        orig = _patch_input(_cli_input)
        try:
            feature_c2pa_write()
        finally:
            _unpatch_input(orig)

    elif cmd == "c2pa-init":
        _CLI_INPUTS[:] = ["y" if args.force else "n"]
        orig = _patch_input(_cli_input)
        try:
            feature_c2pa_init()
        finally:
            _unpatch_input(orig)

    elif cmd == "watermark-embed":
        _CLI_INPUTS[:] = [
            str(args.wtype),
            args.cover,
            args.secret,
            args.output or "",
            args.password or "",
        ]
        orig = _patch_input(_cli_input)
        try:
            feature_wt_embed()
        finally:
            _unpatch_input(orig)

    elif cmd == "watermark-extract":
        _CLI_INPUTS[:] = [
            str(args.wtype),
            args.stego,
            args.outdir or "",
            args.password or "",
        ]
        orig = _patch_input(_cli_input)
        try:
            feature_wt_extract()
        finally:
            _unpatch_input(orig)

    elif cmd == "watermark-list":
        _CLI_INPUTS[:] = []
        orig = _patch_input(_cli_input)
        try:
            feature_wt_list()
        finally:
            _unpatch_input(orig)

    elif cmd == "watermark-describe":
        _CLI_INPUTS[:] = [str(args.wtype)]
        orig = _patch_input(_cli_input)
        try:
            feature_wt_describe()
        finally:
            _unpatch_input(orig)

    elif cmd == "fingerprint":
        cmd_fingerprint(args.file, args.output, args.type)

    elif cmd == "certify":
        cmd_certify(args.file, args.key_dir, args.output, args.skip_fingerprint)

    elif cmd == "certify-verify":
        cmd_certify_verify(args.certificate, args.key_dir)

    elif cmd == "certify-init":
        cmd_certify_init(args.key_dir, args.force)

    elif cmd == "log-create":
        cmd_log_create(args.file, args.description, args.output)

    elif cmd == "log-add-step":
        cmd_log_add_step(args.log, args.action, args.tool, args.description, args.file)

    elif cmd == "log-final":
        cmd_log_final(args.log, args.file)

    elif cmd == "log-sign":
        cmd_log_sign(args.log, args.key_dir)

    elif cmd == "log-view":
        cmd_log_view(args.log, args.format)

    else:
        print(f"  Unknown command: {cmd}")


def _export_handler(feature, prompt, args):
    """Handle export prompts in metadata-read and c2pa-read CLI mode."""
    pl = prompt.strip().lower()
    # File path prompt
    if "file path" in pl:
        print(f"{prompt}{args.file}")
        return args.file
    # Skip prompt: type 'skip' — check BEFORE press-enter because both may match
    if "skip" in pl:
        if args.export:
            print(f"{prompt}")
            return ""
        print(f"{prompt}skip")
        return "skip"
    # Press Enter prompt (before export options) — only if skip not an option
    if "press enter" in pl or "continue" in pl:
        print(f"{prompt}")
        return ""
    # Export format prompt
    if "export to file" in pl or "txt/json" in pl:
        val = args.export or "N"
        print(f"{prompt}{val}")
        return val
    # Output path prompt
    if "output path" in pl or "output" in pl:
        val = args.output or ""
        print(f"{prompt}{val}")
        return val
    # Fallback: print prompt and return empty
    print(f"{prompt}")
    return ""


# -----------------------------------------------------------------------
#  Entry point
# -----------------------------------------------------------------------

def main():
    jar = find_openstego_jar()
    java = find_java()

    parser = build_parser()
    parsed = parser.parse_args()

    if parsed.version:
        print(f"RedoSan Authenticity v{__version__}")
        return
    if parsed.setup:
        return run_setup()

    # CLI subcommand mode
    if parsed.command:
        # Check deps silently in CLI mode
        if parsed.command in ("hide-timestamp", "extract-verify",
                              "watermark-timestamp", "gen-signature", "check-watermark"):
            if not jar:
                print("ERROR: OpenStego not found (required for this command)")
                sys.exit(1)
            if not java:
                print("ERROR: Java not found (required for OpenStego)")
                sys.exit(1)
        if parsed.command in ("audio-embed", "audio-extract") and not has_module("audio"):
            print("ERROR: Audio module not available")
            sys.exit(1)
        if parsed.command in ("video-embed", "video-extract") and not has_module("video"):
            print("ERROR: Video module not available")
            sys.exit(1)
        if parsed.command in ("metadata-read", "metadata-write", "c2pa-read",
                              "c2pa-write", "c2pa-init") and not has_module("metadata"):
            print("ERROR: Metadata module not available")
            sys.exit(1)

        global _CLI_INPUTS
        _CLI_INPUTS.clear()
        run_cli_command(parsed, jar)
        return

    # Batch mode: file dropped as argument (positional, no command)
    if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]):
        feature_batch_process(sys.argv[1], jar)
        return

    # Interactive menu
    check_deps()
    while True:
        os.system("cls" if os.name == "nt" else "clear")
        print("=" * 55)
        print(f"          RedoSan Authenticity v{__version__}")
        print("   Steganography + OpenTimestamps Integration")
        print("=" * 55)
        if not jar:
            print("  [!] OpenStego not found - some features limited")
        if not find_ffmpeg():
            print("  [!] ffmpeg not found - video features limited")
        if not java or not check_pip_packages():
            print("  [!] Some features limited - run with --setup for info")
        print()
        print("  == IMAGE STEGANOGRAPHY ==")
        print("  1. Hide secret in image + Timestamp")
        print("  2. Extract secret + Verify timestamp")
        print("  3. Watermark image + Timestamp")
        print("  4. Generate watermark signature")
        print("  5. Check watermark in image")
        print()
        print("  == AUDIO STEGANOGRAPHY ==")
        print("  6. Hide data in audio (WAV LSB)")
        print("  7. Extract data from audio")
        print()
        print("  == VIDEO STEGANOGRAPHY ==")
        print("  8. Hide data in video (ffmpeg + LSB)")
        print("  9. Extract data from video")
        print()
        print("  == WATERMARK TYPES (PURE PYTHON) ==")
        print("  10. List watermark types")
        print("  11. Embed watermark")
        print("  12. Extract watermark")
        print("  13. Describe watermark type")
        print()
        print("  == METADATA ==")
        print("  14. View file metadata")
        print("  15. Write metadata (EXIF/ID3)")
        print()
        print("  == C2PA PROVENANCE (AI CONTENT) ==")
        print("  16. Read C2PA provenance")
        print("  17. Write C2PA provenance")
        print("  18. Init C2PA certificate")
        print()
        print("  == TIMESTAMPING ==")
        print("  19. Timestamp a file")
        print("  20. Verify timestamp integrity")
        print()
        print("  == FINGERPRINT & CERTIFICATION ==")
        print("  21. Generate fingerprint")
        print("  22. Sign & certify file")
        print("  23. Verify certificate")
        print("  24. Init certification keys")
        print()
        print("  == CREATIVE PROCESS LOG ==")
        print("  25. Start new creative log")
        print("  26. Add editing step to log")
        print("  27. View / Export creative log")
        print()
        print("  == SETUP ==")
        print("  s. Setup / Check dependencies")
        print("  0. Exit")
        print()
        choice = input("  Choice: ").strip().lower()

        if choice == "1":
            if not jar: print("ERROR: OpenStego not found"); pause(); continue
            feature_hide_timestamp(jar)
        elif choice == "2":
            if not jar: print("ERROR: OpenStego not found"); pause(); continue
            feature_extract_verify(jar)
        elif choice == "3":
            if not jar: print("ERROR: OpenStego not found"); pause(); continue
            feature_watermark_timestamp(jar)
        elif choice == "4":
            if not jar: print("ERROR: OpenStego not found"); pause(); continue
            feature_gen_signature(jar)
        elif choice == "5":
            if not jar: print("ERROR: OpenStego not found"); pause(); continue
            feature_check_watermark(jar)
        elif choice == "6" and has_module("audio"):
            feature_audio_embed()
        elif choice == "7" and has_module("audio"):
            feature_audio_extract()
        elif choice == "8" and has_module("video"):
            if not find_ffmpeg(): print("ERROR: ffmpeg not found - run setup.bat"); pause(); continue
            feature_video_embed()
        elif choice == "9" and has_module("video"):
            if not find_ffmpeg(): print("ERROR: ffmpeg not found - run setup.bat"); pause(); continue
            feature_video_extract()
        elif choice == "10" and has_module("watermark"):
            feature_wt_list()
        elif choice == "11" and has_module("watermark"):
            feature_wt_embed()
        elif choice == "12" and has_module("watermark"):
            feature_wt_extract()
        elif choice == "13" and has_module("watermark"):
            feature_wt_describe()
        elif choice == "14" and has_module("metadata"):
            feature_metadata()
        elif choice == "15" and has_module("metadata"):
            feature_metadata_write()
        elif choice == "16" and has_module("metadata"):
            feature_c2pa_read()
        elif choice == "17" and has_module("metadata"):
            feature_c2pa_write()
        elif choice == "18" and has_module("metadata"):
            feature_c2pa_init()
        elif choice == "19":
            feature_timestamp()
        elif choice == "20":
            feature_verify()
        elif choice == "21" and has_module("fingerprint"):
            feature_fingerprint_menu()
        elif choice == "22" and has_module("fingerprint") and has_module("certification"):
            feature_certify_menu()
        elif choice == "23" and has_module("certification"):
            feature_certify_verify_menu()
        elif choice == "24" and has_module("certification"):
            feature_certify_init_menu()
        elif choice == "25" and has_module("creative_log"):
            feature_log_create_menu()
        elif choice == "26" and has_module("creative_log"):
            feature_log_add_step_menu()
        elif choice == "27" and has_module("creative_log"):
            feature_log_view_menu()
        elif choice == "13" and has_module("metadata"):
            feature_write_metadata()
        elif choice == "14" and has_module("metadata"):
            feature_c2pa_read()
        elif choice == "15" and has_module("metadata"):
            feature_c2pa_write()
        elif choice == "16" and has_module("metadata"):
            feature_c2pa_init()
        elif choice == "19" and has_module("watermark"):
            feature_wt_list()
        elif choice == "20" and has_module("watermark"):
            feature_wt_embed()
        elif choice == "21" and has_module("watermark"):
            feature_wt_extract()
        elif choice == "22" and has_module("watermark"):
            feature_wt_describe()
        elif choice in ("s", "setup"):
            run_setup()
        elif choice == "0":
            print("Goodbye!")
            break
        else:
            print("Invalid choice")
        pause()


if __name__ == "__main__":
    if not os.path.isfile(OTS_SCRIPT):
        print(f"ERROR: Required file not found: {OTS_SCRIPT}")
        print("Reinstall the tool or copy modules/ots_stamp.py to the correct location.")
        sys.exit(1)
    main()

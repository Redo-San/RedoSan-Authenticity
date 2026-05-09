#!/usr/bin/env python3
"""
RedoSan Authenticity - One-click Setup Installer
Run:  python install.py    (or double-click setup.bat)

Downloads external tools from our GitHub Releases first,
falls back to original sources, and verifies SHA256 checksums.
"""
import os, sys, subprocess, platform, json, hashlib, urllib.request, zipfile, shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CHECKSUMS_FILE = os.path.join(SCRIPT_DIR, "checksums.json")
PACKAGES = ["opentimestamps", "opentimestamps-client", "Pillow", "mutagen", "c2pa-python", "customtkinter",
           "imagehash", "opencv-python", "cryptography", "PyPDF2", "python-docx"]


# ── Helpers ──

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def run(cmd, desc, capture=True):
    print(f"  [{desc}] ", end="", flush=True)
    kw = {"capture_output": True, "text": True} if capture else {}
    try:
        r = subprocess.run(cmd, **kw, timeout=120)
        if r.returncode == 0:
            print("OK")
            return True
        print("FAILED")
        if capture and r.stderr.strip():
            print(f"    {r.stderr.strip()[:200]}")
        return False
    except FileNotFoundError:
        print("NOT FOUND")
        return False
    except subprocess.TimeoutExpired:
        print("TIMEOUT")
        return False


def download(url, dest, desc, expected_size=None):
    print(f"  [{desc}] ", end="", flush=True)
    try:
        urllib.request.urlretrieve(url, dest)
        actual = os.path.getsize(dest)
        if expected_size and actual != expected_size:
            print(f"SIZE MISMATCH (expected {expected_size}, got {actual})")
            os.remove(dest)
            return False
        print(f"OK ({actual} bytes)")
        return True
    except Exception as e:
        print(f"FAILED ({e})")
        return False


def verify_checksums(path, expected, name):
    """Verify all three hashes (SHA1, SHA256, SHA512) against expected dict."""
    if not os.path.isfile(path):
        return False, "not found"

    failures = []
    for algo in ("sha1", "sha256", "sha512"):
        exp = expected.get(algo)
        if not exp:
            continue
        h = hashlib.new(algo)
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        actual = h.hexdigest()
        if actual != exp:
            failures.append(f"  {algo}: expected {exp}, got {actual}")

    if not failures:
        return True, f"all hashes OK"

    for line in failures:
        print(f"    {line}")
    return False, f"{len(failures)}/{len(expected)} hash(es) mismatch"


# ── Download manager ──

def ensure_tool(entry_key):
    """Download a tool with primary→fallback chain + SHA256 verification."""
    checksums_path = CHECKSUMS_FILE
    if not os.path.isfile(checksums_path):
        print(f"    WARNING: checksums.json not found, skipping verification")
        return False

    with open(checksums_path) as f:
        all_cks = json.load(f)

    info = all_cks.get(entry_key)
    if not info:
        print(f"    WARNING: no checksum entry for {entry_key}")
        return False

    expected_size = info.get("size")
    dest = os.path.join(SCRIPT_DIR, entry_key)

    # Already exists and valid?
    if os.path.isfile(dest):
        ok, msg = verify_checksums(dest, info, entry_key)
        if ok:
            print(f"       {entry_key} found, {msg}")
            return True
        print(f"       {entry_key} exists but {msg}, re-downloading...")
        os.remove(dest)

    urls = info.get("urls", {})
    primary = urls.get("primary")
    fallback = urls.get("fallback")

    # Try primary (our GitHub Release)
    if primary:
        print(f"       Downloading from primary source...")
        if download(primary, dest, f"primary {entry_key}", expected_size):
            ok, msg = verify_checksums(dest, info, entry_key)
            if ok:
                print(f"       {entry_key} ready (from primary)")
                return True
            print(f"       {entry_key} {msg}, removing...")
            os.remove(dest)

    # Try fallback (original source)
    if fallback:
        print(f"       Downloading from fallback (original source)...")
        temp_dir = os.path.join(SCRIPT_DIR, "_tmp_dl")
        os.makedirs(temp_dir, exist_ok=True)
        temp_file = os.path.join(temp_dir, f"{entry_key}.dl")

        if download(fallback, temp_file, f"fallback {entry_key}"):
            # Handle zip archives (c2patool.exe and openstego.jar are inside zips)
            if zipfile.is_zipfile(temp_file):
                needed = entry_key  # e.g. "c2patool.exe" or "openstego.jar"
                found = False
                with zipfile.ZipFile(temp_file, "r") as z:
                    for name in z.namelist():
                        if name.endswith(needed):
                            with z.open(name) as src, open(dest, "wb") as dst:
                                dst.write(src.read())
                            if entry_key.endswith(".exe"):
                                os.chmod(dest, 0o755)
                            found = True
                            break
                    if not found:
                        # try any .jar in zip
                        for name in z.namelist():
                            if name.endswith(".jar"):
                                with z.open(name) as src, open(dest, "wb") as dst:
                                    dst.write(src.read())
                                found = True
                                break
                os.remove(temp_file)
                if not found:
                    print(f"       {needed} not found inside zip")
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    return False
            else:
                shutil.move(temp_file, dest)

            shutil.rmtree(temp_dir, ignore_errors=True)

            if os.path.isfile(dest):
                ok, msg = verify_checksums(dest, info, entry_key)
                if ok:
                    print(f"       {entry_key} ready (from fallback)")
                    return True
                print(f"       {entry_key} {msg}, removing...")
                os.remove(dest)
        else:
            shutil.rmtree(temp_dir, ignore_errors=True)

    print(f"       FAILED to download {entry_key}")
    print(f"       Get it manually and place in: {SCRIPT_DIR}")
    if entry_key == "c2patool.exe":
        print(f"         {fallback or 'https://github.com/contentauth/c2pa-rs/releases'}")
    else:
        print(f"         {fallback or 'https://www.openstego.com/'}")
    return False


def _download_ffmpeg():
    """Download ffmpeg for Windows."""
    import zipfile
    
    ffmpeg_dir = os.path.join(SCRIPT_DIR, "ffmpeg")
    ffmpeg_exe = os.path.join(ffmpeg_dir, "bin", "ffmpeg.exe")
    
    # Check if already exists
    if os.path.isfile(ffmpeg_exe):
        print(f"       ffmpeg.exe found")
        return True
    
    print(f"       Downloading ffmpeg...")
    temp_dir = os.path.join(SCRIPT_DIR, "_tmp_dl")
    os.makedirs(temp_dir, exist_ok=True)
    
    # Try GitHub build (BtbN)
    url = "https://github.com/BtbN/Build/releases/download/Latest/ffmpeg-master-latest-win64-gpl-shared.zip"
    zip_path = os.path.join(temp_dir, "ffmpeg.zip")
    
    try:
        urllib.request.urlretrieve(url, zip_path)
        print(f"       Extracting...")
        
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(SCRIPT_DIR)
        
        # Rename if extraction created folder
        extracted = os.path.join(SCRIPT_DIR, "ffmpeg-master-latest-win64-gpl-shared")
        if os.path.isdir(extracted):
            for item in os.listdir(extracted):
                src = os.path.join(extracted, item)
                dst = os.path.join(ffmpeg_dir, item)
                if not os.path.exists(dst):
                    os.rename(src, dst)
            os.rmdir(extracted)
        
        if os.path.isfile(ffmpeg_exe):
            # Add to PATH
            ffmpeg_bin = os.path.join(ffmpeg_dir, "bin")
            os.environ["PATH"] = ffmpeg_bin + os.pathsep + os.environ.get("PATH", "")
            print(f"       ffmpeg ready at {ffmpeg_dir}")
            return True
    except Exception as e:
        print(f"       Failed: {e}")
    
    # Cleanup
    try:
        shutil.rmtree(temp_dir, ignore_errors=True)
    except:
        pass
    
    return False


# ── Setup ──

def main():
    syst = platform.system()
    is_win = syst == "Windows"

    print("=" * 55)
    print("   RedoSan Authenticity - One-Click Setup")
    print("=" * 55)
    print(f"   Platform: {syst} {platform.release()}")
    print(f"   Python:   {sys.version.split()[0]}")
    print()

    all_ok = True
    failed_packages = []

    # ── 1. Python packages ──
    print("[1/7] Installing Python packages...")
    print("   (This may take a few minutes...)")
    for pkg in PACKAGES:
        print(f"   Installing {pkg}...", end=" ", flush=True)
        ok = run([sys.executable, "-m", "pip", "install", "--user", pkg], pkg)
        if ok:
            print("OK")
        else:
            print("FAILED")
            all_ok = False
            failed_packages.append(pkg)
    print()

    # ── 2. Java ──
    print("[2/7] Checking Java...")
    java_found = run(["java", "-version"], "java -version")
    if not java_found:
        print("       Java is required for image steganography (OpenStego).")
        print("       Download: https://www.java.com/download/")
    print()

    # ── 3. c2patool ──
    print("[3/7] C2PA signing tool (c2patool)...")
    c2pa_found = ensure_tool("c2patool.exe")
    print()

    # ── 4. OpenStego ──
    print("[4/7] OpenStego JAR...")
    jar_found = ensure_tool("openstego.jar")
    print()

    # ── 5. ffmpeg ──
    print("[5/7] ffmpeg (video stego)...")
    ffmpeg_found = run(["ffmpeg", "-version"], "ffmpeg -version")
    if not ffmpeg_found and is_win:
        print("       ffmpeg not found. Downloading...")
        # Try to download ffmpeg for Windows
        ffmpeg_ok = _download_ffmpeg()
        if ffmpeg_ok:
            ffmpeg_found = True
            print("       ffmpeg downloaded successfully!")
    if not ffmpeg_found:
        print("       ffmpeg is optional (for video steganography).")
        print("       Install: https://ffmpeg.org/download.html")
    print()

    # ── 6. SendTo (Windows only) ──
    sendto_ok = True
    if is_win:
        print("[6/7] Windows shortcuts...")
        sendto_ok = _setup_sendto()
        _setup_desktop()
        print()

    # ── Summary ──
    print("=" * 55)
    print("   SETUP SUMMARY")
    print("=" * 55)
    print(f"   Python packages:     {'ALL OK' if all_ok else 'SOME FAILED'}")
    print(f"   Java:                {'OK' if java_found else 'MISSING (optional)'}")
    print(f"   c2patool (C2PA):     {'OK' if c2pa_found else 'MISSING (optional)'}")
    print(f"   OpenStego JAR:       {'OK' if jar_found else 'MISSING (optional)'}")
    print(f"   ffmpeg (video):      {'OK' if ffmpeg_found else 'MISSING (optional)'}")
    print(f"   SendTo shortcut:     {'OK' if sendto_ok else 'FAILED'}")
    print()
    print("   To launch:")
    if is_win:
        print("     - Double-click: RedoSan_Authenticity.bat")
    print("     - CLI:           python RedoSan_Authenticity.py --help")
    print()
    if sendto_ok and is_win:
        print("   Right-click any file -> Send To -> RedoSan Authenticity")
    print()

    if all_ok and c2pa_found and jar_found:
        print("  *** All dependencies installed! ***")
    elif c2pa_found or jar_found:
        print("  Partial setup - some optional features unavailable.")
        print("  Run install.py again anytime to re-download missing tools.")
    else:
        print("  Essential dependencies missing - the tool may not work.")
    
    if failed_packages:
        print()
        print("  Failed packages:", ", ".join(failed_packages))
        print("  Try running install.py as Administrator.")
    
    print()
    print("-" * 55)
    input("Press Enter to exit...")


def _setup_sendto():
    vbs_path = os.path.join(SCRIPT_DIR, "RedoSan_Authenticity_dragdrop.vbs")
    if not os.path.isfile(vbs_path):
        print("       WARNING: RedoSan_Authenticity_dragdrop.vbs not found")
        return False

    sendto = os.path.join(os.environ["APPDATA"], "Microsoft", "Windows", "SendTo")
    os.makedirs(sendto, exist_ok=True)
    lnk_path = os.path.join(sendto, "RedoSan Authenticity.lnk")

    ps = (
        '$w=New-Object -ComObject WScript.Shell;'
        f'$s=$w.CreateShortcut("{lnk_path}");'
        f'$s.TargetPath="{vbs_path}";'
        f'$s.WorkingDirectory="{SCRIPT_DIR}";'
        '$s.Description="Send to RedoSan Authenticity";$s.Save()'
    )
    r = subprocess.run(["powershell", "-Command", ps], capture_output=True, text=True)
    if r.returncode == 0:
        print("       SendTo shortcut created")
        return True
    print("       SendTo shortcut FAILED")
    return False


def _setup_desktop():
    bat_path = os.path.join(SCRIPT_DIR, "RedoSan_Authenticity.bat")
    if not os.path.isfile(bat_path):
        return False
    desktop = os.path.join(os.environ["USERPROFILE"], "Desktop")
    lnk_path = os.path.join(desktop, "RedoSan Authenticity.lnk")

    ps = (
        '$w=New-Object -ComObject WScript.Shell;'
        f'$s=$w.CreateShortcut("{lnk_path}");'
        f'$s.TargetPath="{bat_path}";'
        f'$s.WorkingDirectory="{SCRIPT_DIR}";'
        '$s.Description="RedoSan Authenticity";$s.Save()'
    )
    subprocess.run(["powershell", "-Command", ps], capture_output=True)
    return True


if __name__ == "__main__":
    main()

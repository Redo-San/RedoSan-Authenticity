#!/usr/bin/env python3
import os, sys, hashlib, subprocess, platform, shutil

__version__ = "1.0.0"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OTS_SCRIPT = os.path.join(SCRIPT_DIR, "ots_direct.py")


# -----------------------------------------------------------------------
#  Optional module imports
# -----------------------------------------------------------------------
MODULES = {}

try:
    from modules import audio as _audio_mod
    MODULES["audio"] = _audio_mod
except ImportError:
    MODULES["audio"] = None

try:
    from modules import video as _video_mod
    MODULES["video"] = _video_mod
except ImportError:
    MODULES["video"] = None

try:
    from modules import metadata as _meta_mod
    MODULES["metadata"] = _meta_mod
except ImportError:
    MODULES["metadata"] = None


def has_module(name):
    return MODULES.get(name) is not None


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


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def run_java(jar, args):
    return subprocess.run(
        ["java", "-jar", jar] + args,
        capture_output=True, text=True
    )


def run_ots(args):
    return subprocess.run(
        [sys.executable, OTS_SCRIPT] + args,
        capture_output=True, text=True
    )


def h1(t):
    print(f"\n{'=' * 55}\n   {t}\n{'=' * 55}")


def pause():
    print(f"\n{'-' * 55}")
    input("Press Enter to continue...")


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
    args = ["embed", "-a", "lsb", "-mf", secret, "-cf", cover, "-sf", output]
    if pw:
        args += ["-e", "-p", pw]
    r = run_java(jar, args)
    if r.returncode != 0:
        return print(f"ERROR: OpenStego failed:\n{r.stderr}")
    print(f"       Done: {output}")

    print("\n[2/3] Saving SHA-256...")
    h = sha256_file(output)
    with open(output + ".sha256.txt", "w") as f:
        f.write(f"{h}  {os.path.basename(output)}")
    print(f"       Saved: {output}.sha256.txt")

    print("\n[3/3] Creating timestamp proof...")
    r2 = run_ots(["stamp", output])
    if r2.returncode == 0:
        print(f"       OTS: {output}.ots")
        print("\n*** SUCCESS: Secret hidden & timestamped ***")
    else:
        print(f"WARNING: Timestamp failed: {r2.stderr.strip()}")


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
        print(r.stdout.strip() or "       No output from verifier")
        if r.stderr:
            print(r.stderr.strip())
    else:
        print("       No .ots file found, skipping verification")

    print("\n[2/2] Extracting hidden data...")
    args = ["extract", "-a", "lsb", "-sf", stego, "-xd", outdir]
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
    print("\n[1/2] Calculating SHA-256...")
    h = sha256_file(path)
    with open(path + ".sha256.txt", "w") as f:
        f.write(f"{h}  {os.path.basename(path)}")
    print(f"       Saved: {path}.sha256.txt")
    print("\n[2/2] Creating timestamp proof...")
    r = run_ots(["stamp", path])
    if r.returncode == 0:
        print("*** SUCCESS ***")
    else:
        print(f"ERROR: {r.stderr.strip()}")


def feature_verify():
    h1("VERIFY TIMESTAMP INTEGRITY")
    path = _s(input("File path: "))
    if not os.path.exists(path):
        return print("ERROR: File not found")
    r = run_ots(["verify", path])
    print(r.stdout.strip() or "       Done")
    if r.returncode != 0 and r.stderr:
        print(r.stderr.strip())


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
    r = run_java(jar, ["embedmark", "-a", "dwtxie", "-gf", sig, "-cf", cover, "-sf", output])
    if r.returncode != 0:
        return print(f"ERROR: OpenStego failed:\n{r.stderr}")
    print(f"       Done: {output}")

    print("\n[2/3] Saving SHA-256...")
    h = sha256_file(output)
    with open(output + ".sha256.txt", "w") as f:
        f.write(f"{h}  {os.path.basename(output)}")
    print(f"       Saved: {output}.sha256.txt")

    print("\n[3/3] Creating timestamp proof...")
    r2 = run_ots(["stamp", output])
    if r2.returncode == 0:
        print("*** SUCCESS ***")
    else:
        print(f"WARNING: Timestamp failed: {r2.stderr.strip()}")


def feature_gen_signature(jar):
    h1("GENERATE WATERMARK SIGNATURE")
    sig = _s(input("Output signature file path: "))
    if not sig:
        return print("ERROR: No path specified")
    pw = input("Password (Enter = none): ").strip()
    print("\nGenerating signature...")
    args = ["gensig", "-a", "dwtxie", "-gf", sig]
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
    r = run_java(jar, ["checkmark", "-a", "dwtxie", "-gf", sig, "-sf", stego])
    print(r.stdout.strip() or "       Done")
    if r.stderr:
        print(r.stderr.strip())


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
        h = sha256_file(filepath)
        with open(filepath + ".sha256.txt", "w") as f:
            f.write(f"{h}  {os.path.basename(filepath)}")
        print(f"SHA-256 saved: {filepath}.sha256.txt")
        r = run_ots(["stamp", filepath])
        print("*** Timestamped ***" if r.returncode == 0 else f"ERROR: {r.stderr.strip()}")
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
        args = ["embed", "-a", "lsb", "-mf", secret, "-cf", filepath, "-sf", output]
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
        args = ["extract", "-a", "lsb", "-sf", filepath, "-xd", outdir]
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
        return print("ERROR: File not found")
    meta = MODULES["metadata"].read_metadata(path)
    MODULES["metadata"].print_metadata(meta)


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
        return print("ERROR: File not found")
    meta, err = MODULES["metadata"].c2pa_read(path)
    if err:
        print(f"\n  {err}")
    else:
        MODULES["metadata"].c2pa_print(meta, path)


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
        algo = input("Stego algorithm (e.g. lsb, dwtxie): ").strip() or "lsb"
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
#  Entry point
# -----------------------------------------------------------------------

def main():
    if "--version" in sys.argv or "-v" in sys.argv:
        print(f"RedoSan Authenticity v{__version__}")
        return
    if "--setup" in sys.argv or "--install" in sys.argv:
        return run_setup()

    jar = find_openstego_jar()
    java = find_java()

    # Only check deps in menu mode; batch mode may still work for timestamping
    if len(sys.argv) <= 1 or not os.path.isfile(sys.argv[1]):
        check_deps()

    # Batch mode: file dropped as argument
    if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]):
        feature_batch_process(sys.argv[1], jar)
        return

    # Interactive menu
    while True:
        os.system("cls" if os.name == "nt" else "clear")
        print("=" * 55)
        print(f"          RedoSan Authenticity v{__version__}")
        print("   Steganography + OpenTimestamps Integration")
        print("=" * 55)
        if not jar:
            print("  [!] OpenStego not found - only timestamping features available")
        if not java or not check_pip_packages():
            print("  [!] Some features limited - run with --setup for info")
        print()
        print("  == IMAGE STEGANOGRAPHY ==")
        print("  1. Hide secret in image + Timestamp")
        print("  2. Extract secret + Verify timestamp")
        print("  5. Watermark image + Timestamp")
        print("  6. Generate watermark signature")
        print("  7. Check watermark in image")
        if has_module("audio"):
            print()
            print("  == AUDIO STEGANOGRAPHY ==")
            print("  8. Hide data in audio (WAV LSB)")
            print("  9. Extract data from audio")
        if has_module("video"):
            print()
            print("  == VIDEO STEGANOGRAPHY ==")
            print("  10. Hide data in video (ffmpeg + LSB)")
            print("  11. Extract data from video")
        if has_module("metadata"):
            print()
            print("  == METADATA ==")
            print("  12. View file metadata")
            print("  13. Write metadata (EXIF/ID3)")
            print()
            print("  == C2PA PROVENANCE (AI CONTENT) ==")
            print("  14. Read C2PA provenance (AI credentials)")
            print("  15. Write C2PA provenance (AI/stego claims)")
            print("  16. Init C2PA certificate (first use)")
        print()
        print("  == TIMESTAMPING ==")
        print("  3. Timestamp a file")
        print("  4. Verify timestamp integrity")
        if not jar or not java or not check_pip_packages() or not has_module("audio"):
            print()
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
            feature_timestamp()
        elif choice == "4":
            feature_verify()
        elif choice == "5":
            if not jar: print("ERROR: OpenStego not found"); pause(); continue
            feature_watermark_timestamp(jar)
        elif choice == "6":
            if not jar: print("ERROR: OpenStego not found"); pause(); continue
            feature_gen_signature(jar)
        elif choice == "7":
            if not jar: print("ERROR: OpenStego not found"); pause(); continue
            feature_check_watermark(jar)
        elif choice == "8" and has_module("audio"):
            feature_audio_embed()
        elif choice == "9" and has_module("audio"):
            feature_audio_extract()
        elif choice == "10" and has_module("video"):
            feature_video_embed()
        elif choice == "11" and has_module("video"):
            feature_video_extract()
        elif choice == "12" and has_module("metadata"):
            feature_metadata()
        elif choice == "13" and has_module("metadata"):
            feature_write_metadata()
        elif choice == "14" and has_module("metadata"):
            feature_c2pa_read()
        elif choice == "15" and has_module("metadata"):
            feature_c2pa_write()
        elif choice == "16" and has_module("metadata"):
            feature_c2pa_init()
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
        print("Reinstall the tool or copy ots_direct.py to the same directory.")
        sys.exit(1)
    main()

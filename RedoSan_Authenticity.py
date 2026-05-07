import os, sys, hashlib, subprocess, platform

__version__ = "1.0.0"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

OPENSTEGO_JAR = (
    os.environ.get("OPENSTEGO_JAR")
    or r"C:\Program Files (x86)\OpenStego\lib\openstego.jar"
)


def _find_python():
    candidates = [
        r"C:\Program Files\Python311\python.exe",
        r"C:\Users\pc\AppData\Local\Programs\Python\Python311\python.exe",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    for p in os.environ.get("PATH", "").split(os.pathsep):
        exe = os.path.join(p, "python3.exe")
        if os.path.exists(exe):
            return exe
        exe = os.path.join(p, "python.exe")
        if os.path.exists(exe):
            return exe
    return "python"


PYTHON_CMD = os.environ.get("REDOSAN_PYTHON") or _find_python()
OTS_SCRIPT = os.path.join(SCRIPT_DIR, "ots_direct.py")


def java_available():
    try:
        subprocess.run(["java", "-version"], capture_output=True, check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def run_java(args):
    return subprocess.run(
        ["java", "-jar", OPENSTEGO_JAR] + args,
        capture_output=True, text=True
    )


def run_ots(args):
    return subprocess.run(
        [PYTHON_CMD, OTS_SCRIPT] + args,
        capture_output=True, text=True
    )


def _strip_quotes(s):
    return s.strip().strip("\"'")

# ---------------------------------------------------------------------------
#  Feature functions
# ---------------------------------------------------------------------------

def print_header(title):
    print(f"\n{'=' * 55}")
    print(f"   {title}")
    print(f"{'=' * 55}")


def wait_and_exit():
    print(f"\n{'-' * 55}")
    input("Press Enter to continue...")


def feature_hide_timestamp():
    print_header("HIDE SECRET IN IMAGE + TIMESTAMP")
    cover = _strip_quotes(input("Cover image path: "))
    secret = _strip_quotes(input("Secret file path: "))
    output = _strip_quotes(input("Output image path (Enter = auto): "))
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
    r = run_java(args)
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


def feature_extract_verify():
    print_header("EXTRACT SECRET + VERIFY TIMESTAMP")
    stego = _strip_quotes(input("Stego image path: "))
    outdir = _strip_quotes(input("Extract to directory (Enter = current): "))
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
    r = run_java(args)
    if r.returncode == 0:
        print(f"       Extracted to: {outdir}")
    else:
        print(f"ERROR: Extraction failed:\n{r.stderr}")


def feature_timestamp():
    print_header("TIMESTAMP A FILE")
    path = _strip_quotes(input("File path: "))
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
    print_header("VERIFY TIMESTAMP INTEGRITY")
    path = _strip_quotes(input("File path: "))
    if not os.path.exists(path):
        return print("ERROR: File not found")
    r = run_ots(["verify", path])
    print(r.stdout.strip() or "       Done")
    if r.returncode != 0 and r.stderr:
        print(r.stderr.strip())


def feature_watermark_timestamp():
    print_header("WATERMARK IMAGE + TIMESTAMP")
    sig = _strip_quotes(input("Signature file path: "))
    cover = _strip_quotes(input("Cover image path: "))
    output = _strip_quotes(input("Output image path (Enter = auto): "))
    if not output:
        base, ext = os.path.splitext(cover)
        output = f"{base}_watermarked{ext}"

    if not os.path.exists(sig):
        return print("ERROR: Signature not found")
    if not os.path.exists(cover):
        return print("ERROR: Cover image not found")

    print("\n[1/3] Watermarking image...")
    r = run_java(["embedmark", "-a", "dwtxie", "-gf", sig, "-cf", cover, "-sf", output])
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


def feature_gen_signature():
    print_header("GENERATE WATERMARK SIGNATURE")
    sig = _strip_quotes(input("Output signature file path: "))
    if not sig:
        return print("ERROR: No path specified")
    pw = input("Password (Enter = none): ").strip()
    print("\nGenerating signature...")
    args = ["gensig", "-a", "dwtxie", "-gf", sig]
    r = run_java(args)
    if r.returncode == 0:
        print(f"       Signature saved to: {sig}")
    else:
        print(f"ERROR: {r.stderr.strip()}")


def feature_check_watermark():
    print_header("CHECK WATERMARK")
    sig = _strip_quotes(input("Signature file: "))
    stego = _strip_quotes(input("Stego image: "))
    if not os.path.exists(sig):
        return print("ERROR: Signature not found")
    if not os.path.exists(stego):
        return print("ERROR: Image not found")
    r = run_java(["checkmark", "-a", "dwtxie", "-gf", sig, "-sf", stego])
    print(r.stdout.strip() or "       Done")
    if r.stderr:
        print(r.stderr.strip())


def feature_batch_process(filepath):
    print_header("BATCH: PROCESS DROPPED FILE")
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
        secret = _strip_quotes(input("Secret file to hide: "))
        if not os.path.exists(secret):
            return print("ERROR: Secret not found")
        output = os.path.splitext(filepath)[0] + "_stego" + ext
        pw = input("Password (Enter=none): ").strip()
        args = ["embed", "-a", "lsb", "-mf", secret, "-cf", filepath, "-sf", output]
        if pw:
            args += ["-e", "-p", pw]
        r = run_java(args)
        print(f"Secret hidden in: {output}" if r.returncode == 0 else f"ERROR: {r.stderr.strip()}")
    elif choice == "4":
        outdir = _strip_quotes(input("Extract to directory (Enter=auto): "))
        if not outdir:
            outdir = os.path.dirname(filepath) or "."
        pw = input("Password (Enter=none): ").strip()
        args = ["extract", "-a", "lsb", "-sf", filepath, "-xd", outdir]
        if pw:
            args += ["-p", pw]
        r = run_java(args)
        print(f"Extracted to: {outdir}" if r.returncode == 0 else f"ERROR: {r.stderr.strip()}")
    else:
        print("Invalid choice")


def main_menu():
    while True:
        os.system("cls" if os.name == "nt" else "clear")
        print("=" * 55)
        print(f"          RedoSan Authenticity v{__version__}")
        print("   Steganography + OpenTimestamps Integration")
        print("=" * 55)
        print()
        print("  1. Hide secret in image + Timestamp")
        print("  2. Extract secret + Verify timestamp")
        print("  3. Timestamp a file")
        print("  4. Verify timestamp integrity")
        print("  5. Watermark image + Timestamp")
        print("  6. Generate watermark signature")
        print("  7. Check watermark in image")
        print("  0. Exit")
        print()
        choice = input("  Choice: ").strip()
        if choice == "1":
            feature_hide_timestamp()
        elif choice == "2":
            feature_extract_verify()
        elif choice == "3":
            feature_timestamp()
        elif choice == "4":
            feature_verify()
        elif choice == "5":
            feature_watermark_timestamp()
        elif choice == "6":
            feature_gen_signature()
        elif choice == "7":
            feature_check_watermark()
        elif choice == "0":
            print("Goodbye!")
            break
        else:
            print("Invalid choice")
        wait_and_exit()


if __name__ == "__main__":
    if "--version" in sys.argv or "-v" in sys.argv:
        print(f"RedoSan Authenticity v{__version__}")
        sys.exit(0)

    if not java_available():
        print("ERROR: Java not found. OpenStego requires Java.")
        print("Install Java from: https://www.java.com/download/")
        sys.exit(1)
    if not os.path.exists(OPENSTEGO_JAR):
        print(f"ERROR: OpenStego not found at: {OPENSTEGO_JAR}")
        print("Set OPENSTEGO_JAR environment variable if installed elsewhere.")
        sys.exit(1)
    if not os.path.exists(OTS_SCRIPT):
        print(f"ERROR: {OTS_SCRIPT} not found. Reinstall the tool.")
        sys.exit(1)

    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        feature_batch_process(sys.argv[1])
    else:
        main_menu()

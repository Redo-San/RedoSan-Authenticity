#!/usr/bin/env python3
"""
RedoSan Authenticity - Setup & Dependency Installer
Run:  python install.py
"""
import os, sys, subprocess, platform

PACKAGES = ["opentimestamps", "opentimestamps-client", "Pillow", "mutagen"]


def run(cmd, desc):
    print(f"  [{desc}] ", end="", flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0:
        print("OK")
    else:
        print("FAILED")
        print(f"    {r.stderr.strip()}")
    return r.returncode == 0


def main():
    print("=" * 55)
    print("   RedoSan Authenticity - Setup")
    print("=" * 55)
    print(f"   Platform: {platform.system()} {platform.release()}")
    print(f"   Python:   {sys.version.split()[0]}")
    print()

    # 1. Python packages
    print("[1/4] Installing Python packages...")
    all_ok = True
    for pkg in PACKAGES:
        ok = run([sys.executable, "-m", "pip", "install", pkg], pkg)
        if not ok:
            all_ok = False
    print()

    # 2. Java check
    print("[2/4] Checking Java...")
    ok = run(["java", "-version"], "java -version") if platform.system() != "Windows" else run(
        ["java", "-version"], "java -version")
    if not ok:
        print("       Install Java from: https://www.java.com/download/")
    print()

    # 3. Extended modules check
    print("[3/5] Checking audio module (WAV LSB)...")
    print("       Pure Python - no deps needed")
    audio_ok = True
    print()

    print("[4/5] Checking ffmpeg for video module...")
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        print("       ffmpeg found")
    except:
        print("       ffmpeg not found (optional, for video stego)")
        print("       Install from: https://ffmpeg.org/")
    print()

    print("[5/5] Checking OpenStego...")
    if platform.system() == "Windows":
        jars = [
            r"C:\Program Files (x86)\OpenStego\lib\openstego.jar",
            r"C:\Program Files\OpenStego\lib\openstego.jar",
        ]
    elif platform.system() == "Darwin":
        jars = ["/Applications/OpenStego/lib/openstego.jar"]
    else:
        jars = ["/usr/local/share/openstego/lib/openstego.jar",
                "/usr/share/openstego/lib/openstego.jar"]

    found = any(os.path.isfile(j) for j in jars)
    local = os.path.join(os.path.dirname(__file__) or ".", "openstego.jar")
    if os.path.isfile(local):
        found = True
    if found:
        print("       OpenStego found")
    else:
        print("       OpenStego not found")
        print("       Download from: https://www.openstego.com/")
        print("       Or place openstego.jar in this directory.")
    print()

    # 4. Summary
    print("[4/4] Summary...")
    print()
    print("       To start the tool:")
    print(f"         {sys.executable} RedoSan_Authenticity.py")
    print()
    if all_ok:
        print("  *** Setup complete! ***")
    else:
        print("  Some items failed - check messages above.")

    input("\nPress Enter to exit...")


if __name__ == "__main__":
    main()

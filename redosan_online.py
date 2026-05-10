#!/usr/bin/env python3
"""
RedoSan Authenticity - Online Launcher
Fetches the latest code from GitHub and runs it temporarily.
All fetched files are deleted on exit.
"""
import os, sys, tempfile, shutil, urllib.request, zipfile, subprocess, atexit

REPO_URL = "https://github.com/Redo-San/RedoSan-Authenticity/archive/refs/heads/beta-release.zip"
RAW_BASE = "https://raw.githubusercontent.com/Redo-San/RedoSan-Authenticity/beta-release"

def main():
    tmp = tempfile.mkdtemp(prefix="redosan_")
    atexit.register(lambda: shutil.rmtree(tmp, ignore_errors=True))

    # Download the repo zip
    print("[1/3] Downloading RedoSan Authenticity from GitHub...")
    zip_path = os.path.join(tmp, "repo.zip")
    urllib.request.urlretrieve(REPO_URL, zip_path)

    # Extract
    print("[2/3] Extracting...")
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(tmp)

    # Find the extracted folder (it has a predictable name)
    extracted = os.path.join(tmp, "RedoSan-Authenticity-beta-release")
    os.chdir(extracted)
    sys.path.insert(0, extracted)

    # Run
    print("[3/3] Starting RedoSan Authenticity...\n")
    print("=" * 50)
    print("Type 'exit' or close the window to quit")
    print("All temporary files will be deleted automatically")
    print("=" * 50 + "\n")

    try:
        import RedoSan_Authenticity
        RedoSan_Authenticity.main()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

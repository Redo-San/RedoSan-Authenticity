#!/usr/bin/env python3
"""
RedoSan Authenticity GUI - Online Launcher
Fetches the latest code from GitHub and runs the GUI temporarily.
All fetched files are deleted on exit.
"""
import os, sys, tempfile, shutil, urllib.request, zipfile, subprocess, atexit

REPO_URL = "https://github.com/Redo-San/RedoSan-Authenticity/archive/refs/heads/beta-release.zip"

def main():
    tmp = tempfile.mkdtemp(prefix="redosan_")
    atexit.register(lambda: shutil.rmtree(tmp, ignore_errors=True))

    print("[1/3] Downloading RedoSan Authenticity from GitHub...")
    zip_path = os.path.join(tmp, "repo.zip")
    urllib.request.urlretrieve(REPO_URL, zip_path)

    print("[2/3] Extracting...")
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(tmp)

    extracted = os.path.join(tmp, "RedoSan-Authenticity-beta-release")

    print("[3/3] Starting GUI...")
    subprocess.run([sys.executable, "RedoSan_Authenticity_gui.py"],
                   cwd=extracted)

if __name__ == "__main__":
    main()

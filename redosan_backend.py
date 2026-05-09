#!/usr/bin/env python3
"""
RedoSan Backend - Rust-powered utilities via subprocess
Run: python -m redosan_backend
"""
import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RUST_EXE = os.path.join(SCRIPT_DIR, "rust_gui", "target", "release", "redosan_backend.exe")

def progress_bar(current: int, total: int) -> str:
    """Show progress bar from Rust."""
    if not os.path.isfile(RUST_EXE):
        return f"[{'='*10}{'-'*10}] 0%"
    
    try:
        result = subprocess.run(
            [RUST_EXE, "progress", str(current), str(total)],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.stdout.strip()
    except Exception as e:
        return f"Error: {e}"

def file_hash(filepath: str) -> dict:
    """Get file hash from Rust."""
    if not os.path.isfile(RUST_EXE):
        return {"hash": None, "time_ms": None, "error": "Binary not found"}
    
    if not os.path.isfile(filepath):
        return {"hash": None, "time_ms": None, "error": "File not found"}
    
    try:
        result = subprocess.run(
            [RUST_EXE, "hash", filepath],
            capture_output=True,
            text=True,
            timeout=30
        )
        output = result.stdout.strip()
        lines = output.split("\n")
        data = {"hash": None, "time_ms": None}
        for line in lines:
            if line.startswith("Hash:"):
                data["hash"] = line.split(":")[1].strip()
            elif line.startswith("Time:"):
                time_str = line.split(":")[1].strip().rstrip("ms")
                data["time_ms"] = float(time_str)
        return data
    except Exception as e:
        return {"hash": None, "time_ms": None, "error": str(e)}

def file_size(filepath: str) -> int:
    """Get file size from Rust."""
    if not os.path.isfile(RUST_EXE):
        return 0
    
    if not os.path.isfile(filepath):
        return 0
    
    try:
        result = subprocess.run(
            [RUST_EXE, "size", filepath],
            capture_output=True,
            text=True,
            timeout=5
        )
        output = result.stdout.strip()
        if output.startswith("Size:"):
            return int(output.split(":")[1].strip().split()[0])
    except Exception:
        pass
    return 0

def is_available() -> bool:
    """Check if Rust binary is available."""
    return os.path.isfile(RUST_EXE)

if __name__ == "__main__":
    print("RedoSan Backend v0.1.0")
    print(f"Binary: {RUST_EXE}")
    print(f"Available: {is_available()}")
    print()
    print("Commands:")
    print("  progress <current> <total>")
    print("  hash ")
    print("  size ")
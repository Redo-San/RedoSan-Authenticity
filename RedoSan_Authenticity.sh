#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
if command -v python3 &> /dev/null; then
    python3 "$DIR/RedoSan_Authenticity.py" "$@"
elif command -v python &> /dev/null; then
    python "$DIR/RedoSan_Authenticity.py" "$@"
else
    echo "ERROR: Python not found. Install Python 3 from https://www.python.org/"
    exit 1
fi

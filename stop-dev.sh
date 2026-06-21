#!/usr/bin/env sh
PID_FILE="${TMPDIR:-/tmp}/.redosan-dev.pid"
if [ ! -f "$PID_FILE" ]; then
  echo "No running server found."
  exit 1
fi
PID=$(cat "$PID_FILE")
kill "$PID" 2>/dev/null
rm -f "$PID_FILE"
echo "Dev server stopped."

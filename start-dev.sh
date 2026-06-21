#!/usr/bin/env sh
PID_FILE="${TMPDIR:-/tmp}/.redosan-dev.pid"
if [ -f "$PID_FILE" ]; then
  echo "Server is already running (PID file exists)"
  exit 1
fi
nohup node dev-server.js > /dev/null 2>&1 &
echo $! > "$PID_FILE"
echo "Dev server started (PID $(cat "$PID_FILE"))"
echo "http://localhost:8080"
echo "Run ./stop-dev.sh to stop the server."

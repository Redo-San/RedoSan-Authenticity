#!/usr/bin/env sh
PID_FILE="${TMPDIR:-/tmp}/.redosan-dev.pid"

menu() {
  clear
  echo "============================================"
  echo "     RedoSan Authenticity - Dev Server"
  echo "============================================"
  echo ""
  echo "  1) Start server"
  echo "  2) Restart server"
  echo "  3) Stop server"
  echo "  4) Check server status"
  echo "  5) Exit"
  echo ""
  echo "============================================"
  printf "Enter your choice (1-5): "
  read -r CHOICE

  case "$CHOICE" in
    1) start_server ;;
    2) restart_server ;;
    3) stop_server ;;
    4) check_status ;;
    5) exit 0 ;;
    *) menu ;;
  esac
}

start_server() {
  if [ -f "$PID_FILE" ]; then
    echo ""
    echo "Server is already running."
    sleep 2
    menu
    return
  fi
  nohup node dev-server.js > /dev/null 2>&1 &
  echo $! > "$PID_FILE"
  echo ""
  echo "Dev server started (PID $(cat "$PID_FILE")) on http://localhost:8080"
  echo ""
  printf "Press ENTER to return to menu..."
  read -r _unused
  menu
}

restart_server() {
  echo ""
  echo "Stopping server..."
  kill_server
  echo "Starting server..."
  nohup node dev-server.js > /dev/null 2>&1 &
  echo $! > "$PID_FILE"
  echo "Dev server restarted (PID $(cat "$PID_FILE")) on http://localhost:8080"
  echo ""
  printf "Press ENTER to return to menu..."
  read -r _unused
  menu
}

stop_server() {
  echo ""
  kill_server
  echo "Dev server stopped."
  echo ""
  printf "Press ENTER to return to menu..."
  read -r _unused
  menu
}

check_status() {
  echo ""
  if [ ! -f "$PID_FILE" ]; then
    echo "Server is NOT running."
  else
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      echo "Server is RUNNING (PID: $PID) on http://localhost:8080"
    else
      echo "PID file exists but process is not running (stale PID)"
      rm -f "$PID_FILE"
    fi
  fi
  sleep 3
  menu
}

kill_server() {
  [ ! -f "$PID_FILE" ] && return
  PID=$(cat "$PID_FILE")
  kill "$PID" 2>/dev/null
  rm -f "$PID_FILE"
}

menu

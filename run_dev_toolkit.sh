#!/usr/bin/env sh
# ═══════════════════════════════════════════════════════════════
#  RedoSan Authenticity — Dev Tools
#  v1.0.0 — Project Toolkit
#  Usage: ./run_dev_toolkit.sh
# ═══════════════════════════════════════════════════════════════

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
BIN="$ROOT/node_modules/.bin/"

# ── ANSI colors ──
BOLD="$(tput bold 2>/dev/null || printf '')"
DIM="$(tput dim 2>/dev/null || printf '')"
RESET="$(tput sgr0 2>/dev/null || printf '')"
CYAN="$(tput setaf 6 2>/dev/null || printf '')"
GREEN="$(tput setaf 2 2>/dev/null || printf '')"
YELLOW="$(tput setaf 3 2>/dev/null || printf '')"
RED="$(tput setaf 1 2>/dev/null || printf '')"
MAGENTA="$(tput setaf 5 2>/dev/null || printf '')"
BLUE="$(tput setaf 4 2>/dev/null || printf '')"

# ── Prerequisites ──
command -v npm >/dev/null 2>&1 || { printf '%s\n' "${RED}npm not found in PATH${RESET}"; exit 1; }
command -v npx >/dev/null 2>&1 || { printf '%s\n' "${RED}npx not found in PATH${RESET}"; exit 1; }
[ -f "package.json" ] || { printf '%s\n' "${RED}Error: package.json not found. Run from project root.${RESET}"; exit 1; }

# ── Banner ──
banner() {
  clear 2>/dev/null || printf '\033c'
  printf '%s\n' "${CYAN}"
  printf '  ╔══════════════════════════════════════════════════╗\n'
  printf '  ║       %sRedoSan Authenticity — Dev Toolkit%s%s         ║\n' "${BOLD}" "${RESET}" "${CYAN}"
  printf '  ║       %sv1.0.0 — run_dev_toolkit%s                   ║\n' "${DIM}" "${RESET}${CYAN}"
  printf '  ╚══════════════════════════════════════════════════╝\n'
  printf '%s\n' "${RESET}"
}

# ── Tool runner ──
run() {
  name="$1"
  shift
  banner
  printf '\n'
  printf '  %s╔══════════════════════════════════════╗%s\n' "${BOLD}${MAGENTA}" "${RESET}"
  printf '  %s║       Running: %-22s║%s\n' "${BOLD}${MAGENTA}" "$name" "${RESET}"
  printf '  %s╚══════════════════════════════════════╝%s\n' "${BOLD}${MAGENTA}" "${RESET}"
  printf '\n'
  printf '  %sCommand: %s%s\n\n' "${DIM}" "$*" "${RESET}"

  if [ "$name" = "ESLint" ]; then
    printf '  %s[Info] First run may take several minutes while ESLint builds its cache.%s\n' "${YELLOW}" "${RESET}"
    printf '  %s        Subsequent runs are fast. Please wait...%s\n\n' "${YELLOW}" "${RESET}"
  fi

  # Run, capture exit code without set -e killing the script
  set +e
  start_s=$(date +%s)
  "$@"
  ec=$?
  end_s=$(date +%s)
  set -e

  printf '\n'
  if [ $ec -eq 0 ]; then
    printf '  %s%s✓ %s completed successfully%s  %s(elapsed: %ds)%s\n' "${GREEN}" "${BOLD}" "$name" "${RESET}" "${DIM}" "$((end_s - start_s))" "${RESET}"
  else
    printf '  %s%s✗ %s failed (exit code: %d)%s  %s(elapsed: %ds)%s\n' "${RED}" "${BOLD}" "$name" $ec "${RESET}" "${DIM}" "$((end_s - start_s))" "${RESET}"
  fi
  printf '\n  %sPress RETURN to continue...%s' "${DIM}" "${RESET}"
  read -r _unused
}

# ── Dev server management (port 8080) ──
ensure_server() {
  SERVER_PID=""
  if command -v curl >/dev/null 2>&1 && curl -sf http://127.0.0.1:8080/ >/dev/null 2>&1; then
    printf '  %s[Server] Dev server already running on port 8080%s\n' "${GREEN}" "${RESET}"
    return 0
  fi
  printf '  %s[Server] Dev server not running. Starting on port 8080...%s\n' "${YELLOW}" "${RESET}"
  node dev-server.js &
  SERVER_PID=$!
  max_wait=30
  waited=0
  while [ $waited -lt $max_wait ]; do
    sleep 2
    waited=$((waited + 2))
    if curl -sf http://127.0.0.1:8080/ >/dev/null 2>&1; then
      printf '  %s[Server] Dev server ready.%s\n' "${GREEN}" "${RESET}"
      return 0
    fi
  done
  printf '  %s[Server] Failed to start dev server!%s\n' "${RED}" "${RESET}"
  kill "$SERVER_PID" 2>/dev/null || true
  SERVER_PID=""
  return 1
}

stop_server() {
  if [ -n "$SERVER_PID" ]; then
    printf '  %s[Server] Stopping dev server...%s\n' "${DIM}" "${RESET}"
    kill "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
  fi
}

# ── Runner for tools that need the dev server ──
run_with_server() {
  name="$1"
  shift
  banner
  printf '\n'
  printf '  %s╔══════════════════════════════════════╗%s\n' "${BOLD}${MAGENTA}" "${RESET}"
  printf '  %s║       Running: %-22s║%s\n' "${BOLD}${MAGENTA}" "$name" "${RESET}"
  printf '  %s╚══════════════════════════════════════╝%s\n' "${BOLD}${MAGENTA}" "${RESET}"
  printf '\n'

  ensure_server || {
    printf '\n  %sPress RETURN to continue...%s' "${DIM}" "${RESET}"
    read -r _unused
    return
  }
  printf '\n'

  set +e
  start_s=$(date +%s)
  "$@"
  ec=$?
  end_s=$(date +%s)
  set -e

  stop_server

  printf '\n'
  if [ $ec -eq 0 ]; then
    printf '  %s%s✓ %s completed successfully%s  %s(elapsed: %ds)%s\n' "${GREEN}" "${BOLD}" "$name" "${RESET}" "${DIM}" "$((end_s - start_s))" "${RESET}"
  else
    printf '  %s%s✗ %s failed (exit code: %d)%s  %s(elapsed: %ds)%s\n' "${RED}" "${BOLD}" "$name" $ec "${RESET}" "${DIM}" "$((end_s - start_s))" "${RESET}"
  fi
  printf '\n  %sPress RETURN to continue...%s' "${DIM}" "${RESET}"
  read -r _unused
}

# ── LHCI runner with auto server management ──
run_lhci() {
  name="LHCI"
  banner
  printf '\n'
  printf '  %s╔══════════════════════════════════════╗%s\n' "${BOLD}${MAGENTA}" "${RESET}"
  printf '  %s║       Running: %-22s║%s\n' "${BOLD}${MAGENTA}" "$name" "${RESET}"
  printf '  %s╚══════════════════════════════════════╝%s\n' "${BOLD}${MAGENTA}" "${RESET}"
  printf '\n'

  ensure_server || {
    printf '\n  %sPress RETURN to continue...%s' "${DIM}" "${RESET}"
    read -r _unused
    return
  }
  printf '\n'

  # ── Run LHCI ──
  set +e
  start_s=$(date +%s)
  "$BIN"lhci autorun --config "$ROOT/.tools/Developer_Toolkit/lighthouserc.js"
  ec=$?
  end_s=$(date +%s)
  set -e

  # ── Cleanup ──
  stop_server

  printf '\n'
  if [ $ec -eq 0 ]; then
    printf '  %s%s✓ %s completed successfully%s  %s(elapsed: %ds)%s\n' "${GREEN}" "${BOLD}" "$name" "${RESET}" "${DIM}" "$((end_s - start_s))" "${RESET}"
  else
    printf '  %s%s✗ %s failed (exit code: %d)%s  %s(elapsed: %ds)%s\n' "${RED}" "${BOLD}" "$name" $ec "${RESET}" "${DIM}" "$((end_s - start_s))" "${RESET}"
  fi
  printf '\n  %sPress RETURN to continue...%s' "${DIM}" "${RESET}"
  read -r _unused
}

# ── CLOC runner with auto-download ──
run_cloc() {
  name="CLOC"
  CLI="" RUNNER=""
  banner
  printf '\n'
  printf '  %s╔══════════════════════════════════════╗%s\n' "${BOLD}${MAGENTA}" "${RESET}"
  printf '  %s║       Running: %-22s║%s\n' "${BOLD}${MAGENTA}" "$name" "${RESET}"
  printf '  %s╚══════════════════════════════════════╝%s\n' "${BOLD}${MAGENTA}" "${RESET}"
  printf '\n'

  if command -v cloc >/dev/null 2>&1; then
    CLI="cloc"
  elif [ -f "$ROOT/.tools/cloc" ]; then
    CLI="$ROOT/.tools/cloc"
    if command -v perl >/dev/null 2>&1; then
      RUNNER="perl"
    else
      printf '  %s[FAIL] Found .tools/cloc but perl is required to run it.%s\n' "${RED}" "${RESET}"
      printf '         Install cloc via your package manager (apt/brew/dnf) and retry.%s\n' "${RED}" "${RESET}"
      printf '\n  %sPress RETURN to continue...%s' "${DIM}" "${RESET}"
      read -r _unused
      return
    fi
  else
    printf '  %s[Download] cloc not found. Downloading from GitHub...%s\n' "${YELLOW}" "${RESET}"
    mkdir -p "$ROOT/.tools"
    dl_ok=1
    if command -v curl >/dev/null 2>&1; then
      curl -sfL -o "$ROOT/.tools/cloc" https://raw.githubusercontent.com/AlDanial/cloc/master/cloc && dl_ok=0
    elif command -v wget >/dev/null 2>&1; then
      wget -qO "$ROOT/.tools/cloc" https://raw.githubusercontent.com/AlDanial/cloc/master/cloc && dl_ok=0
    fi
    chmod +x "$ROOT/.tools/cloc" 2>/dev/null || true
    if [ $dl_ok -ne 0 ] || [ ! -s "$ROOT/.tools/cloc" ]; then
      printf '  %s[FAIL] Could not download cloc (need curl or wget).%s\n' "${RED}" "${RESET}"
      printf '         Install cloc manually via your package manager (apt/brew/dnf).%s\n' "${RED}" "${RESET}"
      printf '\n  %sPress RETURN to continue...%s' "${DIM}" "${RESET}"
      read -r _unused
      return
    fi
    CLI="$ROOT/.tools/cloc"
    if command -v perl >/dev/null 2>&1; then
      RUNNER="perl"
    else
      printf '  %s[FAIL] cloc downloaded but perl is required to run it.%s\n' "${RED}" "${RESET}"
      printf '         Install perl or cloc via your package manager.%s\n' "${RED}" "${RESET}"
      printf '\n  %sPress RETURN to continue...%s' "${DIM}" "${RESET}"
      read -r _unused
      return
    fi
  fi

  printf '  %s[OK] Using: %s%s\n\n' "${GREEN}" "$CLI" "${RESET}"

  set +e
  start_s=$(date +%s)
  if [ -n "$RUNNER" ]; then
    "$RUNNER" "$CLI" . --exclude-dir=node_modules,.lighthouseci,backstop_data,vendor,coverage,test-results,.stryker-tmp,.tools,.claude,.opencode,.agents,skills --quiet --progress-rate=0
  else
    "$CLI" . --exclude-dir=node_modules,.lighthouseci,backstop_data,vendor,coverage,test-results,.stryker-tmp,.tools,.claude,.opencode,.agents,skills --quiet --progress-rate=0
  fi
  ec=$?
  end_s=$(date +%s)
  set -e

  printf '\n'
  if [ $ec -eq 0 ]; then
    printf '  %s%s✓ %s completed successfully%s  %s(elapsed: %ds)%s\n' "${GREEN}" "${BOLD}" "$name" "${RESET}" "${DIM}" "$((end_s - start_s))" "${RESET}"
  else
    printf '  %s%s✗ %s failed (exit code: %d)%s  %s(elapsed: %ds)%s\n' "${RED}" "${BOLD}" "$name" $ec "${RESET}" "${DIM}" "$((end_s - start_s))" "${RESET}"
  fi
  printf '\n  %sPress RETURN to continue...%s' "${DIM}" "${RESET}"
  read -r _unused
}

# ── Menu ──
menu() {
  banner
  printf '\n'
  printf '  %sSelect a tool to run:%s\n' "${BOLD}" "${RESET}"
  printf '\n'
  printf '  %s── Code Quality ──────────────────────────%s\n' "${CYAN}" "${RESET}"
  printf '  %s [1]%s  Biome          %s(lint + format)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s [2]%s  ESLint         %s(JS lint)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s [3]%s  Stylelint      %s(CSS lint)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '\n'
  printf '  %s── Testing ───────────────────────────────%s\n' "${CYAN}" "${RESET}"
  printf '  %s [4]%s  Madge          %s(circular deps)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s [5]%s  Core tests     %s(unit tests)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s [6]%s  All tests      %s(full suite)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s [7]%s  Coverage       %s(code coverage)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s [8]%s  CLOC           %s(count lines of code)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '\n'
  printf '  %s── Documentation ─────────────────────────%s\n' "${CYAN}" "${RESET}"
  printf '  %s [9]%s  TypeDoc        %s(API docs)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[10]%s  Markdownlint   %s(MD quality)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '\n'
  printf '  %s── Dependencies ──────────────────────────%s\n' "${CYAN}" "${RESET}"
  printf '  %s[11]%s  Depcheck       %s(unused deps)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[12]%s  Size Limit     %s(bundle budget)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[13]%s  CSpell         %s(spell check)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '\n'
  printf '  %s── Git ───────────────────────────────────%s\n' "${CYAN}" "${RESET}"
  printf '  %s[14]%s  Commitlint     %s(check commit msg)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[15]%s  Husky          %s(reinstall hooks)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '\n'
  printf '  %s── Build / E2E ───────────────────────────%s\n' "${CYAN}" "${RESET}"
  printf '  %s[16]%s  Workbox        %s(SW build)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[17]%s  Pa11y          %s(a11y audit)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[18]%s  LHCI           %s(Lighthouse CI)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[19]%s  BackstopJS     %s(visual regression)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '\n'
  printf '  %s── Global ────────────────────────────────%s\n' "${CYAN}" "${RESET}"
  printf '  %s[C]%s  Full check     %s(lint + style + tests)%s\n' "${YELLOW}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[Q]%s  Quit\n' "${YELLOW}" "${RESET}"
  printf '\n'
  printf '%s>> %s' "${BOLD}" "${RESET}"
  read -r CHOICE

  # Health check — detect if opencode server is reachable
  if command -v curl >/dev/null 2>&1; then
    if curl -sf http://127.0.0.1:4096/global/health >/dev/null 2>&1; then
      printf '  %s[Server] opencode healthy%s\n' "${GREEN}" "${RESET}"
    else
      printf '  %s[Server] opencode not reachable (status unknown)%s\n' "${DIM}" "${RESET}"
    fi
  fi

  case "$CHOICE" in
    1)  run "Biome"          sh -c "cd '$ROOT/.tools/Developer_Toolkit' && '$BIN'biome check '../..'" ;;
    2)  run "ESLint"         "$BIN"eslint . --cache --cache-location .eslintcache --config "$ROOT/.tools/Developer_Toolkit/eslint.config.mjs" ;;
    3)  run "Stylelint"      "$BIN"stylelint "**/*.css" --config "$ROOT/.tools/Developer_Toolkit/.stylelintrc.json" --ignore-path "$ROOT/.tools/Developer_Toolkit/.stylelintignore" ;;
    4)  run "Madge"          "$BIN"madge --circular --extensions js C2PA Watermark Pixel_Injection Audio_Watermark Fingerprint Document_Watermark Timestamp Metadata Forensic ID_Forge Decentralized_Identity_DID Certificate Assistant Converter Style cli ;;
    5)  run "Core Tests"     node --no-warnings --test --test-timeout=120000 cli/tests/did_test.js cli/tests/fingerprint_test.js cli/tests/id_forge_test.js cli/tests/watermark_core_test.js cli/tests/forensic_test.js ;;
    6)  run "All Tests"      npm test ;;
    7)  run "Coverage"       npm run coverage ;;
    8)  run_cloc ;;
    9)  run "TypeDoc"        "$BIN"typedoc --options "$ROOT/.tools/Developer_Toolkit/typedoc.json" ;;
    10) run "Markdownlint"   "$BIN"markdownlint --config "$ROOT/.tools/Developer_Toolkit/.markdownlint.json" "**/*.md" --ignore node_modules --ignore skills --ignore agent --ignore .agents ;;
    11) run "Depcheck"       "$BIN"depcheck --config "$ROOT/.tools/Developer_Toolkit/.depcheckrc" ;;
    12) run "Size Limit"     "$BIN"size-limit ;;
    13) run "CSpell"         "$BIN"cspell --config "$ROOT/.tools/Developer_Toolkit/cspell.json" --no-progress "**/*.js" "**/*.css" "**/*.html" "**/*.md" "**/*.yml" "**/*.json" ;;
    14) run "Commitlint"     sh -c "printf 'feat: test\n' | '$BIN'commitlint --config '$ROOT/.tools/Developer_Toolkit/commitlint.config.mjs'" ;;
    15) run "Husky"          "$BIN"husky ;;
    16) run "Workbox"        "$BIN"workbox generateSW "$ROOT/.tools/Developer_Toolkit/workbox-config.js" ;;
    17) run_with_server "Pa11y" "$BIN"pa11y http://127.0.0.1:8080/ ;;
    18) run_lhci ;;
    19) run_with_server "BackstopJS" "$BIN"backstop test --config "$ROOT/.tools/Developer_Toolkit/backstop.json" ;;
    c|C) run "Full Check"    npm run check ;;
    q|Q) printf '\n'; exit 0 ;;
  esac
  menu
}

menu

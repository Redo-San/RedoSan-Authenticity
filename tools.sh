#!/usr/bin/env sh
# ═══════════════════════════════════════════════════════════════
#  RedoSan Authenticity — Dev Tools
#  v1.0.0 — Project Toolkit
#  Usage: ./tools.sh
# ═══════════════════════════════════════════════════════════════

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

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
  printf '  ║       %sRedoSan Authenticity — Dev Tools%s%s         ║\n' "${BOLD}" "${RESET}" "${CYAN}"
  printf '  ║       %sv1.0.0 — Project Toolkit%s                  ║\n' "${DIM}" "${RESET}${CYAN}"
  printf '  ╚══════════════════════════════════════════════════╝\n'
  printf '%s\n' "${RESET}"
}

# ── Tool runner ──
run() {
  local name="$1"
  shift
  banner
  printf '\n'
  printf '  %s╔══════════════════════════════════════╗%s\n' "${BOLD}${MAGENTA}" "${RESET}"
  printf '  %s║       Running: %-22s║%s\n' "${BOLD}${MAGENTA}" "$name" "${RESET}"
  printf '  %s╚══════════════════════════════════════╝%s\n' "${BOLD}${MAGENTA}" "${RESET}"
  printf '\n'
  printf '  %sCommand: %s%s\n\n' "${DIM}" "$*" "${RESET}"

  # Run, capture exit code without set -e killing the script
  set +e
  "$@"
  local ec=$?
  set -e

  printf '\n'
  if [ $ec -eq 0 ]; then
    printf '  %s%s✓ %s completed successfully%s\n' "${GREEN}" "${BOLD}" "$name" "${RESET}"
  else
    printf '  %s%s✗ %s failed (exit code: %d)%s\n' "${RED}" "${BOLD}" "$name" $ec "${RESET}"
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
  printf '\n'
  printf '  %s── Documentation ─────────────────────────%s\n' "${CYAN}" "${RESET}"
  printf '  %s [7]%s  TypeDoc        %s(API docs)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s [8]%s  Markdownlint   %s(MD quality)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '\n'
  printf '  %s── Dependencies ──────────────────────────%s\n' "${CYAN}" "${RESET}"
  printf '  %s [9]%s  Depcheck       %s(unused deps)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[10]%s  Size Limit     %s(bundle budget)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[11]%s  CSpell         %s(spell check)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '\n'
  printf '  %s── Git ───────────────────────────────────%s\n' "${CYAN}" "${RESET}"
  printf '  %s[12]%s  Commitlint     %s(check commit msg)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[13]%s  Husky          %s(reinstall hooks)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '\n'
  printf '  %s── Build / E2E ───────────────────────────%s\n' "${CYAN}" "${RESET}"
  printf '  %s[14]%s  Workbox        %s(SW build)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[15]%s  Pa11y          %s(a11y audit)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[16]%s  LHCI           %s(Lighthouse CI)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[17]%s  BackstopJS     %s(visual regression)%s\n' "${GREEN}" "${RESET}" "${DIM}" "${RESET}"
  printf '\n'
  printf '  %s── Global ────────────────────────────────%s\n' "${CYAN}" "${RESET}"
  printf '  %s[C]%s  Full check     %s(lint + style + tests)%s\n' "${YELLOW}" "${RESET}" "${DIM}" "${RESET}"
  printf '  %s[Q]%s  Quit\n' "${YELLOW}" "${RESET}"
  printf '\n'
  printf '%s>> %s' "${BOLD}" "${RESET}"
  read -r CHOICE

  case "$CHOICE" in
    1)  run "Biome"          npx @biomejs/biome check . ;;
    2)  run "ESLint"         npx eslint . ;;
    3)  run "Stylelint"      npx stylelint "**/*.css" ;;
    4)  run "Madge"          npx madge --circular --extensions js C2PA Watermark Pixel_Injection Audio_Watermark Fingerprint Document_Watermark Timestamp Metadata Forensic ID_Forge Decentralized_Identity_DID Certificate Assistant Converter Style cli ;;
    5)  run "Core Tests"     node --test --test-timeout=120000 cli/tests/did_test.js cli/tests/fingerprint_test.js cli/tests/id_forge_test.js cli/tests/watermark_core_test.js cli/tests/forensic_test.js ;;
    6)  run "All Tests"      npm test ;;
    7)  run "TypeDoc"        npx typedoc ;;
    8)  run "Markdownlint"   npx markdownlint "**/*.md" --ignore node_modules --ignore skills ;;
    9)  run "Depcheck"       npx depcheck ;;
    10) run "Size Limit"     npx size-limit ;;
    11) run "CSpell"         npx cspell --no-progress "**/*.js" "**/*.css" "**/*.html" "**/*.md" "**/*.yml" "**/*.json" ;;
    12) run "Commitlint"     sh -c 'printf "feat: test\n" | npx commitlint' ;;
    13) run "Husky"          npx husky ;;
    14) run "Workbox"        npx workbox generateSW workbox-config.js ;;
    15) run "Pa11y"          npx pa11y https://redo-san.github.io/RedoSan-Authenticity/ ;;
    16) run "LHCI"           npx lhci autorun ;;
    17) run "BackstopJS"     npx backstop test --config backstop.json ;;
    c|C) run "Full Check"    npm run check ;;
    q|Q) printf '\n'; exit 0 ;;
  esac
  menu
}

menu

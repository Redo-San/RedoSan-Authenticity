#!/usr/bin/env sh
# ═══════════════════════════════════════════════════════════════
#  RedoSan Authenticity - Test Runner
#  Comprehensive Test Suite
# ═══════════════════════════════════════════════════════════════

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

command -v node >/dev/null 2>&1 || { echo "node not found"; exit 1; }
E2E_STARTED=0
PID_FILE="${TMPDIR:-/tmp}/.redosan-dev.pid"

ensure_e2e() {
  if [ -f "$PID_FILE" ]; then
    E2E_PID=$(cat "$PID_FILE" 2>/dev/null)
    if kill -0 "$E2E_PID" 2>/dev/null; then
      return 0
    fi
  fi
  printf '\n  E2E tests require the dev server. Starting it now...\n'
  E2E_STARTED=1
  node dev-server.js &
  echo $! > "$PID_FILE"
  printf '  Waiting for server to be ready...'
  sleep 5
  printf ' done.\n\n'
}

e2e_cleanup() {
  if [ "$E2E_STARTED" = "1" ] && [ -f "$PID_FILE" ]; then
    printf '\n  Stopping dev server...\n'
    E2E_PID=$(cat "$PID_FILE" 2>/dev/null)
    kill "$E2E_PID" 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
}

BOLD="$(tput bold 2>/dev/null || printf '')"
DIM="$(tput dim 2>/dev/null || printf '')"
RESET="$(tput sgr0 2>/dev/null || printf '')"
GREEN="$(tput setaf 2 2>/dev/null || printf '')"
RED="$(tput setaf 1 2>/dev/null || printf '')"
YELLOW="$(tput setaf 3 2>/dev/null || printf '')"
CYAN="$(tput setaf 6 2>/dev/null || printf '')"

banner() {
  clear 2>/dev/null || printf '\033c'
  printf '\n'
  printf '  %s=============================================%s\n' "$CYAN" "$RESET"
  printf '  %sRedoSan Authenticity - Test Runner%s\n' "${BOLD}" "${RESET}"
  printf '  %s      Comprehensive Test Suite%s\n' "$DIM" "$RESET"
  printf '  %s=============================================%s\n' "$CYAN" "$RESET"
  printf '\n'
}

run_test() {
  local name="$1"
  local file="$2"
  printf '  [*] Testing %s... ' "$name"
  set +e
  node --test --test-timeout=300000 "cli/tests/$file" >/dev/null 2>&1
  local ec=$?
  set -e
  if [ $ec -eq 0 ]; then
    printf '%sPASS%s\n' "$GREEN" "$RESET"
  else
    printf '%sFAIL%s\n' "$RED" "$RESET"
  fi
  return $ec
}

run_group() {
  local group_name="$1"
  shift
  local pass=0 fail=0 total=0

  printf '\n  %s===== Running: %s =====%s\n\n' "$YELLOW" "$group_name" "$RESET"

  while [ $# -gt 0 ]; do
    local tname="$1"
    local tfile="$1"
    shift
    total=$((total + 1))

    local display="$tname"
    case "$display" in
      e2e/e2e_*) display="$(printf '%s' "$display" | sed 's|e2e/e2e_||')" ;;
    esac

    if run_test "$display" "$tfile.js"; then
      pass=$((pass + 1))
    else
      fail=$((fail + 1))
    fi
  done

  printf '\n  %s===== Results: %s =====%s\n' "$YELLOW" "$group_name" "$RESET"
  printf '     Total:  %s%d%s\n' "$BOLD" "$total" "$RESET"
  printf '     Passed: %s%d%s\n' "$GREEN" "$pass" "$RESET"
  printf '     Failed: '
  if [ "$fail" -gt 0 ]; then
    printf '%s%d%s\n' "$RED" "$fail" "$RESET"
  else
    printf '%s%d%s\n' "$GREEN" "$fail" "$RESET"
  fi
  printf '\n'
  [ "$fail" -gt 0 ] && printf '  %sWARNING: Some tests failed.%s\n' "$YELLOW" "$RESET"
  printf '\n  %sPress RETURN to continue...%s' "$DIM" "$RESET"
  read -r _unused
}

menu() {
  banner
  printf '  Select test group:\n'
  printf '\n'
  printf '  %s[1]%s  Quick Check     %s(did + fingerprint + id_forge)%s\n' "$GREEN" "$RESET" "$DIM" "$RESET"
  printf '  %s[2]%s  Core Suite      %s(all unit tests)%s\n' "$GREEN" "$RESET" "$DIM" "$RESET"
  printf '  %s[3]%s  Feature Suite   %s(converter, timestamp, metadata, cert, txt)%s\n' "$GREEN" "$RESET" "$DIM" "$RESET"
  printf '  %s[4]%s  E2E Suite       %s(Playwright browser tests)%s\n' "$GREEN" "$RESET" "$DIM" "$RESET"
  printf '  %s[5]%s  All Tests       %s(everything)%s\n' "$GREEN" "$RESET" "$DIM" "$RESET"
  printf '  %s[6]%s  MPA Suite       %s(Standalone page tests)%s\n' "$GREEN" "$RESET" "$DIM" "$RESET"
  printf '  %s[Q]%s  Quit\n' "$YELLOW" "$RESET"
  printf '\n'
  printf '%s>> %s' "$BOLD" "$RESET"
  read -r CHOICE

  case "$CHOICE" in
    1) run_group "Quick Check" \
         did_test fingerprint_test id_forge_test ;;
    2) run_group "Core Suite" \
         did_test fingerprint_test id_forge_test \
         watermark_core_test forensic_test \
         pixel_injection_test advanced_watermarking_test \
         c2pa_cbor_test c2pa_advanced_test \
         audio_watermark_core_test \
         document_watermark_test document_watermark_ui_test ;;
    3) run_group "Feature Suite" \
         converter_test timestamp_test metadata_test \
         certificate_test text_extractor_test remove_watermark_test ;;
     4) ensure_e2e
       run_group "E2E Suite" \
          e2e/e2e_navigation_test e2e/e2e_watermark_test \
          e2e/e2e_audio_test e2e/e2e_c2pa_test \
          e2e/e2e_did_test e2e/e2e_certificate_test \
          e2e/e2e_fingerprint_test e2e/e2e_features_test \
          e2e/e2e_docw_test e2e/e2e_metadata_test \
          e2e/e2e_timestamp_test e2e/e2e_misc_pages_test \
          e2e/e2e_pixel_injection_test e2e/e2e_forensic_test \
          e2e/e2e_converter_removal_test \
          e2e/e2e_music_persistence_test e2e/e2e_hybrid_test ;;
     5) ensure_e2e
       run_group "All Tests" \
          did_test fingerprint_test id_forge_test \
          watermark_core_test forensic_test \
          pixel_injection_test advanced_watermarking_test \
          c2pa_cbor_test c2pa_advanced_test \
          audio_watermark_core_test \
          document_watermark_test document_watermark_ui_test \
          converter_test timestamp_test metadata_test \
          certificate_test text_extractor_test remove_watermark_test \
          e2e/e2e_navigation_test e2e/e2e_watermark_test \
          e2e/e2e_audio_test e2e/e2e_c2pa_test \
          e2e/e2e_did_test e2e/e2e_certificate_test \
          e2e/e2e_fingerprint_test e2e/e2e_features_test \
          e2e/e2e_docw_test e2e/e2e_metadata_test \
          e2e/e2e_timestamp_test e2e/e2e_misc_pages_test \
          e2e/e2e_pixel_injection_test e2e/e2e_forensic_test \
          e2e/e2e_converter_removal_test \
          e2e/e2e_music_persistence_test e2e/e2e_hybrid_test ;;
     6) printf '\n  %s===== Running: MPA Suite =====%s\n\n' "$YELLOW" "$RESET"
        node --test --test-timeout=120000 "$ROOT/cli/tests/e2e/mpa_suite.js"
        printf '\n  %sPress RETURN to continue...%s' "$DIM" "$RESET"
        read -r _unused ;;
    q|Q) e2e_cleanup; printf '\n'; exit 0 ;;
  esac
  menu
}

menu

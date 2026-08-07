#!/usr/bin/env sh
# ═══════════════════════════════════════════════════════════════
#  RedoSan Authenticity — Install Dependencies
#  Usage: ./install_deps.sh
#  Smart: skips already-installed components
# ═══════════════════════════════════════════════════════════════

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ── ANSI colors ──
BOLD="$(tput bold 2>/dev/null || printf '')"
DIM="$(tput dim 2>/dev/null || printf '')"
RESET="$(tput sgr0 2>/dev/null || printf '')"
GREEN="$(tput setaf 2 2>/dev/null || printf '')"
YELLOW="$(tput setaf 3 2>/dev/null || printf '')"
RED="$(tput setaf 1 2>/dev/null || printf '')"
CYAN="$(tput setaf 6 2>/dev/null || printf '')"

echo "${CYAN}"
echo "  +---------------------------------------------+"
echo "  |   RedoSan Authenticity - Install Dependencies"
echo "  +---------------------------------------------+"
echo "  |  Note: 'canvas' native addon (optional, CLI only) may need build tools:"
echo "  |  Linux: apt install libcairo2-dev libjpeg-turbo8-dev libpango1.0-dev libgif-dev librsvg2-dev build-essential"
echo "  |  macOS: xcode-select --install && brew install pkg-config cairo pango giflib librsvg jpeg-turbo"
echo "  |  Windows: Install GTK+ from https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer"
echo "  +---------------------------------------------+"
echo "${RESET}"

NEEDS_INSTALL=0
VERIFIED=0

# ── 1. Node.js ──
echo "  ${BOLD}[1]${RESET} Node.js"
if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v | sed 's/v//')
    MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
    if [ "$MAJOR" -ge 24 ] 2>/dev/null; then
        echo "     > v$NODE_VER OK"
    else
        echo "     > v$NODE_VER found — v24+ required. Upgrade: https://nodejs.org/"
        NEEDS_INSTALL=1
    fi
else
    echo "     > NOT FOUND"
    echo "     > Download from https://nodejs.org/ (v24+ required)"
    NEEDS_INSTALL=1
fi

# ── 2. Git ──
echo ""
echo "  ${BOLD}[2]${RESET} Git"
if command -v git >/dev/null 2>&1; then
    echo "     > $(git --version | head -1) OK"
else
    echo "     > NOT FOUND"
    echo "     > Optional — install from https://git-scm.com/"
fi

if [ "$NEEDS_INSTALL" = 1 ]; then
    echo ""
    echo "  ${RED}Prerequisites missing. Fix issues above and re-run.${RESET}"
    exit 1
fi

BIN="$ROOT/node_modules/.bin"
NPM_NEEDED=0

# ── 3. npm packages ──
echo ""
echo "  ${BOLD}[3]${RESET} npm packages"
if [ ! -d "node_modules" ]; then
    echo "     > node_modules/ missing"
    NPM_NEEDED=1
else
    for pkg in eslint biome backstop stylelint madge lint-staged playwright; do
        if [ ! -x "$BIN/$pkg" ]; then
            echo "     > $pkg missing"
            NPM_NEEDED=1
        fi
    done
    if [ "$NPM_NEEDED" = 0 ]; then
        echo "     > All packages already installed"
    fi
fi
if [ "$NPM_NEEDED" = 1 ]; then
    echo "     > Installing..."
    npm ci --no-fund --no-audit
    echo "     > Done"
else
    echo "     > Skipping (already present)"
fi

# ── 4. Playwright browsers ──
echo ""
echo "  ${BOLD}[4]${RESET} Playwright browser"
PW_NEEDED=0
if [ -d "$HOME/.cache/ms-playwright" ]; then
    if ls "$HOME/.cache/ms-playwright/"*chromium* 2>/dev/null >/dev/null; then
        echo "     > Chromium already installed"
    else
        PW_NEEDED=1
    fi
elif [ -d "$HOME/Library/Caches/ms-playwright" ]; then
    if ls "$HOME/Library/Caches/ms-playwright/"*chromium* 2>/dev/null >/dev/null; then
        echo "     > Chromium already installed"
    else
        PW_NEEDED=1
    fi
else
    PW_NEEDED=1
fi
if [ "$PW_NEEDED" = 1 ]; then
    echo "     > Installing chromium..."
    if npx playwright install chromium 2>/dev/null; then
        echo "     > Done"
    else
        echo "     > Failed — e2e tests may need it. Run 'npx playwright install chromium' manually."
    fi
else
    echo "     > Skipping (already present)"
fi

# ── 5. Husky git hooks ──
echo ""
echo "  ${BOLD}[5]${RESET} Git hooks (husky)"
if [ -d ".git" ]; then
    if [ -f ".husky/pre-commit" ] && [ -f ".husky/commit-msg" ]; then
        echo "     > Hooks already installed"
    else
        echo "     > Installing..."
        if npx husky 2>/dev/null; then
            echo "     > Done"
        else
            echo "     > Failed — run 'npx husky' manually"
        fi
    fi
else
    echo "     > Skipping (no .git directory)"
fi

# ── 6. Verify tools ──
echo ""
echo "  ${BOLD}[6]${RESET} Verification"
MAX_VERIFIED=8

echo "      --- Core (required for dev workflow) ---"

# eslint
if [ -x "$BIN/eslint" ]; then
    VERIFIED=$((VERIFIED + 1))
    echo "     > eslint OK"
else
    echo "     > eslint missing"
fi

# biome
if [ -x "$BIN/biome" ]; then
    VERIFIED=$((VERIFIED + 1))
    echo "     > biome OK"
else
    echo "     > biome missing"
fi

# stylelint
if [ -x "$BIN/stylelint" ]; then
    VERIFIED=$((VERIFIED + 1))
    echo "     > stylelint OK"
else
    echo "     > stylelint missing"
fi

# madge
if [ -x "$BIN/madge" ]; then
    VERIFIED=$((VERIFIED + 1))
    echo "     > madge OK"
else
    echo "     > madge missing"
fi

# lint-staged
if [ -x "$BIN/lint-staged" ]; then
    VERIFIED=$((VERIFIED + 1))
    echo "     > lint-staged OK"
else
    echo "     > lint-staged missing (pre-commit hook needs it)"
fi

# commitlint
if [ -x "$BIN/commitlint" ]; then
    VERIFIED=$((VERIFIED + 1))
    echo "     > commitlint OK"
else
    echo "     > commitlint missing (commit-msg hook needs it)"
fi

# husky
if [ -x "$BIN/husky" ]; then
    VERIFIED=$((VERIFIED + 1))
    echo "     > husky OK"
else
    echo "     > husky missing (needed for git hooks)"
fi

# playwright
if [ -x "$BIN/playwright" ]; then
    VERIFIED=$((VERIFIED + 1))
    echo "     > playwright OK"
else
    echo "     > playwright missing (e2e tests need it)"
fi

echo "      --- Extras (informational, not counted in score) ---"

# cloc
if command -v cloc >/dev/null 2>&1; then
    echo "     > cloc OK"
else
    echo "     > cloc not available (optional: install for line counts)"
fi

# canvas (optional - CLI only)
if node -e "require('canvas')" >/dev/null 2>&1; then
    echo "     > canvas OK"
else
    echo "     > canvas NOT available (optional - only needed for CLI watermark/fingerprint. ~37MB + GTK+ runtime)"
fi

# backstopjs
if [ -x "$BIN/backstop" ]; then
    echo "     > backstopjs OK"
else
    echo "     > backstopjs missing (optional - visual regression testing)"
fi

# cspell
if [ -x "$BIN/cspell" ]; then
    echo "     > cspell OK"
else
    echo "     > cspell missing (optional - spell checking)"
fi

# Playwright chromium browser
if [ -d "$HOME/.cache/ms-playwright" ]; then
    if ls "$HOME/.cache/ms-playwright/"*chromium* 2>/dev/null >/dev/null; then
        echo "     > playwright chromium OK"
    else
        echo "     > playwright chromium NOT found"
    fi
elif [ -d "$HOME/Library/Caches/ms-playwright" ]; then
    if ls "$HOME/Library/Caches/ms-playwright/"*chromium* 2>/dev/null >/dev/null; then
        echo "     > playwright chromium OK"
    else
        echo "     > playwright chromium NOT found"
    fi
else
    echo "     > playwright chromium NOT found"
fi

# ── Summary ──
echo ""
echo "${CYAN}"
echo "  +---------------------------------------------+"
if [ "$VERIFIED" -eq "$MAX_VERIFIED" ]; then
    echo "  |  All core tools ready. You're good to go!"
elif [ "$VERIFIED" -ge 5 ]; then
    echo "  |  Mostly ready ($VERIFIED/$MAX_VERIFIED core). Check warnings above."
else
    echo "  |  Some core tools missing ($VERIFIED/$MAX_VERIFIED). Run npm install."
fi
echo "  +---------------------------------------------+"
echo "${RESET}"
echo ""
echo "  Next: run ./run_dev_toolkit.sh or npm test"
echo ""
printf "  Press Enter to continue..."
read -r dummy 
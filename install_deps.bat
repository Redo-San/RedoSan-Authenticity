@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo  +-----------------------------------------------------------------------------------------------------------------+
echo  ^|   RedoSan Authenticity - Install Dependencies                                                                   ^|
echo  +-----------------------------------------------------------------------------------------------------------------+
echo  ^|  Note: 'canvas' native addon (optional, CLI only) may need build tools:                                          ^|
echo  ^|  Linux: apt install libcairo2-dev libjpeg-turbo8-dev libpango1.0-dev libgif-dev librsvg2-dev build-essential    ^|
echo  ^|  macOS: xcode-select --install ^&^& brew install pkg-config cairo pango giflib librsvg jpeg-turbo                 ^|
echo  ^|  Windows: Install GTK+ from https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer           ^|
echo  +-----------------------------------------------------------------------------------------------------------------+
echo.

set "NEEDS_INSTALL=0"

:: ── 1. Node.js ──
echo  [1] Node.js
where node >nul 2>&1
if errorlevel 1 goto node_missing
for /f "tokens=1 delims=v." %%a in ('node -v') do set "NODE_VER=%%a"
if %NODE_VER% LSS 24 goto node_old
echo     ^> v%NODE_VER% OK
goto node_done

:node_missing
echo     ^> NOT FOUND
echo     ^> Download from https://nodejs.org/ (v24+ required)
set "NEEDS_INSTALL=1"
goto node_done

:node_old
echo     ^> v%NODE_VER% found - v24+ required. Upgrade: https://nodejs.org/
set "NEEDS_INSTALL=1"

:node_done

:: ── 2. Git ──
echo.
echo  [2] Git
where git >nul 2>&1
if errorlevel 1 (
  echo     ^> NOT FOUND
  echo     ^> Optional - install from https://git-scm.com/
) else (
  for /f "tokens=1-3" %%a in ('git --version') do echo     ^> %%a %%b %%c OK
)

if "%NEEDS_INSTALL%"=="1" (
  echo.
  echo  Prerequisites missing. Fix issues above and re-run.
  pause
  exit /b 1
)

:: ── 3. npm packages ──
echo.
echo  [3] npm packages
set "NPM_NEEDED=0"
if not exist "node_modules" (
  echo     ^> node_modules/ missing
  set "NPM_NEEDED=1"
) else (
  set "KEY_PKGS=eslint biome backstop stylelint madge lint-staged playwright"
  for %%p in (!KEY_PKGS!) do (
    if not exist "node_modules\.bin\%%p" (
      echo     ^> %%p missing
      set "NPM_NEEDED=1"
    )
  )
)
if !NPM_NEEDED! equ 1 (
  echo     ^> Installing...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo  [FAIL] npm install failed
    pause
    exit /b 1
  )
  echo     ^> Done
) else (
  echo     ^> Skipping (already present)
)

:: ── 4. Playwright browsers ──
echo.
echo  [4] Playwright browser
set "PW_NEEDED=0"
if exist "%USERPROFILE%\AppData\Local\ms-playwright" (
  dir "%USERPROFILE%\AppData\Local\ms-playwright\*chromium*" /b /ad >nul 2>&1
  if errorlevel 1 set "PW_NEEDED=1"
) else if exist "%USERPROFILE%\.cache\ms-playwright" (
  dir "%USERPROFILE%\.cache\ms-playwright\*chromium*" /b /ad >nul 2>&1
  if errorlevel 1 set "PW_NEEDED=1"
) else (
  set "PW_NEEDED=1"
)
if !PW_NEEDED! equ 1 (
  echo     ^> Installing chromium...
  call npx playwright install chromium 2>nul
  if errorlevel 1 (
    echo     ^> Failed - e2e tests may need it. Run 'npx playwright install chromium' manually.
  ) else (
    echo     ^> Done
  )
) else (
  echo     ^> Skipping (already present)
)

:: ── 5. Husky git hooks ──
echo.
echo  [5] Git hooks (husky)
if exist ".git" (
  if exist ".husky\pre-commit" (
    if exist ".husky\commit-msg" (
      echo     ^> Hooks already installed
    ) else (
      echo     ^> commit-msg hook missing, reinstalling...
      call npx husky 2>nul
      if errorlevel 1 ( echo     ^> Failed ) else ( echo     ^> Done )
    )
  ) else (
    echo     ^> Installing...
    call npx husky 2>nul
    if errorlevel 1 (
      echo     ^> Failed
    ) else (
      echo     ^> Done
    )
  )
) else (
  echo     ^> Skipping (no .git directory)
)

:: ── 6. Verify tools ──
echo.
echo  [6] Verification
set "VERIFIED=0"
set "MAX_VERIFIED=8"

echo      --- Core (required for dev workflow) ---

:: eslint
if exist "node_modules\.bin\eslint" (
  set /a VERIFIED+=1
  echo     ^> eslint OK
) else (
  echo     ^> eslint missing
)

:: biome
if exist "node_modules\.bin\biome" (
  set /a VERIFIED+=1
  echo     ^> biome OK
) else (
  echo     ^> biome missing
)

:: stylelint
if exist "node_modules\.bin\stylelint" (
  set /a VERIFIED+=1
  echo     ^> stylelint OK
) else (
  echo     ^> stylelint missing
)

:: madge
if exist "node_modules\.bin\madge" (
  set /a VERIFIED+=1
  echo     ^> madge OK
) else (
  echo     ^> madge missing
)

:: lint-staged
if exist "node_modules\.bin\lint-staged" (
  set /a VERIFIED+=1
  echo     ^> lint-staged OK
) else (
  echo     ^> lint-staged missing ^(pre-commit hook needs it^)
)

:: commitlint
if exist "node_modules\.bin\commitlint" (
  set /a VERIFIED+=1
  echo     ^> commitlint OK
) else (
  echo     ^> commitlint missing ^(commit-msg hook needs it^)
)

:: husky
if exist "node_modules\.bin\husky" (
  set /a VERIFIED+=1
  echo     ^> husky OK
) else (
  echo     ^> husky missing ^(needed for git hooks^)
)

:: playwright
if exist "node_modules\.bin\playwright" (
  set /a VERIFIED+=1
  echo     ^> playwright OK
) else (
  echo     ^> playwright missing ^(e2e tests need it^)
)

echo      --- Extras ^(informational, not counted in score^) ---

:: cloc
where cloc >nul 2>&1
if errorlevel 1 (
  echo     ^> cloc not available ^(optional: install for line counts^)
) else (
  echo     ^> cloc OK
)

:: canvas (optional - CLI only)
call node -e "require('canvas')" >nul 2>&1
if errorlevel 1 (
  echo     ^> canvas NOT available ^(optional - only needed for CLI watermark/fingerprint. ~37MB + GTK+ runtime^)
) else (
  echo     ^> canvas OK
)

:: backstopjs
if exist "node_modules\.bin\backstop" (
  echo     ^> backstopjs OK
) else (
  echo     ^> backstopjs missing ^(optional - visual regression testing^)
)

:: cspell
if exist "node_modules\.bin\cspell" (
  echo     ^> cspell OK
) else (
  echo     ^> cspell missing ^(optional - spell checking^)
)

:: Playwright chromium browser
if exist "%USERPROFILE%\AppData\Local\ms-playwright" (
  dir "%USERPROFILE%\AppData\Local\ms-playwright\*chromium*" /b /ad >nul 2>&1
  if errorlevel 1 ( echo     ^> playwright chromium NOT found ) else ( echo     ^> playwright chromium OK )
) else if exist "%USERPROFILE%\.cache\ms-playwright" (
  dir "%USERPROFILE%\.cache\ms-playwright\*chromium*" /b /ad >nul 2>&1
  if errorlevel 1 ( echo     ^> playwright chromium NOT found ) else ( echo     ^> playwright chromium OK )
) else (
  echo     ^> playwright chromium NOT found
)

:: ── Summary ──
echo.
echo  +---------------------------------------------+
if %VERIFIED% EQU %MAX_VERIFIED% (
  echo  ^|  All core tools ready. You're good to go!
)
if %VERIFIED% GEQ 5 (
  if not %VERIFIED% EQU %MAX_VERIFIED% (
    echo  ^|  Mostly ready ^(%VERIFIED%/%MAX_VERIFIED% core^). Check warnings above.
  )
)
if %VERIFIED% LSS 5 (
  echo  ^|  Some core tools missing ^(%VERIFIED%/%MAX_VERIFIED%^). Run npm install.
)
echo  +---------------------------------------------+
echo.
echo  Next: run run_dev_toolkit.bat or npm test
echo.
pause

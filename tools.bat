@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

:: ── Prerequisites ──
where npm >nul 2>&1 || (echo npm not found in PATH & pause & exit /b 1)
if not exist "package.json" (echo Run from project root. & pause & exit /b 1)

:: ── ANSI detection ──
set "ESC="
for /f "delims=#" %%a in ('"prompt #$E# & for %%b in (1) do rem."') do set "ESC=%%a"
if defined ESC (
  set "BOLD=%ESC%[1m"
  set "DIM=%ESC%[2m"
  set "GREEN=%ESC%[92m"
  set "YELLOW=%ESC%[93m"
  set "RED=%ESC%[91m"
  set "CYAN=%ESC%[96m"
  set "MAGENTA=%ESC%[95m"
  set "RESET=%ESC%[0m"
) else (
  set "BOLD="&set "DIM="&set "GREEN="&set "YELLOW="
  set "RED="&set "CYAN="&set "MAGENTA="&set "RESET="
)

:: ── ASCII banner ──
:banner
cls
echo.
echo  ===== RedoSan Authenticity - Dev Tools =====
echo         v1.0.0 - Project Toolkit
echo.
echo  ============================================

:: ── Menu ──
:menu
echo.
echo  Select a tool to run:
echo.
echo  -- Code Quality ------------------------------
echo   [1]  Biome          (lint + format)
echo   [2]  ESLint         (JS lint)
echo   [3]  Stylelint      (CSS lint)
echo.
echo  -- Testing ----------------------------------
echo   [4]  Madge          (circular deps)
echo   [5]  Core tests     (unit tests)
echo   [6]  All tests      (full suite)
echo.
echo  -- Documentation ----------------------------
echo   [7]  TypeDoc        (API docs)
echo   [8]  Markdownlint   (MD quality)
echo.
echo  -- Dependencies -----------------------------
echo   [9]  Depcheck       (unused deps)
echo  [10]  Size Limit     (bundle budget)
echo  [11]  CSpell         (spell check)
echo.
echo  -- Git --------------------------------------
echo  [12]  Commitlint     (check commit msg)
echo  [13]  Husky          (reinstall hooks)
echo.
echo  -- Build / E2E ------------------------------
echo  [14]  Workbox        (SW build)
echo  [15]  Pa11y          (a11y audit)
echo  [16]  LHCI           (Lighthouse CI)
echo  [17]  BackstopJS     (visual regression)
echo.
echo  -- Global -----------------------------------
echo   [C]  Full check     (lint + style + tests)
echo   [Q]  Quit
echo.
set /p "CHOICE=>> "

:: ── Route ──
if /i "%CHOICE%"=="1" call :run "Biome"          "npx @biomejs/biome check ."
if /i "%CHOICE%"=="2" call :run "ESLint"         "npx eslint ."
if /i "%CHOICE%"=="3" call :run "Stylelint"      "npx stylelint **/*.css"
if /i "%CHOICE%"=="4" call :run "Madge"          "npx madge --circular --extensions js C2PA Watermark Pixel_Injection Audio_Watermark Fingerprint Document_Watermark Timestamp Metadata Forensic ID_Forge Decentralized_Identity_DID Certificate Assistant Converter Style cli"
if /i "%CHOICE%"=="5" call :run "Core Tests"     "node --test --test-timeout=120000 cli/tests/did_test.js cli/tests/fingerprint_test.js cli/tests/id_forge_test.js cli/tests/watermark_core_test.js cli/tests/forensic_test.js"
if /i "%CHOICE%"=="6" call :run "All Tests"      "npm test"
if /i "%CHOICE%"=="7" call :run "TypeDoc"        "npx typedoc"
if /i "%CHOICE%"=="8" call :run "Markdownlint"   "npx markdownlint **/*.md --ignore node_modules --ignore skills"
if /i "%CHOICE%"=="9" call :run "Depcheck"       "npx depcheck"
if /i "%CHOICE%"=="10" call :run "Size Limit"    "npx size-limit"
if /i "%CHOICE%"=="11" call :run "CSpell"        "npx cspell --no-progress **/*.js **/*.css **/*.html **/*.md **/*.yml **/*.json"
if /i "%CHOICE%"=="12" call :run "Commitlint"    "echo feati test ^| npx commitlint"
if /i "%CHOICE%"=="13" call :run "Husky"         "npx husky"
if /i "%CHOICE%"=="14" call :run "Workbox"       "npx workbox generateSW workbox-config.js"
if /i "%CHOICE%"=="15" call :run "Pa11y"         "npx pa11y https://redo-san.github.io/RedoSan-Authenticity/"
if /i "%CHOICE%"=="16" call :run "LHCI"          "npx lhci autorun"
if /i "%CHOICE%"=="17" call :run "BackstopJS"    "npx backstop test --config backstop.json"
if /i "%CHOICE%"=="c" call :run "Full Check"     "npm run check"
if /i "%CHOICE%"=="C" call :run "Full Check"     "npm run check"
if /i "%CHOICE%"=="q" exit /b 0
if /i "%CHOICE%"=="Q" exit /b 0
goto menu

:: ── Tool runner ──
:run
cls
echo.
echo  ===== Running: %~1 =====
echo.
pushd "%~dp0"
%~2
set "EC=%ERRORLEVEL%"
popd
echo.
if %EC% equ 0 (
  echo  [OK] %~1 completed successfully
) else (
  echo  [FAILED] %~1 exit code: %EC%
)
echo.
pause
goto banner

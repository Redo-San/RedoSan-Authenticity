@echo off
setlocal enabledelayedexpansion
set "ROOT=%~dp0"
cd /d "%ROOT%"

:: ── ANSI color codes ──
set "ESC="
for /f "delims=#" %%a in ('"prompt #$E# & for %%b in (1) do rem."') do set "ESC=%%a"
set "CYAN=%ESC%[96m"
set "GREEN=%ESC%[92m"
set "YELLOW=%ESC%[93m"
set "RED=%ESC%[91m"
set "MAGENTA=%ESC%[95m"
set "BOLD=%ESC%[1m"
set "DIM=%ESC%[2m"
set "RESET=%ESC%[0m"

:: ── Detect npm/npx ──
where npm >nul 2>&1 || (echo %RED%npm not found in PATH%RESET% & pause & exit /b 1)
where npx >nul 2>&1 || (echo %RED%npx not found in PATH%RESET% & pause & exit /b 1)

:: ── Root check ──
if not exist "package.json" (
  echo %RED%Error: package.json not found. Run this script from the project root.%RESET%
  pause & exit /b 1
)

:: ── Banner ──
:banner
cls
echo %CYAN%
echo   ╔══════════════════════════════════════════════════╗
echo   ║       %BOLD%RedoSan Authenticity — Dev Tools%RESET%%CYAN%         ║
echo   ║       %DIM%v1.0.0 — Project Toolkit%RESET%%CYAN%                  ║
echo   ╚══════════════════════════════════════════════════╝
echo %RESET%

:: ── Main menu loop ──
:menu
echo.
echo  %BOLD%Select a tool to run:%RESET%
echo.
echo  %CYAN%── Code Quality ──────────────────────────%RESET%
echo  %GREEN% [1]%RESET%  Biome          %DIM%(lint + format)%RESET%
echo  %GREEN% [2]%RESET%  ESLint         %DIM%(JS lint)%RESET%
echo  %GREEN% [3]%RESET%  Stylelint      %DIM%(CSS lint)%RESET%
echo.
echo  %CYAN%── Testing ───────────────────────────────%RESET%
echo  %GREEN% [4]%RESET%  Madge          %DIM%(circular deps)%RESET%
echo  %GREEN% [5]%RESET%  Core tests     %DIM%(unit tests)%RESET%
echo  %GREEN% [6]%RESET%  All tests      %DIM%(full suite)%RESET%
echo.
echo  %CYAN%── Documentation ─────────────────────────%RESET%
echo  %GREEN% [7]%RESET%  TypeDoc        %DIM%(API docs)%RESET%
echo  %GREEN% [8]%RESET%  Markdownlint   %DIM%(MD quality)%RESET%
echo.
echo  %CYAN%── Dependencies ──────────────────────────%RESET%
echo  %GREEN% [9]%RESET%  Depcheck       %DIM%(unused deps)%RESET%
echo  %GREEN%[10]%RESET%  Size Limit     %DIM%(bundle budget)%RESET%
echo  %GREEN%[11]%RESET%  CSpell         %DIM%(spell check)%RESET%
echo.
echo  %CYAN%── Git ───────────────────────────────────%RESET%
echo  %GREEN%[12]%RESET%  Commitlint     %DIM%(check commit msg)%RESET%
echo  %GREEN%[13]%RESET%  Husky          %DIM%(reinstall hooks)%RESET%
echo.
echo  %CYAN%── Build / E2E ───────────────────────────%RESET%
echo  %GREEN%[14]%RESET%  Workbox        %DIM%(SW build)%RESET%
echo  %GREEN%[15]%RESET%  Pa11y          %DIM%(a11y audit)%RESET%
echo  %GREEN%[16]%RESET%  LHCI           %DIM%(Lighthouse CI)%RESET%
echo  %GREEN%[17]%RESET%  BackstopJS     %DIM%(visual regression)%RESET%
echo.
echo  %CYAN%── Global ────────────────────────────────%RESET%
echo  %YELLOW%[C]%RESET%  Full check     %DIM%(lint + style + tests)%RESET%
echo  %YELLOW%[Q]%RESET%  Quit
echo.
set /p "CHOICE=%BOLD%>> %RESET%"

:: ── Route selection ──
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
if /i "%CHOICE%"=="12" call :run "Commitlint"    "echo commitlint-check & echo To check a message: echo 'feat: msg' ^| npx commitlint"
if /i "%CHOICE%"=="13" call :run "Husky"         "cmd /c npx husky"
if /i "%CHOICE%"=="14" call :run "Workbox"       "npx workbox generateSW workbox-config.js"
if /i "%CHOICE%"=="15" call :run "Pa11y"         "npx pa11y https://redo-san.github.io/RedoSan-Authenticity/"
if /i "%CHOICE%"=="16" call :run "LHCI"          "npx lhci autorun"
if /i "%CHOICE%"=="17" call :run "BackstopJS"    "npx backstop test --config backstop.json"
if /i "%CHOICE%"=="C" call :run "Full Check"     "npm run check"
if /i "%CHOICE%"=="c" call :run "Full Check"     "npm run check"
if /i "%CHOICE%"=="Q" goto :eof
if /i "%CHOICE%"=="q" goto :eof
goto menu

:: ── Tool runner ──
:run
cls
echo.
echo  %BOLD%%MAGENTA%╔══════════════════════════════════════╗%RESET%
echo  %BOLD%%MAGENTA%║       Running: %~1%RESET%%BOLD%%MAGENTA%               ║%RESET%
echo  %BOLD%%MAGENTA%╚══════════════════════════════════════╝%RESET%
echo.
echo  %DIM%Command: %~2%RESET%
echo.
pushd "%ROOT%"
%~2
set "EXIT_CODE=%ERRORLEVEL%"
popd
echo.
if %EXIT_CODE% equ 0 (
  echo  %GREEN%%BOLD%✓ %~1 completed successfully%RESET%
) else (
  echo  %RED%%BOLD%✗ %~1 failed (exit code: %EXIT_CODE%)%RESET%
)
echo.
echo  %DIM%Press any key to return to menu...%RESET%
pause >nul
goto banner

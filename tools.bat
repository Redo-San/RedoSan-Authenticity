@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

where npm >nul 2>&1 || (echo npm not found in PATH & pause & exit /b 1)
if not exist "package.json" (echo Run from project root. & pause & exit /b 1)

:banner
cls
echo.
echo  ===== RedoSan Authenticity - Dev Tools =====
echo         v1.0.0 - Project Toolkit
echo.
echo  ============================================

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

if /i "%CHOICE%"=="1" set "TN=Biome" & set "TC=npx @biomejs/biome check ." & goto run
if /i "%CHOICE%"=="2" set "TN=ESLint" & set "TC=npx eslint ." & goto run
if /i "%CHOICE%"=="3" set "TN=Stylelint" & set "TC=npx stylelint **/*.css" & goto run
if /i "%CHOICE%"=="4" set "TN=Madge" & set "TC=npx madge --circular --extensions js C2PA Watermark Pixel_Injection Audio_Watermark Fingerprint Document_Watermark Timestamp Metadata Forensic ID_Forge Decentralized_Identity_DID Certificate Assistant Converter Style cli" & goto run
if /i "%CHOICE%"=="5" set "TN=Core Tests" & set "TC=node --test --test-timeout=120000 cli/tests/did_test.js cli/tests/fingerprint_test.js cli/tests/id_forge_test.js cli/tests/watermark_core_test.js cli/tests/forensic_test.js" & goto run
if /i "%CHOICE%"=="6" set "TN=All Tests" & set "TC=npm test" & goto run
if /i "%CHOICE%"=="7" set "TN=TypeDoc" & set "TC=npx typedoc" & goto run
if /i "%CHOICE%"=="8" set "TN=Markdownlint" & set "TC=npx markdownlint **/*.md --ignore node_modules --ignore skills" & goto run
if /i "%CHOICE%"=="9" set "TN=Depcheck" & set "TC=npx depcheck" & goto run
if /i "%CHOICE%"=="10" set "TN=Size Limit" & set "TC=npx size-limit" & goto run
if /i "%CHOICE%"=="11" set "TN=CSpell" & set "TC=npx cspell --no-progress **/*.js **/*.css **/*.html **/*.md **/*.yml **/*.json" & goto run
if /i "%CHOICE%"=="12" set "TN=Commitlint" & set "TC=echo feat: test ^| npx commitlint" & goto run
if /i "%CHOICE%"=="13" set "TN=Husky" & set "TC=npx husky" & goto run
if /i "%CHOICE%"=="14" set "TN=Workbox" & set "TC=npx workbox generateSW workbox-config.js" & goto run
if /i "%CHOICE%"=="15" set "TN=Pa11y" & set "TC=npx pa11y https://redo-san.github.io/RedoSan-Authenticity/" & goto run
if /i "%CHOICE%"=="16" set "TN=LHCI" & set "TC=npx lhci autorun" & goto run
if /i "%CHOICE%"=="17" set "TN=BackstopJS" & set "TC=npx backstop test --config backstop.json" & goto run
if /i "%CHOICE%"=="C" set "TN=Full Check" & set "TC=npm run check" & goto run
if /i "%CHOICE%"=="c" set "TN=Full Check" & set "TC=npm run check" & goto run
if /i "%CHOICE%"=="Q" exit /b 0
if /i "%CHOICE%"=="q" exit /b 0
goto menu

:run
cls
echo.
echo  ===== Running: %TN% =====
echo.
pushd "%~dp0"
%TC%
set "EC=%ERRORLEVEL%"
popd
echo.
if %EC% equ 0 (
  echo  [OK] %TN% completed successfully
) else (
  echo  [FAILED] %TN% exit code: %EC%
)
echo.
pause
goto banner

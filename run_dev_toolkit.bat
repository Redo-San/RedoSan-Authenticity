@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

where npm >nul 2>&1 || (echo npm not found in PATH & pause & exit /b 1)
if not exist "package.json" (echo Run from project root. & pause & exit /b 1)

set "BIN=node_modules\.bin\"

call :check_server_health
set "TK=%~dp0.tools\Developer_Toolkit\"

:banner
set "EMPTY_COUNT=0"
cls
echo.
echo  ===== RedoSan Authenticity - Dev Toolkit =====
echo         v1.0.0 - run_dev_toolkit
echo.
echo  ==============================================

:menu
echo.
echo  Select a tool to run:
echo.
echo  -- Code Quality --------------------------------
echo   [1]  Biome          (lint + format)
echo   [2]  ESLint         (JS lint)
echo   [3]  Stylelint      (CSS lint)
echo   [4]  Prettier       (check formatting)
echo   [5]  Prettier W     (write formatting)
echo.
echo  -- Testing ------------------------------------
echo   [6]  Madge          (circular deps)
echo   [7]  Core tests     (unit tests)
echo   [8]  All tests      (full suite)
echo   [9]  Coverage       (code coverage)
echo   [10] CLOC           (count lines of code)
echo   [11] JSCPD          (duplicate code)
echo.
echo  -- Lint / audit -------------------------------
echo   [12] Oxlint         (fast JS lint)
echo   [13] Actionlint     (workflow lint)
echo   [14] Gitleaks       (secret scan, staged)
echo.
echo  -- Search / source ----------------------------
echo   [15] Ripgrep        (quick code search)
echo   [16] FD             (find files)
echo.
echo  -- Documentation ------------------------------
echo   [17] TypeDoc        (API docs)
echo   [18] Markdownlint   (MD quality)
echo.
echo  -- Dependencies -------------------------------
echo   [19] Depcheck       (unused deps)
echo   [20] Size Limit     (bundle budget)
echo   [21] CSpell         (spell check)
echo   [22] Knip           (unused files/deps)
echo.
echo  -- Git ----------------------------------------
echo   [23] Commitlint     (check commit msg)
echo   [24] Husky          (reinstall hooks)
echo.
echo  -- Build / E2E --------------------------------
echo   [25] Workbox        (SW build)
echo   [26] Pa11y          (a11y audit)
echo   [27] LHCI           (Lighthouse CI)
echo   [28] BackstopJS     (visual regression)
echo.
echo  -- Global -------------------------------------
echo   [C]  Full check     (lint + style + tests)
echo   [Q]  Quit
echo.
set "CHOICE="
set /p "CHOICE=>> "
if not defined CHOICE (
  set /a EMPTY_COUNT+=1
  if !EMPTY_COUNT! geq 2 (
    echo.
    echo  [EOF] No input detected. Exiting.
    exit /b 0
  )
  goto menu
)
set "EMPTY_COUNT=0"
set "CHOICE=%CHOICE: =%"
if "%CHOICE%"=="" goto menu

if /i "%CHOICE%"=="1" set "TN=Biome" & set "TC=pushd "%~dp0.tools\Developer_Toolkit" && call ..\..\node_modules\.bin\biome check ..\.. --write && popd" & goto run
if /i "%CHOICE%"=="2" set "TN=ESLint" & set "TC=%BIN%eslint . --cache --cache-location .eslintcache --config .tools\Developer_Toolkit\eslint.config.mjs" & goto run
if /i "%CHOICE%"=="3" set "TN=Stylelint" & set "TC=%BIN%stylelint **/*.css --config .tools\Developer_Toolkit\.stylelintrc.json --ignore-path .tools\Developer_Toolkit\.stylelintignore" & goto run
if /i "%CHOICE%"=="4" set "TN=Prettier" & set "TC=%BIN%prettier --config .tools\Developer_Toolkit\.prettierrc --ignore-path .tools\Developer_Toolkit\.prettierignore --check **/*.{js,css,html,json}" & goto run
if /i "%CHOICE%"=="5" set "TN=Prettier W" & set "TC=%BIN%prettier --write --config .tools\Developer_Toolkit\.prettierrc --ignore-path .tools\Developer_Toolkit\.prettierignore **/*.{js,css,html,json}" & goto run
if /i "%CHOICE%"=="6" set "TN=Madge" & set "TC=%BIN%madge --circular --extensions js C2PA Watermark Pixel_Injection Audio_Watermark Fingerprint Document_Watermark Timestamp Metadata Forensic ID_Forge Decentralized_Identity_DID Certificate Assistant Converter Style cli" & goto run
if /i "%CHOICE%"=="7" set "TN=Core Tests" & set "TC=node --no-warnings --test --test-timeout=120000 cli/tests/did_test.js cli/tests/fingerprint_test.js cli/tests/id_forge_test.js cli/tests/watermark_core_test.js cli/tests/forensic_test.js" & goto run
if /i "%CHOICE%"=="8" set "TN=All Tests" & set "TC=npm test" & goto run
if /i "%CHOICE%"=="9" set "TN=Coverage" & set "TC=npm run coverage" & goto run
if /i "%CHOICE%"=="10" goto run_cloc
if /i "%CHOICE%"=="11" set "TN=JSCPD" & set "TC=%BIN%jscpd --config .tools\Developer_Toolkit\.jscpd.json ." & goto run
if /i "%CHOICE%"=="12" set "TN=Oxlint" & set "TC=%BIN%oxlint --config oxlint.config.json ." & goto run
if /i "%CHOICE%"=="13" goto run_actionlint
if /i "%CHOICE%"=="14" goto run_gitleaks
if /i "%CHOICE%"=="15" goto run_rg
if /i "%CHOICE%"=="16" goto run_fd
if /i "%CHOICE%"=="17" set "TN=TypeDoc" & set "TC=%BIN%typedoc --options .tools\Developer_Toolkit\typedoc.json" & goto run
if /i "%CHOICE%"=="18" set "TN=Markdownlint" & set "TC=%BIN%markdownlint --config .tools\Developer_Toolkit\.markdownlint.json **/*.md --ignore coverage --ignore node_modules --ignore vendor --ignore .opencode --ignore .agents --ignore agent --ignore .claude --ignore skills --ignore .env --ignore backstop_data --ignore certs --ignore docs --ignore .lh13 --ignore .lighthouseci --ignore .playwright-mcp --ignore .stryker-tmp --ignore test-results --ignore tests --ignore .tools" & goto run
if /i "%CHOICE%"=="19" set "TN=Depcheck" & set "TC=%BIN%depcheck --config .tools\Developer_Toolkit\.depcheckrc" & goto run
if /i "%CHOICE%"=="20" set "TN=Size Limit" & set "TC=%BIN%size-limit" & goto run
if /i "%CHOICE%"=="21" set "TN=CSpell" & set "TC=%BIN%cspell --config .tools\Developer_Toolkit\cspell.json --no-progress **/*.js **/*.css **/*.html **/*.md **/*.yml **/*.json" & goto run
if /i "%CHOICE%"=="22" set "TN=Knip" & set "TC=%BIN%knip --config .tools\Developer_Toolkit\knip.json" & goto run
if /i "%CHOICE%"=="23" set "TN=Commitlint" & set "TC=echo(feat: test ^| %BIN%commitlint --config .tools\Developer_Toolkit\commitlint.config.mjs" & goto run
if /i "%CHOICE%"=="24" set "TN=Husky" & set "TC=%BIN%husky" & goto run
if /i "%CHOICE%"=="25" set "TN=Workbox" & set "TC=%BIN%workbox generateSW .tools\Developer_Toolkit\workbox-config.js" & goto run
if /i "%CHOICE%"=="26" goto run_pa11y
if /i "%CHOICE%"=="27" goto run_lhci
if /i "%CHOICE%"=="28" goto run_backstop
if /i "%CHOICE%"=="C" set "TN=Full Check" & set "TC=npm run check" & goto run
if /i "%CHOICE%"=="c" set "TN=Full Check" & set "TC=npm run check" & goto run
if /i "%CHOICE%"=="Q" exit /b 0
if /i "%CHOICE%"=="q" exit /b 0
goto menu

:run_lhci
cls
echo.
echo  +---------------------------------------------+
echo  ^|         Running: LHCI
echo  +---------------------------------------------+
echo.
call :ensure_server
echo.
for /f "delims=" %%a in ('powershell -NoProfile -Command "[int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"') do set "T0=%%a"
call %BIN%lhci autorun --config .tools\Developer_Toolkit\lighthouserc.js
set "EC=%ERRORLEVEL%"
for /f "delims=" %%a in ('powershell -NoProfile -Command "[math]::Round((([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-%T0%)/1000.0,1)"') do set "ELAPSED=%%a"
call :stop_server_if_needed
echo.
echo  -----------------------------------------------
if %EC% equ 0 (
  echo  [PASS] LHCI completed successfully  ^(elapsed: %ELAPSED%s^)
) else (
  echo  [FAIL] LHCI ^(exit code: %EC%^)  ^(elapsed: %ELAPSED%s^)
)
echo  -----------------------------------------------
echo.
pause
goto banner

:run_pa11y
cls
echo.
echo  +---------------------------------------------+
echo  ^|         Running: Pa11y
echo  +---------------------------------------------+
echo.
call :ensure_server
echo.
for /f "delims=" %%a in ('powershell -NoProfile -Command "[int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"') do set "T0=%%a"
call %BIN%pa11y http://127.0.0.1:8080/
set "EC=%ERRORLEVEL%"
for /f "delims=" %%a in ('powershell -NoProfile -Command "[math]::Round((([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-%T0%)/1000.0,1)"') do set "ELAPSED=%%a"
call :stop_server_if_needed
echo.
echo  -----------------------------------------------
if %EC% equ 0 (
  echo  [PASS] Pa11y completed successfully  ^(elapsed: %ELAPSED%s^)
) else (
  echo  [FAIL] Pa11y ^(exit code: %EC%^)  ^(elapsed: %ELAPSED%s^)
)
echo  -----------------------------------------------
echo.
pause
goto banner

:run_backstop
cls
echo.
echo  +---------------------------------------------+
echo  ^|         Running: BackstopJS
echo  +---------------------------------------------+
echo.
call :ensure_server
echo.
for /f "delims=" %%a in ('powershell -NoProfile -Command "[int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"') do set "T0=%%a"
call %BIN%backstop test --config .tools\Developer_Toolkit\backstop.json
set "EC=%ERRORLEVEL%"
for /f "delims=" %%a in ('powershell -NoProfile -Command "[math]::Round((([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-%T0%)/1000.0,1)"') do set "ELAPSED=%%a"
call :stop_server_if_needed
echo.
echo  -----------------------------------------------
if %EC% equ 0 (
  echo  [PASS] BackstopJS completed successfully  ^(elapsed: %ELAPSED%s^)
) else (
  echo  [FAIL] BackstopJS ^(exit code: %EC%^)  ^(elapsed: %ELAPSED%s^)
)
echo  -----------------------------------------------
echo.
pause
goto banner

:run_actionlint
cls
echo.
echo  +---------------------------------------------+
echo  ^|         Running: Actionlint
echo  +---------------------------------------------+
echo.
call :ensure_toolkit
if not exist "%TK%actionlint.exe" (
  if exist "%TK%actionlint.exe" goto actionlint_ok
  echo  [FAIL] actionlint missing. Install: powershell -File scripts\install-toolkit-tools.ps1
  echo.
  pause
  goto banner
)
:actionlint_ok
for /f "delims=" %%a in ('powershell -NoProfile -Command "[int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"') do set "T0=%%a"
"%TK%actionlint.exe" -color
set "EC=%ERRORLEVEL%"
for /f "delims=" %%a in ('powershell -NoProfile -Command "[math]::Round((([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-%T0%)/1000.0,1)"') do set "ELAPSED=%%a"
echo.
echo  -----------------------------------------------
if %EC% equ 0 (
  echo  [PASS] Actionlint completed successfully  ^(elapsed: %ELAPSED%s^)
) else (
  echo  [FAIL] Actionlint ^(exit code: %EC%^)  ^(elapsed: %ELAPSED%s^)
)
echo  -----------------------------------------------
echo.
pause
goto banner

:run_gitleaks
cls
echo.
echo  +---------------------------------------------+
echo  ^|         Running: Gitleaks
echo  +---------------------------------------------+
echo.
call :ensure_toolkit
if not exist "%TK%gitleaks.exe" (
  echo  [FAIL] gitleaks missing. Install: powershell -File scripts\install-toolkit-tools.ps1
  echo.
  pause
  goto banner
)
for /f "delims=" %%a in ('powershell -NoProfile -Command "[int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"') do set "T0=%%a"
"%TK%gitleaks.exe" protect --staged --verbose
set "EC=%ERRORLEVEL%"
for /f "delims=" %%a in ('powershell -NoProfile -Command "[math]::Round((([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-%T0%)/1000.0,1)"') do set "ELAPSED=%%a"
echo.
echo  -----------------------------------------------
if %EC% equ 0 (
  echo  [PASS] Gitleaks completed successfully  ^(elapsed: %ELAPSED%s^)
) else (
  echo  [FAIL] Gitleaks ^(exit code: %EC%^)  ^(elapsed: %ELAPSED%s^)
)
echo  -----------------------------------------------
echo.
pause
goto banner

:run_rg
cls
echo.
echo  +---------------------------------------------+
echo  ^|         Running: Ripgrep
echo  +---------------------------------------------+
echo.
call :ensure_toolkit
if not exist "%TK%rg.exe" (
  echo  [FAIL] rg missing. Install: powershell -File scripts\install-toolkit-tools.ps1
  echo.
  pause
  goto banner
)
set /p "RG_QUERY=Enter search pattern: "
if not defined RG_QUERY set "RG_QUERY=."
setlocal DisableDelayedExpansion
"%TK%rg.exe" -n --no-ignore -g "!node_modules" -g "!.git" -g "!coverage" -g "!vendor" -g "!.opencode" -g "!.agents" -g "!agent" -g "!.claude" -g "!skills" -g "!.env" -g "!backstop_data" -g "!certs" -g "!docs" -g "!.lh13" -g "!.lighthouseci" -g "!.playwright-mcp" -g "!.stryker-tmp" -g "!test-results" -g "!tests" -g "!.tools" "%RG_QUERY%" .
set "EC=%ERRORLEVEL%"
endlocal & set "EC=%EC%"
echo.
echo  -----------------------------------------------
if %EC% equ 0 (
  echo  [DONE] Ripgrep search complete.
) else if %EC% equ 1 (
  echo  [INFO] No matches found.
) else (
  echo  [FAIL] Ripgrep ^(exit code: %EC%^)
)
echo  -----------------------------------------------
echo.
pause
goto banner

:run_fd
cls
echo.
echo  +---------------------------------------------+
echo  ^|         Running: FD
echo  +---------------------------------------------+
echo.
call :ensure_toolkit
if not exist "%TK%fd.exe" (
  echo  [FAIL] fd missing. Install: powershell -File scripts\install-toolkit-tools.ps1
  echo.
  pause
  goto banner
)
set /p "FD_PATT=Enter file pattern (e.g. *.js): "
if not defined FD_PATT set "FD_PATT=*"
"%TK%fd.exe" -H -g -E node_modules -E .git -E coverage -E vendor -E .opencode -E .agents -E agent -E .claude -E skills -E .env -E backstop_data -E certs -E docs -E .lh13 -E .lighthouseci -E .playwright-mcp -E .stryker-tmp -E test-results -E tests -E .tools "%FD_PATT%" .
set "EC=%ERRORLEVEL%"
echo.
echo  -----------------------------------------------
if %EC% equ 0 (
  echo  [DONE] FD search complete.
) else if %EC% equ 1 (
  echo  [INFO] No files found.
) else (
  echo  [FAIL] FD ^(exit code: %EC%^)
)
echo  -----------------------------------------------
echo.
pause
goto banner

:run_cloc
cls
echo.
echo  +---------------------------------------------+
echo  ^|         Running: CLOC
echo  +---------------------------------------------+
echo.
set "CLOCEXE="
where cloc.exe >nul 2>&1 && set "CLOCEXE=cloc.exe"
if not defined CLOCEXE if exist "%~dp0.tools\Developer_Toolkit\cloc.exe" set "CLOCEXE=%~dp0.tools\Developer_Toolkit\cloc.exe"
if not defined CLOCEXE (
  echo  [Download] cloc.exe not found in PATH. Downloading latest release from GitHub...
  if not exist "%~dp0.tools\Developer_Toolkit" mkdir "%~dp0.tools\Developer_Toolkit"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $ErrorActionPreference='Stop'; $out='%~dp0.tools\Developer_Toolkit\cloc.exe'; try { $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/AlDanial/cloc/releases/latest' -Headers @{ 'User-Agent' = 'redosan-toolkit' }; $asset = $rel.assets | Where-Object { $_.name -match '\.exe$' } | Select-Object -First 1; if (-not $asset) { Write-Host 'no .exe asset found in latest release'; exit 3 }; Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $out -UseBasicParsing; if (Test-Path -LiteralPath $out) { exit 0 } else { Write-Host 'download produced no file'; exit 4 } } catch { Write-Host ('download error: ' + $_.Exception.Message); exit 1 } }"
  if errorlevel 1 goto cloc_fail
  set "CLOCEXE=%~dp0.tools\Developer_Toolkit\cloc.exe"
)
echo  [OK] Using: %CLOCEXE%
echo.
pushd "%~dp0"
for /f "delims=" %%a in ('powershell -NoProfile -Command "[int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"') do set "T0=%%a"
"%CLOCEXE%" . --exclude-dir=node_modules,.git,vendor,coverage,.opencode,.agents,agent,.claude,skills,.env,backstop_data,certs,docs,.lh13,.lighthouseci,.playwright-mcp,.stryker-tmp,test-results,tests,.tools --quiet --progress-rate=0
set "EC=%ERRORLEVEL%"
for /f "delims=" %%a in ('powershell -NoProfile -Command "[math]::Round((([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-%T0%)/1000.0,1)"') do set "ELAPSED=%%a"
popd
echo.
echo  -----------------------------------------------
if %EC% equ 0 (
  echo  [PASS] CLOC completed successfully  ^(elapsed: %ELAPSED%s^)
) else (
  echo  [FAIL] CLOC ^(exit code: %EC%^)  ^(elapsed: %ELAPSED%s^)
)
echo  -----------------------------------------------
echo.
pause
goto banner

:cloc_fail
echo.
echo  [FAIL] Could not find or download cloc.exe.
echo         Install it manually from: https://github.com/AlDanial/cloc/releases
echo         (or place cloc.exe in PATH, or in .tools\Developer_Toolkit\cloc.exe)
echo.
pause
goto banner

:run
cls
echo.
echo  +---------------------------------------------+
echo  ^|         Running: %TN%
echo  +---------------------------------------------+
echo.
if /i "%TN%"=="ESLint" (
  echo  [Info] First run may take several minutes while ESLint builds its cache.
  echo         Subsequent runs are fast. Please wait...
  echo.
)
pushd "%~dp0"
for /f "delims=" %%a in ('powershell -NoProfile -Command "[int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"') do set "T0=%%a"
call %TC%
set "EC=%ERRORLEVEL%"
for /f "delims=" %%a in ('powershell -NoProfile -Command "[math]::Round((([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-%T0%)/1000.0,1)"') do set "ELAPSED=%%a"
popd
echo.
echo  -----------------------------------------------
if %EC% equ 0 (
  echo  [PASS] %TN% completed successfully  ^(elapsed: %ELAPSED%s^)
) else (
  echo  [FAIL] %TN% ^(exit code: %EC%^)  ^(elapsed: %ELAPSED%s^)
)
echo  -----------------------------------------------
echo.
pause
goto banner

:: ---- Dev server management (port 8080) ----
:ensure_server
set "STARTED_SERVER=0"
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8080/' -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% equ 0 (
  echo  [Server] Dev server already running.
  exit /b 0
)
echo  [Server] Dev server not running. Starting on port 8080...
start /b "" node dev-server.js
set "STARTED_SERVER=1"
:ensure_server_wait
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8080/' -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% neq 0 goto ensure_server_wait
echo  [Server] Dev server ready.
exit /b 0

:stop_server_if_needed
if "%STARTED_SERVER%"=="1" (
  echo  [Server] Stopping dev server...
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
  set "STARTED_SERVER=0"
)
exit /b 0

:: ---- Health check for opencode server ----
:ensure_toolkit
if not exist "%TK%" mkdir "%TK%"
exit /b 0

:: ---- Health check for opencode server ----
:check_server_health
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:4096/global/health' -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop; $d = $r.Content ^| ConvertFrom-Json; if ($d.healthy) { 'OK' } else { 'DOWN' } } catch { 'DOWN' }" 2^>nul') do set "SRV=%%a"
if "%SRV%"=="OK" (
  echo  [Server] opencode healthy
) else (
  echo  [Server] opencode not reachable (status unknown)
)
exit /b 0

@echo off
setlocal enabledelayedexpansion
set "PID_FILE=%TEMP%\.redosan-dev.pid"

:menu
cls
echo ============================================
echo      RedoSan Authenticity - Dev Server
echo ============================================
echo.
echo  1. Start server
echo  2. Restart server
echo  3. Stop server
echo  4. Check server status
echo  5. Exit
echo.
echo ============================================
set /p "CHOICE=Enter your choice (1-5): "

if "%CHOICE%"=="1" goto start
if "%CHOICE%"=="2" goto restart
if "%CHOICE%"=="3" goto stop
if "%CHOICE%"=="4" goto status
if "%CHOICE%"=="5" exit /b 0
goto menu

:start
if exist "%PID_FILE%" (
  echo.
  echo Server is already running.
  timeout /t 2 >nul
  goto menu
)
powershell -NoProfile -Command ^
  "$p = Start-Process -FilePath 'node' -ArgumentList 'dev-server.js' -WindowStyle Hidden -PassThru;" ^
  "$p.Id | Out-File -Encoding ascii '%PID_FILE%';" >nul
echo.
echo Dev server started on http://localhost:8080
timeout /t 2 >nul
goto menu

:restart
echo.
echo Stopping server...
call :kill
if exist "%PID_FILE%" del "%PID_FILE%" 2>nul
echo Starting server...
powershell -NoProfile -Command ^
  "$p = Start-Process -FilePath 'node' -ArgumentList 'dev-server.js' -WindowStyle Hidden -PassThru;" ^
  "$p.Id | Out-File -Encoding ascii '%PID_FILE%';" >nul
echo Dev server restarted on http://localhost:8080
timeout /t 2 >nul
goto menu

:stop
echo.
call :kill
if exist "%PID_FILE%" del "%PID_FILE%" 2>nul
echo Dev server stopped.
timeout /t 2 >nul
goto menu

:status
if not exist "%PID_FILE%" (
  echo.
  echo Server is NOT running.
) else (
  set /p PID=<"%PID_FILE%"
  tasklist /FI "PID eq %PID%" 2>nul | findstr "%PID%" >nul
  if !errorlevel! equ 0 (
    echo.
    echo Server is RUNNING ^(PID: %PID%^) on http://localhost:8080
  ) else (
    echo.
    echo PID file exists but process is not running ^(stale PID^)
    del "%PID_FILE%" 2>nul
  )
)
timeout /t 3 >nul
goto menu

:kill
if not exist "%PID_FILE%" exit /b 0
set /p PID=<"%PID_FILE%"
taskkill /F /PID %PID% >nul 2>&1
exit /b 0

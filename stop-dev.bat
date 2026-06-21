@echo off
setlocal
set "PID_FILE=%TEMP%\.redosan-dev.pid"
if not exist "%PID_FILE%" (
  echo No running server found.
  exit /b 1
)
set /p PID=<"%PID_FILE%"
taskkill /F /PID %PID% >nul 2>&1
del "%PID_FILE%"
echo Dev server stopped.

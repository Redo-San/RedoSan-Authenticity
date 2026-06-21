@echo off
setlocal
set "PID_FILE=%TEMP%\.redosan-dev.pid"
if exist "%PID_FILE%" (
  echo Server is already running ^(PID file exists^)
  exit /b 1
)
rem Start node in background, save PID
powershell -NoProfile -Command ^
  "$p = Start-Process -FilePath 'node' -ArgumentList 'dev-server.js' -WindowStyle Hidden -PassThru;" ^
  "$p.Id | Out-File -Encoding ascii '%PID_FILE%';" ^
  "Write-Host ('Dev server started (PID ' + $p.Id + ')');"
echo http://localhost:8080
echo Run stop-dev to stop the server.

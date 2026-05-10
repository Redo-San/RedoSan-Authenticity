@echo off
title RedoSan Authenticity - Online
echo ========================================
echo  RedoSan Authenticity - Online Launcher
echo ========================================
echo.
echo This will download and run the latest
echo version from GitHub temporarily.
echo All files are deleted on exit.
echo.
echo Requirements: Python 3.8+
echo.
pause
py -3 redosan_online.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo If Python is not found, try: python redosan_online.py
    pause
)

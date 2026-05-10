@echo off
title RedoSan Authenticity - GUI Online
echo ========================================
echo  RedoSan Authenticity - GUI Online
echo ========================================
echo.
echo This will download the latest version
echo from GitHub and run the GUI temporarily.
echo All files are deleted on exit.
echo.
echo Requirements: Python 3.8+ with customtkinter
echo.
pause
py -3 redosan_online_gui.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Try: python redosan_online_gui.py
    pause
)

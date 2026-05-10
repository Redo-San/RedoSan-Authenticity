@echo off
title RedoSan Authenticity - Setup
set "DIR=%~dp0"

REM Try python first, fall back to py launcher
python "%DIR%install.py"
if %ERRORLEVEL% NEQ 0 (
    echo Trying py launcher...
    py -3 "%DIR%install.py"
)
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Python not found! Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

pause
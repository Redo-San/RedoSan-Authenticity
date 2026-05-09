@echo off
title RedoSan Authenticity - Build Installer
echo =======================================================
echo   RedoSan Authenticity - Build Installer
echo =======================================================
echo.
echo This script builds the Windows installer using Inno Setup.
echo.
echo Prerequisites:
echo   1. Install Inno Setup from: https://jrsoftware.org/isdl.php
echo   2. Make sure "iscc.exe" is in your PATH
echo.

where iscc >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] iscc.exe not found in PATH.
    echo.
    echo Install Inno Setup and add iscc.exe to PATH, then re-run.
    echo Typical path: C:\Program Files (x86)\Inno Setup 6\iscc.exe
    echo.
    pause
    exit /b 1
)

echo [1/2] Building installer...
set "DIR=%~dp0"
iscc "%DIR%installer.iss"
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo [2/2] Done!
echo.
echo Installer created at:
echo   %DIR%installer_output\RedoSan_Authenticity_Setup_v1.0.0.exe
echo.
echo To publish on GitHub:
echo   1. Upload the .exe to GitHub Releases
echo   2. Users download and run it
echo.
pause

@echo off
title RedoSan Authenticity - Build EXE
echo =======================================================
echo   RedoSan Authenticity - Build Standalone EXE
echo =======================================================
echo.
echo This builds a single .exe using PyInstaller.
echo.

set "DIR=%~dp0"
set "PY311=C:\Program Files\Python311\python.exe"

if not exist "%PY311%" (
    where python >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Python not found!
        pause
        exit /b 1
    )
    set "PY311=python"
)

echo [1/2] Installing PyInstaller (if needed)...
"%PY311%" -m pip install pyinstaller -q

echo.
echo [2/2] Building RedoSan_Authenticity.exe...
"%PY311%" -m PyInstaller --onefile --windowed ^
    --name "RedoSan_Authenticity" ^
    --icon "%DIR%RedoSan_Authenticity.ico" ^
    --add-data "%DIR%RedoSan_Authenticity.py;." ^
    --add-data "%DIR%install.py;." ^
    --add-data "%DIR%modules;modules" ^
    --hidden-import "customtkinter" ^
    --hidden-import "PIL._tkinter_finder" ^
    "%DIR%RedoSan_Authenticity_gui.py"

if errorlevel 1 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo [DONE] EXE created at:
echo   %DIR%dist\RedoSan_Authenticity.exe
echo.
echo Size: 
for %%I in ("%DIR%dist\RedoSan_Authenticity.exe") do echo   %%~zI bytes
echo.
echo To publish: upload to GitHub Releases
echo.
pause

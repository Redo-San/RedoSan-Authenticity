@echo off
title RedoSan Authenticity - Setup
set "DIR=%~dp0"

REM Force Python 3.12 (where packages are installed)
set "PYTHON=C:\Users\pc\AppData\Local\Programs\Python\Python312\python.exe"

if exist "%PYTHON%" (
    "%PYTHON%" "%DIR%install.py"
) else (
    echo Python not found, trying py...
    py -3 "%DIR%install.py"
)

pause
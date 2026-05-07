@echo off
title RedoSan Authenticity
set "PYDIR=C:\RedoSan Authenticity"
set "PYTHON=C:\Program Files\Python311\python.exe"

if "%~1"=="" (
    "%PYTHON%" "%PYDIR%\RedoSan_Authenticity.py"
    goto :eof
)

"%PYTHON%" "%PYDIR%\RedoSan_Authenticity.py" "%~1"
ping -n 6 localhost >nul

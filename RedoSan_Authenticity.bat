@echo off
title RedoSan Authenticity
set "DIR=%~dp0"
py -3 "%DIR%RedoSan_Authenticity.py" %*
if %errorlevel% neq 0 (
    echo.
    echo [INFO] 'py -3' failed, trying 'python'...
    python "%DIR%RedoSan_Authenticity.py" %*
)

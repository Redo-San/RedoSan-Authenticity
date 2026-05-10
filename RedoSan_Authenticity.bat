@echo off
title RedoSan Authenticity - CLI
set "DIR=%~dp0"

python "%DIR%RedoSan_Authenticity.py" %*
if %ERRORLEVEL% NEQ 0 (
    py -3 "%DIR%RedoSan_Authenticity.py" %*
)
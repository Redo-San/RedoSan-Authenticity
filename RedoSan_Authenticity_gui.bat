@echo off
title RedoSan Authenticity - GUI
set "DIR=%~dp0"

python "%DIR%RedoSan_Authenticity_gui.py" %*
if %ERRORLEVEL% NEQ 0 (
    py -3 "%DIR%RedoSan_Authenticity_gui.py" %*
)
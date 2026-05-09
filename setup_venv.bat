@echo off
echo ============================================
echo   RedoSan Authenticity - VS Code Setup
echo ============================================

REM Create virtual environment if not exists
if not exist venv (
    echo [1/4] Creating virtual environment...
    python -m venv venv
) else (
    echo [1/4] Virtual environment already exists
)

REM Activate virtual environment
echo [2/4] Activating virtual environment...
call venv\Scripts\activate.bat

REM Upgrade pip
echo [3/4] Upgrading pip...
python -m pip install --upgrade pip

REM Install requirements
echo [4/4] Installing requirements...
pip install -r requirements.txt

echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo To run the GUI:
echo   python RedoSan_Authenticity_gui.py
echo.
echo To run the CLI:
echo   python RedoSan_Authenticity.py --help
echo.
echo To activate environment manually:
echo   venv\Scripts\activate
echo.
pause
@echo off
echo 🚀 RedoSan Authenticity - Automatic GitHub Setup 2026
echo ========================================================

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python first.
    pause
    exit /b 1
)

REM Check if pip is available
pip --version >nul 2>&1
if errorlevel 1 (
    echo ❌ pip is not available. Please check your Python installation.
    pause
    exit /b 1
)

REM Install required packages
echo 📦 Installing required packages...
pip install requests watchdog >nul 2>&1

REM Check if GITHUB_TOKEN is set
if "%GITHUB_TOKEN%"=="" (
    echo ❌ GITHUB_TOKEN environment variable is not set.
    echo 📝 Please set it first:
    echo    set GITHUB_TOKEN=your_github_token_here
    echo 📋 Get your token from: https://github.com/settings/tokens
    pause
    exit /b 1
)

echo ✅ Environment check passed
echo 🚀 Starting automatic GitHub upload...

REM Run the Python script
python AUTO_GITHUB_UPLOAD_2026.py

if errorlevel 1 (
    echo ❌ Failed to upload to GitHub
    pause
    exit /b 1
) else (
    echo 🎉 Successfully uploaded to GitHub!
    echo 📋 Repository: https://github.com/Redo-San/RedoSan-Authenticity
    echo 🏷️ Releases: https://github.com/Redo-San/RedoSan-Authenticity/releases
    pause
)

exit /b 0

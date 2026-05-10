# 🚀 RedoSan Authenticity - Automatic GitHub Setup 2026 (PowerShell)
# ========================================================

Write-Host "🚀 RedoSan Authenticity - Automatic GitHub Setup 2026" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

# Check if Python is installed
try {
    $pythonVersion = python --version 2>$null
    Write-Host "✅ Python is installed: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python is not installed. Please install Python first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if pip is available
try {
    $pipVersion = pip --version 2>$null
    Write-Host "✅ pip is available: $pipVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ pip is not available. Please check your Python installation." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Install required packages
Write-Host "📦 Installing required packages..." -ForegroundColor Yellow
try {
    pip install requests watchdog 2>$null
    Write-Host "✅ Required packages installed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install packages: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if GITHUB_TOKEN is set
if (-not $env:GITHUB_TOKEN) {
    Write-Host "❌ GITHUB_TOKEN environment variable is not set." -ForegroundColor Red
    Write-Host "📝 Please set it first:" -ForegroundColor Yellow
    Write-Host "   `$env:GITHUB_TOKEN = 'your_github_token_here'`" -ForegroundColor Cyan
    Write-Host "📋 Get your token from: https://github.com/settings/tokens" -ForegroundColor Cyan
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Environment check passed" -ForegroundColor Green
Write-Host "🚀 Starting automatic GitHub upload..." -ForegroundColor Green

# Run Python script
try {
    python AUTO_GITHUB_UPLOAD_2026.py
    if ($LASTEXITCODE -eq 0) {
        Write-Host "🎉 Successfully uploaded to GitHub!" -ForegroundColor Green
        Write-Host "📋 Repository: https://github.com/Redo-San/RedoSan-Authenticity" -ForegroundColor Cyan
        Write-Host "🏷️ Releases: https://github.com/Redo-San/RedoSan-Authenticity/releases" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Failed to upload to GitHub" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error running Python script: $_" -ForegroundColor Red
}

Read-Host "Press Enter to exit"

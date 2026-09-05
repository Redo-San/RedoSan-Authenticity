# RedoSan developer-toolkit binary installer.
# Downloads, SHA-256 verifies, and installs the pinned Windows binaries into
# .tools/Developer_Toolkit/. Binaries are gitignored (*.exe); nothing is
# staged or committed by this script.
# Requires: PowerShell 7+, curl.exe, and network access to github.com.
$ErrorActionPreference = "Stop"

$Destination = Join-Path $PSScriptRoot "..\.tools\Developer_Toolkit"
$ToolBinaries = @(
  @{
    Name       = "gitleaks"
    Version    = "v8.30.1"
    Url        = "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_windows_x64.zip"
    Checksum   = "d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e"
    ExtractExe = "gitleaks.exe"
  },
  @{
    Name       = "rg"
    Version    = "15.2.0"
    Url        = "https://github.com/BurntSushi/ripgrep/releases/download/15.2.0/ripgrep-15.2.0-x86_64-pc-windows-msvc.zip"
    Checksum   = "71b2fef860abe467217a538ff31de02f5258807c0129f771846f87bd029aafc5"
    ExtractExe = "ripgrep-15.2.0-x86_64-pc-windows-msvc\rg.exe"
  },
  @{
    Name       = "actionlint"
    Version    = "v1.7.12"
    Url        = "https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_windows_amd64.zip"
    Checksum   = "6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9"
    ExtractExe = "actionlint.exe"
  },
  @{
    Name       = "fd"
    Version    = "v10.5.0"
    Url        = "https://github.com/sharkdp/fd/releases/download/v10.5.0/fd-v10.5.0-x86_64-pc-windows-msvc.zip"
    Checksum   = "a227701b8551c35a9931d9f6da75503cf86d88e182d71fb849a70864c5d57cd7"
    ExtractExe = "fd-v10.5.0-x86_64-pc-windows-msvc\fd.exe"
  }
)

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$Work = Join-Path $env:TEMP "redosan-toolkit-install"
New-Item -ItemType Directory -Force -Path $Work | Out-Null

foreach ($Tool in $ToolBinaries) {
  $Zip = Join-Path $Work "$($Tool.Name).zip"
  Write-Host "Downloading $($Tool.Name) $($Tool.Version) ..." -ForegroundColor Cyan
  & curl.exe -L --fail --silent --show-error -o $Zip $Tool.Url
  if ($LASTEXITCODE -ne 0) { throw "Download failed for $($Tool.Name)" }

  $Actual = (Get-FileHash -Path $Zip -Algorithm SHA256).Hash.ToLower()
  if ($Actual -ne $Tool.Checksum) {
    throw "Checksum mismatch for $($Tool.Name): expected $($Tool.Checksum), got $Actual"
  }

  $ExtractDir = Join-Path $Work "$($Tool.Name)-x"
  Expand-Archive -Path $Zip -DestinationPath $ExtractDir -Force
  $ExeSrc = Join-Path $ExtractDir $Tool.ExtractExe
  if (-not (Test-Path -LiteralPath $ExeSrc)) { throw "Binary not found in archive for $($Tool.Name)" }
  Copy-Item -LiteralPath $ExeSrc -Destination (Join-Path $Destination "$($Tool.Name).exe") -Force
  Write-Host "Installed $($Tool.Name).exe (checksum OK)" -ForegroundColor Green
}

Remove-Item -LiteralPath $Work -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "All toolkit binaries installed to $Destination" -ForegroundColor Green
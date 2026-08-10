# RedoSan pre-commit secret scan (gitleaks)
# Fails the commit only when gitleaks is available and finds a secret in the
# staged diff. If gitleaks is missing, prints a warning and lets the commit
# proceed (CI is the enforcement layer).
$ErrorActionPreference = "Stop"

function Find-Gitleaks {
  $candidates = @()
  $cmd = Get-Command gitleaks -ErrorAction SilentlyContinue
  if ($cmd) { $candidates += $cmd.Source }
  if ($env:GITLEAKS_PATH) { $candidates += $env:GITLEAKS_PATH }
  $local = Join-Path $env:LOCALAPPDATA "opencode\gitleaks\gitleaks.exe"
  if (Test-Path $local) { $candidates += $local }
  foreach ($c in $candidates) {
    if (Test-Path $c) { return $c }
  }
  return $null
}

$gitleaks = Find-Gitleaks
if (-not $gitleaks) {
  Write-Host "WARN: gitleaks not found - staged secret scan skipped (install it or set GITLEAKS_PATH)." -ForegroundColor Yellow
  exit 0
}

& $gitleaks protect --staged --verbose
exit $LASTEXITCODE

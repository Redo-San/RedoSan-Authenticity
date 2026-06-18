param(
  [switch]$fix,
  [switch]$quick,
  [switch]$full
)

$ErrorActionPreference = "Continue"

if ($quick) {
  Write-Host "=== Quick local check ===" -ForegroundColor Cyan
  npm run lint:fix
  npm run biome:fix
  npm run stylelint:fix
  Write-Host "=== Running core tests ===" -ForegroundColor Cyan
  npm run test:core
  exit
}

if ($fix) {
  Write-Host "=== Fixing all issues ===" -ForegroundColor Cyan
  npm run lint:fix
  npm run biome:fix
  npm run stylelint:fix
  npm run markdownlint:fix
  exit
}

if ($full) {
  Write-Host "=== Full local audit ===" -ForegroundColor Cyan
  npm run lint
  npm run biome
  npm run stylelint
  npm run markdownlint
  npm run cspell
  npm run madge:circular
  npm run depcheck
  npm run test:core
  Write-Host "=== Done ===" -ForegroundColor Green
  exit
}

# Default: standard pre-push check
Write-Host "=== Pre-push check ===" -ForegroundColor Cyan

Write-Host "1/6 Linting..." -ForegroundColor Yellow
npm run lint
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: lint" -ForegroundColor Red; exit 1 }

Write-Host "2/6 Formatting..." -ForegroundColor Yellow
npm run biome
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: biome" -ForegroundColor Red; exit 1 }

Write-Host "3/6 CSS lint..." -ForegroundColor Yellow
npm run stylelint
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: stylelint" -ForegroundColor Red; exit 1 }

Write-Host "4/6 Circular deps..." -ForegroundColor Yellow
npm run madge:circular
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: circular deps" -ForegroundColor Red; exit 1 }

Write-Host "5/6 Core tests..." -ForegroundColor Yellow
npm run test:core
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: tests" -ForegroundColor Red; exit 1 }

Write-Host "6/6 Commit message lint..." -ForegroundColor Yellow
npx commitlint --edit $env:GIT_PARAMS
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: commit message" -ForegroundColor Red; exit 1 }

Write-Host "=== All checks passed! ===" -ForegroundColor Green

# Generate a self-signed localhost certificate for the HTTPS dev server
# (dev-server.js --https). Uses only built-in Windows/.NET APIs — no openssl.
# Requires PowerShell 7+ (pwsh) for the .NET 5+ PEM export APIs.
# Output: certs/localhost.crt + certs/localhost.key (PEM).
# Chrome will show a one-time "not secure" warning; click "Advanced → Proceed".

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$certDir = Join-Path $root "certs"
$certPath = Join-Path $certDir "localhost.crt"
$keyPath = Join-Path $certDir "localhost.key"

if ((Test-Path -LiteralPath $certPath) -and (Test-Path -LiteralPath $keyPath)) {
    Write-Host "Certificates already exist: $certDir"
    exit 0
}

New-Item -ItemType Directory -Force -Path $certDir | Out-Null

$cert = New-SelfSignedCertificate `
    -DnsName "localhost" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -NotAfter (Get-Date).AddYears(2)

$rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)

[System.IO.File]::WriteAllText($certPath, $cert.ExportCertificatePem())
[System.IO.File]::WriteAllText($keyPath, $rsa.ExportPkcs8PrivateKeyPem())

Remove-Item -Path $cert.PSPath -Force | Out-Null

Write-Host "Created:"
Write-Host "  $certPath"
Write-Host "  $keyPath"
Write-Host "Start the HTTPS dev server: node dev-server.js --https"

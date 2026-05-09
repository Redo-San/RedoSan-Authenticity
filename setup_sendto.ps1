# RedoSan Authenticity - Windows Send To Installer
# Right-click any file -> Send To -> RedoSan Authenticity
# Run:  powershell -ExecutionPolicy Bypass .\setup_sendto.ps1

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbs = Join-Path $dir "RedoSan_Authenticity_dragdrop.vbs"
$sendto = [Environment]::GetFolderPath('SendTo')
$lnk = Join-Path $sendto "RedoSan Authenticity.lnk"

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnk)
$sc.TargetPath = $vbs
$sc.WorkingDirectory = $dir
$sc.Description = "Send to RedoSan Authenticity"
$sc.Save()

Write-Host "[OK] SendTo shortcut created: $lnk"
Write-Host "[OK] Target: $vbs"

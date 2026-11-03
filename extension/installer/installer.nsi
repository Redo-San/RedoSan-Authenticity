; RedoSan Authenticity Inspector - Windows installer.
;
; Built by .github/workflows/extension-release.yml:
;   makensis -DVERSION=0.1.0 -DVERSION4=0.1.0.0 \
;            -DSRCDIR="$PWD/extension/.output" -DOUTFILE="$PWD/dist/..." \
;            installer/installer.nsi
;
; SRCDIR and OUTFILE must be absolute: NSIS resolves relative paths against the
; script directory, not the current directory. SEP defaults to "/" (Linux CI);
; pass -DSEP=\ when compiling on Windows.
;
; The installer is deliberately unprivileged (RequestExecutionLevel user) and
; writes only below %LOCALAPPDATA%. It cannot register the extension with the
; browser: Chrome blocks off-store installs on Windows (Chrome 33+), ignores
; --load-extension in branded builds, and Firefox release builds refuse unsigned
; add-ons. It therefore copies the packaged files, opens chrome://extensions and
; writes INSTALL.txt with the Firefox steps. See ../DISTRIBUTION.md.

Unicode true

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

!define APP_NAME "RedoSan Authenticity Inspector"
!define APP_PUBLISHER "RedoSan"
!define APP_URL "https://redo-san.github.io/RedoSan-Authenticity/"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\RedoSanAuthenticityInspector"

!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifndef VERSION4
  !define VERSION4 "0.0.0.0"
!endif
!ifndef SRCDIR
  !define SRCDIR ".output"
!endif
!ifndef OUTFILE
  !define OUTFILE "RedoSan-Inspector-Setup.exe"
!endif
!ifndef SEP
  !define SEP "/"
!endif

Name "${APP_NAME} ${VERSION}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\RedoSan\AuthenticityInspector"
InstallDirRegKey HKCU "${UNINST_KEY}" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "${APP_NAME} ${VERSION}"

VIProductVersion "${VERSION4}"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "FileDescription" "${APP_NAME} installer"
VIAddVersionKey "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey "LegalCopyright" "GPL-2.0"

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Open chrome://extensions"
!define MUI_FINISHPAGE_RUN_FUNCTION OpenChromeExtensions
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\INSTALL.txt"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Open the installation guide (INSTALL.txt)"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Var ChromeExe

Function FindChrome
  StrCpy $ChromeExe ""
  ReadRegStr $ChromeExe HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" ""
  ${If} $ChromeExe == ""
    ReadRegStr $ChromeExe HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" ""
  ${EndIf}
  ${If} $ChromeExe == ""
    ${If} ${FileExists} "$PROGRAMFILES64\Google\Chrome\Application\chrome.exe"
      StrCpy $ChromeExe "$PROGRAMFILES64\Google\Chrome\Application\chrome.exe"
    ${ElseIf} ${FileExists} "$PROGRAMFILES\Google\Chrome\Application\chrome.exe"
      StrCpy $ChromeExe "$PROGRAMFILES\Google\Chrome\Application\chrome.exe"
    ${ElseIf} ${FileExists} "$LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
      StrCpy $ChromeExe "$LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    ${EndIf}
  ${EndIf}
FunctionEnd

Section "-Install"
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "URLInfoAbout" "${APP_URL}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1

  ; A one-line helper so the folder path needed by "Load unpacked" can be
  ; copied without typing it.
  FileOpen $0 "$INSTDIR\Copy Chrome folder path.cmd" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "echo %~dp0chrome | clip$\r$\n"
  FileWrite $0 "echo Copied: %~dp0chrome$\r$\n"
  FileWrite $0 "pause$\r$\n"
  FileClose $0

  FileOpen $0 "$INSTDIR\INSTALL.txt" w
  FileWrite $0 "${APP_NAME} ${VERSION}$\r$\n"
  FileWrite $0 "==========================================$\r$\n$\r$\n"
  FileWrite $0 "Files were copied to:$\r$\n  $INSTDIR$\r$\n$\r$\n"
  FileWrite $0 "Google Chrome / Microsoft Edge (unpacked)$\r$\n"
  FileWrite $0 "--------------------------------------$\r$\n"
  FileWrite $0 "1. Open chrome://extensions (or edge://extensions)$\r$\n"
  FileWrite $0 "2. Turn on Developer mode$\r$\n"
  FileWrite $0 "3. Choose Load unpacked and select:$\r$\n   $INSTDIR\chrome$\r$\n"
  FileWrite $0 "4. Pin the extension from the puzzle-piece menu$\r$\n$\r$\n"
  FileWrite $0 "Chrome cannot install an extension outside the Chrome Web Store on$\r$\n"
  FileWrite $0 "Windows (blocked since Chrome 33), so Developer mode is the only$\r$\n"
  FileWrite $0 "no-cost path. The extension keeps working after a restart; dismiss$\r$\n"
  FileWrite $0 "the developer-mode notice when Chrome shows it.$\r$\n$\r$\n"
  FileWrite $0 "Mozilla Firefox$\r$\n"
  FileWrite $0 "---------------$\r$\n"
  FileWrite $0 "Release Firefox refuses unsigned add-ons permanently. Two options:$\r$\n$\r$\n"
  FileWrite $0 "A. Temporary (until Firefox restarts, works in every build)$\r$\n"
  FileWrite $0 "   about:debugging#/runtime/this-firefox -> Load Temporary Add-on$\r$\n"
  FileWrite $0 "   -> select $INSTDIR\firefox\manifest.json$\r$\n$\r$\n"
  FileWrite $0 "B. Permanent (needs a free AMO account, no fee)$\r$\n"
  FileWrite $0 "   Sign the XPI through addons.mozilla.org (unlisted channel), then$\r$\n"
  FileWrite $0 "   about:addons -> gear icon -> Install Add-on From File$\r$\n"
  FileWrite $0 "   -> select $INSTDIR\firefox\redosan-inspector.xpi$\r$\n$\r$\n"
  FileWrite $0 "Verification$\r$\n"
  FileWrite $0 "------------$\r$\n"
  FileWrite $0 "SHA-256 sums for every release asset are published next to the$\r$\n"
  FileWrite $0 "download as SHA256SUMS.txt.$\r$\n$\r$\n"
  FileWrite $0 "${APP_URL}$\r$\n"
  FileClose $0
SectionEnd

Section "Chrome / Edge extension files" SEC_CHROME
  SetOutPath "$INSTDIR\chrome"
  File /r "${SRCDIR}${SEP}chrome-mv3${SEP}*"
SectionEnd

Section "Firefox extension files (folder + XPI)" SEC_FIREFOX
  SetOutPath "$INSTDIR\firefox"
  File /r "${SRCDIR}${SEP}firefox-mv2${SEP}*"
  File "/oname=redosan-inspector.xpi" "${SRCDIR}${SEP}redosan-inspector.xpi"
SectionEnd

Function OpenChromeExtensions
  ; Skip when the Chrome/Edge section was deselected during setup.
  SectionGetFlags ${SEC_CHROME} $0
  IntOp $0 $0 & ${SF_SELECTED}
  ${If} $0 == 0
    Return
  ${EndIf}

  Call FindChrome
  ${If} $ChromeExe != ""
    Exec '"$ChromeExe" chrome://extensions/'
  ${Else}
    MessageBox MB_ICONINFORMATION|MB_OK "Google Chrome was not found in the usual locations.$\r$\n$\r$\nOpen chrome://extensions or edge://extensions manually, enable Developer mode, and choose Load unpacked with the folder printed in INSTALL.txt."
  ${EndIf}
FunctionEnd

; The file sections run before this callback, so the size is final here.
Function .onInstSuccess
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"
FunctionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_CHROME} "Copies the MV3 build to $INSTDIR\chrome for Load unpacked in Chrome or Edge."
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_FIREFOX} "Copies the MV2 build and the XPI to $INSTDIR\firefox for about:debugging or a signed install."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  DeleteRegKey HKCU "${UNINST_KEY}"
  RMDir /r "$INSTDIR"
SectionEnd

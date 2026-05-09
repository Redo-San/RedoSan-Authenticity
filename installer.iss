; RedoSan Authenticity - Inno Setup Installer
; To compile: right-click this file → Compile (with Inno Setup)
; Or: iscc installer.iss

#define MyAppName "RedoSan Authenticity"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Redo_San"
#define MyAppURL "https://github.com/Redo_San/RedoSan-Authenticity"
#define MyAppExeName "RedoSan_Authenticity.bat"

[Setup]
AppId={{B4F9E3A1-2C7D-4E5F-9A8B-3D6C1E2F4A7B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=installer_output
OutputBaseFilename=RedoSan_Authenticity_Setup_v{#MyAppVersion}
SetupIconFile=RedoSan_Authenticity.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=no
UninstallDisplayIcon={app}\RedoSan_Authenticity.ico
CloseApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: checkedonce
Name: "sendtoicon"; Description: "Add to Send To menu (right-click any file)"; GroupDescription: "Additional shortcuts:"; Flags: checkedonce

[Files]
; Core tool
Source: "RedoSan_Authenticity.py"; DestDir: "{app}"; Flags: ignoreversion
Source: "RedoSan_Authenticity.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "RedoSan_Authenticity.sh"; DestDir: "{app}"; Flags: ignoreversion
Source: "RedoSan_Authenticity_dragdrop.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "modules\ots_stamp.py"; DestDir: "{app}\modules"; Flags: ignoreversion
Source: "install.py"; DestDir: "{app}"; Flags: ignoreversion
Source: "checksums.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "requirements.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "setup.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "setup_sendto.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: ".gitignore"; DestDir: "{app}"; Flags: ignoreversion
Source: "c2pa_certs.pem"; DestDir: "{app}"; Flags: ignoreversion
Source: "c2pa_private.key"; DestDir: "{app}"; Flags: ignoreversion

; Modules
Source: "modules\__init__.py"; DestDir: "{app}\modules"; Flags: ignoreversion
Source: "modules\audio.py"; DestDir: "{app}\modules"; Flags: ignoreversion
Source: "modules\video.py"; DestDir: "{app}\modules"; Flags: ignoreversion
Source: "modules\provenance.py"; DestDir: "{app}\modules"; Flags: ignoreversion

; ICO (placeholder — auto-generated if missing)
Source: "RedoSan_Authenticity.ico"; DestDir: "{app}"; Flags: ignoreversion; Check: HasIcon

[Icons]
Name: "{group}\{#MyAppName} (Interactive Menu)"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Comment: "Launch RedoSan Authenticity interactive menu"
Name: "{group}\Setup & Dependencies"; Filename: "{app}\install.py"; WorkingDir: "{app}"; Comment: "Run dependency installer"
Name: "{group}\README"; Filename: "{app}\README.md"; WorkingDir: "{app}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon; Comment: "RedoSan Authenticity"
Name: "{sendto}\RedoSan Authenticity"; Filename: "{app}\RedoSan_Authenticity_dragdrop.vbs"; WorkingDir: "{app}"; Tasks: sendtoicon; Comment: "Send to RedoSan Authenticity"

[Run]
; Step 1: Install Python packages
Filename: "{cmd}"; Parameters: "/C """"{app}\install.py"" --quiet"""; WorkingDir: "{app}"; StatusMsg: "Installing Python packages & dependencies..."; Flags: runhidden

; Step 2: Download external tools (c2patool, openstego) from GitHub Releases
Filename: "{cmd}"; Parameters: "/C ""cd /d ""{app}"" && python -m pip install opentimestamps opentimestamps-client Pillow mutagen c2pa-python"""; WorkingDir: "{app}"; StatusMsg: "Installing Python libraries..."; Flags: runhidden

; Step 3: Run setup to check everything
Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Description: "Launch RedoSan Authenticity"; Flags: postinstall nowait skipifsilent unchecked

[UninstallRun]
; Remove pip packages on uninstall (optional)
Filename: "{cmd}"; Parameters: "/C pip uninstall -y c2pa-python mutagen Pillow opentimestamps-client opentimestamps 2>nul"; Flags: runhidden

[Code]
// ──────────────────────────────────────────────────────────
//  Python detection
// ──────────────────────────────────────────────────────────

function FindPython(): string;
var
  Paths: TArrayOfString;
  I: Integer;
  Versions: array of string;
  Keys: array of string;
  Key: string;
  InstallPath: string;
  Exe: string;
begin
  Result := '';

  // Check common install locations
  Versions := ['3.14', '3.13', '3.12', '3.11', '3.10', '3.9', '3.8'];
  Keys := ['SOFTWARE\Python\PythonCore\{#VERSION}\InstallPath',
           'SOFTWARE\Wow6432Node\Python\PythonCore\{#VERSION}\InstallPath'];

  for I := 0 to GetArrayLength(Versions) - 1 do
  begin
    for Key in Keys do
    begin
      InstallPath := '';
      if RegQueryStringValue(HKLM, StringReplace(Key, '{#VERSION}', Versions[I], []), '', InstallPath) or
         RegQueryStringValue(HKCU, StringReplace(Key, '{#VERSION}', Versions[I], []), '', InstallPath) then
      begin
        Exe := AddBackslash(InstallPath) + 'python.exe';
        if FileExists(Exe) then
        begin
          Result := Exe;
          Exit;
        end;
      end;
    end;
  end;

  // Fallback: check PATH
  if Exec('python', '--version', '', SW_HIDE, ewWaitUntilTerminated, InstallPath) then
    Result := 'python';
end;

// ──────────────────────────────────────────────────────────
//  Initialization: warn if no Python
// ──────────────────────────────────────────────────────────

function InitializeSetup(): Boolean;
var
  PyExe: string;
begin
  PyExe := FindPython();
  if PyExe = '' then
  begin
    if MsgBox('Python 3.8+ is required but not found.'#13#13
              'Install Python from python.org first, then run this installer again.'#13#13
              'Continue anyway?', mbError, MB_YESNO) = IDYES then
      Result := True
    else
      Result := False;
  end
  else
    Result := True;
end;

// ──────────────────────────────────────────────────────────
//  ICO fallback: generate icon if missing
// ──────────────────────────────────────────────────────────

function HasIcon: Boolean;
begin
  Result := FileExists(ExpandConstant('{src}\RedoSan_Authenticity.ico'));
end;

// ──────────────────────────────────────────────────────────
//  Post-install: download tools, verify, clean up
// ──────────────────────────────────────────────────────────

procedure CurStepChanged(CurStep: TSetupStep);
var
  AppDir: string;
  PyExe: string;
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    AppDir := ExpandConstant('{app}');
    PyExe := FindPython();

    if PyExe = '' then
      PyExe := 'python';

    // Run install.py to download tools & verify checksums
    Exec(ExpandConstant('{cmd}'), '/C ""' + PyExe + '" "' + AppDir + '\install.py""',
         AppDir, SW_SHOW, ewWaitUntilTerminated, ResultCode);

    if ResultCode = 0 then
      MsgBox('RedoSan Authenticity installed successfully!'#13#13
             'You can now:'#13
             '  - Right-click any file → Send To → RedoSan Authenticity'#13
             '  - Double-click the desktop shortcut'#13
             '  - Run: python RedoSan_Authenticity.py --help',
             mbInformation, MB_OK)
    else
      MsgBox('Setup completed with some warnings.'#13#13
             'Run "python install.py" from the install directory to check.',
             mbWarning, MB_OK);
  end;
end;

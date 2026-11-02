# Windows installer

`installer.nsi` is compiled by `.github/workflows/extension-release.yml` with
NSIS 3 on Ubuntu, after `npm run zip` and `npm run zip:firefox`. The script
embeds `.output/chrome-mv3`, `.output/firefox-mv2` and the Firefox XPI, and
writes an unprivileged per-user install under
`%LOCALAPPDATA%\RedoSan\AuthenticityInspector`.

`SRCDIR` and `OUTFILE` must be **absolute**: NSIS resolves relative paths
against the script directory, not the current directory. `SEP` defaults to `/`
(Linux); pass `-DSEP=\` on Windows.

## Build on Windows

```powershell
cd extension
npx -y npm@11.20.0 run zip
npx -y npm@11.20.0 run zip:firefox
Copy-Item .output\*-firefox.zip .output\redosan-inspector.xpi -Force
New-Item -ItemType Directory -Force dist | Out-Null

& 'C:\Program Files (x86)\NSIS\makensis.exe' `
  -DVERSION=0.1.0 `
  -DVERSION4=0.1.0.0 `
  -DSRCDIR="$PWD\.output" `
  -DOUTFILE="$PWD\dist\RedoSan-Inspector-Setup-0.1.0.exe" `
  '-DSEP=\' `
  installer\installer.nsi
```

## Build on Linux (same as CI)

```bash
sudo apt-get install -y --no-install-recommends nsis
cd extension
npx -y npm@11.20.0 run zip
npx -y npm@11.20.0 run zip:firefox
cp .output/*-firefox.zip .output/redosan-inspector.xpi
mkdir -p dist
makensis -V2 \
  -DVERSION=0.1.0 \
  -DVERSION4=0.1.0.0 \
  -DSRCDIR="$PWD/.output" \
  -DOUTFILE="$PWD/dist/RedoSan-Inspector-Setup-0.1.0.exe" \
  installer/installer.nsi
```

## Smoke test

```powershell
$exe = 'dist\RedoSan-Inspector-Setup-0.1.0.exe'
Start-Process $exe -ArgumentList '/S', "/D=$env:TEMP\redo-inspector-test" -Wait
Test-Path "$env:TEMP\redo-inspector-test\chrome\manifest.json"
Start-Process "$env:TEMP\redo-inspector-test\Uninstall.exe" -ArgumentList '/S' -Wait
Test-Path "$env:TEMP\redo-inspector-test"   # False
```

The installer is not code-signed. Do not add a self-signed certificate: it does
not satisfy SmartScreen and only makes the build look verified when it is not.

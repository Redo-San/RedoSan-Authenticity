@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

where node >nul 2>&1 || (echo node not found & pause & exit /b 1)

:banner
cls
echo.
echo  ===== RedoSan Authenticity - Test Runner =====
echo              Comprehensive Test Suite
echo.
echo  ==============================================
echo.

:menu
echo  Select test group:
echo.
echo   [1]  Quick Check     (did + fingerprint + id_forge)
echo   [2]  Core Suite      (all unit tests)
echo   [3]  Feature Suite   (converter, timestamp, metadata, cert, txt)
echo   [4]  E2E Suite       (Playwright browser tests)
echo   [5]  All Tests       (everything)
echo   [Q]  Quit
echo.
set /p "CHOICE=>> "

if /i "%CHOICE%"=="1" call :run_group "Quick Check" did_test fingerprint_test id_forge_test
if /i "%CHOICE%"=="2" call :run_group "Core Suite" did_test fingerprint_test id_forge_test watermark_core_test forensic_test pixel_injection_test advanced_watermarking_test c2pa_cbor_test c2pa_advanced_test audio_watermark_core_test document_watermark_test document_watermark_ui_test
if /i "%CHOICE%"=="3" call :run_group "Feature Suite" converter_test timestamp_test metadata_test certificate_test text_extractor_test remove_watermark_test
if /i "%CHOICE%"=="4" call :run_group "E2E Suite" e2e/e2e_navigation_test e2e/e2e_watermark_test e2e/e2e_audio_test e2e/e2e_c2pa_test e2e/e2e_did_test e2e/e2e_certificate_test e2e/e2e_fingerprint_test e2e/e2e_features_test e2e/e2e_docw_test e2e/e2e_metadata_test e2e/e2e_timestamp_test e2e/e2e_misc_pages_test e2e/e2e_pixel_injection_test e2e/e2e_forensic_test e2e/e2e_converter_removal_test e2e/e2e_music_persistence_test e2e/e2e_hybrid_test
if /i "%CHOICE%"=="5" call :run_group "All Tests" did_test fingerprint_test id_forge_test watermark_core_test forensic_test pixel_injection_test advanced_watermarking_test c2pa_cbor_test c2pa_advanced_test audio_watermark_core_test document_watermark_test document_watermark_ui_test converter_test timestamp_test metadata_test certificate_test text_extractor_test remove_watermark_test e2e/e2e_navigation_test e2e/e2e_watermark_test e2e/e2e_audio_test e2e/e2e_c2pa_test e2e/e2e_did_test e2e/e2e_certificate_test e2e/e2e_fingerprint_test e2e/e2e_features_test e2e/e2e_docw_test e2e/e2e_metadata_test e2e/e2e_timestamp_test e2e/e2e_misc_pages_test e2e/e2e_pixel_injection_test e2e/e2e_forensic_test e2e/e2e_converter_removal_test e2e/e2e_music_persistence_test e2e/e2e_hybrid_test
if /i "%CHOICE%"=="Q" exit /b 0
if /i "%CHOICE%"=="q" exit /b 0
goto menu

:run_group
set "GROUP_NAME=%~1"
set "PASS=0"
set "FAIL=0"
set "TOTAL=0"
set "IDX=0"
echo.
echo  ===== Running: %GROUP_NAME% =====
echo.

for %%t in (%*) do (
  if !IDX! gtr 0 (
    set /a TOTAL+=1
    set "TFILE=%%t"
    set "TDISPLAY=%%t"
    set "TDISPLAY=!TDISPLAY:e2e/e2e_=!"
    <nul set /p "=  [!TOTAL!] !TDISPLAY!... "
    pushd "%~dp0"
    node --test --test-timeout=300000 "cli/tests/%%t.js" >nul 2>&1
    set "EC=!ERRORLEVEL!"
    popd
    if !EC! equ 0 (
      echo PASS
      set /a PASS+=1
    ) else (
      echo FAIL
      set /a FAIL+=1
    )
  )
  set /a IDX+=1
)

echo.
echo  ===== Results: %GROUP_NAME% =====
echo     Total:  %TOTAL%
echo     Passed: %PASS%
echo     Failed: %FAIL%
echo.
if %FAIL% gtr 0 (
  echo  WARNING: Some tests failed.
)
echo.
pause
goto banner

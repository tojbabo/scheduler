@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-app.ps1"
set EXITCODE=%ERRORLEVEL%

if %EXITCODE% neq 0 (
  echo.
  pause
)
exit /b %EXITCODE%

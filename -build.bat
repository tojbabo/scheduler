@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo [Scheduler] 빌드 후 프로젝트 루트에 Scheduler.exe 생성
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-app.ps1"
set EXITCODE=%ERRORLEVEL%

echo.
if %EXITCODE% neq 0 (
  echo 실패했습니다. 위 로그를 확인하세요.
) else (
  echo 성공. 프로젝트 폴더의 Scheduler.exe 를 확인하세요.
)
echo.
pause
exit /b %EXITCODE%

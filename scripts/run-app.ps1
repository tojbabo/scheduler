$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$exe = Join-Path $root "Scheduler.exe"

if (-not (Test-Path $exe)) {
  $fallback = @(
    (Join-Path $root "src-tauri\target\release\Scheduler.exe"),
    (Join-Path $root "src-tauri\target\release\scheduler.exe")
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1

  if ($fallback) {
    Write-Host "프로젝트 루트 복사본이 없어 빌드 결과물을 실행합니다:" -ForegroundColor Yellow
    Write-Host $fallback
    Start-Process -FilePath $fallback
    exit 0
  }

  Write-Host "실행 파일을 찾을 수 없습니다." -ForegroundColor Red
  Write-Host "먼저 빌드.bat 을 실행하세요."
  Write-Host "기대 경로: $exe"
  exit 1
}

Write-Host "실행: $exe"
Start-Process -FilePath $exe

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
$env:Path = "$cargoBin;$env:Path"

$vcvars = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if (-not (Test-Path $vcvars)) {
  $vcvars = "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
}

Write-Host "==> Scheduler 빌드 시작" -ForegroundColor Cyan
Write-Host "프로젝트: $root"

if (Test-Path $vcvars) {
  Write-Host "==> MSVC 환경 로드"
  cmd /c "`"$vcvars`" && set" | ForEach-Object {
    if ($_ -match "^(.*?)=(.*)$") {
      Set-Item -Path "Env:$($matches[1])" -Value $matches[2]
    }
  }
} else {
  Write-Host "경고: vcvars64.bat을 찾지 못했습니다. 빌드가 실패할 수 있습니다." -ForegroundColor Yellow
}

npm run tauri:build
if ($LASTEXITCODE -ne 0) {
  throw "빌드 실패 (exit $LASTEXITCODE)"
}

$candidates = @(
  (Join-Path $root "src-tauri\target\release\Scheduler.exe"),
  (Join-Path $root "src-tauri\target\release\scheduler.exe")
)
$built = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $built) {
  throw "빌드된 exe를 찾지 못했습니다: src-tauri\target\release\"
}

$destExe = Join-Path $root "Scheduler.exe"
Copy-Item -Force -Path $built -Destination $destExe

Write-Host ""
Write-Host "==> 완료" -ForegroundColor Green
Write-Host "실행 파일: $destExe"
Write-Host "더블클릭하거나 .\실행.bat 으로 실행하세요."

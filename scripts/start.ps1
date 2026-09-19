$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
if (-not (Test-Path '.venv\Scripts\python.exe')) { throw 'Run scripts/setup.ps1 first' }
if (-not (Test-Path 'frontend\dist\index.html')) { throw 'Build frontend: cd frontend; npm run build' }
Write-Host 'AniqTashxis: http://127.0.0.1:8000'
Write-Host 'Demo account: doctor@demo.aniq / AniqDemo!2026'
& '.venv\Scripts\python.exe' -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --no-access-log

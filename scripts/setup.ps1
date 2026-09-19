$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
if (-not (Test-Path '.venv\Scripts\python.exe')) { py -3.12 -m venv .venv }
& '.venv\Scripts\python.exe' -m pip install -r backend\requirements.lock.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed' }
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }
Push-Location frontend
npm.cmd ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Frontend installation failed' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
Pop-Location
Write-Host 'Ready. Start with: powershell -ExecutionPolicy Bypass -File scripts/start.ps1'

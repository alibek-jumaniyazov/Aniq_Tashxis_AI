$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
& '.venv\Scripts\python.exe' -m pytest backend/tests -q
if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed' }
& '.venv\Scripts\python.exe' -m ruff check --config backend/pyproject.toml backend scripts
if ($LASTEXITCODE -ne 0) { throw 'Python lint failed' }
& '.venv\Scripts\python.exe' -m ruff format --check --config backend/pyproject.toml backend scripts
if ($LASTEXITCODE -ne 0) { throw 'Python formatting check failed' }
& '.venv\Scripts\python.exe' scripts/export_openapi.py --check
if ($LASTEXITCODE -ne 0) { throw 'OpenAPI contract is out of date' }
Push-Location frontend
try {
    npm.cmd run format:check
    if ($LASTEXITCODE -ne 0) { throw 'Frontend formatting check failed' }
    npm.cmd run lint
    if ($LASTEXITCODE -ne 0) { throw 'Frontend lint failed' }
    npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Frontend unit tests failed' }
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
    npm.cmd run test:e2e
    if ($LASTEXITCODE -ne 0) { throw 'Browser tests failed' }
} finally { Pop-Location }
Write-Host 'Engineering checks passed. Model inference and clinical validation are separate.'

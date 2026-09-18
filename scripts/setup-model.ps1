param([switch]$InstallRuntime)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
if ($InstallRuntime) {
    & '.venv\Scripts\python.exe' -m pip install -r backend\requirements-ai.txt
    if ($LASTEXITCODE -ne 0) { throw 'AI runtime installation failed' }
}
Write-Host 'Accept access terms at https://huggingface.co/google/medgemma-1.5-4b-it'
Write-Host 'Authenticate with: .venv\Scripts\hf.exe auth login'
Write-Host 'The token must never be added to git or sent to the frontend.'
& '.venv\Scripts\python.exe' -c "from huggingface_hub import get_token; import sys; sys.exit(0 if get_token() else 1)"
if ($LASTEXITCODE -ne 0) { throw 'Run the displayed hf auth login command locally, then run this script again.' }
& '.venv\Scripts\python.exe' scripts\download_model.py
if ($LASTEXITCODE -ne 0) { throw 'Model setup incomplete. See the reason above.' }

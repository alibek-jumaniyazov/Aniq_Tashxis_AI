param([int]$GpuLayers = 24, [string]$Device = '', [switch]$Diagnostics)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
$modelFile = Join-Path $projectRoot 'models\medgemma-1.5-4b-gguf\medgemma-1.5-4b-it-Q4_K_M.gguf'
$server = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'runtime\llama') -Filter llama-server.exe -Recurse | Select-Object -First 1
if (-not $server -or -not (Test-Path -LiteralPath $modelFile)) { throw 'Run .venv\Scripts\python.exe scripts/download_gguf.py first' }
$modelHash = (Get-FileHash -LiteralPath $modelFile -Algorithm SHA256).Hash.ToLowerInvariant()
if ($modelHash -ne 'b31becdf4f39561800505514cce67681604fe449d04dd35c8c92fd7848c6d7bd') { throw 'Model SHA-256 mismatch. Refusing to load unverified weights.' }
$keyFile = Join-Path $projectRoot 'runtime\model-server.key'
if (-not (Test-Path -LiteralPath $keyFile)) {
    & '.venv\Scripts\python.exe' -c "import secrets; from pathlib import Path; Path('runtime/model-server.key').write_text(secrets.token_urlsafe(48), encoding='ascii')"
    if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the local server key' }
}
Write-Host 'Local MedGemma 4B server: http://127.0.0.1:8081'
if ($GpuLayers -eq 0) { $Device = 'none' }
if (-not $Device) {
    $deviceLines = & $server.FullName --list-devices 2>$null
    $nvidiaLine = $deviceLines | Where-Object { $_ -match 'Vulkan\d+:.*NVIDIA' } | Select-Object -First 1
    if ($nvidiaLine -match '(Vulkan\d+):') { $Device = $Matches[1] } else { $Device = 'Vulkan0' }
}
Write-Host "Device: $Device; GPU layers: $GpuLayers"
$visionArgs = @()
$projector = Join-Path $projectRoot 'models\medgemma-1.5-4b-gguf\mmproj-F16.gguf'
if (Test-Path -LiteralPath $projector) {
    if ((Get-FileHash -LiteralPath $projector -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'f45f0f750587494e8f976d952cb396dfaa3158662120e2f9c224fc11f3882c83') { throw 'Vision projector SHA-256 mismatch' }
    $visionArgs = @('--mmproj', $projector, '--image-max-tokens', '256')
    Write-Host 'Vision enabled: selected image review with MedGemma.'
}
$logArgs = @()
if (-not $Diagnostics) { $logArgs += '--log-disable' }
& $server.FullName -m $modelFile @visionArgs --alias medgemma-1.5-4b-local --host 127.0.0.1 --port 8081 --device $Device -c 4096 -ngl $GpuLayers -np 1 -b 256 -ub 256 -cram 0 --jinja --no-webui --no-context-shift --no-slots --no-cache-prompt --api-key-file $keyFile @logArgs

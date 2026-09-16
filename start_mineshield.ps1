$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-Command",
    "Set-Location -LiteralPath '$root'; .\.venv\Scripts\python.exe -m uvicorn backend_server:app --port 8001"
) -WindowStyle Normal

Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-Command",
    "Set-Location -LiteralPath '$root\frontend'; npm run dev"
) -WindowStyle Normal

Write-Host "MineShield OCC services started. Dashboard: http://localhost:3000" -ForegroundColor Green

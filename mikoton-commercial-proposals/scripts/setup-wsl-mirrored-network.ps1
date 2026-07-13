param(
  [switch]$Apply
)

$ErrorActionPreference = "Stop"

$wslConfigPath = Join-Path $env:USERPROFILE ".wslconfig"
$requiredLines = @{
  "networkingMode=mirrored" = "[wsl2]`nnetworkingMode=mirrored"
}

function Test-WslLanAccess {
  try {
    & curl.exe -fsS --connect-timeout 10 "http://192.168.100.11:3000/healthz" | Out-Null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

function Test-WslNodeLanAccess {
  $projectDir = Split-Path -Parent $PSScriptRoot
  $result = wsl bash -lc "source ~/.nvm/nvm.sh 2>/dev/null; cd '$(wsl wslpath -a $projectDir)' && TWENTY_URL='http://192.168.100.11:3000' node scripts/network-preflight.mjs" 2>&1
  return $LASTEXITCODE -eq 0
}

Write-Host "Checking Windows access to Twenty..."
if (-not (Test-WslLanAccess)) {
  Write-Error "Windows cannot reach http://192.168.100.11:3000. Verify VPN/internal network and that Twenty is running."
}

Write-Host "Windows access: OK"

Write-Host "Checking WSL access to Twenty..."
if (Test-WslNodeLanAccess) {
  Write-Host "WSL access: OK"
  Write-Host "No WSL networking changes are required."
  exit 0
}

Write-Host "WSL access: FAILED"
Write-Host ""
Write-Host "WSL2 NAT cannot reach the internal Twenty host from Linux, while Windows can."
Write-Host "Private deploy requires WSL mirrored networking."
Write-Host ""

if (-not $Apply) {
  Write-Host "Run this command to apply the fix:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/setup-wsl-mirrored-network.ps1 -Apply"
  exit 1
}

$desiredContent = @"
[wsl2]
networkingMode=mirrored
dnsTunneling=true
firewall=true
autoProxy=true
"@

if (Test-Path -LiteralPath $wslConfigPath) {
  $existing = Get-Content -LiteralPath $wslConfigPath -Raw
  if ($existing -match "networkingMode\s*=\s*mirrored") {
    Write-Host "Mirrored networking is already configured in $wslConfigPath"
  } else {
    Add-Content -LiteralPath $wslConfigPath -Value "`n[wsl2]`nnetworkingMode=mirrored`ndnsTunneling=true`nfirewall=true`nautoProxy=true`n"
    Write-Host "Updated $wslConfigPath"
  }
} else {
  Set-Content -LiteralPath $wslConfigPath -Value $desiredContent -Encoding UTF8
  Write-Host "Created $wslConfigPath"
}

Write-Host ""
Write-Host "Restarting WSL to apply networking changes..."
wsl --shutdown
Start-Sleep -Seconds 3

Write-Host "Re-checking WSL access to Twenty..."
if (-not (Test-WslNodeLanAccess)) {
  Write-Error "WSL still cannot reach Twenty after enabling mirrored networking. Reboot Windows and run this script again."
}

Write-Host "WSL access: OK"
Write-Host "You can now run deploy.bat again."

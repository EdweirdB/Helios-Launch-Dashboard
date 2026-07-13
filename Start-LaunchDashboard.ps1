# Helios Launch Countdown — start on LAN
# Usage: .\Start-LaunchDashboard.ps1 [-Port 8780]

param(
  [string]$HostAddress = "0.0.0.0",
  [int]$Port = 8780
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command py -ErrorAction SilentlyContinue }
if (-not $python) { throw "Python is required on PATH." }

Write-Host "Starting Helios Launch Countdown on ${HostAddress}:${Port}" -ForegroundColor Yellow
Write-Host "Open from this PC:  http://127.0.0.1:$Port/" -ForegroundColor Cyan

try {
  $lan = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } |
    Select-Object -ExpandProperty IPAddress -Unique
  foreach ($ip in $lan) {
    Write-Host "Open from LAN:     http://${ip}:$Port/" -ForegroundColor Cyan
  }
} catch {}

# Best-effort firewall rule (may require elevation)
try {
  $rule = Get-NetFirewallRule -DisplayName "Helios Launch Countdown $Port" -ErrorAction SilentlyContinue
  if (-not $rule) {
    New-NetFirewallRule -DisplayName "Helios Launch Countdown $Port" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private,Domain -ErrorAction SilentlyContinue | Out-Null
  }
} catch {}

& $python.Source "$Root\server.py" --host $HostAddress --port $Port

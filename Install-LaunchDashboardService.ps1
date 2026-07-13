# Install Helios Launch Countdown as a persistent Windows Scheduled Task (at logon).
# Run elevated for best results:  .\Install-LaunchDashboardService.ps1

param(
  [int]$Port = 8780
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$TaskName = "HeliosLaunchCountdown"
$pyCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pyCmd) { $pyCmd = Get-Command py -ErrorAction SilentlyContinue }
if (-not $pyCmd) { throw "Python not found on PATH." }
$Python = $pyCmd.Source

$action = New-ScheduledTaskAction -Execute $Python -Argument "`"$Root\server.py`" --host 0.0.0.0 --port $Port" -WorkingDirectory $Root
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null

# Firewall
try {
  $ruleName = "Helios Launch Countdown $Port"
  if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private,Domain | Out-Null
  }
} catch {
  Write-Warning "Could not create firewall rule (run elevated): $_"
}

Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 2

Write-Host "Installed and started task '$TaskName'." -ForegroundColor Green
Write-Host "Dashboard: http://127.0.0.1:$Port/" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -like '192.168.*' } |
  ForEach-Object { Write-Host ("LAN URL:   http://{0}:{1}/" -f $_.IPAddress, $Port) -ForegroundColor Cyan }

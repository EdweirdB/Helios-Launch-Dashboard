# Helios Launch Countdown

Realtime kiosk dashboard for Helios platform launch countdowns — built to stay up on a LAN screen.

## Platforms tracked

| Platform | Build unit | Progress seed |
|---|---|---|
| Elite Vantage Greenfield | sprints S00–S39 | 17 / 40 (9 PASS + 8 impl) |
| Construction OS | sprints S00–S37 | 13 / 38 |
| Property OS | modules / phases | 3 / 16 |
| Corporate OS | phases 0–5 | 1 / 6 |
| Capital Markets OS — CRE | roadmap checklist | 9 / 46 |
| Plutus | launch items | 4 / 18 |

## Quick start (LAN)

```powershell
cd D:\Helios-Launch-Dashboard
.\Start-LaunchDashboard.ps1
```

Then open on the wall screen / any device on your network:

- Local: `http://127.0.0.1:8780/`
- LAN: `http://<this-machine-ip>:8780/` (printed at startup; currently often `192.168.1.115`)

### Keep it running after reboot

```powershell
# Prefer elevated PowerShell so the firewall rule sticks
.\Install-LaunchDashboardService.ps1
```

## Update targets / build counts

Edit `data/platforms.json` and save. The dashboard auto-refreshes every 30 seconds — no restart required for data edits (restart only if you change the server).

Each platform supports:

- `launch_at` — ISO-8601 target used by the live countdown
- `builds_completed` / `builds_total`
- `completed_builds` / `outstanding_builds` / `blockers` / `detail_sections` for the click-through drawer

## API

- `GET /api/state` — full fleet payload
- `GET /api/health` — liveness

## Stack

Zero dependencies: Python 3 stdlib HTTP server + static HTML/CSS/JS (Helios black + gold).

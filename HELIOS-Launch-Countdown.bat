@echo off
title HELIOS Launch Countdown
cd /d "D:\Helios-Launch-Dashboard"
echo Starting HELIOS Launch Countdown...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\Helios-Launch-Dashboard\Start-LaunchDashboard.ps1"
if errorlevel 1 (
  echo.
  echo Failed to start. Press any key to close.
  pause >nul
)

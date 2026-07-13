#!/usr/bin/env python3
"""Helios Launch Countdown — LAN-accessible dashboard server."""

from __future__ import annotations

import argparse
import json
import socket
import sys
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "platforms.json"
WEB_ROOT = ROOT / "web"


def load_payload() -> dict:
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    platforms = []
    for p in raw.get("platforms", []):
        completed = int(p.get("builds_completed", 0))
        total = int(p.get("builds_total", 0))
        outstanding = max(total - completed, 0)
        pct = round((completed / total) * 100, 1) if total else 0.0
        platforms.append(
            {
                **p,
                "builds_outstanding": outstanding,
                "progress_pct": pct,
            }
        )
    return {
        "schema": raw.get("schema", "helios.launch_countdown/v1"),
        "fleet_name": raw.get("fleet_name", "HELIOS Platform Launch"),
        "updated_at": raw.get("updated_at"),
        "notes": raw.get("notes", ""),
        "server_time": datetime.now(timezone.utc).isoformat(),
        "platforms": platforms,
    }


def lan_ips() -> list[str]:
    ips: list[str] = []
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    # Prefer common private ranges first
    preferred = [ip for ip in ips if ip.startswith(("192.168.", "10.", "172."))]
    return preferred or ips


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in ("/api/state", "/api/platforms"):
            self._send_json(load_payload())
            return
        if path in ("/api/health", "/health"):
            self._send_json({"ok": True, "server_time": datetime.now(timezone.utc).isoformat()})
            return
        if path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def _send_json(self, payload: dict) -> None:
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> int:
    parser = argparse.ArgumentParser(description="Helios Launch Countdown dashboard")
    parser.add_argument("--host", default="0.0.0.0", help="Bind address (default 0.0.0.0 for LAN)")
    parser.add_argument("--port", type=int, default=8780, help="Port (default 8780)")
    args = parser.parse_args()

    if not DATA_PATH.exists():
        print(f"Missing data file: {DATA_PATH}", file=sys.stderr)
        return 1
    if not (WEB_ROOT / "index.html").exists():
        print(f"Missing web UI: {WEB_ROOT / 'index.html'}", file=sys.stderr)
        return 1

    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    ips = lan_ips()
    print("Helios Launch Countdown")
    print(f"  Local:   http://127.0.0.1:{args.port}/")
    for ip in ips:
        print(f"  Network: http://{ip}:{args.port}/")
    if not ips:
        print("  Network: (could not detect LAN IP — use this machine's IPv4)")
    print(f"  Data:    {DATA_PATH}")
    print("  Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

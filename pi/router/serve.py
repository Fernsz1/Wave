"""
Runnable classroom-router entrypoint for the Raspberry Pi.

This is the deployment glue that [relay.py](relay.py) deliberately left out: it
opens the LoRa radio over serial, starts the downlink listener, and wraps a
dependency-light stdlib HTTP front-end around the relay + cache so student
devices on the Wi-Fi AP can fetch their material and post quiz attempts.

    Town/server (addr 1) ──LoRa──► Heltec B ──USB──► Pi ──Wi-Fi AP──► phone

Run on the Pi (from the repo root) after the AP is up:

    python -m pi.router.serve --serial /dev/ttyUSB0 --address 2 --http-port 80

HTTP surface (served to phones at http://10.0.0.1/):
    GET  /api/health                         -> {"status":"ok",...}
    GET  /api/remediation?section=<name>     -> [ {payload}, ... ] newest first
    POST /api/uplink   (body: envelope JSON) -> 202, ships it to the server

Stdlib only (http.server) + pyserial. No Flask/FastAPI needed on the Pi.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# Make `wave_api` (server/) and `pi.router` (repo root) importable whether this
# is launched as `python -m pi.router.serve` or `python pi/router/serve.py`.
_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT))
sys.path.insert(0, str(_ROOT / "server"))

from wave_api.lora.rylr998 import Rylr998Driver  # noqa: E402

from .cache import DEFAULT_DB, RelayCache  # noqa: E402
from .relay import Relay, RelayConfig  # noqa: E402

log = logging.getLogger("pi.router.serve")

MATERIAL_TYPE = "TeacherRemediationMaterial"


def _make_handler(relay: Relay, cache: RelayCache, address: int):
    class Handler(BaseHTTPRequestHandler):
        # Quieter, single-line access log via the project logger.
        def log_message(self, fmt, *args):  # noqa: A003
            log.info("http %s - %s", self.address_string(), fmt % args)

        def _send_json(self, code: int, obj) -> None:
            body = json.dumps(obj).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path in ("/api/health", "/health"):
                self._send_json(200, {"status": "ok", "address": address})
                return
            if parsed.path == "/api/remediation":
                qs = parse_qs(parsed.query)
                section = (qs.get("section") or [""])[0]
                if not section:
                    self._send_json(400, {"error": "missing ?section="})
                    return
                items = cache.list_for_section(section, MATERIAL_TYPE)
                self._send_json(200, items)
                return
            # A bare landing page so a phone's browser shows the link is alive.
            if parsed.path == "/":
                self._send_json(200, {"service": "wave-classroom-router", "address": address})
                return
            self._send_json(404, {"error": "not found"})

        def do_POST(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path != "/api/uplink":
                self._send_json(404, {"error": "not found"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                envelope = json.loads(self.rfile.read(length) or b"{}")
            except (ValueError, json.JSONDecodeError):
                self._send_json(400, {"error": "body must be a JSON envelope"})
                return
            if not isinstance(envelope, dict):
                self._send_json(400, {"error": "envelope must be a JSON object"})
                return
            relay.enqueue_uplink(envelope)  # ships to server with CSMA backoff
            self._send_json(202, {"status": "queued"})

    return Handler


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Wave classroom LoRa router (Pi).")
    p.add_argument("--serial", required=True, help="Heltec/RYLR998 serial port, e.g. /dev/ttyUSB0 or /dev/ttyAMA0")
    p.add_argument("--baud", type=int, default=115200)
    p.add_argument("--address", type=int, default=2, help="this Pi's LoRa address (village side)")
    p.add_argument("--network-id", type=int, default=18)
    p.add_argument("--server-addr", type=int, default=1, help="town/server LoRa address for uplinks")
    p.add_argument("--http-port", type=int, default=80)
    p.add_argument("--bind", default="0.0.0.0", help="HTTP bind address (10.0.0.1 on the AP)")
    p.add_argument("--db", default=str(DEFAULT_DB), help="late-joiner cache SQLite path")
    p.add_argument("--verbose", action="store_true")
    args = p.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    try:
        import serial  # pyserial
    except ImportError:
        print("pyserial not installed — run: pip install pyserial", file=sys.stderr)
        return 2

    driver = Rylr998Driver(serial.Serial(args.serial, args.baud, timeout=1))
    driver.configure(address=args.address, network_id=args.network_id)
    log.info("lora %s configured addr=%s net=%s", args.serial, args.address, args.network_id)

    cache = RelayCache(args.db)
    relay = Relay(driver, cache, RelayConfig(server_addr=args.server_addr))
    relay.start()
    log.info("relay listening for downlinks; cache=%s", args.db)

    httpd = ThreadingHTTPServer((args.bind, args.http_port), _make_handler(relay, cache, args.address))
    log.info("http serving on %s:%s", args.bind, args.http_port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log.info("shutting down")
    finally:
        httpd.server_close()
        relay.stop()
        driver.close()
        cache.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

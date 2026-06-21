"""
Classroom router HTTP front-end (runs on the Raspberry Pi, Heltec B side).

Dependency-light: stdlib `http.server` only — nothing to `pip install` on the Pi
beyond `pyserial` (which the LoRa driver needs). Serves the late-joiner cache to
student phones on the `Wave-Classroom` Wi-Fi AP and accepts student uplinks.

Endpoints
---------
  GET  /health                       -> {"ok": true}
  GET  /api/sync?section=<s>[&type=<t>]
                                     -> JSON array of tokenized envelope arrays
                                        (newest first) the app decodes with its
                                        codec — identical bytes to the MQTT path.
  POST /api/uplink   body: <token array>
                                     -> ship a student envelope back to town over
                                        LoRa (CSMA backoff via the relay). 202.

All responses carry permissive CORS headers so the browser PWA (served from the
Pi or loaded from the laptop's Vite dev server) can call cross-origin.

Run as the Pi daemon:
    python -m pi.router.serve
Configuration is via environment variables (see `_main` / PI_SETUP.md).
"""
from __future__ import annotations

import json
import logging
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .cache import RelayCache
from .relay import Relay

log = logging.getLogger(__name__)


class RouterHTTPServer(ThreadingHTTPServer):
    """ThreadingHTTPServer that carries the cache + relay for handlers to use."""

    daemon_threads = True

    def __init__(self, addr, cache: RelayCache, relay: "Relay | None"):
        self.cache = cache
        self.relay = relay
        super().__init__(addr, RouterHandler)


class RouterHandler(BaseHTTPRequestHandler):
    server_version = "WaveRouter/1.0"

    # ---- helpers ---------------------------------------------------------

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status: int, body: str) -> None:
        raw = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self._cors()
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(raw)

    def log_message(self, fmt: str, *args) -> None:  # route to logging, not stderr
        log.info("http %s - %s", self.address_string(), fmt % args)

    # ---- routes ----------------------------------------------------------

    def do_OPTIONS(self) -> None:  # CORS preflight
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json(200, '{"ok":true}')
            return
        if parsed.path == "/api/sync":
            qs = parse_qs(parsed.query)
            section = (qs.get("section") or [""])[0]
            msg_type = (qs.get("type") or [None])[0]
            # Each cached entry is already a serialized token-array string; splice
            # them into one JSON array without re-parsing (byte-faithful).
            rows = self.server.cache.list_for_section(section, msg_type)
            body = "[" + ",".join(rows) + "]"
            self._send_json(200, body)
            return
        self._send_json(404, '{"error":"not found"}')

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/uplink":
            self._send_json(404, '{"error":"not found"}')
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length else b""
            tokens = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            self._send_json(400, json.dumps({"error": f"bad body: {exc}"}))
            return
        relay = self.server.relay
        if relay is None:
            self._send_json(503, '{"error":"uplink unavailable (no radio)"}')
            return
        # enqueue_uplink json.dumps() the value; a token array serializes to the
        # tokenized envelope array — exactly the on-air uplink format.
        relay.enqueue_uplink(tokens)
        self._send_json(202, '{"queued":true}')


def serve(cache: RelayCache, relay: "Relay | None", host: str, port: int) -> RouterHTTPServer:
    """Build (but do not block on) the HTTP server. Caller runs serve_forever()."""
    httpd = RouterHTTPServer((host, port), cache, relay)
    log.info("router.http listening on %s:%d", host, port)
    return httpd


def _main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    import serial  # pyserial — only needed when actually driving the radio

    from wave_api.lora.rylr998 import Rylr998Driver

    port = os.getenv("WAVE_PI_PORT", "/dev/ttyUSB0")
    baud = int(os.getenv("WAVE_PI_BAUD", "115200"))
    http_host = os.getenv("WAVE_PI_HTTP_HOST", "0.0.0.0")
    http_port = int(os.getenv("WAVE_PI_HTTP_PORT", "80"))
    village_addr = int(os.getenv("WAVE_VILLAGE_ADDR", "2"))  # this Pi's Heltec B
    town_addr = int(os.getenv("WAVE_TOWN_ADDR", "1"))        # the laptop's Heltec A
    network_id = int(os.getenv("WAVE_NETWORK_ID", "18"))
    parameter = os.getenv("WAVE_PARAMETER", "10,7,1,7")
    cache_db = os.getenv("WAVE_CACHE_DB", "/var/lib/wave/cache.sqlite")

    log.info("router.boot opening %s @ %d baud", port, baud)
    ser = serial.Serial(port, baud, timeout=1)
    driver = Rylr998Driver(ser)
    driver.configure(address=village_addr, network_id=network_id, parameter=parameter)

    cache = RelayCache(cache_db)
    from .relay import RelayConfig

    relay = Relay(driver, cache, RelayConfig(server_addr=town_addr))
    relay.start()

    httpd = serve(cache, relay, http_host, http_port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log.info("router.shutdown")
    finally:
        relay.stop()
        driver.close()
        cache.close()


if __name__ == "__main__":
    _main()

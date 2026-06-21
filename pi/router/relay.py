"""
Classroom router relay daemon.

Runs on the Pi 4B. Listens on the RYLR998 UART for downstream remediation
chunks, reassembles them, caches per section, and serves the cache over
local HTTP to student devices on the Wi-Fi AP. Also accepts uplink POSTs
from students (quiz attempts) and ships them back to the server via LoRa
with CSMA-style backoff so an in-flight downlink isn't trampled.

This module imports the server-side LoRa transport for byte-identical
chunking semantics — a deliberate cross-host coupling keeps the two sides
in sync.
"""
from __future__ import annotations

import json
import logging
import random
import re
import threading
import time
from dataclasses import dataclass
from typing import Optional

from wave_api import codec
from wave_api.lora.chunk import Reassembler
from wave_api.lora.transport import send_payload
from wave_api.lora.rylr998 import ReceivedFrame, Rylr998Driver

from .cache import RelayCache

log = logging.getLogger(__name__)

REASSEMBLY_TIMEOUT_MS = 30_000


def _slug(section: str) -> str:
    """Section -> URL/topic slug. Must match server mqtt.slug and app topics.slug."""
    return re.sub(r"[^a-z0-9]+", "-", section.lower()).strip("-")


@dataclass
class RelayConfig:
    server_addr: int = 1
    poll_timeout: float = 0.5
    backoff_min_ms: int = 50
    backoff_max_ms: int = 500
    # LoRa is half-duplex: the radio is deaf while transmitting. Defer an uplink
    # until the channel has been quiet (no downlink frame received) for this
    # long, so we don't transmit into the middle of an in-flight downlink and
    # knock out a chunk the far side is still sending.
    quiet_period_ms: int = 150


class Relay:
    """Glue between the LoRa driver, the local cache, and the HTTP layer.

    The HTTP server itself (Flask/FastAPI/anything) is left to the deployment
    image — this class only exposes `ingest_downlink_payload(...)` and
    `enqueue_uplink(...)` so the HTTP layer can pass requests to it.
    """

    def __init__(
        self,
        driver: Rylr998Driver,
        cache: RelayCache,
        config: Optional[RelayConfig] = None,
    ):
        self._driver = driver
        self._cache = cache
        self._config = config or RelayConfig()
        self._reasm = Reassembler(timeout_ms=REASSEMBLY_TIMEOUT_MS)
        self._tx_lock = threading.Lock()
        self._rx_busy = threading.Event()
        self._last_rx_ms = 0.0  # monotonic ms of the most recent downlink frame
        self._stop = threading.Event()
        self._listener: Optional[threading.Thread] = None

    def start(self) -> None:
        if self._listener and self._listener.is_alive():
            return
        self._listener = threading.Thread(target=self._listen, name="relay-rx", daemon=True)
        self._listener.start()

    def stop(self) -> None:
        self._stop.set()
        if self._listener:
            self._listener.join(timeout=2)

    # ---- downlink (server -> Pi -> student) ------------------------------

    def _listen(self) -> None:
        while not self._stop.is_set():
            try:
                frame: ReceivedFrame = self._driver.recv(timeout=self._config.poll_timeout)
            except Exception:
                for mid in self._reasm.gc():
                    log.warning("lora.reassembly.timeout msgId=%s", mid)
                continue
            self._rx_busy.set()
            try:
                self._on_frame(frame)
            finally:
                self._last_rx_ms = time.monotonic() * 1000.0
                self._rx_busy.clear()
            for mid in self._reasm.gc():
                log.warning("lora.reassembly.timeout msgId=%s", mid)

    def _on_frame(self, frame: ReceivedFrame) -> None:
        try:
            d = json.loads(frame.data)
        except ValueError:
            log.warning("relay.bad_frame data=%r", frame.data)
            return
        from wave_api.lora.chunk import Chunk

        try:
            chunk = Chunk(msgId=d["msgId"], index=d["index"], total=d["total"], data=d["data"])
        except KeyError:
            log.warning("relay.malformed_chunk data=%r", d)
            return
        assembled = self._reasm.add(chunk)
        if assembled is not None:
            self.ingest_downlink_payload(assembled)

    def ingest_downlink_payload(self, serialized: str) -> None:
        """Called when a reassembled downlink payload is ready. Caches per section.

        The reassembled payload is the tokenized envelope ARRAY (the exact bytes
        that came over the air — identical to what flows over MQTT). We decode it
        only to read `section`/`type` for the cache keys, then store the raw
        array string verbatim so the student app can decode it with its codec,
        unchanged from the MQTT path.
        """
        try:
            tokens = json.loads(serialized)
        except ValueError:
            log.warning("relay.bad_payload serialized=%r", serialized[:120])
            return
        try:
            env = codec.decode_envelope(tokens)
        except Exception as exc:  # noqa: BLE001 — malformed envelope, drop it
            log.warning("relay.bad_envelope err=%s tokens=%r", exc, str(tokens)[:120])
            return
        # Cache key is the section SLUG so it matches the app's topic globs and
        # the /api/sync?section=<slug> query. The raw section still lives inside
        # the cached envelope for the app to read.
        section = _slug(env.get("section") or "")
        msg_type = env.get("type") or ""
        self._cache.store(section=section, msg_type=msg_type, payload=serialized)
        log.info("relay.cached section=%s type=%s", section, msg_type)

    # ---- uplink (student -> Pi -> server) --------------------------------

    def enqueue_uplink(self, envelope: dict) -> None:
        """Ship a student envelope back to the server with CSMA-style backoff."""
        serialized = json.dumps(envelope, separators=(",", ":"))
        threading.Thread(
            target=self._send_with_backoff,
            args=(serialized,),
            daemon=True,
        ).start()

    def _send_with_backoff(self, serialized: str) -> None:
        while self._channel_busy():
            delay = random.randint(self._config.backoff_min_ms, self._config.backoff_max_ms) / 1000
            time.sleep(delay)
        with self._tx_lock:
            send_payload(self._driver, self._config.server_addr, serialized)

    def _channel_busy(self) -> bool:
        """Best-effort 'is a downlink happening' check, half-duplex friendly.

        Three signals, cheapest first:
        - `_rx_busy`: a frame is being parsed right now.
        - a pending (incomplete) reassembly: a multi-frame downlink is in flight,
          so even the silent gap *between* chunks is busy — the far side is
          mid-air on the next chunk we simply haven't received yet. This is the
          SF-independent signal that a pure time window can't capture.
        - `quiet_period_ms` tail guard after the last received frame, to cover
          the brief settle before the server returns to listening.
        """
        if self._rx_busy.is_set():
            return True
        try:
            if self._reasm.pending_msg_ids():
                return True
        except RuntimeError:
            # _reasm mutated by the listener mid-iteration — treat as busy and
            # recheck on the next backoff cycle.
            return True
        if self._last_rx_ms == 0.0:
            return False
        return (time.monotonic() * 1000.0 - self._last_rx_ms) < self._config.quiet_period_ms

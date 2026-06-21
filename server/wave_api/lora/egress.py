"""
LoRa egress — town/server side (Heltec A).

Parallel to MQTT: when `settings.LORA_ENABLED` is true, every downstream cast
that the server publishes to Mosquitto is ALSO fragmented and shipped over LoRa
to the village radio (Heltec B on the Pi). The payload is the *already-tokenized*
envelope array (the same bytes that go over MQTT) — this module only adds the
LoRa-specific fragmentation + AT+SEND, reusing `transport.send_payload`.

Design mirrors `wave_api.mqtt._get_client()`: a lazily-opened singleton driver
that degrades gracefully. If LoRa is disabled, pyserial is missing, or the port
can't be opened, `get_driver()` returns None and `send_envelope()` is a no-op —
a radio fault never breaks the MQTT path.
"""
from __future__ import annotations

import json
import logging
import threading

from django.conf import settings

from .rylr998 import Rylr998Driver
from .transport import send_payload

log = logging.getLogger(__name__)

_driver: Rylr998Driver | None = None
_lock = threading.Lock()
_init_failed = False  # latch so we log the failure once, then stay quiet


def get_driver() -> Rylr998Driver | None:
    """Return the shared Heltec-A driver, opening it on first use.

    Returns None (and logs once) if LoRa is disabled or the radio is
    unavailable, so callers can no-op without special-casing.
    """
    global _driver, _init_failed
    if _driver is not None:
        return _driver
    if _init_failed or not getattr(settings, "LORA_ENABLED", False):
        return None
    with _lock:
        if _driver is not None:
            return _driver
        if _init_failed:
            return None
        try:
            port = settings.LORA_PORT
            if not port:
                raise ValueError("LORA_ENABLED but LORA_PORT is empty")
            import serial  # pyserial — imported lazily so it's optional

            ser = serial.Serial(port, settings.LORA_BAUD, timeout=1)
            drv = Rylr998Driver(ser)
            drv.configure(
                address=settings.LORA_TOWN_ADDR,
                network_id=settings.LORA_NETWORK_ID,
                parameter=settings.LORA_PARAMETER,
            )
            _driver = drv
            log.info(
                "lora.egress.ready port=%s addr=%s netid=%s param=%s",
                port,
                settings.LORA_TOWN_ADDR,
                settings.LORA_NETWORK_ID,
                settings.LORA_PARAMETER,
            )
            return _driver
        except Exception as exc:  # noqa: BLE001 — degrade gracefully like MQTT
            _init_failed = True
            log.warning("lora.egress.unavailable: %s (LoRa downlink disabled)", exc)
            return None


def send_envelope(env_tokens: list) -> None:
    """Fragment a tokenized envelope array and ship it to the village radio.

    No-op when LoRa is unavailable. Never raises — a radio error must not break
    the MQTT cast it runs alongside.
    """
    driver = get_driver()
    if driver is None:
        return
    serialized = json.dumps(env_tokens, separators=(",", ":"))
    try:
        send_payload(driver, settings.LORA_VILLAGE_ADDR, serialized)
    except Exception as exc:  # noqa: BLE001
        log.warning("lora.egress.send_failed: %s", exc)


def close() -> None:
    """Close the shared driver (used by tests / clean shutdown)."""
    global _driver, _init_failed
    with _lock:
        if _driver is not None:
            _driver.close()
        _driver = None
        _init_failed = False

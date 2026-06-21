"""
Tests for the Pi relay's tokenized-envelope handling.

The relay receives reassembled tokenized-envelope arrays over LoRa, decodes them
only far enough to read section/type, and caches the RAW array string keyed by
the section slug — so the student app fetches and decodes it exactly as it would
an MQTT message. These tests run the real relay + cache against FakeSerial.
"""
import json

import pytest

from tests.fakes.fake_serial import linked_pair
from wave_api import codec
from wave_api.lora.rylr998 import Rylr998Driver
from wave_api.lora.transport import send_payload

from pi.router.cache import RelayCache
from pi.router.relay import Relay, RelayConfig, _slug


SECTION = "Grade 6 - Section Newton"


def _rankings_envelope() -> list:
    rankings = {
        "section": SECTION,
        "subject": "science",
        "standings": [
            {"rank": 1, "studentLrn": "111", "name": "Ana", "score": 9, "perfect": 10, "percent": 90},
        ],
    }
    return codec.encode_envelope(
        {
            "version": codec.PROTOCOL_VERSION,
            "msgId": "rank0001",
            "type": "Rankings",
            "direction": "down",
            "subject": "science",
            "section": SECTION,
            "createdAt": "2026-06-21T00:00:00Z",
            "chunkIndex": 0,
            "chunkTotal": 1,
            "payload": codec.encode("Rankings", rankings),
        }
    )


def test_ingest_caches_raw_array_by_section_slug(tmp_path):
    cache = RelayCache(tmp_path / "cache.sqlite")
    ser_a, ser_b = linked_pair(addr_a=1, addr_b=2)
    drv = Rylr998Driver(ser_b, ack_timeout=2.0)
    relay = Relay(drv, cache, RelayConfig(server_addr=1))
    env = _rankings_envelope()
    serialized = json.dumps(env, separators=(",", ":"))
    try:
        relay.ingest_downlink_payload(serialized)
        # Cached under the SLUG of the section, keyed by the decoded type.
        rows = cache.list_for_section(_slug(SECTION), "Rankings")
        assert len(rows) == 1
        # Stored verbatim — decodes back to the original tokenized envelope.
        assert json.loads(rows[0]) == env
        assert codec.decode_envelope(json.loads(rows[0]))["section"] == SECTION
    finally:
        drv.close()
        cache.close()


def test_bad_envelope_is_dropped_not_cached(tmp_path):
    cache = RelayCache(tmp_path / "cache.sqlite")
    ser_a, ser_b = linked_pair(addr_a=1, addr_b=2)
    drv = Rylr998Driver(ser_b, ack_timeout=2.0)
    relay = Relay(drv, cache, RelayConfig(server_addr=1))
    try:
        relay.ingest_downlink_payload("not json at all")
        assert cache.list_for_section(_slug(SECTION)) == []
    finally:
        drv.close()
        cache.close()


def test_multiframe_envelope_over_fake_radio(tmp_path):
    """End-to-end through the chunk/transport layer: a big envelope fragments,
    travels over the fake link, and the relay reassembles + caches it."""
    cache = RelayCache(tmp_path / "cache.sqlite")
    ser_a, ser_b = linked_pair(addr_a=1, addr_b=2)
    drv_a = Rylr998Driver(ser_a, ack_timeout=2.0)  # town (sender)
    drv_b = Rylr998Driver(ser_b, ack_timeout=2.0)  # village (relay)
    relay = Relay(drv_b, cache, RelayConfig(server_addr=1))
    relay.start()

    material = {
        "id": "REM-MF",
        "originalTopicId": "T1",
        "title": "Big Remedial",
        "content": "y" * 500,  # forces multiple frames
        "teacherNotes": "notes",
        "createdQuiz": [],
        "publishDate": "2026-06-21T00:00:00Z",
        "targetSection": SECTION,
        "chunks": [],
        "isPublished": True,
    }
    env = codec.encode_envelope(
        {
            "version": codec.PROTOCOL_VERSION,
            "msgId": "remmf001",
            "type": "TeacherRemediationMaterial",
            "direction": "down",
            "subject": None,
            "section": SECTION,
            "createdAt": "2026-06-21T00:00:00Z",
            "chunkIndex": 0,
            "chunkTotal": 1,
            "payload": codec.encode("TeacherRemediationMaterial", material),
        }
    )
    serialized = json.dumps(env, separators=(",", ":"))
    try:
        send_payload(drv_a, 2, serialized, frame_size=180)
        # Give the relay listener thread time to receive + reassemble + cache.
        import time

        deadline = time.monotonic() + 5
        rows = []
        while time.monotonic() < deadline:
            rows = cache.list_for_section(_slug(SECTION), "TeacherRemediationMaterial")
            if rows:
                break
            time.sleep(0.05)
        assert rows and json.loads(rows[0]) == env
    finally:
        relay.stop()
        drv_a.close()
        drv_b.close()
        cache.close()

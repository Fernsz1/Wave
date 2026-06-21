"""
Tests for the server-side LoRa egress (Heltec A).

Proves the live-path contract: a tokenized envelope handed to
`egress.send_envelope()` is fragmented, shipped over the (faked) radio, and
reassembles on the peer back into the *identical* tokenized array — i.e. the
exact bytes a student would have received over MQTT. Also proves the
degrade-gracefully guarantee: with LoRa disabled, send is a silent no-op.
"""
import json

import pytest

from tests.fakes.fake_serial import linked_pair
from wave_api import codec
from wave_api.lora import egress
from wave_api.lora.rylr998 import Rylr998Driver
from wave_api.lora.transport import recv_payloads


def _sample_envelope() -> list:
    """A realistic tokenized TeacherRemediationMaterial down-cast envelope."""
    material = {
        "id": "REM-EG1",
        "originalTopicId": "T1",
        "title": "Remedial: Fractions",
        "content": "x" * 400,  # large enough to force multi-frame fragmentation
        "teacherNotes": "Focus on halves and quarters.",
        "createdQuiz": [],
        "publishDate": "2026-06-21T00:00:00Z",
        "targetSection": "Grade 6 - Section Newton",
        "chunks": [],
        "isPublished": True,
    }
    return codec.encode_envelope(
        {
            "version": codec.PROTOCOL_VERSION,
            "msgId": "abc12345",
            "type": "TeacherRemediationMaterial",
            "direction": "down",
            "subject": None,
            "section": "Grade 6 - Section Newton",
            "createdAt": "2026-06-21T00:00:00Z",
            "chunkIndex": 0,
            "chunkTotal": 1,
            "payload": codec.encode("TeacherRemediationMaterial", material),
        }
    )


@pytest.fixture(autouse=True)
def _reset_egress():
    egress.close()
    yield
    egress.close()


def test_send_envelope_noop_when_disabled(monkeypatch):
    # Default LORA_ENABLED is False — get_driver returns None, send is a no-op.
    monkeypatch.setattr(egress.settings, "LORA_ENABLED", False, raising=False)
    egress.send_envelope(_sample_envelope())  # must not raise
    assert egress.get_driver() is None


def test_send_envelope_fragments_and_reassembles(monkeypatch):
    ser_a, ser_b = linked_pair(addr_a=1, addr_b=2)
    drv_a = Rylr998Driver(ser_a, ack_timeout=2.0)
    drv_b = Rylr998Driver(ser_b, ack_timeout=2.0)
    # Inject the town driver as the egress singleton and point egress at addr 2.
    monkeypatch.setattr(egress, "_driver", drv_a, raising=False)
    monkeypatch.setattr(egress.settings, "LORA_VILLAGE_ADDR", 2, raising=False)

    env = _sample_envelope()
    try:
        gen = recv_payloads(drv_b, poll_timeout=0.2, reassembly_timeout_ms=5000)
        egress.send_envelope(env)
        assembled = next(gen)
        # The reassembled bytes decode back to the exact tokenized envelope.
        assert json.loads(assembled) == env
        # And the envelope still decodes to the original section/type.
        meta = codec.decode_envelope(json.loads(assembled))
        assert meta["type"] == "TeacherRemediationMaterial"
        assert meta["section"] == "Grade 6 - Section Newton"
    finally:
        drv_a.close()
        drv_b.close()

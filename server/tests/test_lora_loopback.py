"""
Loopback integration tests using FakeSerial. Simulates two RYLR998 modules
linked by a perfect (or lossy) channel — no real hardware required.

Mirrors the Tier-2 bench tests so the same code paths can be exercised in CI.
"""
import json
import threading

import pytest

from tests.fakes.fake_serial import FakeSerial, LoopbackChannel, linked_pair
from wave_api.lora.chunk import Reassembler, Chunk
from wave_api.lora.rylr998 import ReceivedFrame, Rylr998Driver, Rylr998Error
from wave_api.lora.transport import recv_payloads, send_payload


def _start_driver_pair():
    ser_a, ser_b = linked_pair(addr_a=1, addr_b=2)
    drv_a = Rylr998Driver(ser_a, ack_timeout=2.0)
    drv_b = Rylr998Driver(ser_b, ack_timeout=2.0)
    return drv_a, drv_b


def test_at_send_returns_ok_via_fake():
    drv_a, drv_b = _start_driver_pair()
    try:
        drv_a.send(2, "hello")
        frame: ReceivedFrame = drv_b.recv(timeout=2.0)
        assert frame.addr == 1
        assert frame.data == "hello"
        assert frame.length == 5
    finally:
        drv_a.close()
        drv_b.close()


def test_at_send_at_error_raises():
    ser_a, ser_b = linked_pair()
    ser_a.scripted_acks.append("+ERR=10")
    drv_a = Rylr998Driver(ser_a, ack_timeout=2.0)
    drv_b = Rylr998Driver(ser_b, ack_timeout=2.0)
    try:
        with pytest.raises(Rylr998Error, match="ERR=10"):
            drv_a.send(2, "boom")
    finally:
        drv_a.close()
        drv_b.close()


def test_multi_chunk_payload_reassembles():
    drv_a, drv_b = _start_driver_pair()
    big = json.dumps({"x": "y" * 600})
    try:
        gen = recv_payloads(drv_b, poll_timeout=0.2, reassembly_timeout_ms=5000)
        msg_id = send_payload(drv_a, 2, big, frame_size=180)
        assembled = next(gen)
        assert assembled == big
        assert msg_id  # 8-hex
    finally:
        drv_a.close()
        drv_b.close()


def test_dropped_frame_never_emits_partial():
    chan = LoopbackChannel(drop_indices=[1])  # drop the SECOND AT+SEND
    ser_a = FakeSerial(address=1, channel=chan)
    ser_b = FakeSerial(address=2, peer=ser_a, channel=chan)
    drv_a = Rylr998Driver(ser_a, ack_timeout=2.0)
    drv_b = Rylr998Driver(ser_b, ack_timeout=2.0)
    payload = "abc" * 200
    try:
        gen = recv_payloads(drv_b, poll_timeout=0.2, reassembly_timeout_ms=300)
        send_payload(drv_a, 2, payload, frame_size=180)
        # The generator must NOT yield a partial; force one poll cycle then
        # confirm nothing emerged within the reassembly timeout.
        import _thread, time
        result = {"v": None}

        def consume():
            try:
                result["v"] = next(gen)
            except StopIteration:
                pass

        t = threading.Thread(target=consume, daemon=True)
        t.start()
        t.join(timeout=1.5)
        assert result["v"] is None
    finally:
        drv_a.close()
        drv_b.close()


def test_duplicate_frame_idempotent():
    chan = LoopbackChannel(duplicate_indices=[0, 1])
    ser_a = FakeSerial(address=1, channel=chan)
    ser_b = FakeSerial(address=2, peer=ser_a, channel=chan)
    drv_a = Rylr998Driver(ser_a, ack_timeout=2.0)
    drv_b = Rylr998Driver(ser_b, ack_timeout=2.0)
    payload = "duplicate" * 60
    try:
        gen = recv_payloads(drv_b, poll_timeout=0.2)
        send_payload(drv_a, 2, payload, frame_size=180)
        assembled = next(gen)
        assert assembled == payload
    finally:
        drv_a.close()
        drv_b.close()

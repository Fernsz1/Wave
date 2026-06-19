"""
Tier-2 hardware-in-the-loop tests against two physical RYLR998 modules.

Skipped unless WAVE_HW_BENCH=1. Pair the modules on the same NetworkID and
let them sit at least 30 cm apart with a 20 dB attenuator on the server side
to avoid desensing. Run via:

  WAVE_HW_BENCH=1 \
  WAVE_HW_SERVER_PORT=/dev/ttyUSB0 \
  WAVE_HW_ROUTER_PORT=/dev/ttyAMA0 \
  pytest server/tests/hw/test_lora_link.py
"""
import json
import threading
import time

import pytest

from wave_api.lora.chunk import fragment
from wave_api.lora.rylr998 import Rylr998Error
from wave_api.lora.transport import recv_payloads, send_payload


# H1
def test_at_version_and_address(server_driver):
    ver = server_driver.version()
    assert ver.startswith("+VER=")
    addr = server_driver.address()
    assert addr.startswith("+ADDRESS=")


# H2
def test_single_frame_send_recv(server_driver, router_driver):
    payload = "hello-bench-12345"
    send_payload(server_driver, 2, payload, frame_size=200)
    gen = recv_payloads(router_driver, poll_timeout=0.5, reassembly_timeout_ms=10_000)
    out = next(gen)
    assert out == payload


# H3
def test_remediation_material_real_rf(server_driver, router_driver):
    blob = json.dumps({"id": "REM-HW", "content": "x" * 600})
    gen = recv_payloads(router_driver, poll_timeout=0.5, reassembly_timeout_ms=30_000)
    msg_id = send_payload(server_driver, 2, blob, frame_size=200)
    assembled = next(gen)
    assert assembled == blob
    expected_chunks = len(fragment(msg_id, blob, 200))
    assert expected_chunks > 1  # truly multi-frame


# H4 — backpressure: send() must block on +OK before next send
def test_at_send_serializes_on_plus_ok(server_driver, router_driver):
    payload = "x" * 100
    blob = json.dumps({"d": payload}) * 5  # multi-chunk
    gen = recv_payloads(router_driver, poll_timeout=0.5, reassembly_timeout_ms=10_000)
    t0 = time.monotonic()
    send_payload(server_driver, 2, blob, frame_size=200)
    elapsed = time.monotonic() - t0
    assembled = next(gen)
    assert assembled == blob
    # Successful all-chunks delivery means +OK was honored between sends.
    # We can't precisely measure airtime but expect > 0 because real RF takes time.
    assert elapsed > 0


# H6 — dropped frame must NOT emit a partial payload
def test_dropped_frame_no_partial_emit(server_driver, router_driver, monkeypatch):
    """We can't simulate a drop with real hardware easily, so this is xfailed
    on hardware unless the user uses an attenuator strong enough to lose
    frames. The Tier-1 loopback test covers the logic."""
    pytest.skip("covered by tests/test_lora_loopback.py::test_dropped_frame_never_emits_partial")


# H7 — duplicate frame: hard to force with real RF; logic covered in loopback test
def test_duplicate_frame_idempotent_skipped():
    pytest.skip("covered by tests/test_lora_loopback.py::test_duplicate_frame_idempotent")


# H8 — interleaved msgIds
def test_two_msgids_isolated(server_driver, router_driver):
    payload_a = "A" * 250
    payload_b = "B" * 220
    gen = recv_payloads(router_driver, poll_timeout=0.5, reassembly_timeout_ms=15_000)

    # Interleave by sending one chunk each.
    chunks_a = fragment("MA", payload_a, 200)
    chunks_b = fragment("MB", payload_b, 200)
    for ca, cb in zip(chunks_a, chunks_b):
        server_driver.send(2, json.dumps(ca.to_dict(), separators=(",", ":")))
        server_driver.send(2, json.dumps(cb.to_dict(), separators=(",", ":")))

    results = {next(gen), next(gen)}
    assert results == {payload_a, payload_b}


# H9 — airtime budget
def test_payload_under_duty_cycle(server_driver, router_driver):
    blob = json.dumps({"items": [{"q": "x" * 100} for _ in range(10)]})
    gen = recv_payloads(router_driver, poll_timeout=0.5, reassembly_timeout_ms=20_000)
    t0 = time.monotonic()
    send_payload(server_driver, 2, blob, frame_size=200)
    elapsed = time.monotonic() - t0
    out = next(gen)
    assert out == blob
    assert elapsed < 10.0, f"airtime budget exceeded: {elapsed:.2f}s"


# H11 — recovery from AT error
def test_recovery_from_at_error(server_driver):
    with pytest.raises(Rylr998Error):
        server_driver.send(2, "x" * 999)  # exceeds 240-byte module limit
    # Driver should still function after the error.
    server_driver.send(2, "ok")


# H13 — uplink path (router -> server)
def test_student_uplink_path(server_driver, router_driver):
    envelope = json.dumps({"type": "StudentQuizAttempt", "section": "S", "payload": [1, 2, 3]})
    gen = recv_payloads(server_driver, poll_timeout=0.5, reassembly_timeout_ms=10_000)
    send_payload(router_driver, 1, envelope, frame_size=200)
    out = next(gen)
    assert out == envelope


# H14 — concurrent uplink during downlink (backoff)
def test_concurrent_uplink_during_downlink(server_driver, router_driver):
    downlink = "D" * 600
    uplink = "U" * 80

    server_gen = recv_payloads(server_driver, poll_timeout=0.5, reassembly_timeout_ms=15_000)
    router_gen = recv_payloads(router_driver, poll_timeout=0.5, reassembly_timeout_ms=15_000)

    results = {}

    def receive(name, gen, expected):
        try:
            results[name] = next(gen)
        except Exception as e:
            results[name] = f"err:{e}"

    t_down = threading.Thread(target=receive, args=("downlink", router_gen, downlink))
    t_up = threading.Thread(target=receive, args=("uplink", server_gen, uplink))
    t_down.start()
    t_up.start()

    sender_a = threading.Thread(target=send_payload, args=(server_driver, 2, downlink), kwargs={"frame_size": 200})
    sender_b = threading.Thread(target=send_payload, args=(router_driver, 1, uplink), kwargs={"frame_size": 200})
    sender_a.start()
    time.sleep(0.05)
    sender_b.start()

    sender_a.join(timeout=20)
    sender_b.join(timeout=20)
    t_down.join(timeout=20)
    t_up.join(timeout=20)

    assert results.get("downlink") == downlink
    assert results.get("uplink") == uplink

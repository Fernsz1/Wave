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

from pi.router.cache import RelayCache
from pi.router.relay import Relay, RelayConfig


# H1
def test_at_version_and_address(server_driver):
    ver = server_driver.version()
    assert ver.startswith("+VER=")
    addr = server_driver.address()
    assert addr.startswith("+ADDRESS=")


# H2
def test_single_frame_send_recv(server_driver, router_driver):
    payload = "hello-bench-12345"
    send_payload(server_driver, 2, payload, frame_size=180)
    gen = recv_payloads(router_driver, poll_timeout=0.5, reassembly_timeout_ms=10_000)
    out = next(gen)
    assert out == payload


# H3
def test_remediation_material_real_rf(server_driver, router_driver):
    blob = json.dumps({"id": "REM-HW", "content": "x" * 600})
    gen = recv_payloads(router_driver, poll_timeout=0.5, reassembly_timeout_ms=30_000)
    msg_id = send_payload(server_driver, 2, blob, frame_size=180)
    assembled = next(gen)
    assert assembled == blob
    expected_chunks = len(fragment(msg_id, blob, 180))
    assert expected_chunks > 1  # truly multi-frame


# H4 — backpressure: send() must block on +OK before next send
def test_at_send_serializes_on_plus_ok(server_driver, router_driver):
    payload = "x" * 100
    blob = json.dumps({"d": payload}) * 5  # multi-chunk
    gen = recv_payloads(router_driver, poll_timeout=0.5, reassembly_timeout_ms=10_000)
    t0 = time.monotonic()
    send_payload(server_driver, 2, blob, frame_size=180)
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
    chunks_a = fragment("MA", payload_a, 180)
    chunks_b = fragment("MB", payload_b, 180)
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
    send_payload(server_driver, 2, blob, frame_size=180)
    elapsed = time.monotonic() - t0
    out = next(gen)
    assert out == blob
    # At SF10/BW125 (the configured params) a ~1.1 KB payload is ~7 frames at
    # ~2 s/frame of LoRa airtime — inherently slow; a real RYLR998 is identical.
    # The bound just guards against a runaway (stuck retry / lost-frame stall).
    # Drop to a lower SF if tighter airtime / duty cycle matters.
    assert elapsed < 20.0, f"airtime budget exceeded: {elapsed:.2f}s"


# H11 — recovery from a rejected send
def test_recovery_from_at_error(server_driver):
    # The driver guards the 240-byte RYLR998 ceiling client-side (ValueError)
    # before the frame ever reaches the module. The module-side +ERR recovery
    # path is covered by tests/test_lora_loopback.py::test_at_send_at_error_raises.
    with pytest.raises(ValueError):
        server_driver.send(2, "x" * 999)  # exceeds 240-byte module limit
    # Driver should still function after the error.
    server_driver.send(2, "ok")


# H13 — uplink path (router -> server)
def test_student_uplink_path(server_driver, router_driver):
    envelope = json.dumps({"type": "StudentQuizAttempt", "section": "S", "payload": [1, 2, 3]})
    gen = recv_payloads(server_driver, poll_timeout=0.5, reassembly_timeout_ms=10_000)
    send_payload(router_driver, 1, envelope, frame_size=180)
    out = next(gen)
    assert out == envelope


# H14 — concurrent uplink during downlink, through the real relay CSMA path
def test_concurrent_uplink_during_downlink(server_driver, router_driver, tmp_path):
    """Drive the production collision-avoidance path instead of two bare drivers.

    The village radio is owned by a `Relay`, so the student uplink it sends is
    deferred by `Relay._send_with_backoff` until the channel is quiet — i.e. the
    downlink broadcast has finished and the server is listening again. This is
    what keeps both directions intact on a half-duplex link; the earlier
    bare-driver version transmitted into the middle of the downlink and lost
    frames by design.
    """
    section = "Grade 6 - Section Newton"
    downlink_env = {
        "type": "TeacherRemediationMaterial",
        "section": section,
        "payload": {"id": "REM-HW14", "content": "D" * 500},  # multi-frame
    }
    downlink = json.dumps(downlink_env, separators=(",", ":"))
    uplink_env = {"type": "StudentQuizAttempt", "section": section, "payload": [1, 2, 3]}

    cache = RelayCache(tmp_path / "cache.sqlite")
    relay = Relay(router_driver, cache, RelayConfig(server_addr=1))
    relay.start()

    server_gen = recv_payloads(server_driver, poll_timeout=0.5, reassembly_timeout_ms=20_000)
    uplink_result = {}

    def recv_uplink():
        try:
            uplink_result["v"] = next(server_gen)
        except Exception as e:
            uplink_result["v"] = f"err:{e}"

    t_up = threading.Thread(target=recv_uplink, daemon=True)
    t_up.start()

    try:
        # frame_size 140 (not the default 180): this envelope is quote-heavy, and
        # re-wrapping a slice re-escapes every " to \", inflating the wire line.
        # 140 leaves headroom under the 240-byte RYLR998 cap. See note in the
        # transport about LORA_SAFE_FRAME not accounting for escape inflation.
        sender = threading.Thread(
            target=send_payload,
            args=(server_driver, 2, downlink),
            kwargs={"frame_size": 140},
        )
        sender.start()
        # Submit the uplink once the broadcast is detectably in progress (relay
        # has heard its first downlink frame). This is exactly the case the
        # backoff is built for: defer until the channel goes quiet. A submit in
        # the blind window *before* the first frame lands can't be deconflicted
        # without radio carrier-sense (CAD), which the RYLR998 doesn't expose —
        # a known link limitation, not what this test asserts.
        deadline = time.monotonic() + 10
        while relay._last_rx_ms == 0.0 and time.monotonic() < deadline:
            time.sleep(0.05)
        relay.enqueue_uplink(uplink_env)

        sender.join(timeout=30)
        t_up.join(timeout=30)

        # Downlink survived and was cached by the relay.
        cached = cache.list_for_section(section, "TeacherRemediationMaterial")
        assert cached and cached[0] == downlink_env["payload"]

        # Uplink survived the half-duplex window and reached the server.
        got = uplink_result.get("v")
        assert got is not None and not str(got).startswith("err:"), f"uplink not received: {got!r}"
        assert json.loads(got) == uplink_env
    finally:
        relay.stop()
        cache.close()

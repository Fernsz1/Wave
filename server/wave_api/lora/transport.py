"""
LoRa transport: bridges the codec/chunk layer to the Rylr998Driver.

`send_payload(addr, serialized)` fragments the payload via `chunk.fragment()`,
serializes each chunk as JSON, and pushes through the driver with one
`AT+SEND` per chunk. The driver itself blocks on `+OK` between sends so the
module's outgoing FIFO never overflows (H4 guarantee).

`recv_payloads()` is a generator that yields fully reassembled payloads as the
peer transmits them. Stale buffers are GC'd every iteration so a lost frame
does not leak memory (H6 guarantee).
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Iterator, Optional

from .chunk import DEFAULT_FRAME, Chunk, Reassembler, fragment

# RYLR998 AT+SEND caps the payload at 240 bytes. The chunk wrapper
# `{"msgId":"xxxxxxxx","index":NNN,"total":NNN,"data":"..."}` adds ~55 bytes.
# 180 bytes of data keeps the worst-case wire line at ~235 chars.
LORA_SAFE_FRAME = 180
from .rylr998 import ReceivedFrame, Rylr998Driver

log = logging.getLogger(__name__)


def _new_msg_id() -> str:
    # 8-char hex keeps the framing overhead small for LoRa.
    return uuid.uuid4().hex[:8]


def send_payload(
    driver: Rylr998Driver,
    addr: int,
    serialized: str,
    *,
    msg_id: Optional[str] = None,
    frame_size: int = LORA_SAFE_FRAME,
) -> str:
    """Fragment `serialized` and ship every chunk to `addr`. Returns msgId."""
    mid = msg_id or _new_msg_id()
    chunks = fragment(mid, serialized, frame_size)
    log.info("lora.send msgId=%s chunks=%d bytes=%d", mid, len(chunks), len(serialized))
    for chunk in chunks:
        wire = json.dumps(chunk.to_dict(), separators=(",", ":"))
        driver.send(addr, wire)
    return mid


def recv_payloads(
    driver: Rylr998Driver,
    *,
    poll_timeout: float = 1.0,
    reassembly_timeout_ms: int = 30_000,
) -> Iterator[str]:
    """Yield reassembled payloads as the peer transmits them.

    Caller controls the loop; this is a generator so tests can `next()` one
    payload at a time. Stale buffers are evicted every poll.
    """
    reasm = Reassembler(timeout_ms=reassembly_timeout_ms)
    while True:
        try:
            frame: ReceivedFrame = driver.recv(timeout=poll_timeout)
        except Exception:
            stale = reasm.gc()
            for mid in stale:
                log.warning("lora.reassembly.timeout msgId=%s", mid)
            continue
        try:
            d = json.loads(frame.data)
            chunk = Chunk(msgId=d["msgId"], index=d["index"], total=d["total"], data=d["data"])
        except (ValueError, KeyError) as e:
            log.warning("lora.bad_frame data=%r err=%s", frame.data, e)
            continue
        result = reasm.add(chunk)
        if result is not None:
            yield result
        stale = reasm.gc()
        for mid in stale:
            log.warning("lora.reassembly.timeout msgId=%s", mid)

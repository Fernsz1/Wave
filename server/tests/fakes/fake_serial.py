"""
In-memory serial fake for Rylr998Driver tests.

Two paired `FakeSerial` instances share a `LoopbackChannel`: bytes written to
one come out on the other side, simulating two RYLR998 modules linked over
LoRa. The channel optionally drops/duplicates/reorders frames so we can
exercise H5/H6/H7 without real RF.

It also recognises `AT+SEND=<addr>,<len>,<data>` and `AT+...` commands and
auto-emits `+OK` (or the response a queue dictates) so the driver's ack queue
gets fed; and translates `AT+SEND` into a `+RCV=...` line on the peer.
"""
from __future__ import annotations

import random
import re
import threading
from collections import deque
from dataclasses import dataclass, field
from typing import Callable, Deque, List, Optional

_AT_SEND_RE = re.compile(r"^AT\+SEND=(\d+),(\d+),(.*)$")


@dataclass
class LoopbackChannel:
    """A bidirectional, half-duplex channel between two FakeSerial endpoints."""
    drop_indices: List[int] = field(default_factory=list)
    duplicate_indices: List[int] = field(default_factory=list)
    reorder: Optional[Callable[[List[str]], List[str]]] = None
    rssi: int = -45
    snr: int = 10

    def __post_init__(self) -> None:
        self._counter = 0
        self._lock = threading.Lock()

    def next_index(self) -> int:
        with self._lock:
            i = self._counter
            self._counter += 1
            return i


class FakeSerial:
    """Implements the SerialLike subset used by Rylr998Driver."""

    def __init__(self, *, address: int, peer: Optional["FakeSerial"] = None,
                 channel: Optional[LoopbackChannel] = None):
        self.address = address
        self._peer: Optional[FakeSerial] = peer
        self._channel = channel or (peer._channel if peer else LoopbackChannel())
        if peer is not None and peer._peer is None:
            peer._peer = self
            peer._channel = self._channel
        self._rx: Deque[bytes] = deque()
        self._rx_cv = threading.Condition()
        self._closed = False
        # If a test wants to script ack responses (e.g. +ERR=10) it can prepend.
        self.scripted_acks: Deque[str] = deque()

    # ---- SerialLike ------------------------------------------------------

    def write(self, data: bytes) -> int:
        if self._closed:
            raise OSError("closed")
        line = data.decode("ascii", errors="replace").strip()
        if not line:
            return len(data)

        m = _AT_SEND_RE.match(line)
        if m:
            target_addr = int(m.group(1))
            payload = m.group(3)
            self._deliver_to_peer(target_addr, payload)
            self._enqueue_self(self._next_ack())
            return len(data)

        if line.startswith("AT+VER"):
            self._enqueue_self("+VER=RYLR998_FAKE_v1.0")
            self._enqueue_self(self._next_ack())
            return len(data)
        if line.startswith("AT+ADDRESS?"):
            self._enqueue_self(f"+ADDRESS={self.address}")
            self._enqueue_self(self._next_ack())
            return len(data)
        if line.startswith("AT+"):
            self._enqueue_self(self._next_ack())
            return len(data)
        return len(data)

    def readline(self) -> bytes:
        with self._rx_cv:
            while not self._rx and not self._closed:
                self._rx_cv.wait(timeout=0.1)
            if self._rx:
                return self._rx.popleft()
            return b""

    def close(self) -> None:
        self._closed = True
        with self._rx_cv:
            self._rx_cv.notify_all()

    # ---- helpers ---------------------------------------------------------

    def _next_ack(self) -> str:
        if self.scripted_acks:
            return self.scripted_acks.popleft()
        return "+OK"

    def _enqueue_self(self, line: str) -> None:
        with self._rx_cv:
            self._rx.append((line + "\r\n").encode("ascii"))
            self._rx_cv.notify_all()

    def _deliver_to_peer(self, target_addr: int, payload: str) -> None:
        if self._peer is None or self._peer.address != target_addr:
            return
        idx = self._channel.next_index()
        if idx in self._channel.drop_indices:
            return
        line = (
            f"+RCV={self.address},{len(payload)},{payload},"
            f"{self._channel.rssi},{self._channel.snr}"
        )
        self._peer._enqueue_self(line)
        if idx in self._channel.duplicate_indices:
            self._peer._enqueue_self(line)


def linked_pair(addr_a: int = 1, addr_b: int = 2,
                channel: Optional[LoopbackChannel] = None) -> tuple[FakeSerial, FakeSerial]:
    """Convenience: returns a paired (server-side, router-side) FakeSerial."""
    ch = channel or LoopbackChannel()
    a = FakeSerial(address=addr_a, channel=ch)
    b = FakeSerial(address=addr_b, peer=a, channel=ch)
    return a, b

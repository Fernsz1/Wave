"""
RYLR998 (REYAX) 915 MHz LoRa module AT-command driver.

Connects over UART (USB-UART on the server box, /dev/ttyAMA0 on the Pi).
Speaks the REYAX AT command set:

  AT+ADDRESS=<n>           set my address (0-65535)
  AT+NETWORKID=<n>         set network id (0-18, must match peer)
  AT+PARAMETER=SF,BW,CR,PP set SF / BW / CR / preamble
  AT+SEND=<addr>,<len>,<data>   send <data> (max 240 bytes) to <addr>
  +OK / +ERR=<code>        response to AT+SEND
  +RCV=<addr>,<len>,<data>,<rssi>,<snr>  asynchronous receive frame

This driver is *transport-agnostic to the framing layer above it*: it sends and
receives opaque ASCII payloads. Fragmentation lives in `transport.py`.

A `FakeSerial` shim (server/tests/fakes/fake_serial.py) implements the same
interface as `serial.Serial` so unit tests can drive the driver without real
hardware.
"""
from __future__ import annotations

import logging
import re
import threading
import time
from dataclasses import dataclass
from queue import Empty, Queue
from typing import Optional, Protocol

log = logging.getLogger(__name__)


class SerialLike(Protocol):
    """Subset of pyserial.Serial we depend on; lets us inject a fake."""

    def write(self, data: bytes) -> int: ...
    def readline(self) -> bytes: ...
    def close(self) -> None: ...


@dataclass
class ReceivedFrame:
    addr: int
    length: int
    data: str
    rssi: int
    snr: int


_RCV_RE = re.compile(r"^\+RCV=(\d+),(\d+),(.*),(-?\d+),(-?\d+)$")
_OK_RE = re.compile(r"^\+OK$")
_ERR_RE = re.compile(r"^\+ERR=(\d+)$")


class Rylr998Error(Exception):
    pass


class Rylr998Driver:
    """Single-threaded AT driver with a background reader.

    Concurrency model:
    - One reader thread pulls lines off the serial port and routes them:
        +RCV=...      -> rx_queue (consumed by transport.py)
        +OK / +ERR    -> ack_queue (paired with the outstanding AT+SEND)
        anything else -> info_queue (for AT+VER?, AT+ADDRESS?, etc.)
    - `send()` serializes AT+SEND calls under a mutex and blocks on +OK before
      releasing — this is the backpressure guarantee that H4 asserts.
    """

    def __init__(self, ser: SerialLike, *, ack_timeout: float = 3.0):
        self._ser = ser
        self._ack_timeout = ack_timeout
        self._tx_lock = threading.Lock()
        self._ack_queue: Queue[str] = Queue()
        self._rx_queue: Queue[ReceivedFrame] = Queue()
        self._info_queue: Queue[str] = Queue()
        self._stop = threading.Event()
        self._reader = threading.Thread(target=self._read_loop, name="rylr-reader", daemon=True)
        self._reader.start()

    def close(self) -> None:
        self._stop.set()
        try:
            self._ser.close()
        except Exception:
            pass

    # ---- configuration ----------------------------------------------------

    def configure(self, *, address: int, network_id: int, parameter: str = "10,7,1,7") -> None:
        self._at(f"AT+ADDRESS={address}")
        self._at(f"AT+NETWORKID={network_id}")
        self._at(f"AT+PARAMETER={parameter}")

    def version(self) -> str:
        self._write_line("AT+VER?")
        return self._info_queue.get(timeout=self._ack_timeout)

    def address(self) -> str:
        self._write_line("AT+ADDRESS?")
        return self._info_queue.get(timeout=self._ack_timeout)

    # ---- send / receive ---------------------------------------------------

    def send(self, addr: int, data: str) -> None:
        """Send `data` to `addr`. Blocks until the module returns +OK."""
        payload = data.encode("utf-8")
        if len(payload) > 240:
            raise ValueError(f"RYLR998 max payload is 240 bytes, got {len(payload)}")
        cmd = f"AT+SEND={addr},{len(payload)},{data}"
        with self._tx_lock:
            while not self._ack_queue.empty():
                self._ack_queue.get_nowait()
            self._write_line(cmd)
            try:
                ack = self._ack_queue.get(timeout=self._ack_timeout)
            except Empty:
                raise Rylr998Error(f"no +OK within {self._ack_timeout}s for: {cmd}")
        if not _OK_RE.match(ack):
            m = _ERR_RE.match(ack)
            if m:
                raise Rylr998Error(f"module returned +ERR={m.group(1)} for: {cmd}")
            raise Rylr998Error(f"unexpected ack {ack!r} for: {cmd}")

    def recv(self, timeout: Optional[float] = None) -> ReceivedFrame:
        return self._rx_queue.get(timeout=timeout)

    # ---- internals --------------------------------------------------------

    def _at(self, cmd: str) -> None:
        with self._tx_lock:
            while not self._ack_queue.empty():
                self._ack_queue.get_nowait()
            self._write_line(cmd)
            try:
                ack = self._ack_queue.get(timeout=self._ack_timeout)
            except Empty:
                raise Rylr998Error(f"no +OK within {self._ack_timeout}s for: {cmd}")
        if not _OK_RE.match(ack):
            m = _ERR_RE.match(ack)
            if m:
                raise Rylr998Error(f"module returned +ERR={m.group(1)} for: {cmd}")
            raise Rylr998Error(f"unexpected ack {ack!r} for: {cmd}")

    def _write_line(self, line: str) -> None:
        self._ser.write((line + "\r\n").encode("ascii"))

    def _read_loop(self) -> None:
        while not self._stop.is_set():
            try:
                raw = self._ser.readline()
            except Exception:
                if self._stop.is_set():
                    return
                time.sleep(0.05)
                continue
            if not raw:
                continue
            line = raw.decode("ascii", errors="replace").strip()
            if not line:
                continue
            if _OK_RE.match(line) or _ERR_RE.match(line):
                self._ack_queue.put(line)
                continue
            m = _RCV_RE.match(line)
            if m:
                addr, length, data, rssi, snr = m.groups()
                self._rx_queue.put(
                    ReceivedFrame(
                        addr=int(addr),
                        length=int(length),
                        data=data,
                        rssi=int(rssi),
                        snr=int(snr),
                    )
                )
                continue
            # Responses to AT+VER?, AT+ADDRESS?, etc.
            self._info_queue.put(line)

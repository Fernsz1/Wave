"""
Server-side Python port of `wave/src/sync/chunk.ts`.

Byte-for-byte identical fragmentation semantics so a chunk emitted on either
side reassembles cleanly on the other. The Python Reassembler additionally
supports per-msgId timeouts (the runtime gap flagged by D3 / H6).
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Dict, List, Optional

DEFAULT_FRAME = 200  # bytes-ish; matches chunk.ts
# Soft cap that keeps `total` in a single byte if a future protocol revision
# wants to pack it. RYLR998 max payload is 240 bytes; with frame=200 we hit
# ~51 KB before clipping, which is well past any realistic remediation size.
MAX_TOTAL = 255


@dataclass
class Chunk:
    msgId: str
    index: int
    total: int
    data: str

    def to_dict(self) -> dict:
        return {"msgId": self.msgId, "index": self.index, "total": self.total, "data": self.data}


def fragment(msg_id: str, serialized: str, frame_size: int = DEFAULT_FRAME) -> List[Chunk]:
    if frame_size <= 0:
        raise ValueError("frame_size must be positive")
    if len(serialized) <= frame_size:
        return [Chunk(msgId=msg_id, index=0, total=1, data=serialized)]
    parts = [serialized[i : i + frame_size] for i in range(0, len(serialized), frame_size)]
    if len(parts) > MAX_TOTAL:
        raise ValueError(
            f"payload requires {len(parts)} chunks but MAX_TOTAL={MAX_TOTAL}; "
            f"shrink payload or raise frame_size"
        )
    total = len(parts)
    return [Chunk(msgId=msg_id, index=i, total=total, data=p) for i, p in enumerate(parts)]


class ReassemblyTimeout(Exception):
    """Raised when a msgId buffer exceeds its TTL without completing."""


class Reassembler:
    """Per-msgId buffered reassembly with optional TTL.

    Mirrors the TS implementation:
    - Dedupes by (msgId, index) — same index overwrites silently.
    - Tolerates out-of-order arrival.
    - Returns the joined string on completion; None until complete.

    Additionally:
    - `timeout_ms` lets the caller expire stale buffers via `gc()` so a single
      lost chunk does not leak memory forever.
    """

    def __init__(self, timeout_ms: Optional[int] = None):
        self._buffers: Dict[str, Dict[int, str]] = {}
        self._first_seen: Dict[str, float] = {}
        self._timeout_ms = timeout_ms

    def add(self, chunk: Chunk) -> Optional[str]:
        buf = self._buffers.setdefault(chunk.msgId, {})
        self._first_seen.setdefault(chunk.msgId, time.monotonic())
        buf[chunk.index] = chunk.data
        if len(buf) < chunk.total:
            return None
        try:
            out = "".join(buf[i] for i in range(chunk.total))
        except KeyError:
            return None
        del self._buffers[chunk.msgId]
        del self._first_seen[chunk.msgId]
        return out

    def pending_msg_ids(self) -> List[str]:
        return list(self._buffers.keys())

    def gc(self) -> List[str]:
        """Evict buffers older than timeout_ms. Returns the evicted msgIds."""
        if self._timeout_ms is None:
            return []
        cutoff = time.monotonic() - (self._timeout_ms / 1000.0)
        stale = [mid for mid, t in self._first_seen.items() if t < cutoff]
        for mid in stale:
            self._buffers.pop(mid, None)
            self._first_seen.pop(mid, None)
        return stale

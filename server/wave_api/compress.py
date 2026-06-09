"""
DEFLATE payload compression for the LoRa-bound wire (Python side).

Mirror of Wave/src/sync/compress.ts. Both speak the self-describing zlib DEFLATE
format, so either side inflates the other's output regardless of the exact bytes
each library emits. Used by the envelope layer to compress the tokenized payload.
"""
from __future__ import annotations

import base64
import zlib


def deflate_to_b64(s: str) -> str:
    """UTF-8 string -> DEFLATE -> base64 ASCII."""
    return base64.b64encode(zlib.compress(s.encode("utf-8"))).decode("ascii")


def inflate_from_b64(b64: str) -> str:
    """base64 -> DEFLATE-inflate -> UTF-8 string."""
    return zlib.decompress(base64.b64decode(b64)).decode("utf-8")


def deflate_to_bytes(s: str) -> bytes:
    """Raw DEFLATE bytes — what the LoRa radio carries directly (no base64)."""
    return zlib.compress(s.encode("utf-8"))


def inflate_from_bytes(data: bytes) -> str:
    return zlib.decompress(data).decode("utf-8")

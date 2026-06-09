"""DEFLATE compression: round-trip, size win, and cross-language interop."""
import json
from pathlib import Path

from wave_api.compress import deflate_to_b64, inflate_from_b64

_FIXTURE = Path(__file__).resolve().parents[2] / "protocol" / "fixtures" / "compress.json"


def test_roundtrip_identity():
    s = json.dumps({"msg": "opposing muscles", "items": [f"q-{i}" for i in range(50)]})
    assert inflate_from_b64(deflate_to_b64(s)) == s


def test_large_payload_shrinks():
    s = "Skeletal muscles work in opposing pairs. " * 40
    assert len(deflate_to_b64(s)) < len(s)


def test_cross_language_interop():
    """Python inflates the committed base64 (byte-identical from pako/TS) back to raw."""
    fx = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    assert inflate_from_b64(fx["b64"]) == fx["raw"]
    # And Python's own output matches the committed cross-language base64.
    assert deflate_to_b64(fx["raw"]) == fx["b64"]

"""Codec round-trips against the shared golden fixtures (cross-language contract)."""
import json
from pathlib import Path

from wave_api import codec

GOLDEN = json.load(
    (Path(__file__).resolve().parents[2] / "protocol" / "fixtures" / "golden.json").open(encoding="utf-8")
)["cases"]


def test_encode_matches_golden():
    for case in GOLDEN:
        assert codec.encode(case["type"], case["object"]) == case["tokenArray"], case["name"]


def test_decode_matches_golden():
    for case in GOLDEN:
        assert codec.decode(case["type"], case["tokenArray"]) == case["object"], case["name"]


def test_envelope_roundtrip():
    env = {
        "version": codec.PROTOCOL_VERSION,
        "msgId": "abc",
        "type": "StudentProgress",
        "direction": "up",
        "subject": "science",
        "section": "Grade 4 - Section Newton",
        "createdAt": "2026-06-07T00:00:00Z",
        "chunkIndex": 0,
        "chunkTotal": 1,
        "payload": [1, 2, 3],
    }
    assert codec.decode_envelope(codec.encode_envelope(env)) == env

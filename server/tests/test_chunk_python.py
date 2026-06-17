"""Unit tests for the Python chunk/Reassembler port (mirrors wave/src/sync/chunk.ts)."""
import json
import random
import time
from pathlib import Path

import pytest

from wave_api.lora.chunk import (
    DEFAULT_FRAME,
    Chunk,
    Reassembler,
    fragment,
)

GOLDEN = json.loads(
    (Path(__file__).resolve().parents[2] / "protocol" / "fixtures" / "chunk_golden.json").read_text(
        encoding="utf-8"
    )
)["cases"]


def test_fragment_matches_golden():
    for case in GOLDEN:
        chunks = fragment(case["msgId"], case["serialized"], case["frameSize"])
        assert [c.to_dict() for c in chunks] == case["chunks"], case["name"]


def test_empty_payload_emits_one_chunk():
    chunks = fragment("m", "", 200)
    assert len(chunks) == 1
    assert chunks[0].total == 1 and chunks[0].index == 0 and chunks[0].data == ""


def test_exact_frame_boundary():
    chunks = fragment("m", "a" * 200, 200)
    assert len(chunks) == 1
    assert chunks[0].total == 1


def test_boundary_plus_one_splits():
    chunks = fragment("m", "a" * 201, 200)
    assert len(chunks) == 2
    assert chunks[-1].total == 2
    assert "".join(c.data for c in chunks) == "a" * 201


def test_multi_frame_total_count_consistent():
    payload = "x" * (DEFAULT_FRAME * 5 + 17)
    chunks = fragment("m", payload, DEFAULT_FRAME)
    assert chunks[0].total == chunks[-1].total == 6
    assert "".join(c.data for c in chunks) == payload


def test_total_overflow_raises():
    with pytest.raises(ValueError, match="MAX_TOTAL"):
        fragment("m", "x" * 600, 2)  # 300 chunks > MAX_TOTAL=255


def test_reassembler_in_order():
    chunks = fragment("m1", "hello world payload data more data", 8)
    r = Reassembler()
    out = None
    for c in chunks:
        out = r.add(c)
    assert out == "hello world payload data more data"


def test_reassembler_out_of_order():
    serialized = "abcdef" * 50
    chunks = fragment("m2", serialized, 20)
    shuffled = list(chunks)
    random.Random(42).shuffle(shuffled)
    r = Reassembler()
    out = None
    for c in shuffled:
        result = r.add(c)
        if result is not None:
            out = result
    assert out == serialized


def test_reassembler_dedupes_duplicates():
    chunks = fragment("m3", "abcdefghij", 3)  # 4 chunks
    r = Reassembler()
    delivered = chunks + chunks  # every chunk twice
    out = None
    for c in delivered:
        result = r.add(c)
        if result is not None:
            out = result
    assert out == "abcdefghij"


def test_reassembler_isolates_msg_ids():
    a = fragment("A", "AAAAAAAA", 3)
    b = fragment("B", "BBBBB", 2)
    interleaved = [a[0], b[0], a[1], b[1], a[2], b[2]]
    r = Reassembler()
    results = []
    for c in interleaved:
        out = r.add(c)
        if out is not None:
            results.append(out)
    assert sorted(results) == sorted(["AAAAAAAA", "BBBBB"])


def test_reassembler_does_not_emit_partial():
    chunks = fragment("M", "abcdefgh", 2)
    r = Reassembler()
    for c in chunks[:-1]:
        assert r.add(c) is None
    assert "M" in r.pending_msg_ids()


def test_reassembler_gc_evicts_stale_buffers():
    r = Reassembler(timeout_ms=50)
    chunks = fragment("X", "abcdefgh", 2)
    r.add(chunks[0])
    assert r.pending_msg_ids() == ["X"]
    time.sleep(0.08)
    evicted = r.gc()
    assert evicted == ["X"]
    assert r.pending_msg_ids() == []

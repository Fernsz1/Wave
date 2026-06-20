"""
LoRa-readiness: prove the largest realistic payload (a full Grade 7 science
LessonCatalog) survives the wire path end-to-end —
    encode -> envelope -> JSON -> fragment -> (shuffled) reassemble -> decode.

This is the cross-language guarantee that big content reassembles correctly over
LoRa frames; the TS suite asserts the same on src/sync/loraCatalog.test.ts.
"""
import json
import random
from pathlib import Path

from wave_api import codec
from wave_api.lora.chunk import Reassembler, fragment
from wave_api.lora.transport import LORA_SAFE_FRAME

CATALOG = json.load(
    (Path(__file__).resolve().parents[1] / "wave_api" / "seed" / "catalog.json").open(encoding="utf-8")
)


def _envelope(payload):
    return {
        "version": codec.PROTOCOL_VERSION,
        "msgId": "cat-0001",
        "type": "LessonCatalog",
        "direction": "down",
        "subject": "science",
        "section": None,
        "createdAt": "2026-06-20T00:00:00Z",
        "chunkIndex": 0,
        "chunkTotal": 1,
        "payload": payload,
    }


def test_grade7_catalog_survives_lora_framing():
    lessons = CATALOG["science"]
    payload = codec.encode("LessonCatalog", {"subject": "science", "lessons": lessons})
    serialized = json.dumps(codec.encode_envelope(_envelope(payload)), separators=(",", ":"))

    chunks = fragment("cat-0001", serialized, LORA_SAFE_FRAME)
    assert len(chunks) > 1, "catalog should span many LoRa frames"

    # Out-of-order + a duplicate frame must still reassemble correctly.
    shuffled = chunks[:] + [chunks[0]]
    random.Random(7).shuffle(shuffled)
    reasm = Reassembler()
    result = None
    for c in shuffled:
        out = reasm.add(c)
        if out is not None:
            result = out
    assert result == serialized

    env = codec.decode_envelope(json.loads(result))
    decoded = codec.decode("LessonCatalog", env["payload"])
    # Reassembled+decoded catalog must equal the directly-decoded one.
    assert decoded == codec.decode("LessonCatalog", payload)
    assert decoded["lessons"][0]["topics"][0]["content"]["keyTakeaway"]
    assert len(decoded["lessons"]) == 4

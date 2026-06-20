"""
Conformance guards for the wire contract (see protocol/OWNERSHIP.md):

- every manifest message/def is represented field-for-field by a generated
  Pydantic model (complements `npm run codegen:check`);
- decode_envelope rejects an incompatible protocolVersion;
- the section slug is byte-identical to the shared slug fixture (the TS suite
  asserts the same fixture, proving both sides address the same topics).
"""
import json
import re
from pathlib import Path

import pytest

from wave_api import codec
from wave_api.agents import wire_models
from wave_api.mqtt import slug

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = json.load((ROOT / "protocol" / "wire_manifest.json").open(encoding="utf-8"))
SLUGS = json.load((ROOT / "protocol" / "fixtures" / "slug_golden.json").open(encoding="utf-8"))["cases"]

ALL_TYPES = {**MANIFEST["defs"], **MANIFEST["messages"]}


@pytest.mark.parametrize("name", sorted(ALL_TYPES))
def test_pydantic_model_covers_manifest_fields(name):
    model = getattr(wire_models, f"Wire{name}", None)
    assert model is not None, f"missing generated model Wire{name}"
    # The wire name of each pydantic field is its alias if set, else its name.
    wire_names = {
        (f.alias or pyname) for pyname, f in model.model_fields.items()
    }
    manifest_names = {f["name"] for f in ALL_TYPES[name]["fields"]}
    assert wire_names == manifest_names, name


def test_schema_by_type_matches_manifest_message_types():
    # Mirrors the TS SCHEMA_BY_TYPE check: top-level message types only.
    assert set(MANIFEST["messages"]) == set(MANIFEST["enums"]["type"])


def test_decode_envelope_rejects_wrong_protocol_version():
    env = codec.encode_envelope(
        {
            "version": codec.PROTOCOL_VERSION + 1,
            "msgId": "x",
            "type": "StudentProgress",
            "direction": "up",
            "createdAt": "2026-06-07T00:00:00Z",
            "chunkIndex": 0,
            "chunkTotal": 1,
            "payload": [],
        }
    )
    with pytest.raises(ValueError, match="protocolVersion"):
        codec.decode_envelope(env)


@pytest.mark.parametrize("case", SLUGS, ids=lambda c: c["section"])
def test_slug_matches_golden(case):
    assert slug(case["section"]) == case["slug"]


def test_slug_regex_matches_topics_ts():
    # The TS slug uses /[^a-z0-9]+/ collapsing + trim; assert the Python one is
    # equivalent on an adversarial input not in the golden set.
    s = "  Foo / Bar -- Baz!! "
    expected = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    assert slug(s) == expected

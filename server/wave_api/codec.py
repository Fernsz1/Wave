"""
Tokenized-array codec - Python side.

Line-for-line mirror of the TS codec (Wave/src/protocol/codec.py's sibling at
Wave/src/protocol/codec.ts). Both read the SAME protocol/wire_manifest.json so
the app and server encode/decode identical positional arrays over MQTT (and LoRa
later). Field ORDER comes only from the manifest.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# Repo root: server/wave_api/codec.py -> parents[2] == Wave-1/
_MANIFEST_PATH = Path(__file__).resolve().parents[2] / "protocol" / "wire_manifest.json"

with _MANIFEST_PATH.open(encoding="utf-8") as fh:
    _MANIFEST = json.load(fh)

MESSAGES: dict[str, dict] = _MANIFEST["messages"]
DEFS: dict[str, dict] = _MANIFEST["defs"]
ENUMS: dict[str, list[str]] = _MANIFEST["enums"]
ENVELOPE_FIELDS: list[dict] = _MANIFEST["envelope"]["fields"]
PROTOCOL_VERSION: int = _MANIFEST["protocolVersion"]

_SCALARS = {"str", "int", "bool"}

Token = Any  # str | int | bool | None | list


def _resolve_def(name: str) -> dict:
    d = MESSAGES.get(name) or DEFS.get(name)
    if d is None:
        raise ValueError(f'codec: unknown type "{name}"')
    return d


def _encode_value(t: str, value: Any) -> Token:
    if value is None:
        return None

    if t in _SCALARS:
        return value

    if t == "array":  # raw passthrough (envelope payload)
        return value

    if t.startswith("enum:"):
        dict_ = ENUMS[t[5:]]
        try:
            return dict_.index(value)
        except ValueError:
            raise ValueError(f'codec: value "{value}" not in enum {t}')

    if t.startswith("array:"):
        elem = t[6:]
        return [_encode_value(elem, v) for v in value]

    if t.startswith("map:"):
        elem = t[4:]
        return [[k, _encode_value(elem, v)] for k, v in value.items()]

    # ref to a message/def
    return _encode_fields(_resolve_def(t)["fields"], value)


def _decode_value(t: str, token: Token) -> Any:
    if token is None:
        return None

    if t in _SCALARS:
        return token

    if t == "array":
        return token

    if t.startswith("enum:"):
        return ENUMS[t[5:]][token]

    if t.startswith("array:"):
        elem = t[6:]
        return [_decode_value(elem, v) for v in token]

    if t.startswith("map:"):
        elem = t[4:]
        return {k: _decode_value(elem, v) for k, v in token}

    return _decode_fields(_resolve_def(t)["fields"], token)


def _encode_fields(fields: list[dict], obj: dict) -> list[Token]:
    obj = obj or {}
    return [_encode_value(f["t"], obj.get(f["name"])) for f in fields]


def _decode_fields(fields: list[dict], arr: list[Token]) -> dict:
    out: dict[str, Any] = {}
    for i, f in enumerate(fields):
        decoded = _decode_value(f["t"], arr[i] if i < len(arr) else None)
        if decoded is not None:
            out[f["name"]] = decoded
    return out


def encode(type_name: str, obj: dict) -> list[Token]:
    """Encode a named message/def into its positional token array."""
    return _encode_fields(_resolve_def(type_name)["fields"], obj)


def decode(type_name: str, arr: list[Token]) -> dict:
    """Decode a positional token array back into an object for a named type."""
    return _decode_fields(_resolve_def(type_name)["fields"], arr)


def type_tag(type_name: str) -> int:
    tag = MESSAGES.get(type_name, {}).get("tag")
    if tag is None:
        raise ValueError(f'codec: "{type_name}" has no tag (not a top-level message)')
    return tag


def encode_envelope(env: dict) -> list[Token]:
    return _encode_fields(ENVELOPE_FIELDS, env)


def decode_envelope(arr: list[Token]) -> dict:
    return _decode_fields(ENVELOPE_FIELDS, arr)

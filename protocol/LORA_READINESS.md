# LoRa readiness

How a Wave message travels once the radio is the transport, and how to test it.

## The path

```
object ──codec.encode──▶ token array ──encode_envelope──▶ envelope array
      ──JSON.stringify──▶ string ──fragment(frame)──▶ Chunk[] ──radio frames──▶
      ──Reassembler.add──▶ string ──JSON.parse──▶ envelope ──decode_envelope──▶
      ──codec.decode(type)──▶ object
```

- **Codec** ([codec.ts](../Wave/src/protocol/codec.ts) / [codec.py](../server/wave_api/codec.py)) turns objects into compact positional arrays from [wire_manifest.json](wire_manifest.json). Identical on both sides.
- **Chunking** ([chunk.ts](../Wave/src/sync/chunk.ts) / [lora/chunk.py](../server/wave_api/lora/chunk.py)) splits the serialized envelope into frame-sized `Chunk`s and reassembles them. Reassembly dedupes by index and tolerates out-of-order arrival.
- **Driver/transport** ([lora/transport.py](../server/wave_api/lora/transport.py) over [rylr998.py](../server/wave_api/lora/rylr998.py)) already fragments on send (`send_payload`) and reassembles on receive (`recv_payloads`), one `AT+SEND` per chunk, blocking on `+OK` for backpressure.

## Frame budget

The RYLR998 `AT+SEND` payload caps at 240 bytes. The chunk wrapper
`{"msgId":..,"index":..,"total":..,"data":..}` adds ~55 bytes, so the data slice
is capped at `LORA_SAFE_FRAME = 180` (see [transport.py](../server/wave_api/lora/transport.py)).
`MAX_TOTAL = 255` keeps `total` in one byte (~45 KB ceiling) — well past any
catalog or remediation pack. A full Grade 7 science `LessonCatalog` spans many
frames and is covered by the round-trip tests below.

## What is proven by tests (no hardware needed)

| Guarantee | Test |
|---|---|
| Codec is byte-identical across TS/Python | `golden.json` via codec.test.ts + test_codec.py |
| Chunk fragmentation is identical across TS/Python | `chunk_golden.json` via sync.test.ts + test_chunk_python.py |
| A full Grade 7 catalog survives fragment→shuffle→reassemble→decode | test_lora_catalog_roundtrip.py + loraCatalog.test.ts |
| Driver handles backpressure, dropped + duplicate frames | test_lora_loopback.py (fake serial) |
| protocolVersion mismatch is rejected; section slugs match | test_conformance.py + conformance.test.ts |

Run them:

```bash
cd server && python -m pytest          # includes the LoRa loopback + catalog tests
cd Wave   && npm test                  # includes the chunk + catalog tests
```

## Real-payload bench (send/receive actual Wave envelopes)

The hardware suite ships placeholder blobs; to watch a *real* progress report go
up or a *real* remediation pack come down — encoded, fragmented, reassembled,
decoded, and schema-validated — use [server/tools/lora_payload.py](../server/tools/lora_payload.py)
with two boards (town = addr 1, village = addr 2, NetworkID 18):

```bash
# Student side listens for remediation (terminal 1):
python server/tools/lora_payload.py recv --port COM4 --address 2

# Teacher/server sends remediation down to the student (terminal 2):
python server/tools/lora_payload.py send-remediation --port COM3 --address 1 --dest 2 \
    --section "Grade 7 - Section Einstein" --subject science

# Reverse — student sends a progress report up (run recv on the server port first):
python server/tools/lora_payload.py recv --port COM3 --address 1            # terminal 1
python server/tools/lora_payload.py send-progress --port COM4 --address 2 --dest 1 \
    --lrn 101234567891 --section "Grade 7 - Section Einstein"               # terminal 2
```

The receiver prints the decoded payload and a schema-validation result, so a
malformed or version-mismatched frame is obvious. This is the same
encode→fragment→reassemble→decode path the app uses — only the transport differs.

## Hardware bench (real RYLR998 modules)

Gated behind `WAVE_HW_BENCH=1`. Pair two modules on the same NetworkID, then:

```bash
WAVE_HW_BENCH=1 \
WAVE_HW_SERVER_PORT=/dev/ttyUSB0 \
WAVE_HW_ROUTER_PORT=/dev/ttyAMA0 \
python -m pytest server/tests/hw/test_lora_link.py
```

These validate real RF delivery, multi-frame reassembly, and collision handling.
The logic they exercise is the same `fragment`/`Reassembler` proven offline above,
so a green offline suite plus this bench run is the LoRa go/no-go.

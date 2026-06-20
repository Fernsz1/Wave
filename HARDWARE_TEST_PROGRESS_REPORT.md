# Wave — Hardware Test: Student Progress Report over LoRa (2× Heltec V3)

**Goal:** prove a real **student → teacher** progress-report transfer across two Heltec WiFi
LoRa 32 V3 boards, and **see exactly what the receiver got in the Arduino IDE Serial Monitor.**

This walks the payload through every stage it actually passes through in the Wave stack — the
human-readable object, its **tokenized** form, the **chunks** it splits into, the on-air `AT+SEND`
lines, and the `+RCV` line the receiving board prints to serial — and tells you precisely what
each one should look like on screen.

Companions: [HARDWARE.md](HARDWARE.md) (wiring) · [FIRMWARE.md](FIRMWARE.md) (firmware & AT subset).
Every example below was generated from the real project codec
([server/wave_api/codec.py](server/wave_api/codec.py),
[server/wave_api/lora/chunk.py](server/wave_api/lora/chunk.py),
[server/tools/lora_payload.py](server/tools/lora_payload.py)) — not invented.

---

## 1. Use case & roles

> A student finishes a quiz. Their device builds a **StudentProgress** report and sends it
> **up** the link. The teacher/server side receives it, reassembles it, decodes it, and
> validates it against the wire schema.

Both ends are the **same Heltec image** ([firmware/heltec_wave_at/](firmware/heltec_wave_at/)) —
role is assigned at runtime by `AT+ADDRESS`.

| Board | Plays the part of | LoRa address | Direction in this test |
|---|---|---|---|
| **Heltec A** (e.g. `COM3`) | **Teacher / server** | `1` | **Receiver** — prints `+RCV` |
| **Heltec B** (e.g. `COM4`) | **Student** | `2` | **Sender** — issues `AT+SEND` |

Both boards **must** share `NetworkID 18` and `Parameter 10,7,1,7`, or they will not hear each
other. (The progress report flows *up*, student `2` → teacher `1`; remediation would flow *down*,
`1` → `2`.)

---

## 2. Before you start — checklist

- [ ] **Antenna on BOTH boards** before power-on (TX without antenna kills the SX1262 PA).
- [ ] Both boards flashed with [firmware/heltec_wave_at/heltec_wave_at.ino](firmware/heltec_wave_at/heltec_wave_at.ino)
      (Arduino IDE → board *Heltec WiFi LoRa 32(V3)*, library *RadioLib*; see [FIRMWARE.md](FIRMWARE.md) §3).
- [ ] Both boards plugged into the same laptop by USB-C → two COM ports (check Device Manager →
      Ports → *Silicon Labs CP210x*).
- [ ] If the boards sit < 1 m apart, add a **20 dB SMA attenuator** on one side, or the receiver
      desenses and drops frames.
- [ ] Database already set up (done) — not needed for this radio test, only for the full app path.

> **One process owns a COM port at a time.** The Arduino Serial Monitor and the Python tool both
> open the port exclusively. **Method A (below) uses two Arduino Serial Monitors** and is the way
> to literally watch `+RCV` in the Arduino IDE — that is the headline requirement. Method B
> automates the same thing from Python but the Serial Monitor must be **closed** while it runs.

---

## 3. The data pipeline — what the payload looks like at each stage

This is the heart of the request: *the payload, its tokenized version, its chunk view, and how it
arrives at the receiver.* Below is a **real** StudentProgress report (LRN `101234567891`, one topic
`L1-T2` completed, perfect score 4/4) traced end to end.

```
 STUDENT (Heltec B, addr 2)                                 TEACHER (Heltec A, addr 1)
 ────────────────────────────                               ────────────────────────────
 ① object  ─► ② tokenized ─► ③ serialized ─► ④ chunks ──air──► ⑤ +RCV lines ─► ⑥ reassembled ─► ⑦ decoded+validated
```

### ① Payload object — what the student device holds
Plain JSON, human-readable. This is the `StudentProgress` model from
[Wave/src/schemas/index.ts](Wave/src/schemas/index.ts) / [protocol/wire_manifest.json](protocol/wire_manifest.json):

```json
{
  "studentLrn": "101234567891",
  "section": "Grade 7 - Einstein",
  "completedTopicIds": ["L1-T2"],
  "quizAttempts": {
    "L1-T2": { "topicId": "L1-T2", "score": 4, "perfectScore": 4,
               "answers": [0,1,2,3], "completedAt": "2026-06-21" }
  },
  "quizScores": {},
  "summativeScores": {}
}
```

### ② Tokenized — keys dropped, values become a positional array
The codec replaces field **names** with **position** (order comes from the manifest) and turns
enums into small integers. This is the compaction that makes the message cheap to send over LoRa:

```json
["101234567891","Grade 7 - Einstein",["L1-T2"],[["L1-T2",["L1-T2",4,4,[0,1,2,3],"2026-06-21"]]],[],[]]
```

The payload is then wrapped in an **envelope** (also tokenized — note `"StudentProgress"` became
`2` and `"up"` became `0`, their enum indices) and serialized to the exact bytes that go on air:

### ③ Serialized envelope — the on-air bytes (**176 bytes**)
```json
[1,"a1b2c3d4",2,0,0,"Grade 7 - Einstein","2026-06-21T08:30:00+00:00",0,1,["101234567891","Grade 7 - Einstein",["L1-T2"],[["L1-T2",["L1-T2",4,4,[0,1,2,3],"2026-06-21"]]],[],[]]]
```
Envelope field order = `version, msgId, type(enum), direction(enum), subject(enum), section,
createdAt, chunkIndex, chunkTotal, payload`.

### ④ Chunks — split to fit the radio
RYLR998/Heltec `AT+SEND` caps a frame at **240 bytes**. 176 bytes of JSON would fit in one frame,
**but** each chunk is re-wrapped as `{"msgId","index","total","data":"…"}` and every `"` inside
`data` is escaped to `\"`, which inflates the wire line. To stay safely under 240 we fragment with
`frame_size = 120`, giving **2 chunks**. Each chunk is a self-describing JSON object:

```json
chunk 0 of 2:  {"msgId":"a1b2c3d4","index":0,"total":2,"data":"[1,\"a1b2c3d4\",2,0,0,\"Grade 7 - Einstein\",\"2026-06-21T08:30:00+00:00\",0,1,[\"101234567891\",\"Grade 7 - Einstein\",[\"L1-T2\"],"}
chunk 1 of 2:  {"msgId":"a1b2c3d4","index":1,"total":2,"data":"[[\"L1-T2\",[\"L1-T2\",4,4,[0,1,2,3],\"2026-06-21\"]]],[],[]]]"}
```

The receiver uses `msgId` to group chunks, `index`/`total` to order them and know when it's
complete, and `data` is the slice of the serialized envelope.

---

## 4. Method A — manual, watch `+RCV` in the Arduino Serial Monitor (the headline test)

This is the literal "see what the receiver got in the Arduino IDE" path. You open **two** Serial
Monitors (one per board), provision both, then **type the chunk frames** on the student board and
**watch them arrive** on the teacher board.

> Open two Arduino IDE windows (or two Serial Monitor instances), each on its own COM port, both at
> **115200 baud** with line ending **"Both NL & CR"**.

### Step 1 — provision both boards (type these once per board)

**On Heltec A's monitor (teacher / receiver, COM3):**
```
AT+ADDRESS=1        → +OK
AT+NETWORKID=18     → +OK
AT+PARAMETER=10,7,1,7 → +OK
```
**On Heltec B's monitor (student / sender, COM4):**
```
AT+ADDRESS=2        → +OK
AT+NETWORKID=18     → +OK
AT+PARAMETER=10,7,1,7 → +OK
```

### Step 2 — (optional) one-line smoke test first
Prove the link before the full report. On **B (student)** type:
```
AT+SEND=1,5,hello   → +OK
```
On **A (teacher)** the Serial Monitor prints (rssi/snr vary):
```
+RCV=2,5,hello,-37,11
```
`+RCV=<srcAddr>,<len>,<data>,<rssi>,<snr>` — source `2` is the student, payload `hello`. If you see
this, framing, addressing, and network filtering all work.

### Step 3 — send the real progress report (two chunks)
On **B (student)**, paste these two lines one at a time, waiting for `+OK` after each:

```
AT+SEND=1,182,{"msgId":"a1b2c3d4","index":0,"total":2,"data":"[1,\"a1b2c3d4\",2,0,0,\"Grade 7 - Einstein\",\"2026-06-21T08:30:00+00:00\",0,1,[\"101234567891\",\"Grade 7 - Einstein\",[\"L1-T2\"],"}
AT+SEND=1,112,{"msgId":"a1b2c3d4","index":1,"total":2,"data":"[[\"L1-T2\",[\"L1-T2\",4,4,[0,1,2,3],\"2026-06-21\"]]],[],[]]]"}
```
> The number after the address is the **byte length of everything that follows it** (the chunk
> JSON). It must match or the firmware returns `+ERR=1`. The lengths above (182, 112) are exact.

### Step 4 — what each Serial Monitor should show

**Heltec B — STUDENT / SENDER (COM4):**
```
AT+ADDRESS=2
+OK
AT+NETWORKID=18
+OK
AT+PARAMETER=10,7,1,7
+OK
AT+SEND=1,182,{"msgId":"a1b2c3d4","index":0,"total":2,"data":"[1,\"a1b2c3d4\",2,0,0,...
+OK
AT+SEND=1,112,{"msgId":"a1b2c3d4","index":1,"total":2,"data":"[[\"L1-T2\",...
+OK
```

**Heltec A — TEACHER / RECEIVER (COM3):** ← *this is "what the receiver has gotten"*
```
+RCV=2,182,{"msgId":"a1b2c3d4","index":0,"total":2,"data":"[1,\"a1b2c3d4\",2,0,0,\"Grade 7 - Einstein\",\"2026-06-21T08:30:00+00:00\",0,1,[\"101234567891\",\"Grade 7 - Einstein\",[\"L1-T2\"],"},-39,10
+RCV=2,112,{"msgId":"a1b2c3d4","index":1,"total":2,"data":"[[\"L1-T2\",[\"L1-T2\",4,4,[0,1,2,3],\"2026-06-21\"]]],[],[]]]"},-39,10
```

Each `+RCV` is **one chunk exactly as the student sent it**, plus the source address (`2`), the
byte length, and live RSSI/SNR. Two `+RCV` lines with the same `msgId` and `index` 0 then 1, both
showing `total:2` = a complete, correctly ordered message. **The firmware prints these to serial on
its own** — no extra code needed; that is the receiver output you asked to see.

> The Heltec firmware is a transparent radio: it shows you the raw chunk frames. Turning those two
> `+RCV` lines back into the readable object of stage ① (reassemble → decode → validate) is done by
> the host (`recv_payloads` + `codec`), shown in Method B. Manually, you can confirm success just
> from the two `+RCV` lines arriving intact.

---

## 5. Multi-chunk case — "its look in chunks if necessary"

A bigger report (e.g. 8 topics completed, **561 bytes** serialized) fragments into **4 chunks**.
Same `msgId`, `index` 0→3, every line carries `total:4`. The student sends four `AT+SEND` lines;
the teacher prints four `+RCV` lines:

```
+RCV=2,253,{"msgId":"ff00ee11","index":0,"total":4,"data":"[1,\"ff00ee11\",2,0,0,\"Grade 7 - ..."},-40,9
+RCV=2,256,{"msgId":"ff00ee11","index":1,"total":4,"data":"7\",\"L1-T8\"],[[\"L1-T1\",[\"L1-T1\",3,4,..."},-40,9
+RCV=2,254,{"msgId":"ff00ee11","index":2,"total":4,"data":"026-06-21\"]],[\"L1-T5\",[\"L1-T5\",3,4,..."},-41,9
+RCV=2,72,{"msgId":"ff00ee11","index":3,"total":4,"data":"026-06-21\"]]],[],[]]]"},-40,9
```

The receiver only emits the decoded payload once it has collected indices `0..total-1`. A missing
index = an incomplete message (the host's reassembler times it out after
`reassembly_timeout_ms`; manually, you'd just see fewer `+RCV` lines than `total`).

> **Keep each `AT+SEND` line under 240 bytes.** Quote-escaping inflates the wire — a 176-byte
> payload sliced at `frame_size=180` produced a **247-byte** frame in testing and would return
> `+ERR=10`. Use `frame_size=120–140` for quote-heavy JSON like these envelopes (the project's own
> H14 test drops to 140 for the same reason).

---

## 6. Method B — automated, with the host tool (reassemble + decode + validate)

Same radios, same chunks, but Python drives both ends and prints the **fully decoded, schema-
validated** report — i.e. stages ⑥ and ⑦. **Close the Arduino Serial Monitors first** (the tool
needs the COM ports).

Two terminals, from [server/](server/):

```powershell
# Terminal 1 — teacher/server side listens on addr 1:
.venv\Scripts\python tools\lora_payload.py recv --port COM3 --address 1

# Terminal 2 — student side sends its progress report up to addr 1:
.venv\Scripts\python tools\lora_payload.py send-progress --port COM4 --address 2 --dest 1 `
    --lrn 101234567891 --section "Grade 7 - Einstein" --subject science --score 4
```

**Terminal 2 (student) prints:**
```
[lora] COM4 configured addr=2 net=18
[lora] sending StudentProgress: 176 bytes -> ~1 frame(s) to addr 1
[lora] sent msgId=a1b2c3d4
```

**Terminal 1 (teacher) prints — this is the receiver's fully reconstructed view:**
```
[lora] COM3 configured addr=1 net=18
[lora] listening on addr 1; Ctrl+C to stop

=== received StudentProgress (176 bytes) — schema ok ===
  from section='Grade 7 - Einstein' subject='science' dir='up'
{
  "studentLrn": "101234567891",
  "section": "Grade 7 - Einstein",
  "completedTopicIds": ["L1-T2"],
  "quizAttempts": {
    "L1-T2": { "topicId": "L1-T2", "score": 4, "perfectScore": 4,
               "answers": [0,1,2,3], "completedAt": "2026-06-21" }
  },
  "quizScores": {},
  "summativeScores": {}
}
```

`schema ok` = the reassembled bytes decoded cleanly and validated against the generated wire model
([server/wave_api/agents/wire_models.py](server/wave_api/agents/wire_models.py) /
[Wave/src/schemas/index.ts](Wave/src/schemas/index.ts)). **The object that comes out the right end
is byte-for-byte the object the student put in at stage ①** — that is a successful transfer.

### Reverse direction (teacher → student remediation), for completeness
```powershell
# Student listens:
.venv\Scripts\python tools\lora_payload.py recv --port COM4 --address 2
# Teacher sends remediation down to addr 2:
.venv\Scripts\python tools\lora_payload.py send-remediation --port COM3 --address 1 --dest 2 `
    --section "Grade 7 - Einstein" --subject science
```

---

## 7. Pass criteria

| # | Check | Pass looks like |
|---|---|---|
| 1 | Both boards provision | `+OK` to every `AT+ADDRESS/NETWORKID/PARAMETER` |
| 2 | Smoke test | `hello` sent on B appears as `+RCV=2,5,hello,…` on A |
| 3 | Progress report, manual | A prints `total:N` `+RCV` lines, `index` `0..N-1`, same `msgId` |
| 4 | Progress report, host tool | Terminal 1 prints `received StudentProgress … schema ok` and the object matches stage ① |
| 5 | RSSI/SNR sane | RSSI roughly −30 to −90 dBm at bench range (worse → check antenna/attenuator) |

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `+ERR=1` after `AT+SEND` | The `<len>` doesn't match the byte count of the data, or fewer than two commas. Recount; the payload may contain commas but the first two are delimiters. |
| `+ERR=10` after `AT+SEND` | Frame > 240 bytes (escape inflation). Re-fragment with smaller `frame_size` (120–140). |
| No `+RCV` on the receiver | NetworkID/Parameter/freq mismatch, wrong dest address, or no antenna. Re-provision both; confirm `AT+SEND=1,…` targets the receiver's address. |
| `+ERR=99` looping on boot | Radio init failed — board isn't a V3 (SX1262) or antenna unseated. |
| Receiver desensed at close range | Add a 20 dB attenuator or separate the boards. |
| Python tool "port in use" | An Arduino Serial Monitor still owns the COM port — close it. |
| Garbled serial text | Wrong baud — set the monitor to **115200**. |

---

## 9. Where this maps in the codebase

| Stage | Code |
|---|---|
| ② tokenize / ⑦ decode | [server/wave_api/codec.py](server/wave_api/codec.py) · [protocol/wire_manifest.json](protocol/wire_manifest.json) |
| ④ fragment / ⑥ reassemble | [server/wave_api/lora/chunk.py](server/wave_api/lora/chunk.py) |
| `AT+SEND` / `+RCV` driver | [server/wave_api/lora/rylr998.py](server/wave_api/lora/rylr998.py) · [transport.py](server/wave_api/lora/transport.py) |
| Heltec firmware (prints `+RCV`) | [firmware/heltec_wave_at/heltec_wave_at.ino](firmware/heltec_wave_at/heltec_wave_at.ino) |
| This use case, scripted | [server/tools/lora_payload.py](server/tools/lora_payload.py) |
| Automated bench suite | [server/tests/hw/test_lora_link.py](server/tests/hw/test_lora_link.py) (`WAVE_HW_BENCH=1`) |

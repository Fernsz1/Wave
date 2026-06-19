# Wave — How to Run & Test

Wave is an offline-first learning app (`wave/`, React + Vite) backed by an online Django
server (`server/`) that they both speak to via a **tokenized-array protocol**
(`protocol/wire_manifest.json`) over **MQTT** today and **LoRa** (RYLR998 @ 915 MHz) in the
classroom deployment. A Pi 4B (`pi/router/`) acts as the LoRa-side router and Wi-Fi AP for
internet-free classrooms.

There are six ways to run it, smallest first:

| Mode | Needs | What it proves |
|---|---|---|
| **A. Offline app** | Node only | The full UI on in-memory data |
| **B. Automated tests** | Node + Python (+ optional agent extras) | Codec/protocol, chunking, adapter, server API, agents |
| **C. Full live demo** | + Mosquitto | Real student↔teacher sync over the broker, no internet |
| **D. AI remediation flow** | + Gemini API key | Teacher diagnoses a section → AI drafts handbook + quiz → wire-shaped material lands in the DB |
| **E. LoRa hardware bench** | 2× RYLR998 modules + Pi or USB-UART | Real RF chunking/reassembly, AT-command driver, link margin |
| **F. Classroom dress rehearsal** | Pi 4B + hostapd/dnsmasq + students | Captive-portal-free Wi-Fi AP + LoRa relay end-to-end |

Paths below use Windows PowerShell. On macOS/Linux, swap `.venv\Scripts\` for `.venv/bin/`.

---

## Prerequisites

- **Node 18+** and **npm**
- **Python 3.12+**
- **Mosquitto** MQTT broker (Mode C) — Windows installer at `C:\Program Files\mosquitto\mosquitto.exe`
- **Google Gemini API key** (Mode D) — set `GOOGLE_API_KEY` in `server/.env`
- **RYLR998** modules + USB-UART adapter / Raspberry Pi 4B (Modes E, F)
- **hostapd**, **dnsmasq** on the Pi (Mode F)

---

## A. Offline app (fastest)

```powershell
cd wave
npm install
npm run dev
```

Open `http://localhost:3000`. With **no `.env.local`**, the app runs on the in-memory
`MockRepository` — every screen works, data lives in `window.localStorage` (key prefix
`wave_*`), nothing is sent anywhere.

Log in as:
- **Student** — LRN `101234567891` (Sophia Cruz), PIN `123456`
- **Teacher** — `T-2026-001` / `Mrs. Elena Santos`

To wipe local state and start over: `localStorage.clear()` in the browser console, then refresh.

---

## B. Automated tests

### Frontend (Vitest)

```powershell
cd wave
npm install
npm test          # vitest — codec golden cases, chunking, outbox, transport, sync
npm run lint      # tsc --noEmit, should be clean
```

The TS codec test re-reads the same `protocol/fixtures/golden.json` the Python suite uses —
that's the cross-language contract.

### Backend (pytest)

Minimum (codec/adapter/chunking/LoRa loopback):
```powershell
cd server
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python manage.py migrate
.venv\Scripts\python -m pytest
```

Expected: **46 passed, 11 skipped** (the 11 skipped are RYLR998 hardware tests gated on
`WAVE_HW_BENCH=1`, see Mode E).

Breakdown:
| File | Coverage |
|---|---|
| `tests/test_api.py` | login, catalog, roster, progress, rankings, sync push |
| `tests/test_codec.py` | golden round-trip in both directions |
| `tests/test_agent_adapters.py` | QuizItem → WireQuizQuestion, sidecar non-leakage, ID assignment |
| `tests/test_chunk_python.py` | fragment/reassemble, dedupe, out-of-order, TTL eviction |
| `tests/test_lora_loopback.py` | RYLR998 driver against FakeSerial, +OK backpressure, frame loss |
| `tests/test_lesson_generation_view.py` | start/PASS/feedback routes, 400/404 paths, idempotent material_id |

If `langchain_core`/`langgraph` aren't installed, `test_lesson_generation_view.py` is skipped
with a clear reason; the other 39 tests still run.

### Hardware bench tests (gated)

```powershell
$env:WAVE_HW_BENCH=1
$env:WAVE_HW_SERVER_PORT="COM3"     # or /dev/ttyUSB0 on Linux/macOS
$env:WAVE_HW_ROUTER_PORT="COM4"     # or /dev/ttyAMA0 on a Pi
cd server
.venv\Scripts\python -m pytest tests/hw/ -v
```

See Mode E below for the wiring.

---

## C. Full live demo (offline LAN, MQTT-backed)

This is the payoff for the non-LoRa path: a student submits a quiz on one device and the
teacher sees it live on another, over the broker, with no internet.

### One-time server setup
```powershell
cd server
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python manage.py migrate
.venv\Scripts\python manage.py seed_data
```
Re-export the seed from the frontend any time with: `cd wave; npm run seed`.

### Run it — four terminals
```powershell
# 1) MQTT broker
& "C:\Program Files\mosquitto\mosquitto.exe" -c "server\mqtt\mosquitto.conf" -v

# 2) Django web server
cd server; .venv\Scripts\python manage.py runserver 0.0.0.0:8000

# 3) MQTT ingest/broadcast loop (wait for "[mqtt] connected")
cd server; .venv\Scripts\python manage.py run_mqtt

# 4) The app, pointed at the server
cd wave; npm run dev
```

### Point the app at the server
Create `wave/.env.local` (git-ignored):
```
VITE_API_BASE=http://<LAN-IP>:8000
VITE_MQTT_URL=ws://<LAN-IP>:9001
```
- Same laptop only: use `localhost`.
- Phone on the same Wi-Fi: use the laptop's LAN IP (`ipconfig`), then open `http://<LAN-IP>:3000`.
- Delete `.env.local` to fall back to the offline MockRepository.

### Drive the demo
1. Teacher tab → subject **Science**, section **Grade 4 - Section Newton**.
2. Student tab/phone → log in as **Sophia Cruz** `101234567891` / `123456` (same section).
3. Student takes a quiz and submits.
4. Terminal 3 prints `up <- …` then `down -> …`, and the **teacher's records update live**.

**Offline/retained check:** stop the student's connection, run `tools\publish_score.py` from
`server\`, then reconnect the student — the retained message arrives immediately.

**No-app smoke test:** run `tools\phone_sim.py` (subscriber) and `tools\publish_score.py`
(publisher) from `server\`.

---

## D. AI remediation flow (Gemini-backed)

The teacher submits a section's failed quiz items, the lesson agent diagnoses the
misconception and drafts a remediation handbook, then on PASS the quiz agent generates a
targeted quiz. The adapter translates both into a wire-shaped `TeacherRemediationMaterial`
that drops straight into the existing `/remediation` channel.

### Prerequisites
```powershell
cd server
.venv\Scripts\python -m pip install langchain-core langgraph langchain-google-genai python-dotenv
```
Create `server/.env`:
```
GOOGLE_API_KEY=ya29.your-real-key
```

### Drive the flow with curl / Postman

**1) Start a remediation session (interrupts at TeacherReview):**
```powershell
curl -X POST http://localhost:8000/api/generate-lesson `
  -H "Content-Type: application/json" `
  -d '{
    "subject": "science",
    "grade_level": 6,
    "original_topic_id": "L1-T2",
    "topic": "Involuntary vs. Voluntary Muscles",
    "lesson_context": "Voluntary muscles move on command; involuntary muscles work automatically.",
    "target_section": "Grade 6 - Section Newton",
    "failed_items": [
      {"questionId":"Q2-1","topicId":"L1-T2","selectedOption":0,"correctOption":1}
    ]
  }'
```
Response carries `session_id` + the AI's `draft_lesson` (`title` / `content` / `teacher_notes`) and
evaluator remarks.

**2) Iterate (any of: `simplify`, `practical`, `change`, `micro`):**
```powershell
curl -X POST http://localhost:8000/api/submit-feedback `
  -H "Content-Type: application/json" `
  -d '{"session_id":"<from step 1>","feedback":"simplify"}'
```

**3) Approve and finalize:**
```powershell
curl -X POST http://localhost:8000/api/submit-feedback `
  -H "Content-Type: application/json" `
  -d '{"session_id":"<from step 1>","feedback":"PASS"}'
```
On PASS the orchestrator runs the quiz agent, adapts both outputs, writes a
`RemediationMaterial` row (with the new `analytics` JSONField holding cognitive level and
targeted distractor key per item), and returns the camelCase wire payload.

**4) Verify the wire material is published to a section:**
```powershell
curl "http://localhost:8000/remediation?section=Grade%206%20-%20Section%20Newton"
```
The response is `codec.encode("TeacherRemediationMaterial", obj)` token arrays — what a
device would receive over MQTT/LoRa.

### Run without a real API key

For local development without the LLM:
```powershell
cd server
.venv\Scripts\python -m pytest tests/test_lesson_generation_view.py -v
```
The test suite stubs out `AgentFactory.create_llm` and exercises the full LangGraph workflow
with canned Pydantic responses from `tests/fixtures/agent_outputs.py`. **7 passing** covers
every branch (start, four revision buttons, PASS persistence, 400 on bad feedback, 404 on
unknown session, idempotent re-publish via `material_id`).

---

## E. LoRa hardware bench (Tier 2)

Validates the actual radio path with two RYLR998 modules.

### Wiring
- **Server rig**: 1× RYLR998 on `COM3` or `/dev/ttyUSB0`, `AT+ADDRESS=1`, `AT+NETWORKID=18`,
  `AT+PARAMETER=10,7,1,7`. Add a **20 dB SMA attenuator** if the two modules are <1 m apart.
- **Router rig**: 1× RYLR998 on `/dev/ttyAMA0` (Pi UART) or another USB-UART, `AT+ADDRESS=2`,
  same NetworkID + Parameter.
- Both modules must report the same `AT+VER?` — firmware mismatches break interop.

### Run
```powershell
$env:WAVE_HW_BENCH=1
$env:WAVE_HW_SERVER_PORT="COM3"
$env:WAVE_HW_ROUTER_PORT="COM4"
cd server
.venv\Scripts\python -m pytest tests/hw/test_lora_link.py -v
```

Tests cover:
- H1: AT+VER / AT+ADDRESS sanity
- H2: single-frame send/recv with RSSI/SNR
- H3: multi-frame `TeacherRemediationMaterial` reassembly
- H4: `+OK` backpressure between sends
- H8: interleaved msgIds (two payloads in flight)
- H9: airtime budget (10-item remediation ≤ 10 s at SF10/BW125)
- H11: recovery from `+ERR` after malformed AT
- H13: uplink path (Pi → server)
- H14: collision handling with concurrent uplink during downlink

H6 (dropped frame) and H7 (duplicate frame) defer to the loopback tests in
`tests/test_lora_loopback.py` because real RF can't reliably drop on demand.

---

## F. Classroom dress rehearsal (Pi 4B as AP, real students)

End-to-end: a Pi serves a Wi-Fi AP with no internet, students connect over HTTP, and
remediation flows down over LoRa.

### One-time Pi setup
```bash
# On the Pi 4B
sudo apt install hostapd dnsmasq python3-pip
sudo cp /repo/pi/router/config/hostapd.conf /etc/hostapd/hostapd.conf
sudo cp /repo/pi/router/config/dnsmasq.conf /etc/dnsmasq.d/wave.conf
sudo systemctl enable hostapd dnsmasq
sudo mkdir -p /var/lib/wave
pip install pyserial pydantic
```

`hostapd.conf` advertises SSID `Wave-Classroom` on channel 6 (change `wpa_passphrase` per
classroom). `dnsmasq.conf` answers captive-portal probes (gstatic, captive.apple.com, etc.)
locally so phones don't auto-disconnect with "no internet" warnings.

### Run the relay
```bash
cd /repo
python -m pi.router.relay   # reads /dev/ttyAMA0, reassembles, caches /var/lib/wave/cache.sqlite
```

Wrap an HTTP front-end (Flask, FastAPI, or stock `http.server`) around the cache to serve
`http://10.0.0.1/api/remediation?section=...` to students on the AP.

### Smoke test the classroom path
1. Server: PASS a remediation via Mode D for `target_section="Grade 6 - Section Newton"`.
2. Server LoRa driver fragments and ships via `wave_api.lora.transport.send_payload`.
3. Pi relay reassembles and stores in `cache.sqlite`.
4. A phone on `Wave-Classroom` browses to `http://10.0.0.1/...` and gets the wire payload.
5. Student app validates against `wave/src/schemas/index.ts:TeacherRemediationMaterialSchema`
   (Zod) and renders.

### Late-joiner test
Disconnect a student during the broadcast, reconnect 60 s later, hit the same URL — Pi
cache returns the payload (cap of `MAX_PER_SECTION = 20` per section).

---

## Troubleshooting

- **Teacher view only updates on refresh** → live channel down. Check broker (Terminal 1) and
  `run_mqtt` (Terminal 3) are up, and that the teacher's selected **section matches** the
  student's section.
- **Phone can't reach the server** → Windows Firewall. Admin PowerShell:
  ```powershell
  New-NetFirewallRule -DisplayName "Wave demo" -Direction Inbound -Protocol TCP -LocalPort 8000,1883,9001 -Action Allow -Profile Private
  ```
- **Teacher shows fewer students / empty section** → only 4 students have seeded progress
  (Sophia, Ethan, Chloe — Grade 4 Newton; Jacob — Grade 6 Einstein), seed is science-only.
- **IP changed (DHCP)** → update both lines in `wave/.env.local`.
- **`/api/generate-lesson` returns 500** → check `GOOGLE_API_KEY` is set in `server/.env` and
  reachable; run `pytest tests/test_lesson_generation_view.py` to verify the route works with
  the stub.
- **RYLR998 silent** → confirm `baudrate=115200`, common NetworkID, antenna attached. `AT+VER?`
  must respond before anything else works.
- **LoRa payload `+ERR=10`** → chunk payload exceeded 240 bytes. The default `LORA_SAFE_FRAME=180`
  leaves room for the JSON wrapper; lower further if your prompt fields run long.
- **Phone disconnects from `Wave-Classroom`** → captive-portal probe is leaking. Confirm
  `dnsmasq.conf` answers `connectivitycheck.gstatic.com` and friends locally.
- **Late joiner doesn't see remediation** → check `/var/lib/wave/cache.sqlite` has rows for the
  student's section; relay log shows `lora.reassembly.timeout` if a chunk was lost.

---

## Where things live

- `protocol/` — shared wire manifest + golden fixtures (source of truth, both languages).
- `wave/src/protocol/`, `schemas/`, `sync/`, `repo/` — TS codec, Zod schemas, sync/transport, data seam.
- `server/wave_api/` — Django app + DRF views.
- `server/wave_api/codec.py` — Python mirror of the TS codec.
- `server/wave_api/agents/` — LangGraph agents, Pydantic wire mirrors, adapter, orchestrator.
- `server/wave_api/lora/` — RYLR998 AT driver, chunking, transport.
- `server/tests/` — full pytest suite incl. `hw/` for hardware-gated tests.
- `pi/router/` — relay daemon, late-joiner SQLite cache, hostapd/dnsmasq configs.
- Demo posture: read endpoints are open and PINs are plaintext for the LAN demo — harden before production.

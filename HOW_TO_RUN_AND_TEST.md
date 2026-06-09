# Wave — How to Run & Test

Wave is an offline-first learning app (`Wave/`, React + Vite) backed by an online Django
server (`server/`) that they both speak to via a **tokenized-array protocol**
(`protocol/wire_manifest.json`), **DEFLATE-compressed** into compact bytes and carried over
**MQTT** — the same last-mile path that LoRa will later use. Remedial lessons and quizzes are
**AI-generated** (Google Gemini) server-side, with a deterministic offline fallback.

There are three ways to run it, smallest first:

| Mode | Needs | What it proves |
|---|---|---|
| **A. Offline app** | Node only | The full UI on in-memory data; AI uses the deterministic fallback |
| **B. Automated tests** | Node + Python | Codec/protocol, compression, LoRa frames, AI fallback, server API |
| **C. Full live demo** | Node + Python + Mosquitto | Real student↔teacher sync (compressed) + live Gemini generation |

---

## Prerequisites

- **Node 18+** and **npm**
- **Python 3.12+**
- **Mosquitto** MQTT broker (only for Mode C) — Windows installer puts it at
  `C:\Program Files\mosquitto\mosquitto.exe`

Paths below use Windows PowerShell. On macOS/Linux, swap `.venv\Scripts\` for `.venv/bin/`.

---

## A. Offline app (fastest)

```powershell
cd Wave
npm install
npm run dev
```

Open `http://localhost:3000`. With **no `.env.local`**, the app runs on the in-memory
`MockRepository` — every screen works, data lives in the browser, nothing is sent anywhere.
The AI Remediation Wizard generates content from the deterministic, catalog-derived fallback
(no API key needed); live Gemini generation requires Mode C.

Log in as:
- **Student** — LRN `101234567891` (Sophia Cruz), PIN `123456`
- **Teacher** — any Teacher ID + name (e.g. `T-2026-001` / `Mrs. Elena Santos`)

---

## B. Automated tests

**Frontend** (codec golden cases, DEFLATE compression, LoRa byte frames, outbox, transport):
```powershell
cd Wave
npm test          # vitest — expect ~36 passing
npm run lint      # tsc --noEmit, should be clean
```

**Backend** (codec, compression interop, AI fallback, login, catalog decode, sync push, derivations):
```powershell
cd server
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m pytest -q      # expect 15 passing
```

> Two cross-language fixtures are the proof the app and server agree over MQTT/LoRa: the codec
> golden arrays (`protocol/fixtures/golden.json`) and the DEFLATE interop fixture
> (`protocol/fixtures/compress.json`, byte-identical from `pako` and Python `zlib`), each asserted
> by **both** suites. The AI tests run with no API key, so they exercise the deterministic fallback
> only — no network.

---

## C. Full live demo (offline LAN, last-mile delivery)

This is the payoff: a student submits a quiz on one device and the teacher sees it live on
another, over the broker, with no internet.

### One-time server setup
```powershell
cd server
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python manage.py migrate
.venv\Scripts\python manage.py seed_data     # seeds catalog/roster/progress from the frontend
```
Re-export the seed from the frontend any time with: `cd Wave; npm run seed`.

**Enable live AI generation (optional).** Without a key, the server still serves remedial
content/quizzes from the deterministic fallback. To use Gemini, set the key before running the
Django server (Terminal 2) — see `server/.env.example`:
```powershell
$env:GEMINI_API_KEY = "<your-key>"      # optional: $env:GEMINI_MODEL = "gemini-flash-latest"
```
The key stays on the server and is never sent to the browser.

### Run it — four terminals
```powershell
# 1) MQTT broker
& "C:\Program Files\mosquitto\mosquitto.exe" -c "server\mqtt\mosquitto.conf" -v

# 2) Django web server
cd server; .venv\Scripts\python manage.py runserver 0.0.0.0:8000

# 3) MQTT ingest/broadcast loop
cd server; .venv\Scripts\python manage.py run_mqtt      # wait for "[mqtt] connected"

# 4) The app, pointed at the server
cd Wave; npm run dev
```

### Point the app at the server
Create `Wave/.env.local` (this file is git-ignored):
```
VITE_API_BASE=http://<LAN-IP>:8000
VITE_MQTT_URL=ws://<LAN-IP>:9001
```
- Same laptop only: use `localhost`.
- Phone on the same Wi-Fi: use the laptop's LAN IP (find it with `ipconfig`), then open
  `http://<LAN-IP>:3000` on the phone.

Delete `.env.local` to fall back to the offline MockRepository.

### Drive the demo
1. Teacher tab → subject **Science**, section **Grade 4 - Section Newton**.
2. Student tab/phone → log in as **Sophia Cruz** `101234567891` / `123456` (same section).
3. Student takes a quiz and submits.
4. Terminal 3 prints `up <- …` then `down -> …`, and the **teacher's records update live** — no refresh.
5. Teacher → **AI Remediation Wizard** → pick a student/topic → Generate. With `GEMINI_API_KEY`
   set you get live Gemini content; otherwise the grounded fallback. Publish broadcasts it
   (compressed) to the whole section, and the student sees it.

The down-broadcast payloads are DEFLATE-compressed (envelope `enc=1`); `tools\phone_sim.py` decodes
them transparently, so you can watch the compressed traffic arrive and round-trip.

**Offline/retained check:** stop the student's connection, run
`server\.venv\Scripts\python tools\publish_score.py`, then reconnect the student — the retained
message arrives immediately ("delivered when reachable").

**No-app smoke test:** run `tools\phone_sim.py` (subscriber) and `tools\publish_score.py`
(publisher) from `server\` — you'll see the tokenized up message and the server's down broadcasts.

---

## Troubleshooting

- **Teacher view only updates on refresh** → the live channel isn't connecting. Check the broker
  (Terminal 1) and `run_mqtt` (Terminal 3) are up, and that the teacher's selected **section
  matches** the student's section (live pushes are per-section).
- **Phone can't reach the server** → Windows Firewall. In an **admin** PowerShell:
  ```powershell
  New-NetFirewallRule -DisplayName "Wave demo" -Direction Inbound -Protocol TCP -LocalPort 8000,1883,9001 -Action Allow -Profile Private
  ```
- **Teacher shows fewer students / empty section** → only 4 students have seeded progress
  (Sophia, Ethan, Chloe — Grade 4; Jacob — Grade 6 Einstein), and the seed is science-only.
  Use those sections, or re-seed with more data.
- **IP changed (DHCP)** → update both lines in `Wave/.env.local`.

---

## Where things live
- `protocol/` — shared wire manifest + golden/compress fixtures (the source of truth).
- `Wave/src/protocol/`, `schemas/`, `sync/`, `repo/` — codec, validation, sync layer (compression +
  `LoRaTransport` byte frames live in `sync/`), data seam.
- `server/` — Django API + MQTT; AI generation in `wave_api/ai.py`. See `server/README.md`.
- Demo posture: read endpoints are open and PINs are plaintext for the LAN demo — harden before production.

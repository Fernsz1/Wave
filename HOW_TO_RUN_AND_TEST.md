# Wave — How to Run & Test

Wave is an offline-first learning app (`Wave/`, React + Vite) backed by an online Django
server (`server/`) that they both speak to via a **tokenized-array protocol**
(`protocol/wire_manifest.json`) over **MQTT** — the same last-mile path that LoRa will later use.

There are three ways to run it, smallest first:

| Mode | Needs | What it proves |
|---|---|---|
| **A. Offline app** | Node only | The full UI on in-memory data (today's behavior) |
| **B. Automated tests** | Node + Python | Codec/protocol, chunking, server API, derivations |
| **C. Full live demo** | Node + Python + Mosquitto | Real student↔teacher sync over the broker, no internet |

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

Log in as:
- **Student** — LRN `101234567891` (Sophia Cruz), PIN `123456`
- **Teacher** — any Teacher ID + name (e.g. `T-2026-001` / `Mrs. Elena Santos`)

---

## B. Automated tests

**Frontend** (codec golden cases, chunking/reassembly, outbox, transport):
```powershell
cd Wave
npm test          # vitest — expect ~22 passing
npm run lint      # tsc --noEmit, should be clean
```

**Backend** (codec golden cases, login, catalog decode, sync push, derivations):
```powershell
cd server
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m pytest -q      # expect 8 passing
```

> The codec golden fixtures (`protocol/fixtures/golden.json`) are asserted by **both** suites
> against the same expected token arrays — that cross-language match is the proof the app and
> server will agree over MQTT/LoRa.

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
- `protocol/` — shared wire manifest + golden fixtures (the source of truth).
- `Wave/src/protocol/`, `schemas/`, `sync/`, `repo/` — codec, validation, sync layer, data seam.
- `server/` — Django API + MQTT; see `server/README.md` for backend detail.
- Demo posture: read endpoints are open and PINs are plaintext for the LAN demo — harden before production.

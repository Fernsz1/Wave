# Wave Server (Django) + tokenized protocol

The online, AI-capable system of record for Wave. Persists every data object, derives
`quizScores` / `completedTopicIds` / `Rankings`, and speaks the **tokenized-array wire
protocol** (`../protocol/wire_manifest.json`) so the offline app and this server decode
identical arrays over MQTT today and LoRa later. (AI generation is intentionally not wired yet.)

## Layout
- `wave_api/codec.py` — Python tokenized-array codec (mirror of `Wave/src/protocol/codec.ts`).
- `wave_api/models.py` — Student/Teacher, QuizAttempt, SummativeResult, RemediationMaterial,
  CatalogDocument (static catalog as JSON), ApiToken.
- `wave_api/ingest.py` / `derive.py` — route "up" messages to storage; assemble progress + rankings.
- `wave_api/views.py` + `urls.py` — REST: `auth/login`, `roster`, `catalog`, `allprogress`,
  `progress/<lrn>`, `rankings`, `remediation`, `sync/push`.
- `wave_api/mqtt.py` + `management/commands/run_mqtt.py` — MQTT publish/subscribe (paho), the
  last-mile transport (replaces the demo's FastAPI `app.py`).
- `mqtt/mosquitto.conf` — broker config (1883 TCP + 9001 WebSocket), reused from `wave_demo`.
- `tools/phone_sim.py`, `tools/publish_score.py` — codec-adapted demo smoke tests.

## First-time setup
```bash
cd server
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # (Scripts on Windows; bin on *nix)
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py seed_data                  # seeds from Wave/scripts/export-seed.ts output
.venv/Scripts/python -m pytest -q
```
Re-export seed data from the frontend any time with: `cd ../Wave && npm run seed`.

## Demo runbook (offline LAN, last-mile delivery)
1. **Broker**:   `mosquitto -c server/mqtt/mosquitto.conf -v`
2. **Server**:   `python manage.py runserver 0.0.0.0:8000`  (+ a 2nd shell) `python manage.py run_mqtt`
3. **App**:      in `Wave/.env.local` set `VITE_API_BASE=http://<LAN-IP>:8000` and
   `VITE_MQTT_URL=ws://<LAN-IP>:9001`, then `npm run dev`. (Unset both → offline MockRepository.)
4. **Same router, no internet** — phone + laptop on the same LAN; allow inbound TCP 8000/1883/9001.
5. A student submitting a quiz publishes `StudentProgress` up → server recomputes and broadcasts
   `Rankings` + the student's progress **down** to the section (retained, QoS 1), so the teacher's
   records update live and a phone that was offline gets the latest on reconnect.

Quick no-app check: run `python tools/phone_sim.py` (subscriber) and `python tools/publish_score.py`
(publisher) — you should see the up message and the server's down broadcasts, all tokenized.

> Demo posture: read endpoints are open and PINs are plaintext for the LAN demo. Harden before production.

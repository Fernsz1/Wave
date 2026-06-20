# Wave — Backend Integration Plan (Frontend is Frozen)

**Goal:** Make the backend + schema conform to the existing UI **without changing the frontend**. Set up SQLite + Postgres correctly, switchable via env; complete the schema; make the server boot; define and Postman-test every endpoint; connect the live frontend; document every request payload, response, query param, header, and HTTP status code.

**Guiding rule — the frontend never changes.** Every decision below adapts the backend to what `Wave/src` already sends and expects. The contract is whatever `Wave/src/repo/httpRepository.ts` and the components do today.

**Temporary mock note (per request):**
- The **TeacherHome remedial** (lesson + quiz + summative) and the **Remediation Wizard** stay on mock data for now (AI not integrated). But the **schema must already contain the fields** to store a full remedial lesson + quiz + summative, so when AI is wired later nothing schema-side changes. The generate endpoints return a deterministic **mock** in the exact shape the frontend maps.

---

## ⚠️ Hard compatibility rules (read first)

The frozen frontend bundles its own copy of `protocol/wire_manifest.json` and `Wave/src/schemas/index.ts` at build time. Therefore:

1. **Tokenized (codec) messages are positional.** For `LessonCatalog`, `StudentProgress`, `StudentSummativeResults`, `TeacherRemediationMaterial`, `Rankings`, `StudentSignup` and their `defs`:
   - **NEVER reorder or remove** existing fields.
   - You MAY **append new fields at the end** and mark them `"optional": true`. The frozen frontend simply ignores trailing tokens it doesn't know.
   - New appended wire fields will **not** reach the frozen UI (its bundled manifest lacks them) — that's fine; their purpose is server-side persistence and future use.
2. **Plain-JSON endpoints** (`/auth/login`, `/roster`, `/remediation/generate`) are not tokenized — you may add response fields freely; the frontend reads only the keys it knows.
3. **Keep `derive.py` emitting `section` and `quizScores`** in `StudentProgress` even though the UI type drops them — they're already in the bundled manifest positions; removing them would shift positions and break decoding.

---

## Current state (baseline, verified)

- **Stack:** Django + DRF, URL prefix `/api/` ([config/urls.py](server/config/urls.py)), custom token auth `Authorization: Token <key>` ([wave_api/auth.py](server/wave_api/auth.py)).
- **DB:** SQLite hardcoded ([config/settings.py:35-40](server/config/settings.py#L35)); migrations `0001–0005` applied; schema matches models (no drift).
- **Blocker:** the app **cannot boot** — [urls.py:4](server/wave_api/urls.py#L4) eagerly imports the AI agent stack (`pydantic`, `langgraph`, …) which isn't installed, so every `manage.py`/`runserver` fails.
- **Endpoints today:** `auth/login`, `roster`, `catalog`, `allprogress`, `progress/<lrn>`, `rankings`, `remediation`, `remediation/generate`, `sync/push`, `generate-lesson`, `submit-feedback`.
- **Reference audits:** [Wave/docs/FRONTEND_DATA_AUDIT.md](Wave/docs/FRONTEND_DATA_AUDIT.md), [Wave/docs/FRONTEND_BACKEND_ALIGNMENT.md](Wave/docs/FRONTEND_BACKEND_ALIGNMENT.md), [server/DATABASE_SCHEMA.md](server/DATABASE_SCHEMA.md).

---

# PHASE 1 — Make the server boot (decouple AI)

The AI is not integrated; it must not block the core API.

### Step 1.1 — Make the AI imports lazy
Edit [server/wave_api/lesson_generation_view.py](server/wave_api/lesson_generation_view.py): remove the top-level `from wave_api.agents import orchestrator` and import it **inside** each view function instead:

```python
# at top: delete the module-level orchestrator import
@api_view(['POST'])
def start_lesson_generation(request):
    from wave_api.agents import orchestrator   # lazy
    ...
@api_view(['POST'])
def submit_teacher_feedback(request):
    from wave_api.agents import orchestrator   # lazy
    ...
```

Now `urls.py` imports cleanly even with the AI deps absent. (`ai.py` already imports `google.genai` lazily.)

### Step 1.2 — Verify boot
```bash
server/.venv/Scripts/python.exe server/manage.py check
server/.venv/Scripts/python.exe server/manage.py runserver 0.0.0.0:8000
```
`check` should pass; `runserver` should start. (If `check` still complains about AI, confirm no other module imports agents at top level.)

### Step 1.3 — Make generate endpoints return deterministic MOCK
The frontend maps these keys from `/api/remediation/generate` ([httpRepository.ts:198-242](Wave/src/repo/httpRepository.ts#L198)): `lesson_title|title`, `concepts[]` or `content`, `teachers_notes[]`+`learning_gap` or `teacherNotes`, `summative_test[]` or `createdQuiz[]`.

Enhance `_fallback()` in [server/wave_api/ai.py](server/wave_api/ai.py) so `summative_test` returns 3 real mock items (currently `[]`), so the wizard preview shows a quiz. Also make `views.generate_remediation` tolerant of **both** key spellings the frontend uses (the Wizard sends `topicId`/`studentLrn`; the repo sends `originalTopicId`/`studentName`):

```python
topic_id = data.get("originalTopicId") or data.get("topicId") or ""
student_name = data.get("studentName") or data.get("section") or "your class"
```

This keeps the Wizard on mock data while returning a correctly-shaped response.

---

# PHASE 2 — Complete the schema (superset that can hold everything the UI models)

Add the frontend-only fields so the schema can store a full remedial lesson/quiz and the attempt counter — even though the frozen UI doesn't transmit them yet. Append-only; no reorders.

### Step 2.1 — Models ([server/wave_api/models.py](server/wave_api/models.py))
```python
class QuizAttempt(models.Model):
    ...
    attempts = models.IntegerField(default=0)   # UI retry counter (max 3)

class RemediationMaterial(models.Model):
    ...
    assigned_student_lrn = models.CharField(max_length=12, blank=True, default="")
    target_lesson_id = models.CharField(max_length=40, blank=True, default="")
    # `subject` already exists; expose it on the wire (Step 2.2)
```
(`title`, `content`, `teacher_notes`, `created_quiz`, `created_summative`, `analytics` already cover the remedial lesson + quiz + summative — these satisfy the "fields must exist in schema" requirement.)

### Step 2.2 — Wire manifest ([protocol/wire_manifest.json](protocol/wire_manifest.json)) — APPEND ONLY
Add to the **end** of the relevant field lists, each `"optional": true`:
- `defs.StudentQuizAttempt.fields` → `{ "name": "attempts", "t": "int", "optional": true }`
- `messages.TeacherRemediationMaterial.fields` → `{ "name": "subject", "t": "enum:subject", "optional": true }`, `{ "name": "assignedStudentLrn", "t": "str", "optional": true }`, `{ "name": "targetLessonId", "t": "str", "optional": true }`

> Do not touch the order of existing entries. The Python codec re-reads this file at runtime; the frozen frontend keeps its bundled copy and ignores the new trailing fields.

### Step 2.3 — Derivation & ingest
- [derive.py](server/wave_api/derive.py) `assemble_progress`: add `"attempts": a.attempts` to each `quiz_attempts[...]` entry.
- [ingest.py](server/wave_api/ingest.py) `_save_progress`: when saving an attempt, set `attempts` (increment, capped at 3) and persist `assigned_student_lrn`/`target_lesson_id`/`subject` in `_save_remediation`.

### Step 2.4 — Migrate
```bash
server/.venv/Scripts/python.exe server/manage.py makemigrations wave_api
server/.venv/Scripts/python.exe server/manage.py migrate
```

---

# PHASE 3 — Database config: SQLite + Postgres, switchable by env

### Step 3.1 — Dependencies → [server/requirements.txt](server/requirements.txt)
Add:
```
python-dotenv>=1.0
dj-database-url>=2.1
psycopg[binary]>=3.1
```
Install:
```bash
server/.venv/Scripts/python.exe -m pip install python-dotenv dj-database-url "psycopg[binary]"
```

### Step 3.2 — settings.py: load .env + DATABASE_URL with SQLite fallback
Replace the hardcoded `DATABASES` block in [config/settings.py](server/config/settings.py):
```python
import os
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if DATABASE_URL:
    import dj_database_url
    DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600)}
else:
    DATABASES = {
        "default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}
    }
```
**Result:** no `DATABASE_URL` → SQLite (offline/dev, default). `DATABASE_URL=postgres://…` → Postgres. One engine at a time; the active one is the system of record. (See the lessons-delivery note at the bottom — Postgres is the town master; rural phones still load the catalog from the app bundle, not Postgres.)

---

# PHASE 4 — Environment files

### Step 4.1 — `server/.env` (gitignored; real local values)
```
# Database — leave unset for SQLite; set for Postgres
# DATABASE_URL=postgres://wave:wave@localhost:5432/wave

# MQTT broker
WAVE_BROKER_HOST=127.0.0.1
WAVE_BROKER_PORT=1883

# AI (blank = mock/fallback mode)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

### Step 4.2 — `server/.env.example` (committed template — masked)
Same keys, no secrets:
```
# DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
WAVE_BROKER_HOST=127.0.0.1
WAVE_BROKER_PORT=1883
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

### Step 4.3 — Frontend `Wave/.env.local` (to point the frozen UI at the server)
```
VITE_API_BASE=http://localhost:8000
# VITE_MQTT_URL=ws://localhost:9001   # optional live "down" channel
```
(Setting `VITE_API_BASE` is the supported switch from MockRepository → HttpRepository — no code change.)

---

# PHASE 5 — Seed both databases

The catalog/roster come from the frontend export ([seed_data.py](server/wave_api/management/commands/seed_data.py)).

### SQLite (default)
```bash
server/.venv/Scripts/python.exe server/manage.py migrate
server/.venv/Scripts/python.exe server/manage.py seed_data
server/.venv/Scripts/python.exe server/manage.py seed_users   # if used
```

### Postgres (when you switch)
1. Create DB: `createdb wave` (or via pgAdmin), set `DATABASE_URL` in `server/.env`.
2. Build structure + load data:
```bash
server/.venv/Scripts/python.exe server/manage.py migrate
server/.venv/Scripts/python.exe server/manage.py seed_data       # re-seed from JSON, OR
# migrate existing SQLite rows instead of re-seeding:
#   (with SQLite active)  manage.py dumpdata wave_api --indent 2 > wave_data.json
#   (switch to Postgres)  manage.py migrate && manage.py loaddata wave_data.json
```
3. Verify the catalog landed: `SELECT subject, COUNT(*) FROM wave_api_catalogdocument;` → 3 rows.

---

# PHASE 6 — API contract (payloads, responses, params, headers, status codes)

Base URL: `http://localhost:8000/api`. Headers: `Content-Type: application/json` on POST; `Authorization: Token <key>` only where noted.

### 6.1 `POST /auth/login`  — auth: none
**Student request**
```json
{ "role": "student", "lrn": "101234567891", "pin": "123456" }
```
**Teacher request**
```json
{ "role": "teacher", "teacherId": "T-2026-001", "password": "password123" }
```
**200 response (student)**
```json
{ "token": "<hex>", "role": "student",
  "user": { "lrn": "101234567891", "name": "Maria Santos", "gradeLevel": "Grade 6", "section": "Grade 6 - Section Einstein" } }
```
**Status:** 200 OK · 400 (unknown role / missing teacher creds) · 401 (wrong PIN/password) · 404 (LRN/teacher not found).

### 6.2 `GET /roster`  — auth: none
**200**
```json
{ "students": [ { "lrn": "...", "name": "...", "gradeLevel": "...", "section": "...", "pin": "..." } ],
  "teachers": [ { "teacherId": "...", "name": "...", "department": "...", "password": "..." } ] }
```
**Status:** 200 OK.

### 6.3 `GET /catalog?subject=science`  — auth: none
**Query:** `subject` ∈ `science|mathematics|english` (default `science`).
**200**
```json
{ "type": "LessonCatalog", "tokens": [ /* positional token array */ ] }
```
Frontend does `decode('LessonCatalog', tokens).lessons`. **Status:** 200 OK (empty `tokens` if subject absent).

### 6.4 `GET /allprogress`  — auth: none
**200**
```json
{ "type": "StudentProgress", "records": [ [ /* tokens */ ], [ /* tokens */ ] ] }
```
**Status:** 200 OK.

### 6.5 `GET /progress/<lrn>`  — auth: none
**200** `{ "type": "StudentProgress", "tokens": [ ... ] }` · **404** if LRN unknown.

### 6.6 `GET /rankings?section=<s>&subject=<subj>`  — auth: none
**200** `{ "type": "Rankings", "tokens": [ ... ] }`. **Status:** 200 OK.
> Note: the frozen UI computes rankings client-side and does not call this. Keep it working for parity/Postman, but it's not on the UI's critical path.

### 6.7 `GET /remediation?section=<s>`  — auth: none
**Query:** optional `section` (filters to that section + "All Sections" + blank).
**200** `{ "type": "TeacherRemediationMaterial", "items": [ [ /* tokens */ ] ] }`. **Status:** 200 OK.

### 6.8 `POST /remediation/generate`  — auth: none — **MOCK**
**Request (accept both shapes):**
```json
{ "subject": "science", "originalTopicId": "t-1", "studentName": "Grade 6 - Section Einstein", "failedItems": [] }
```
(Wizard variant sends `topicId`, `studentLrn`, `topicName`, `gradeLevel`, `section` — backend must read `originalTopicId||topicId` and `studentName||section`.)
**200 (mock, AI schema the frontend maps):**
```json
{ "lesson_number": 1, "lesson_title": "Remedial Review: t-1",
  "learning_gap": "…", "grade_level_section": "…",
  "teachers_notes": ["…","…"],
  "concepts": [ { "header_title": "…", "explanation": "…" } ],
  "summative_test": [ { "question": "…", "choices": ["A","B","C","D"], "correct_answer": "B" } ] }
```
**Status:** 200 OK (always returns mock; never 5xx in mock mode).

### 6.9 `POST /sync/push`  — **auth: `Authorization: Token <key>` REQUIRED**
**Request:**
```json
{ "envelopes": [ [ /* encoded envelope token array */ ] ] }
```
Envelope types the UI sends: `StudentProgress` (quiz attempt), `StudentSummativeResults`, `TeacherRemediationMaterial` (publish), `StudentSignup` (enroll).
**200** `{ "acks": ["<msgId>", ...] }`.
**Status:** 200 OK · **401/403** if token missing/invalid · 400 on malformed envelope.

### 6.10 `POST /generate-lesson` & `POST /submit-feedback`  — auth: none — **MOCK / deferred**
Keep returning the documented shapes (`session_id`, `draft_lesson`, `ai_evaluation_remarks`) but back them with mock until AI is integrated. Not on the frozen UI's path (UI uses `/remediation/generate`). **Status:** 200 OK · 400 (serializer invalid) · 404 (session missing).

---

# PHASE 7 — Postman testing

### Step 7.1 — Collection + environment
- Create env `Wave Local` with vars: `base = http://localhost:8000/api`, `token = ""`, `lrn = 101234567891`, `section = Grade 6 - Section Einstein`.
- Create a collection `Wave API` with one request per endpoint above, using `{{base}}`.

### Step 7.2 — Auth flow
1. `POST {{base}}/auth/login` (student body). In **Tests** tab:
   ```js
   pm.test("200", () => pm.response.to.have.status(200));
   pm.environment.set("token", pm.response.json().token);
   ```
2. For `POST {{base}}/sync/push`, set header `Authorization: Token {{token}}`.

### Step 7.3 — Per-request assertions (examples)
```js
// GET /roster
pm.test("200", () => pm.response.to.have.status(200));
pm.test("has students+teachers", () => {
  const b = pm.response.json();
  pm.expect(b).to.have.property("students");
  pm.expect(b).to.have.property("teachers");
});
// GET /catalog?subject=science
pm.test("LessonCatalog tokens", () => {
  pm.expect(pm.response.json().type).to.eql("LessonCatalog");
  pm.expect(pm.response.json().tokens).to.be.an("array");
});
// POST /sync/push without token → expect 401/403
```
### Step 7.4 — Status-code matrix to verify
| Endpoint | Expect |
|---|---|
| login (good) | 200 |
| login (bad PIN) | 401 |
| login (unknown LRN) | 404 |
| login (no role) | 400 |
| roster / catalog / allprogress / remediation / rankings | 200 |
| progress/<bad lrn> | 404 |
| sync/push (no token) | 401/403 |
| sync/push (valid envelope + token) | 200 + acks |
| remediation/generate | 200 (mock) |

### Step 7.5 — Generating envelope tokens for `sync/push`
The body is a tokenized array, not plain JSON, so don't hand-craft it. Either:
- Capture a real envelope from the running frontend (browser Network tab → `sync/push` payload) and paste it into Postman, **or**
- Add a tiny dev helper endpoint/script that calls the Python codec `encode_envelope` to produce a sample, and use that.

---

# PHASE 8 — Connect the frontend and verify end-to-end

### Step 8.1 — Run both
```bash
# backend
server/.venv/Scripts/python.exe server/manage.py runserver 0.0.0.0:8000
# frontend (separate shell), with Wave/.env.local set
cd Wave && npm run dev
```
The frontend now resolves to `HttpRepository` (because `VITE_API_BASE` is set).

### Step 8.2 — Clear stale local state
In the browser devtools console (so old optimistic data doesn't masquerade as backend data):
```js
localStorage.removeItem('wave_progress_records');
localStorage.removeItem('wave_enrolled_students');
localStorage.removeItem('wave_enrolled_teachers');
```

### Step 8.3 — Verify a real round-trip (server-side, not the UI)
1. Log in as the student, submit a topic quiz.
2. Confirm the write hit the DB:
```bash
server/.venv/Scripts/python.exe -c "import sqlite3;print(list(sqlite3.connect('server/db.sqlite3').execute('SELECT student_id,topic_id,score FROM wave_api_quizattempt ORDER BY id DESC LIMIT 5')))"
```
A new row = the backend genuinely received and persisted it. (For Postgres, query via `psql`.)

### Step 8.4 — Verify reads
- Catalog renders (served from DB, not just the bundle): temporarily change a lesson title in the DB and confirm it appears after reload in live mode.
- Teacher dashboard shows the student's real attempt (not a fabricated fallback).

---

# Execution checklist (do in order)

- [ ] **P1.1** Lazy AI imports in `lesson_generation_view.py`
- [ ] **P1.2** `manage.py check` + `runserver` succeed
- [ ] **P1.3** `generate_remediation` accepts both key shapes; `_fallback` returns 3 mock quiz items
- [ ] **P2.1** Add `attempts`, `assigned_student_lrn`, `target_lesson_id` to models
- [ ] **P2.2** Append optional wire fields (no reorder)
- [ ] **P2.3** Emit/persist them in `derive.py` / `ingest.py`
- [ ] **P2.4** `makemigrations` + `migrate`
- [ ] **P3.1** Add `python-dotenv`, `dj-database-url`, `psycopg[binary]` + install
- [ ] **P3.2** `settings.py` reads `.env` + `DATABASE_URL` with SQLite fallback
- [ ] **P4** Create `server/.env`, `server/.env.example`, `Wave/.env.local`
- [ ] **P5** Seed SQLite; (later) create Postgres DB, migrate, load/seed; verify catalog rows
- [ ] **P6** Confirm each endpoint matches the contract tables
- [ ] **P7** Build Postman collection; pass the status-code matrix
- [ ] **P8** Run both, clear localStorage, verify DB round-trip + reads

---

## Appendix — Frozen-frontend field reconciliation (from the alignment audit)

| Field the UI has | Action (backend) |
|---|---|
| `StudentQuizAttempt.attempts` | Add column + optional wire field; persist (P2). Not sent by frozen UI, but schema ready. |
| `TeacherRemediationMaterial.assignedStudentLrn / targetLessonId` | Add columns + optional wire fields (P2). |
| `TeacherRemediationMaterial.targetSubject` | Map to existing `subject` column; expose as optional wire field (P2.2). |
| `StudentProgress.section`, `quizScores` | Already emitted by backend — **do not remove** (positional). UI ignores; harmless. |
| `QuizAttempt.lesson_id` | Already stored; keep. |
| `SubjectCatalog.gradeLevel` | Optional — backend may add to `LessonCatalog`; not required by UI. |

> **Lessons delivery reminder:** Postgres (town) is the catalog **master**; the rural student phone loads lessons/quizzes from the **app bundle** (build-time `import` of `Wave/src/content/*.json`), not from Postgres or the Pi SQLite. The Pi SQLite cache only carries small remediation payloads over LoRa. None of the backend DB work changes how lessons reach field devices.

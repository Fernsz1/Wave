# Wave — Backend Schema & API Reference

**Updated:** 2026-06-21 · generated from the live DB + code (migrations `0001`–`0008` applied).
**Legend:** 🤖 = AI feature / AI-generated data · 🔑 = primary key · 🔗 = foreign key · 📦 = JSON column.

> This single reference supersedes the earlier `DATABASE_SCHEMA.md` and `API_CONTRACT.md`.
> It covers: **(Part 1)** the database schema for **both SQLite and Postgres**, **(Part 2)** every API endpoint, **(Part 3)** all JSON / wire structures, and **(Part 4)** an AI-features map.

---

# Part 1 — Database Schema (SQLite + Postgres)

**One model set, two engines.** The same Django models + migrations drive both. SQLite is the default (offline/dev); Postgres activates when `DATABASE_URL` is set. The *logical* schema is identical; only physical column types differ.

### SQLite ↔ Postgres type mapping
| Django field | SQLite | PostgreSQL |
|---|---|---|
| `CharField(max_length=n)` | `varchar(n)` | `varchar(n)` |
| `IntegerField` | `integer` | `integer` |
| `BooleanField` | `bool` (0/1) | `boolean` |
| `TextField` | `text` | `text` |
| 📦 `JSONField` | `text` + `CHECK(json_valid(...))` | **`jsonb`** |
| Auto PK (`BigAutoField`) | `integer` rowid | `bigint` identity |

> 📦 The JSON columns are the only meaningful difference: SQLite stores them as validated text; Postgres stores native `jsonb`. App code reads/writes whole objects, so behavior is identical.

---

## Tables

### `wave_api_student` — enrolled students
| Column | SQLite | Postgres | Notes |
|---|---|---|---|
| `lrn` 🔑 | varchar(12) | varchar(12) | 12-digit Learner Reference Number |
| `name` | varchar(120) | varchar(120) | |
| `grade_level` | varchar(80) | varchar(80) | e.g. `Grade 6` |
| `section` | varchar(80) | varchar(80) | e.g. `Grade 6 - Section Einstein` |
| `pin` | varchar(6) | varchar(6) | login PIN (demo: plaintext) |

### `wave_api_teacher` — teacher accounts
| Column | SQLite | Postgres | Notes |
|---|---|---|---|
| `teacher_id` 🔑 | varchar(40) | varchar(40) | |
| `name` | varchar(120) | varchar(120) | |
| `department` | varchar(120) | varchar(120) | default `General Academics` |
| `password` | varchar(40) | varchar(40) | login password (demo: plaintext) |

### `wave_api_apitoken` — auth tokens
| Column | SQLite | Postgres | Notes |
|---|---|---|---|
| `key` 🔑 | varchar(64) | varchar(64) | sent as `Authorization: Token <key>` |
| `role` | varchar(10) | varchar(10) | `student` \| `teacher` |
| `principal_id` | varchar(40) | varchar(40) | the lrn or teacher_id |

### `wave_api_catalogdocument` — static lesson catalog (one row per subject)
| Column | SQLite | Postgres | Notes |
|---|---|---|---|
| `subject` 🔑 | varchar(20) | varchar(20) | `science` \| `mathematics` \| `english` |
| `data` 📦 | text(json) | jsonb | full `Lesson[]` tree (lessons → topics → quizzes) |

### `wave_api_quizattempt` — per-student topic quiz attempts
| Column | SQLite | Postgres | Notes |
|---|---|---|---|
| `id` 🔑 | integer | bigint | auto |
| `student_id` 🔗 | varchar(12) | varchar(12) | → `wave_api_student(lrn)` |
| `topic_id` | varchar(40) | varchar(40) | |
| `lesson_id` | varchar(40) | varchar(40) | |
| `score` | integer | integer | |
| `perfect_score` | integer | integer | default 10 |
| `answers` 📦 | text(json) | jsonb | `number[]` of selected option indices |
| `completed_at` | varchar(20) | varchar(20) | `YYYY-MM-DD` |
| `attempts` | integer | integer | retry counter (capped at 3) |

**Constraints:** UNIQUE(`student_id`, `topic_id`) · INDEX(`student_id`).

### `wave_api_summativeresult` — per-student summative exam results
| Column | SQLite | Postgres | Notes |
|---|---|---|---|
| `id` 🔑 | integer | bigint | auto |
| `student_id` 🔗 | varchar(12) | varchar(12) | → `wave_api_student(lrn)` |
| `lesson_id` | varchar(40) | varchar(40) | |
| `score` | integer | integer | |
| `total` | integer | integer | default 20 |
| `percent` | integer | integer | |
| `passed` | bool | boolean | |
| `feedback` | text | text | |
| `failed_items` 📦 | text(json) | jsonb | `FailedItem[]` |
| `attempts` | integer | integer | capped at 3 |

**Constraints:** UNIQUE(`student_id`, `lesson_id`) · INDEX(`student_id`).

### `wave_api_remediationmaterial` 🤖 — AI/teacher generated lesson + remediation store
> This table holds the output of **both AI features** (TeacherHome remedial and the Lesson Wizard). Scalar metadata is plain; 🤖 columns hold AI-generated content.

| Column | SQLite | Postgres | AI? | Notes |
|---|---|---|---|---|
| `material_id` 🔑 | varchar(40) | varchar(40) | | `REM-…` |
| `subject` | varchar(20) | varchar(20) | | |
| `original_topic_id` | varchar(40) | varchar(40) | | source topic (optional for free lessons) |
| `title` | varchar(200) | varchar(200) | 🤖 | lesson title |
| `content` | text | text | 🤖 | lesson body (flattened modules markdown) |
| `teacher_notes` | text | text | 🤖 | notes (folds learning gap + notes list) |
| `created_quiz` 📦 | text(json) | jsonb | 🤖 | `QuizQuestion[]` (remedial feature) |
| `created_summative` 📦 | text(json) | jsonb | 🤖 | `QuizQuestion[]` (remedial feature) |
| `concepts` 📦 | text(json) | jsonb | 🤖 | `[{header_title, explanation}]` lesson modules |
| `learning_gap` | text | text | 🤖 | gap addressed |
| `lesson_number` | integer | integer | 🤖 | |
| `grade_level_section` | varchar(120) | varchar(120) | 🤖 | AI-reported grade/section label |
| `analytics` 📦 | text(json) | jsonb | 🤖 | server-only pedagogical sidecar (never sent over wire) |
| `publish_date` | varchar(20) | varchar(20) | | `YYYY-MM-DD` |
| `target_section` | varchar(80) | varchar(80) | | recipient section |
| `is_published` | bool | boolean | | |
| `assigned_student_lrn` | varchar(12) | varchar(12) | | superset column (UI no longer sends) |
| `target_lesson_id` | varchar(40) | varchar(40) | | superset column (UI no longer sends) |

## Relationships
```
wave_api_student (lrn) ──1:N──▶ wave_api_quizattempt     (UNIQUE per topic_id)
wave_api_student (lrn) ──1:N──▶ wave_api_summativeresult (UNIQUE per lesson_id)
wave_api_catalogdocument   — standalone (keyed by subject)
wave_api_remediationmaterial 🤖 — standalone (keyed by material_id)
wave_api_apitoken          — standalone
```
Plus Django framework tables from migration `0001`: `django_migrations`, `django_content_type`, `auth_*`. (No `django_session`/`admin` — token auth only.)

---

# Part 2 — API Endpoints

**Base:** `http://<host>:8000/api` · **Auth:** only `POST /sync/push` needs `Authorization: Token <key>`.

| # | Method | Path | AI? | Auth | Success | Errors |
|---|---|---|---|---|---|---|
| 1 | POST | `/auth/login` | | none | 200 | 400, 401, 404 |
| 2 | GET | `/roster` | | none | 200 | — |
| 3 | GET | `/catalog?subject=` | | none | 200 | — |
| 4 | GET | `/allprogress` | | none | 200 | — |
| 5 | GET | `/progress/<lrn>` | | none | 200 | 404 |
| 6 | GET | `/rankings?section=&subject=` | | none | 200 | — |
| 7 | GET | `/remediation?section=` | | none | 200 | — |
| 8 | POST | `/remediation/generate` | 🤖 | none | 200 | — |
| 9 | POST | `/sync/push` | | **Token** | 200 | 403 |
| 10 | POST | `/generate-lesson` | 🤖 | none | 200 | 400, 404, 503 |
| 11 | POST | `/submit-feedback` | 🤖 | none | 200 | 400, 404, 503 |

**Used by the UI:** 1,2,3,4,7,8,9. **Dormant** (exist, not called by UI): 5, 6, 10, 11.
🤖 endpoints 10/11 are the deferred AI agent (HITL) path — currently return **503** until the AI deps are installed.

---

# Part 3 — JSON / Wire Structures

Two transport styles:
- **Plain JSON** — `/auth/login`, `/roster`, `/remediation/generate` (objects you read directly).
- **Tokenized (codec)** — `/catalog`, `/allprogress`, `/progress`, `/rankings`, `/remediation`, `/sync/push`. The body carries **positional token arrays** decoded via the shared `protocol/wire_manifest.json`. The *decoded object* shapes are below.

## 3.1 Auth & roster (plain JSON)

**`POST /auth/login` — request (student / teacher)**
```json
{ "role": "student", "lrn": "101234567891", "pin": "123456" }
{ "role": "teacher", "teacherId": "T-2026-001", "password": "password123" }
```
**200 response**
```json
{ "token": "<hex40>", "role": "student",
  "user": { "lrn": "101234567891", "name": "Maria Santos", "gradeLevel": "Grade 6", "section": "Grade 6 - Section Einstein" } }
```
**`GET /roster` — 200**
```json
{ "students": [ { "lrn": "...", "name": "...", "gradeLevel": "...", "section": "...", "pin": "..." } ],
  "teachers": [ { "teacherId": "...", "name": "...", "department": "...", "password": "..." } ] }
```

## 3.2 Tokenized response envelopes
- `GET /catalog` → `{ "type": "LessonCatalog", "tokens": [...] }`
- `GET /allprogress` → `{ "type": "StudentProgress", "records": [[...],[...]] }`
- `GET /progress/<lrn>` → `{ "type": "StudentProgress", "tokens": [...] }`
- `GET /rankings` → `{ "type": "Rankings", "tokens": [...] }`
- `GET /remediation` → `{ "type": "TeacherRemediationMaterial", "items": [[...]] }`
- `POST /sync/push` → request `{ "envelopes": [[...]] }`, response `{ "acks": ["<msgId>"] }`

**SyncEnvelope** — the wrapper every `/sync/push` token array decodes to (the `payload` holds the typed body from §3.3):
```json
{
  "version": 1,
  "msgId": "m-abc123",
  "type": "StudentProgress",          // StudentSignup | TeacherSignup | StudentProgress | StudentSummativeResults | QuizAttemptRequest | Rankings | TeacherRemediationMaterial | LessonCatalog
  "direction": "up",                  // up = device→server, down = server→device
  "subject": "science",               // optional
  "section": "Grade 6 - Section Einstein", // optional
  "createdAt": "2026-06-21",
  "chunkIndex": 0,
  "chunkTotal": 1,
  "payload": [ /* encoded token array of `type` */ ]
}
```

## 3.3 Decoded wire object shapes

**StudentProgress**
```json
{
  "studentLrn": "101234567891",
  "section": "Grade 6 - Section Einstein",
  "completedTopicIds": ["L1-T1"],
  "quizAttempts": { "L1-T1": { "topicId": "L1-T1", "score": 8, "perfectScore": 10, "answers": [0,1,2], "completedAt": "2026-06-21", "attempts": 1, "lessonId": "L1" } },
  "quizScores":   { "L1-T1": { "score": 8, "total": 10, "percent": 80, "passed": true } },
  "summativeScores": { "L1": { "score": 16, "total": 20, "feedback": "...", "attempts": 1, "percent": 80, "passed": true, "failedItems": [] } }
}
```
**StudentSummativeResults**
```json
{ "studentLrn": "101234567891", "section": "Grade 6 - Section Einstein", "lessonId": "L1",
  "score": 16, "total": 20, "percent": 80, "passed": true,
  "failedItems": [ { "questionId": "Q1", "topicId": "L1-T1", "selectedOption": 0, "correctOption": 2 } ] }
```
**Rankings**
```json
{ "section": "Grade 6 - Section Einstein", "subject": "science",
  "standings": [ { "rank": 1, "studentLrn": "...", "name": "...", "score": 42, "perfect": 50, "percent": 84 } ] }
```
**TeacherRemediationMaterial** 🤖 (published lesson/remediation)
```json
{ "id": "REM-ABC123", "originalTopicId": "L1-T1", "title": "Lesson 1: Active vs. Passive Voice",
  "content": "## The Doer vs The Receiver\n...", "teacherNotes": "**Learning Gap:** ...\n• note",
  "createdQuiz": [ /* QuizQuestion[] — empty for the Lesson Wizard */ ],
  "createdSummative": [ /* QuizQuestion[] */ ],
  "publishDate": "2026-06-21", "targetSection": "Grade 6 - Section Einstein",
  "chunks": [], "isPublished": true, "subject": "english" }
```
**LessonCatalog → Lesson → Topic → QuizQuestion**
```json
{ "subject": "science",
  "lessons": [ { "id": "L1", "title": "...", "description": "...",
    "topics": [ { "id": "L1-T1", "name": "...", "description": "...", "readingTime": "5 mins",
      "content": { "introduction": "...", "sections": [ { "title": "...", "body": "...", "codeExample": "?" } ], "definition": { "term": "...", "meaning": "..." }, "keyTakeaway": "...", "importantNote": "?" },
      "quiz": [ { "id": "q1", "question": "...", "options": ["A","B","C","D"], "correctAnswerIndex": 1, "explanation": "..." } ],
      "isCustomRemedial": false } ],
    "summative": [ /* QuizQuestion[] */ ] } ] }
```

## 3.4 🤖 AI generation JSON — `POST /remediation/generate`
Shared by **both** AI features (TeacherHome remedial + Lesson Wizard). Mock today; real Gemini when `GEMINI_API_KEY` set.

**Request** (accepts catalog-driven and/or free-prompt; all combos valid):
```json
{
  "subject": "science",
  "originalTopicId": "L1-T1",
  "topicIds": ["L1-T1", "L1-T2"],
  "prompt": "Create a fun intro to the water cycle",
  "gradeLevel": "Grade 6",
  "section": "Grade 6 - Section Einstein",
  "failedItems": []
}
```
**200 response** (the AI schema the frontend maps):
```json
{
  "lesson_number": 1,
  "lesson_title": "Active vs. Passive Voice",
  "learning_gap": "Students confuse past tense with passive voice.",
  "grade_level_section": "Grade 6 - Section Einstein",
  "teachers_notes": ["Tip 1", "Tip 2"],
  "concepts": [ { "header_title": "The Doer vs. The Receiver", "explanation": "..." } ],
  "summative_test": [ { "question": "...", "choices": ["A","B","C"], "correct_answer": "B" } ]
}
```
**Frontend mapping:** `lesson_title`→title · `concepts[]`→`sections[]`/content · `teachers_notes`+`learning_gap`→teacherNotes · `summative_test[]`→createdQuiz (`choices`→options, `correct_answer`→correctAnswerIndex). The **Lesson Wizard ignores** `summative_test` (lesson-only); **TeacherHome remedial uses** it.

## 3.5 🤖 AI agent HITL — `/generate-lesson`, `/submit-feedback` (deferred → 503)
```json
// POST /generate-lesson — REQUEST (failed_items min length 1)
{ "subject": "science", "grade_level": 6, "original_topic_id": "L1-T1",
  "topic": "", "lesson_context": "", "target_section": "Grade 6 - Section Einstein",
  "failed_items": [ { "questionId": "Q1", "topicId": "L1-T1", "selectedOption": 0, "correctOption": 2 } ] }
// POST /generate-lesson — 200 (when AI installed)
{ "session_id": "uuid", "draft_lesson": { ... }, "ai_evaluation_remarks": "..." }

// POST /submit-feedback — REQUEST (feedback ∈ PASS | simplify | practical | change | micro)
{ "session_id": "uuid", "feedback": "PASS", "material_id": "" }
// POST /submit-feedback — 200
{ "status": "completed" | "needs_review", ... }

// CURRENT STATE for both (AI deps not installed):  → 503
{ "detail": "AI lesson generation is not available (AI dependencies not installed)." }
```

## 3.6 Up-write payloads — `POST /sync/push`
What the frontend sends (the `payload` inside the SyncEnvelope, by `type`). Each is encoded to a token array; decoded shapes shown.

**`StudentProgress`** — save a topic quiz attempt (`saveQuizAttempt`):
```json
{ "studentLrn": "101234567891", "section": "Grade 6 - Section Einstein",
  "completedTopicIds": ["L1-T1"],
  "quizAttempts": { "L1-T1": { "topicId": "L1-T1", "score": 8, "perfectScore": 10, "answers": [0,1,2], "completedAt": "2026-06-21" } },
  "quizScores": {}, "summativeScores": {} }
```
**`StudentSummativeResults`** — save a summative result (`saveSummativeResult`):
```json
{ "studentLrn": "101234567891", "section": "Grade 6 - Section Einstein", "lessonId": "L1",
  "score": 16, "total": 20, "percent": 80, "passed": true, "failedItems": [], "feedback": "Good job! ..." }
```
**`StudentSignup`** — enroll a student (`enrollStudent`):
```json
{ "lrn": "101234567899", "name": "Juan Dela Cruz", "gradeLevel": "Grade 6", "section": "Grade 6 - Section Einstein", "pin": "123456" }
```
**`TeacherRemediationMaterial`** — publish a lesson/remediation (`publishRemediation`): see §3.3 / §4.1 / §4.2.

Response for all: `{ "acks": ["<msgId>", ...] }`. Requires `Authorization: Token <key>`.

---

# Part 4 — 🤖 AI Features Map

There are **2 teacher-facing AI features**, both calling **one** endpoint (`POST /remediation/generate`), plus a **deferred** agent path.

| | Feature 1 — Remedial (TeacherHome) | Feature 2 — Lesson Wizard |
|---|---|---|
| Component | `TeacherHome.tsx` "Custom AI Remedial Architect" | `LessonWizard.tsx` "Copilot Lesson Generator" |
| Produces | **Lesson + Quiz** (+ summative) | **Lesson only** (no quiz) |
| Inputs | section + topic, gap/failed-items focused | grade, section, subject, lesson, **multi-topic**, **free prompt** |
| Endpoint | `POST /remediation/generate` 🤖 | `POST /remediation/generate` 🤖 |
| Publishes | `TeacherRemediationMaterial` (quiz populated) | `TeacherRemediationMaterial` (`createdQuiz: []`) |
| Schema fields used 🤖 | title, content, teacher_notes, **created_quiz**, **created_summative**, concepts, learning_gap, lesson_number | title, content, teacher_notes, **concepts**, learning_gap, lesson_number |

> Neither feature has its own endpoint — both use the **shared** `/remediation/generate` (generate) and `/sync/push` (publish). The per-feature request/response payloads are below.

## 4.1 Feature 1 — Remedial (TeacherHome)

### 4.1.A Generate — `POST /remediation/generate`

**Request**
```json
{
  "subject": "science",
  "originalTopicId": "L1-T1",
  "studentName": "Grade 6 - Section Einstein",
  "failedItems": ["Q text 1", "Q text 2"]
}
```
**Response — 200** (AI schema; this feature **uses** `summative_test` → quiz)
```json
{
  "lesson_number": 1,
  "lesson_title": "...",
  "learning_gap": "...",
  "grade_level_section": "Grade 6 - Section Einstein",
  "teachers_notes": ["..."],
  "concepts": [ { "header_title": "...", "explanation": "..." } ],
  "summative_test": [ { "question": "...", "choices": ["A","B","C","D"], "correct_answer": "B" } ]
}
```

### 4.1.B Publish — `POST /sync/push`

**Request** (`SyncEnvelope.payload`, type `TeacherRemediationMaterial` — quiz **populated**)
```json
{
  "id": "REM-…",
  "originalTopicId": "L1-T1",
  "title": "Lesson 1: …",
  "content": "## …",
  "teacherNotes": "…",
  "createdQuiz": [ /* QuizQuestion[] — POPULATED */ ],
  "createdSummative": [ /* QuizQuestion[] */ ],
  "publishDate": "2026-06-21",
  "targetSection": "Grade 6 - Section Einstein",
  "chunks": [],
  "isPublished": true,
  "subject": "science"
}
```
**Response — 200**
```json
{ "acks": ["<msgId>"] }
```

---

## 4.2 Feature 2 — Lesson Wizard (`LessonWizard.tsx`)

### 4.2.A Generate — `POST /remediation/generate`

**Request** (multi `topicIds` + free `prompt`, no `failedItems`)
```json
{
  "subject": "english",
  "originalTopicId": "L-ENG1-T1",
  "topicIds": ["L-ENG1-T1", "L-ENG1-T2"],
  "prompt": "Create an engaging lesson on active vs. passive voice with Filipino examples",
  "gradeLevel": "Grade 6",
  "section": "Grade 6 - Section Einstein",
  "failedItems": []
}
```
**Response — 200** (same AI schema; this feature **ignores** `summative_test`, maps `concepts` → `sections`)
```json
{
  "lesson_number": 1,
  "lesson_title": "Active vs. Passive Voice",
  "learning_gap": "...",
  "grade_level_section": "Grade 6 - Section Einstein",
  "teachers_notes": ["..."],
  "concepts": [ { "header_title": "The Doer vs. The Receiver", "explanation": "..." } ],
  "summative_test": [ /* present, but the Lesson Wizard does NOT use it */ ]
}
```
> Frontend maps `concepts[]` → editable `sections[{title, body}]`; `teachers_notes`+`learning_gap` → notes; **quiz is dropped**.

### 4.2.B Publish — `POST /sync/push`

**Request** (`SyncEnvelope.payload`, type `TeacherRemediationMaterial` — quiz **always empty**)
```json
{
  "id": "REM-…",
  "originalTopicId": "L-ENG1-T1",
  "title": "Lesson 1: Active vs. Passive Voice",
  "content": "## The Doer vs. The Receiver\n…\n\n## …",
  "teacherNotes": "**Learning Gap:** …\n• …",
  "createdQuiz": [],
  "createdSummative": [],
  "publishDate": "2026-06-21",
  "targetSection": "Grade 6 - Section Einstein",
  "chunks": [],
  "isPublished": true,
  "subject": "english"
}
```
**Response — 200**
```json
{ "acks": ["<msgId>"] }
```

**AI-related schema:** the entire `wave_api_remediationmaterial` 🤖 table (esp. `created_quiz`, `created_summative`, `concepts`, `learning_gap`, `lesson_number`, `grade_level_section`, `analytics`).

**AI-related endpoints:** `POST /remediation/generate` 🤖 (active, mock), `POST /generate-lesson` 🤖 + `POST /submit-feedback` 🤖 (deferred HITL → 503).

**Current AI status:** **mock mode** — `GEMINI_API_KEY` blank and the agent stack (pydantic/langgraph/langchain) not installed. `/remediation/generate` returns deterministic mock output in the exact schema above; the HITL endpoints return 503. Installing the deps + key activates real generation with **no schema or contract changes**.

---

# Part 5 — Postman Quick-Test (copy-paste ready)

Runs on **SQLite** (no Postgres needed). Start: `cd server && .venv/Scripts/python.exe manage.py runserver 0.0.0.0:8000`.
All bodies use header `Content-Type: application/json`. Only `/sync/push` also needs `Authorization: Token <token>`.

## 5.1 Absolute URLs

| Method | URL | Body? |
|---|---|---|
| POST | `http://localhost:8000/api/auth/login` | yes (§5.2) |
| GET | `http://localhost:8000/api/roster` | — |
| GET | `http://localhost:8000/api/catalog?subject=science` | — |
| GET | `http://localhost:8000/api/allprogress` | — |
| GET | `http://localhost:8000/api/progress/101234567891` | — |
| GET | `http://localhost:8000/api/rankings?section=Grade 6 - Section Einstein&subject=science` | — |
| GET | `http://localhost:8000/api/remediation?section=Grade 6 - Section Einstein` | — |
| POST | `http://localhost:8000/api/remediation/generate` | yes (§5.3) |
| POST | `http://localhost:8000/api/sync/push` | yes (§5.4) **+ Token header** |
| POST | `http://localhost:8000/api/generate-lesson` | yes → 503 |
| POST | `http://localhost:8000/api/submit-feedback` | yes → 503 |

## 5.2 Login — get the token first
`POST http://localhost:8000/api/auth/login`
```json
{ "role": "student", "lrn": "101234567891", "pin": "123456" }
```
```json
{ "role": "teacher", "teacherId": "T-2026-001", "password": "password123" }
```
Copy `token` from the response → use it in §5.4.

## 5.3 Generate (both AI features)
`POST http://localhost:8000/api/remediation/generate`

Remedial (TeacherHome):
```json
{ "subject": "science", "originalTopicId": "L-SCI1-T1", "studentName": "Grade 6 - Section Einstein", "failedItems": [] }
```
Lesson Wizard:
```json
{ "subject": "english", "topicIds": ["L-ENG1-T1","L-ENG1-T2"], "prompt": "Active vs passive voice with Filipino examples", "gradeLevel": "Grade 6", "section": "Grade 6 - Section Einstein", "failedItems": [] }
```

## 5.4 `POST /sync/push` — ready-to-paste encoded bodies
`POST http://localhost:8000/api/sync/push` · Headers: `Content-Type: application/json` **and** `Authorization: Token <token-from-5.2>`
These are already codec-encoded — paste exactly. Response: `{ "acks": ["<msgId>"] }`.

**Save quiz attempt:**
```json
{"envelopes": [[1, "m-quiz-1", 2, 0, 0, "Grade 6 - Section Einstein", "2026-06-21", 0, 1, ["101234567891", "Grade 6 - Section Einstein", ["L-SCI1-T1"], [["L-SCI1-T1", ["L-SCI1-T1", 8, 10, [0, 1, 2, 3, 0, 1, 2, 3, 0, 1], "2026-06-21"]]], [], []]]]}
```
**Save summative result:**
```json
{"envelopes": [[1, "m-summ-1", 3, 0, 0, "Grade 6 - Section Einstein", "2026-06-21", 0, 1, ["101234567891", "Grade 6 - Section Einstein", "L-SCI1", 16, 20, 80, true, []]]]}
```
**Enroll a student:**
```json
{"envelopes": [[1, "m-enroll-1", 0, 0, null, "Grade 6 - Section Einstein", "2026-06-21", 0, 1, ["101234567899", "Juan Dela Cruz", "Grade 6", "Grade 6 - Section Einstein", "123456"]]]}
```
**Publish a remediation/lesson:**
```json
{"envelopes": [[1, "m-pub-1", 6, 0, 0, "Grade 6 - Section Einstein", "2026-06-21", 0, 1, ["REM-POSTMAN1", "L-SCI1-T1", "Lesson 1: Demo", "## Intro\nbody", "notes", [], [], "2026-06-21", "Grade 6 - Section Einstein", [], true, 0]]]}
```

## 5.5 AI HITL (currently 503)
`POST http://localhost:8000/api/generate-lesson`
```json
{ "subject": "science", "grade_level": 6, "original_topic_id": "L-SCI1-T1", "failed_items": [ { "q": "x" } ] }
```
`POST http://localhost:8000/api/submit-feedback`
```json
{ "session_id": "x", "feedback": "PASS" }
```
Both → `503 { "detail": "AI lesson generation is not available (AI dependencies not installed)." }`.

> Note: topic IDs here are illustrative — for writes/generates tied to real topics, pull actual IDs from `GET /catalog?subject=science` first. `101234567891` is the seeded demo student.

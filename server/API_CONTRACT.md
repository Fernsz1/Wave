# Wave — API Contract

**Base URL:** `http://localhost:8000/api` (dev). Set the frontend's `VITE_API_BASE` to the host (no `/api`).
**Verified:** 2026-06-21 against the live code (every status code below was exercised, not assumed).
**Auth:** custom token. Only `POST /sync/push` requires it: header `Authorization: Token <key>` (key from `POST /auth/login`).
**Content-Type:** `application/json` for all POST bodies.

> **Tokenized vs plain-JSON.** Some responses carry **positional token arrays** (the LoRa/MQTT wire codec) rather than plain objects — fields are decoded by position from `protocol/wire_manifest.json`. These are marked **(tokenized)** and the frontend runs `decode(<Type>, tokens)`. All other endpoints are plain JSON.

---

## Endpoint summary

| # | Method | Path | Auth | Success | Errors |
|---|---|---|---|---|---|
| 1 | POST | `/auth/login` | none | 200 | 400, 401, 404 |
| 2 | GET | `/roster` | none | 200 | — |
| 3 | GET | `/catalog?subject=` | none | 200 | — |
| 4 | GET | `/allprogress` | none | 200 | — |
| 5 | GET | `/progress/<lrn>` | none | 200 | 404 |
| 6 | GET | `/rankings?section=&subject=` | none | 200 | — |
| 7 | GET | `/remediation?section=` | none | 200 | — |
| 8 | POST | `/remediation/generate` | none | 200 (mock) | — |
| 9 | POST | `/sync/push` | **Token** | 200 | 403 |
| 10 | POST | `/generate-lesson` | none | 200 | 400, 404, **503** |
| 11 | POST | `/submit-feedback` | none | 200 | 400, 404, **503** |

---

## 1. `POST /auth/login`
Authenticate a student (LRN + PIN) or teacher (teacherId + password); returns a token.

**Request — student**
```json
{ "role": "student", "lrn": "101234567891", "pin": "123456" }
```
**Request — teacher**
```json
{ "role": "teacher", "teacherId": "T-2026-001", "password": "password123" }
```
**200 — student**
```json
{ "token": "<hex40>", "role": "student",
  "user": { "lrn": "101234567891", "name": "Maria Santos", "gradeLevel": "Grade 6", "section": "Grade 6 - Section Einstein" } }
```
**200 — teacher**
```json
{ "token": "<hex40>", "role": "teacher",
  "user": { "teacherId": "T-2026-001", "name": "Mrs. Elena Santos", "department": "General Academics" } }
```
**Errors** (all `{ "error": "<message>" }`): `400` unknown role / missing teacher creds · `401` wrong PIN/password · `404` LRN or teacherId not found.

---

## 2. `GET /roster`
Full student + teacher lists (used for login validation / bootstrap).

**200**
```json
{
  "students": [ { "lrn": "101234567891", "name": "Maria Santos", "gradeLevel": "Grade 6", "section": "Grade 6 - Section Einstein", "pin": "123456" } ],
  "teachers": [ { "teacherId": "T-2026-001", "name": "Mrs. Elena Santos", "department": "General Academics", "password": "password123" } ]
}
```

---

## 3. `GET /catalog?subject=<subject>`  (tokenized)
The lesson catalog for one subject.

**Query:** `subject` ∈ `science | mathematics | english` (default `science` if omitted).
**200**
```json
{ "type": "LessonCatalog", "tokens": [ /* positional token array */ ] }
```
Frontend: `decode('LessonCatalog', tokens).lessons` → `Lesson[]`. Empty `tokens` if the subject has no catalog row.

---

## 4. `GET /allprogress`  (tokenized)
Every student's progress (teacher bootstrap).

**200**
```json
{ "type": "StudentProgress", "records": [ [ /* tokens */ ], [ /* tokens */ ] ] }
```
Frontend decodes each array with `decode('StudentProgress', tokens)`.

---

## 5. `GET /progress/<lrn>`  (tokenized)
One student's progress.

**200** `{ "type": "StudentProgress", "tokens": [ /* tokens */ ] }`
**404** `{ "error": "not found" }` (unknown LRN).

---

## 6. `GET /rankings?section=<section>&subject=<subject>`  (tokenized)
Section leaderboard for a subject.

**Query:** `section` (e.g. `Grade 6 - Section Einstein`), `subject` (default `science`).
**200** `{ "type": "Rankings", "tokens": [ /* tokens */ ] }` → decodes to `{ section, subject, standings: Standing[] }`.

---

## 7. `GET /remediation?section=<section>`  (tokenized)
Published remediation materials, optionally filtered to a section (also includes "All Sections" + blank-section broadcasts).

**Query:** `section` (optional).
**200**
```json
{ "type": "TeacherRemediationMaterial", "items": [ [ /* tokens */ ] ] }
```
Each item decodes to a `TeacherRemediationMaterial` (id, originalTopicId, title, content, teacherNotes, createdQuiz, createdSummative?, publishDate, targetSection, chunks, isPublished, subject?, assignedStudentLrn?, targetLessonId?).

---

## 8. `POST /remediation/generate`  (MOCK while AI deferred)
Generate a remedial lesson + quiz. Returns a deterministic mock today (no Gemini key / AI stack). Accepts **both** request shapes the UI uses.

**Request (repo shape)**
```json
{ "subject": "science", "originalTopicId": "L1-T2", "studentName": "Grade 6 - Section Einstein", "failedItems": [] }
```
**Request (wizard shape — also accepted)**
```json
{ "subject": "science", "topicId": "L1-T2", "studentLrn": "101234567891", "section": "Grade 6 - Section Einstein", "topicName": "...", "gradeLevel": "Grade 6", "failedItems": [] }
```
Backend reads `originalTopicId || topicId` and `studentName || section`.

**200** — AI schema the frontend maps:
```json
{
  "lesson_number": 1,
  "lesson_title": "Remedial Review: L1-T2 (Science)",
  "learning_gap": "...",
  "grade_level_section": "Grade 6 - Section Einstein",
  "teachers_notes": ["...", "..."],
  "concepts": [ { "header_title": "...", "explanation": "..." } ],
  "summative_test": [ { "question": "...", "choices": ["A","B","C","D"], "correct_answer": "B" } ]
}
```
Frontend maps: `lesson_title`→title, `concepts[]`→content (markdown), `teachers_notes`+`learning_gap`→teacherNotes, `summative_test[]`→createdQuiz (`choices`→options, `correct_answer`→correctAnswerIndex). Always `200` in mock mode.

---

## 9. `POST /sync/push`  (tokenized, **AUTH REQUIRED**)
The single "up" write path. Body is a list of **encoded envelope token arrays**.

**Headers:** `Authorization: Token <key>` + `Content-Type: application/json`.
**Request**
```json
{ "envelopes": [ [ /* encoded envelope token array */ ] ] }
```
Envelope `type` values the UI sends: `StudentProgress` (quiz attempt), `StudentSummativeResults`, `TeacherRemediationMaterial` (publish), `StudentSignup` (enroll).
**200** `{ "acks": ["<msgId>", ...] }`
**403** `{ "detail": "Authentication credentials were not provided." }` — missing **or invalid** token.

> Don't hand-build the token array. Capture a real one from the browser Network tab, or generate it with the Python codec (`codec.encode_envelope(...)`). Empty `{ "envelopes": [] }` returns `{ "acks": [] }`.

---

## 10. `POST /generate-lesson`  (AI HITL — deferred)
Starts the agent lesson-generation session. **Not used by the current UI** (UI uses #8).

**Request** (validated): `{ "subject": "science", "grade_level": 6, "original_topic_id": "L1-T2", "failed_items": [ { ... } ] }` (`failed_items` min length 1).
**200** `{ "session_id": "...", "draft_lesson": {...}, "ai_evaluation_remarks": "..." }`
**400** serializer errors · **404** session not found · **503** `{ "detail": "AI lesson generation is not available (AI dependencies not installed)." }` (current state until the AI stack is installed).

---

## 11. `POST /submit-feedback`  (AI HITL — deferred)
Applies teacher feedback to a session; on `PASS`, finalizes + persists. **Not used by the current UI.**

**Request:** `{ "session_id": "...", "feedback": "PASS" | "simplify" | "practical" | "change" | "micro", "material_id": "" }`
**200** `{ "status": "completed" | "needs_review", ... }`
**400** invalid feedback choice · **404** session missing · **503** AI deps absent.

---

## HTTP status-code reference (verified)

| Code | Meaning in Wave | Where |
|---|---|---|
| **200 OK** | Success (reads, accepted writes, mock generate) | all |
| **400 Bad Request** | Missing role / invalid serializer body | login, generate-lesson, submit-feedback |
| **401 Unauthorized** | Wrong PIN / password | login |
| **403 Forbidden** | Missing or invalid `Token` on a protected route | sync/push |
| **404 Not Found** | Unknown LRN / teacher / session | login, progress, generate/submit |
| **503 Service Unavailable** | AI dependencies not installed | generate-lesson, submit-feedback |

> Note: there is no `201 Created` — writes go through the tokenized `POST /sync/push` envelope path and return `200` with `acks`, not a REST resource creation.

---

## Notes for Postman (Phase 7)
- Create an environment with `base = http://localhost:8000/api` and `token` (empty).
- In `POST /auth/login` → Tests: `pm.environment.set("token", pm.response.json().token)`.
- For `POST /sync/push`, add header `Authorization: Token {{token}}` and use a captured envelope array as the body.
- Assert codes per the table above (e.g. `pm.response.to.have.status(200)`; bad-PIN login → 401; no-token push → 403).

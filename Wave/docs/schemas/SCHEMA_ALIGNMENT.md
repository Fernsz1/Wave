# Schema Alignment Report — Wave Backend ↔ Frontend

**Scope:** Django `wave_api` models & API responses vs. `Wave/src` TypeScript types/clients.
**Date:** 2026-06-18 · **Branch:** `chore/assess-backend`

The architecture has four layers:

1. **Backend DB** — `server/wave_api/models.py` (snake_case Django fields)
2. **Wire protocol** — `protocol/wire_manifest.json` (canonical camelCase, positional codec); backend `derive.py`/`views.py` translate DB→wire
3. **Frontend wire schemas** — `Wave/src/schemas/index.ts` (Zod, mirror of manifest)
4. **Frontend UI types** — `Wave/src/types.ts` (what components actually consume)

> Translation between snake_case DB fields and camelCase wire fields happens server-side in `server/wave_api/derive.py`, `server/wave_api/views.py`, and `server/wave_api/ingest.py`. "🟡 Mappable" below means the rename/transform is **already wired** unless the discrepancy note says otherwise. "🔴" means a field is dropped, unmapped, or actively mismatched at runtime.

## 1. `Student` → `StudentUser`

| Backend Attribute | Current Frontend Attribute | Status | Target UI / Page |
|---|---|---|---|
| `lrn: CharField` (PK) | `lrn: string` | 🟢 Aligned | LoginScreen, App, all Student* + Teacher* views |
| `name: CharField` | `name: string` | 🟢 Aligned | StudentProfile, TeacherStudents, StudentRankings |
| `grade_level: CharField` | `gradeLevel: string` | 🟡 Mappable | StudentProfile, StudentHome — snake→camel; handled in `roster()`/`login()` |
| `section: CharField` (required) | `section?: string` (optional) | 🟡 Mappable | StudentRankings, TeacherStudents — backend always sets it; FE treats as optional w/ fallback to `gradeLevel` |
| `pin: CharField` | `pin?: string` (optional) | 🟡 Mappable | LoginScreen — `roster()` exposes plaintext PIN to FE (security note); FE only uses it in Mock repo |

## 2. `Teacher` → `TeacherUser`

| Backend Attribute | Current Frontend Attribute | Status | Target UI / Page |
|---|---|---|---|
| `teacher_id: CharField` (PK) | `teacherId: string` | 🟡 Mappable | LoginScreen, TeacherProfile — snake→camel, handled in views |
| `name: CharField` | `name: string` | 🟢 Aligned | TeacherProfile, TeacherHome |
| `department: CharField` | `department: string` | 🟢 Aligned | TeacherProfile |
| `password: CharField` | `password?: string` | 🟡 Mappable | LoginScreen — `roster()` exposes plaintext password to FE (security note) |

## 3. `QuizAttempt` → `StudentQuizAttempt` (inside `StudentProgress.quizAttempts`)

| Backend Attribute | Current Frontend Attribute | Status | Target UI / Page |
|---|---|---|---|
| `topic_id: CharField` | `topicId: string` | 🟡 Mappable | StudentLessons, StudentProgressRep — snake→camel via `assemble_progress` |
| `score: IntegerField` | `score: number` | 🟢 Aligned | StudentLessons, TeacherAnalytics |
| `perfect_score: IntegerField` | `perfectScore: number` | 🟡 Mappable | StudentLessons — snake→camel |
| `answers: JSONField` | `answers: number[]` | 🟢 Aligned | RemediationWizard (derives failedItems), StudentLessons |
| `completed_at: CharField` | `completedAt: string` | 🟡 Mappable | StudentProgressRep — snake→camel |
| `lesson_id: CharField` | *(none)* | 🔴 Action Required | Stored on the row but absent from wire `StudentQuizAttempt` def and `types.ts`; never surfaced |
| *(none — no DB column)* | `attempts?: number` (max 3) | 🔴 Action Required | StudentLessons reads `attempt.attempts` to gate retries, but `assemble_progress` never emits it for topic quizzes → always `undefined` |

## 4. `SummativeResult` → `StudentProgress.summativeScores` + `StudentSummativeResults` wire

| Backend Attribute | Current Frontend Attribute | Status | Target UI / Page |
|---|---|---|---|
| `lesson_id: CharField` | map key / `lessonId: string` | 🟡 Mappable | StudentLessons, StudentProgressRep |
| `score: IntegerField` | `score: number` | 🟢 Aligned | StudentProgressRep |
| `feedback: TextField` | `feedback: string` | 🟢 Aligned | StudentProgressRep |
| `attempts: IntegerField` | `attempts?: number` | 🟢 Aligned | StudentLessons (gates summative retries) |
| `total: IntegerField` | `perfectScore: number` (in map) **/** `total` (in `StudentSummativeResults`) | 🟡 Mappable | StudentProgressRep — **same DB field renamed two different ways**: `perfectScore` in `summativeScores`, `total` in the results wire |
| `percent: IntegerField` | *(none in `summativeScores`)* | 🔴 Action Required | Present only on `StudentSummativeResults`; dropped from the `StudentProgress.summativeScores` shape the UI consumes |
| `passed: BooleanField` | *(none in `summativeScores`)* | 🔴 Action Required | Dropped from `summativeScores`; UI re-derives pass/fail client-side from score |
| `failed_items: JSONField` | *(none in `summativeScores`)* | 🔴 Action Required | Carried on `StudentSummativeResults` wire but never reaches `types.ts`; RemediationWizard rebuilds failedItems from raw `answers` instead |

## 5. `StudentProgress` envelope (derive vs. UI type)

| Backend Attribute | Current Frontend Attribute | Status | Target UI / Page |
|---|---|---|---|
| `studentLrn` | `studentLrn: string` | 🟢 Aligned | TeacherStudents, App progress map |
| `completedTopicIds` | `completedTopicIds: string[]` | 🟢 Aligned | StudentHome, StudentLessons |
| `quizAttempts` (map) | `quizAttempts: Record<string, StudentQuizAttempt>` | 🟢 Aligned | StudentLessons |
| `section` (emitted by `assemble_progress`) | *(not in `StudentProgress` type)* | 🟡 Mappable | Present at runtime (Zod schema requires it) but missing from `types.ts`; survives only via `as unknown as` cast in `httpRepository.ts` |
| `quizScores` (map, emitted + Zod-required) | *(not in `StudentProgress` type)* | 🔴 Action Required | Backend computes `{score,total,percent,passed}` per topic; UI type omits it entirely, so components recompute scores themselves |

## 6. `RemediationMaterial` → `TeacherRemediationMaterial`

| Backend Attribute | Current Frontend Attribute | Status | Target UI / Page |
|---|---|---|---|
| `material_id: CharField` (PK) | `id: string` | 🟡 Mappable | StudentLessons, TeacherHome — renamed in `remediation()` view |
| `original_topic_id` | `originalTopicId: string` | 🟡 Mappable | RemediationWizard, StudentLessons |
| `title` / `content` | `title` / `content: string` | 🟢 Aligned | StudentLessons (remedial render) |
| `teacher_notes` | `teacherNotes: string` | 🟡 Mappable | TeacherHome |
| `created_quiz: JSONField` | `createdQuiz: QuizQuestion[]` | 🟡 Mappable | StudentLessons (remedial quiz) |
| `created_summative: JSONField` | `createdSummative?: QuizQuestion[]` | 🔴 Action Required | `remediation()` GET maps it, but the agent finalize path `lesson_generation_view.py` **does not persist it** → null on agent-generated packs |
| `publish_date` | `publishDate: string` | 🟡 Mappable | StudentLessons |
| `target_section` | `targetSection?: string` | 🟡 Mappable | StudentLessons, TeacherHome |
| `is_published: BooleanField` | `isPublished: boolean` | 🟡 Mappable | TeacherHome |
| `subject: CharField` | `targetSubject?: string` | 🔴 Action Required | DB stores subject, but wire payload omits it (carried on envelope); `toInternalRemediation` never sets `targetSubject` → **always `undefined`** |
| `analytics: JSONField` | *(none — server-only)* | 🟢 Aligned | By design: pedagogical sidecar, never sent over wire |
| *(none)* | `assignedStudentLrn: string` | 🔴 Action Required | No backend source; hardcoded to `''` in `toInternalRemediation` |
| *(none)* | `targetLessonId?: string` | 🔴 Action Required | "Which lesson's summative this replaces" — no backend field; unpopulated |

## 7. Static catalog `CatalogDocument.data` → `Lesson` / `Topic` / `QuizQuestion`

| Backend Attribute | Current Frontend Attribute | Status | Target UI / Page |
|---|---|---|---|
| `Lesson{id,title,description,topics,summative}` | identical | 🟢 Aligned | StudentLessons, TeacherHome — round-trips through manifest |
| `Topic{id,name,description,readingTime,content,quiz,isCustomRemedial}` | identical | 🟢 Aligned | StudentLessons, TeacherAnalytics — field order differs in manifest but codec is positional & consistent |
| `QuizQuestion{id,question,options,correctAnswerIndex,explanation}` | identical | 🟢 Aligned | StudentLessons, RemediationWizard |

## 8. AI generation endpoints (snake_case AI schema, not the wire codec)

| Backend Attribute | Current Frontend Attribute | Status | Target UI / Page |
|---|---|---|---|
| `ai.generate_remediation` → `lesson_title` | `title` | 🟡 Mappable | RemediationWizard — transformed in 2 places (`RemediationWizard.tsx` **and** `httpRepository.ts`, duplicated) |
| `concepts[{header_title,explanation}]` | `content: string` (markdown) | 🟡 Mappable | RemediationWizard — flattened to markdown client-side |
| `teachers_notes: string[]` + `learning_gap` | `teacherNotes: string` | 🟡 Mappable | RemediationWizard — joined into one string; `learning_gap`/`lesson_number`/`grade_level_section` otherwise dropped |
| `summative_test[{question,choices,correct_answer}]` | `createdQuiz: QuizQuestion[]` | 🟡 Mappable | RemediationWizard — `correct_answer` string → `correctAnswerIndex` via `indexOf` |
| view reads `originalTopicId`, `studentName` | RemediationWizard POSTs `topicId`, `studentLrn`, `topicName` | 🔴 Action Required | **Key-name mismatch:** `views.py` reads `originalTopicId`/`studentName`; the component sends `topicId`/`studentLrn` → `topic_id=""` and `student_name="your class"` |
| `lesson_generation_view` (`/generate-lesson`, `/submit-feedback`): `session_id`, `draft_lesson`, `ai_evaluation_remarks` | *(no consumer)* | 🔴 Action Required | The new agent/orchestrator HITL flow is **never called by the frontend**; RemediationWizard still uses legacy single-shot `/api/remediation/generate` |

---

# Prioritized Action Items

### 🔴 Action Required (blocking / runtime-incorrect)

1. **Fix `generate_remediation` request keys (real bug).** In `RemediationWizard.tsx`, rename the POST body keys `topicId`→`originalTopicId` and `studentLrn`→`studentName` (or send the section name), matching `views.py`. Today the AI generates against an empty topic and "your class". **Better:** route the component through `repo.generateRemediation()` (which already uses the correct keys) and delete the duplicated `fetch` + mapping block.

2. **`StudentQuizAttempt.attempts` has no backend source.** StudentLessons gates topic-quiz retries (max 3) on `attempt.attempts`, but `assemble_progress` never emits it. Either add an `attempts` IntegerField to `QuizAttempt` (increment in `ingest._save_progress`, emit in `derive.assemble_progress` + `wire_manifest` `StudentQuizAttempt` def + Zod schema), or remove the retry gate. Decide before relying on the limit.

3. **`targetSubject` always `undefined`.** Add `subject` to the `TeacherRemediationMaterial` wire payload (or have `toInternalRemediation` in `httpRepository.ts` read it from the envelope) and set `targetSubject`. Otherwise remedial packs can't be filtered by subject on the client.

4. **`assignedStudentLrn` / `targetLessonId` are dead frontend fields.** Both are unmapped (`assignedStudentLrn` hardcoded to `''`, `targetLessonId` never set). Either persist them on `RemediationMaterial` + wire, or remove them from `TeacherRemediationMaterial` in `types.ts`.

5. **Agent finalize drops `created_summative`.** `lesson_generation_view.py` saves only `created_quiz`. Add `"created_summative": [...]` to the `update_or_create` defaults so AI-finalized packs match the `remediation()` GET shape.

6. **Decide on the unused agent HITL endpoints.** `/generate-lesson` and `/submit-feedback` (`lesson_generation_view.py`) plus the whole `agents/orchestrator` are not consumed. Either migrate RemediationWizard to the session-based flow (`session_id` → `draft_lesson` → feedback loop → PASS) or mark the legacy `/api/remediation/generate` path as canonical and archive the agent endpoints.

7. **`quizScores` dropped from UI type.** Backend emits per-topic `{score,total,percent,passed}` and Zod requires it, but `StudentProgress` in `types.ts` omits it, so the cast in `httpRepository.ts` silently discards it and components recompute. Add `quizScores: Record<string, QuizScore>` to the type and consume it, or document the recompute as intentional.

8. **`summativeScores` loses `passed` / `percent` / `failedItems`.** The UI `summativeScores` entry only has `{score,perfectScore,feedback,attempts}`. RemediationWizard rebuilds failed items from raw `answers` with `correctOption: 0` hardcoded — inaccurate. Surface the persisted `failed_items` (and `passed`/`percent`) into the progress shape so remediation targets real misses.

### 🟡 Mappable (rename/transform — verify & de-duplicate)

9. **De-duplicate the AI-response mapping.** Identical `lesson_title→title`, `concepts→content`, `teachers_notes→teacherNotes`, `summative_test→createdQuiz` logic lives in both `RemediationWizard.tsx` and `httpRepository.ts`. Keep one (the repository) and have the component call it.

10. **Normalize `total` vs `perfectScore`.** The single DB field `SummativeResult.total` is exposed as `perfectScore` in `summativeScores` but `total` in `StudentSummativeResults`. Pick one name across the manifest/Zod/types to avoid confusion.

11. **snake→camel renames (already handled, no code change needed, listed for traceability):** `grade_level→gradeLevel`, `teacher_id→teacherId`, `topic_id→topicId`, `perfect_score→perfectScore`, `completed_at→completedAt`, `material_id→id`, `original_topic_id→originalTopicId`, `teacher_notes→teacherNotes`, `created_quiz→createdQuiz`, `publish_date→publishDate`, `target_section→targetSection`, `is_published→isPublished`. Confirm any **new** field added in future follows the same `derive.py`/view mapping pattern.

12. **Add `section` to the `StudentProgress` TS type.** It's emitted, Zod-required, and used by ranking/section logic, but missing from `types.ts` (only survives via `as unknown` cast). Add `section: string`.

13. **Security note (not schema, but surfaced by the audit):** `roster()` returns plaintext `pin` and `password` to any unauthenticated client (`views.py`). The model comments already flag "hash for production." Track separately.

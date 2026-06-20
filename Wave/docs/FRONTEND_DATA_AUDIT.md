# Wave — Frontend Data Audit

**Date:** 2026-06-20
**Scope:** What the React frontend (`Wave/src`) expects to receive and map onto each page, and which mock / hardcoded values are currently fabricated client-side but **should be sourced from / saved to the backend**.

The app talks to data only through one seam — `WaveRepository` ([repo/repository.ts](../src/repo/repository.ts)). It resolves to **`HttpRepository`** (Django + MQTT) when `VITE_API_BASE` is set, else **`MockRepository`** (offline, in-memory) — see [repo/index.ts](../src/repo/index.ts).

---

## Part 1 — Data the frontend expects to receive and map

### Cold-start load — `repo.bootstrap()` → `RepoBootstrap` ([App.tsx:136](../src/App.tsx#L136))

| Field expected | Type | Backend source |
|---|---|---|
| `students` | `StudentUser[]` | `GET /api/roster` |
| `teachers` | `TeacherUser[]` | `GET /api/roster` |
| `lessonsBySubject` | `Record<string, Lesson[]>` | `GET /api/catalog?subject=` ×3 (decoded from `LessonCatalog`) |
| `progressRecords` | `Record<lrn, StudentProgress>` | `GET /api/allprogress` |
| `remediationMaterials` | `TeacherRemediationMaterial[]` | `GET /api/remediation` |

### Student pages

| Page / Feature | Component | Data expected | Source |
|---|---|---|---|
| Login | [LoginScreen.tsx](../src/components/LoginScreen.tsx) | `students[]`, `teachers[]` | roster + `POST /api/auth/login` |
| Home / Dashboard | [StudentHome.tsx](../src/components/StudentHome.tsx) | `student`, `progress` (`StudentProgress`), `lessons`, `remediationMaterials` | bootstrap + live MQTT |
| Syllabus / Lessons | [StudentLessons.tsx](../src/components/StudentLessons.tsx) | `progress`, `lessons`, `remediationMaterials`; **writes** quiz & summative scores | reads bootstrap; writes via `POST /api/sync/push` |
| Rankings | [StudentRankings.tsx](../src/components/StudentRankings.tsx) | `progressRecords`, `students`, `lessons` | ⚠️ computed client-side — should be `GET /api/rankings` |
| Progress | [StudentProgressRep.tsx](../src/components/StudentProgressRep.tsx) | `progress`, `lessons` | bootstrap |
| Profile | [StudentProfile.tsx](../src/components/StudentProfile.tsx) | `student` | session |

### Teacher pages

| Page / Feature | Component | Data expected | Source |
|---|---|---|---|
| Home / Dashboard | [TeacherHome.tsx](../src/components/TeacherHome.tsx) | `teacher`, `progressRecords`, `students`; AI generate + publish | `POST /api/remediation/generate`, publish via `POST /api/sync/push` |
| Class Records | [TeacherStudents.tsx](../src/components/TeacherStudents.tsx) | `progressRecords`, `students`; **writes** enrollment | reads bootstrap; `enrollStudent` → `StudentSignup` push |
| Analytics | [TeacherAnalytics.tsx](../src/components/TeacherAnalytics.tsx) | `progressRecords`, `students`, `lessons` | bootstrap (derived stats) |
| Profile | [TeacherProfile.tsx](../src/components/TeacherProfile.tsx) | `teacher` | session |
| AI Remediation Wizard | [RemediationWizard.tsx](../src/components/RemediationWizard.tsx) | `students`, `progressRecords`; generate + publish | `POST /api/remediation/generate` + push |

### Writes (up-sync) the frontend emits

| Action | Repo method | Wire type | Endpoint |
|---|---|---|---|
| Submit topic quiz | `saveQuizAttempt` | `StudentProgress` | `POST /api/sync/push` |
| Submit summative | `saveSummativeResult` | `StudentSummativeResults` | `POST /api/sync/push` |
| Publish remediation | `publishRemediation` | `TeacherRemediationMaterial` | `POST /api/sync/push` |
| Enroll student | `enrollStudent` | `StudentSignup` | `POST /api/sync/push` |
| Generate remediation | `generateRemediation` | (AI JSON) | `POST /api/remediation/generate` |

### Live "down" updates (MQTT, Http mode only) — [App.tsx:120](../src/App.tsx#L120)
`progress` (peer `StudentProgress`), `rankings` (currently ignored), `remediation` (new `TeacherRemediationMaterial`).

---

## Part 2 — Mock / hardcoded data that should come from / be saved to the backend

Two layers of "mock": **(A)** whole-app mock mode, and **(B)** hardcoded fallbacks inside components that fire **even in live mode** when a record is missing — these are the dangerous ones because they render invented numbers as if real.

### A. Whole-app mock mode
- Default is `MockRepository` unless `VITE_API_BASE` is set ([repo/index.ts:18](../src/repo/index.ts#L18)): empty `progressRecords`, empty `remediationMaterials`, all writes no-op, lessons from local JSON ([data.ts](../src/data.ts)), demo student/teacher seeded in `localStorage` ([mockRepository.ts:28-41](../src/repo/mockRepository.ts#L28)).
- `App.tsx` also seeds demo accounts and persists `progressRecords` to `localStorage` independently of the repo ([App.tsx:63-69](../src/App.tsx#L63), [App.tsx:115-117](../src/App.tsx#L115)).

### B. Hardcoded / fabricated data inside components

| Location | Page | What's faked | Trigger | Priority to back with real data |
|---|---|---|---|---|
| [StudentRankings.tsx:44-49](../src/components/StudentRankings.tsx#L44) | Rankings | Invents score from LRN digits (`0.6 + (idx%4)*0.1` × perfect) | student with no progress | 🔴 High |
| [StudentRankings.tsx:32-64](../src/components/StudentRankings.tsx#L32) | Rankings | Whole leaderboard computed client-side; `GET /api/rankings` never called; live `rankings` ignored ([App.tsx:130](../src/App.tsx#L130)) | always | 🔴 High |
| [TeacherAnalytics.tsx:61-63](../src/components/TeacherAnalytics.tsx#L61) | Analytics | Default `quizAvg=85, summativeScore=17, overallGrade=84` | no progress | 🔴 High |
| [TeacherAnalytics.tsx:53-57](../src/components/TeacherAnalytics.tsx#L53) | Analytics | Completed-topics count synthesized from LRN | no progress | 🔴 High |
| [TeacherAnalytics.tsx:92-103](../src/components/TeacherAnalytics.tsx#L92) | Analytics | Summative & quiz grades fabricated from `lrn.slice(-2)` | no summative record | 🔴 High |
| [TeacherAnalytics.tsx:170](../src/components/TeacherAnalytics.tsx#L170) | Analytics | Topic-trend line uses `74 + ((l+t)%4)*6` | empty topic | 🟡 Medium |
| [TeacherHome.tsx:351-374](../src/components/TeacherHome.tsx#L351) | Teacher Home | Hardcoded 20-item math/english/science summative banks | subject template | 🟡 Medium |
| [TeacherHome.tsx:300-348](../src/components/TeacherHome.tsx#L300) | Teacher Home | Hardcoded remedial lesson body + quiz (science) | default content | 🟡 Medium |
| [StudentHome.tsx:180](../src/components/StudentHome.tsx#L180) | Student Home | Hardcoded teacher name "Mrs. Elena Santos" | always | 🟢 Low |
| [RemediationWizard.tsx:240](../src/components/RemediationWizard.tsx#L240) | Wizard | Material ID via `Math.random()` (client-generated) | on create | 🟡 Medium |
| [RemediationWizard.tsx:299](../src/components/RemediationWizard.tsx#L299) | Wizard | Fallback section literal `'Grade 6 - Section Newton'` | missing section | 🟢 Low |
| [RemediationWizard.tsx:~149](../src/components/RemediationWizard.tsx) | Wizard | `correctOption: 0` hardcoded when rebuilding failed items | always | 🟡 Medium |

---

## Part 3 — What is important to actually persist to the backend

These are the data points the UI currently fakes or holds only in `localStorage`, that **must be a real backend round-trip** for the product to be trustworthy:

1. **Rankings / leaderboard** — consume `GET /api/rankings` (the `Standing` schema + endpoint already exist) instead of recomputing and inventing per-student scores. Remove the LRN-digit fallback so a student with no attempts shows 0 / "no data," not a fabricated 60–90%.
2. **Per-student grades & completion (Analytics)** — derive strictly from `progressRecords` returned by `GET /api/allprogress`. Replace every fabricated default (`85/17/84`, `lrn.slice(-2)` formulas, `74 + …` trend) with an explicit "No data yet" state.
3. **Quiz & summative attempts** — already wired to `POST /api/sync/push`; confirm they persist server-side (rows in `wave_api_quizattempt` / `wave_api_summativeresult`). The `attempts` retry counter for topic quizzes is currently UI-only ([App.tsx:248-260](../src/App.tsx#L248)) and has no backend column — decide whether to persist it.
4. **Remediation materials** — `Math.random()` IDs should be server-assigned (the backend already generates `REM-…` IDs in the AI finalize path). Persist `targetSubject`, `targetSection`, and `failedItems` accurately rather than the hardcoded `correctOption: 0`.
5. **Summative / remedial question banks** — the hardcoded banks in `TeacherHome` should come from the catalog (`Lesson.summative`) or AI generation, then be saved as part of the published `TeacherRemediationMaterial`.
6. **Teacher attribution** — the student remediation banner should show the publishing teacher's real name (from `TeacherRemediationMaterial` / roster), not the hardcoded "Mrs. Elena Santos."

### Caveat — section scoping bug affecting all of the above
Several components filter by `student.gradeLevel === activeSection` (e.g. [TeacherAnalytics.tsx:41](../src/components/TeacherAnalytics.tsx#L41), [StudentRankings.tsx:29](../src/components/StudentRankings.tsx#L29)), but sections live in the `section` field (`"Grade 6 - Section Einstein"`) while `gradeLevel` is `"Grade 6"`. Section scoping is therefore unreliable, compounded by the `StudentProgress` UI type dropping the `section` field (see the schema-alignment audit). Fix the field mapping when wiring real data.

---

## How to verify the backend actually receives data
1. Set `VITE_API_BASE` (and optionally `VITE_MQTT_URL`) so `HttpRepository` is used.
2. Perform an action (submit a quiz).
3. Confirm **server-side**, not in the UI (the UI can mask with fallbacks): watch the Django log for `POST /api/sync/push`, or query the DB:
   ```
   SELECT student_id, topic_id, score FROM wave_api_quizattempt ORDER BY id DESC LIMIT 5;
   ```
   A fresh row = the backend genuinely received and persisted the write.

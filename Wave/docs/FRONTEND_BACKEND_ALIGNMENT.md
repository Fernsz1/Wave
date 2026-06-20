# Wave — Frontend ↔ Backend Alignment Assessment

**Date:** 2026-06-20
**Scope:** Whether the frontend data (`Wave/src/types.ts`, `repo/`, and component usage) is aligned with the backend schema (`server/wave_api/models.py` + `protocol/wire_manifest.json`, with migrations `0001–0005` applied).

This audit answers two questions:
1. Which specific data **is aligned** between frontend and backend (with the consuming component/page)?
2. Which data exists **in the frontend but not in the backend schema** (with the consuming component/page)?

> Note on naming: the backend stores snake_case columns and exposes camelCase over the wire; that rename is handled server-side (`derive.py` / views), so "aligned" below means field-for-field correspondence after that rename.

---

## ✅ Part A — Data that IS aligned (exists in both, maps cleanly)

### Entity / identity data
| Frontend field | Type | Backend match | Component / Page |
|---|---|---|---|
| `StudentUser.lrn / name / gradeLevel / section / pin` | string | `Student.lrn/name/grade_level/section/pin` | [LoginScreen](../src/components/LoginScreen.tsx), [StudentProfile](../src/components/StudentProfile.tsx), all student/teacher pages |
| `TeacherUser.teacherId / name / department / password` | string | `Teacher.teacher_id/name/department/password` ✅ *(password migrated in 0004)* | [LoginScreen](../src/components/LoginScreen.tsx), [TeacherProfile](../src/components/TeacherProfile.tsx) |

### Catalog content (round-trips as JSON via `CatalogDocument`)
| Frontend field | Backend match (wire `defs`) | Component / Page |
|---|---|---|
| `Lesson.id/title/description/topics/summative` | `Lesson` def | [StudentLessons](../src/components/StudentLessons.tsx), [TeacherHome](../src/components/TeacherHome.tsx) |
| `Topic.id/name/description/readingTime/content/quiz/isCustomRemedial` | `Topic` def (incl. `isCustomRemedial`) | [StudentLessons](../src/components/StudentLessons.tsx), [TeacherAnalytics](../src/components/TeacherAnalytics.tsx) |
| `QuizQuestion.id/question/options/correctAnswerIndex/explanation` | `QuizQuestion` def | [StudentLessons](../src/components/StudentLessons.tsx), [RemediationWizard](../src/components/RemediationWizard.tsx) |
| `Topic.content.{introduction,sections,definition?,keyTakeaway,importantNote?}` | `TopicContent`/`ContentSection`/`Definition` defs | [StudentLessons](../src/components/StudentLessons.tsx) (reading view) |

### Progress / attempts
| Frontend field | Backend match | Component / Page |
|---|---|---|
| `StudentProgress.studentLrn / completedTopicIds / quizAttempts` | `StudentProgress` wire + `QuizAttempt` rows | [StudentHome](../src/components/StudentHome.tsx), [TeacherStudents](../src/components/TeacherStudents.tsx) |
| `StudentQuizAttempt.topicId/score/perfectScore/answers/completedAt` | `StudentQuizAttempt` def + `QuizAttempt` columns | [StudentLessons](../src/components/StudentLessons.tsx), [StudentProgressRep](../src/components/StudentProgressRep.tsx) |
| `summativeScores[lessonId].{score,perfectScore,feedback,attempts?}` | `SummativeScore` def + `SummativeResult` row | [StudentProgressRep](../src/components/StudentProgressRep.tsx), [StudentLessons](../src/components/StudentLessons.tsx) |
| `Standing.{rank,studentLrn,name,score,perfect,percent}` | `Standing` def | [TeacherAnalytics](../src/components/TeacherAnalytics.tsx), [TeacherStudents](../src/components/TeacherStudents.tsx) *(via `RepoUpdate`)* |

### Remediation (aligned subset)
| Frontend field | Backend match | Component / Page |
|---|---|---|
| `TeacherRemediationMaterial.id/originalTopicId/title/content/teacherNotes/createdQuiz/createdSummative?/publishDate/targetSection?/isPublished` | `RemediationMaterial` columns + wire def | [StudentLessons](../src/components/StudentLessons.tsx) (remedial view), [TeacherHome](../src/components/TeacherHome.tsx), [RemediationWizard](../src/components/RemediationWizard.tsx) |

---

## 🔴 Part B — In the frontend but NOT in the backend schema

These have **no backing column and no wire field** — invented or held only client-side.

### Frontend-only *type* fields (in `types.ts` / `repository.ts`)
| Frontend field | Where defined | Component / Page | Note |
|---|---|---|---|
| `StudentQuizAttempt.attempts?` | [types.ts:74](../src/types.ts#L74) | [StudentLessons](../src/components/StudentLessons.tsx) (gates 3-retry limit); set in [App.tsx:250-258](../src/App.tsx#L250) | No `attempts` column on `QuizAttempt`, no wire field → always `undefined` from server; only survives in `localStorage` |
| `TeacherRemediationMaterial.assignedStudentLrn` | [types.ts:93](../src/types.ts#L93) | [App.tsx:322](../src/App.tsx#L322), [RemediationWizard](../src/components/RemediationWizard.tsx) | No backend field; hardcoded to `''` on decode |
| `TeacherRemediationMaterial.targetLessonId?` | [types.ts:96](../src/types.ts#L96) | [RemediationWizard](../src/components/RemediationWizard.tsx) | No backend field; never populated |
| `SubjectCatalog.gradeLevel` | [types.ts:64](../src/types.ts#L64) | [data.ts](../src/data.ts) content files | Wire `LessonCatalog` is only `{subject, lessons}` — `gradeLevel` is dropped |

### Frontend-only *computed/derived* data (presentation metrics, persisted nowhere)
| Frontend value | Component / Page | Note |
|---|---|---|
| `overallGrade` (weighted 0.4×quiz + 0.6×summative) | [TeacherAnalytics.tsx:90](../src/components/TeacherAnalytics.tsx#L90) | Backend has per-topic `quizScores`, but no composite grade |
| `quizAvg`, `progressPercentage`, `classStandingLabel`, grade-band counts, `topicAverages` trend | [TeacherAnalytics.tsx:61-183](../src/components/TeacherAnalytics.tsx#L61) | All computed client-side; several with fabricated fallbacks |
| Leaderboard `score / percentage` | [StudentRankings.tsx:32-64](../src/components/StudentRankings.tsx#L32) | Recomputed locally; the real `Rankings`/`Standing` endpoint is never consumed |
| Material ID `REM-${Math.random()}` | [RemediationWizard.tsx:240](../src/components/RemediationWizard.tsx#L240) | Client-generated; backend assigns its own `REM-…` IDs |
| `failedItems[].correctOption: 0` | [RemediationWizard.tsx:149](../src/components/RemediationWizard.tsx#L149) | Hardcoded; `FailedItem` schema expects the real correct index |

### ⚠️ Borderline (frontend field, backend column exists, but not wired)
| Frontend field | Backend | Component / Page |
|---|---|---|
| `TeacherRemediationMaterial.targetSubject?` | `RemediationMaterial.subject` exists, but the **wire payload omits it** (carried on the envelope) and `toInternalRemediation` never sets it → effectively frontend-only at runtime | [RemediationWizard](../src/components/RemediationWizard.tsx), [StudentLessons](../src/components/StudentLessons.tsx) |

---

## Summary

- **Aligned:** identity (Student/Teacher), the entire catalog tree (Lesson/Topic/QuizQuestion/content), core progress (`completedTopicIds`, `quizAttempts`, `summativeScores`), and `Standing`.
- **Frontend-only (no backend schema):** `attempts` on topic attempts, `assignedStudentLrn`, `targetLessonId`, `SubjectCatalog.gradeLevel`, plus all derived analytics/ranking metrics (`overallGrade`, leaderboard %, class standing, trends) and the `Math.random()` ID / `correctOption:0` fabrications.
- **Borderline:** `targetSubject` (column exists, not transported).

### Reverse gap (for completeness — backend has it, frontend type drops it)
Not the focus of this audit, but noted: `StudentProgress.section` and `StudentProgress.quizScores`, and `QuizAttempt.lesson_id` exist in the backend but are absent from the frontend UI types. See the schema-alignment audit for details.

---

*Related docs: [FRONTEND_DATA_AUDIT.md](FRONTEND_DATA_AUDIT.md) (expected data + mock/hardcoded inventory), [../../server/DATABASE_SCHEMA.md](../../server/DATABASE_SCHEMA.md) (applied SQLite schema).*

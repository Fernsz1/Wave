# Wave — ER Diagram (Django relational DB)

The backend database. Reflects [server/wave_api/models.py](../server/wave_api/models.py). Solid
lines are real Django ForeignKeys; **dashed** lines are *soft* references (logical links Django does
not enforce with an FK).

```mermaid
erDiagram
    STUDENT ||--o{ QUIZ_ATTEMPT : "has (FK student)"
    STUDENT ||--o{ SUMMATIVE_RESULT : "has (FK student)"
    STUDENT ||..o{ API_TOKEN : "principal_id (soft)"
    TEACHER ||..o{ API_TOKEN : "principal_id (soft)"
    STUDENT ||..o{ REMEDIATION_MATERIAL : "target_section (soft)"

    STUDENT {
        string lrn PK
        string name
        string grade_level
        string section
        string pin "plaintext (demo only)"
    }
    TEACHER {
        string teacher_id PK
        string name
        string department
    }
    API_TOKEN {
        string key PK
        string role "student | teacher"
        string principal_id "lrn or teacher_id"
    }
    CATALOG_DOCUMENT {
        string subject PK "science | mathematics | english"
        json data "Lesson[] (static catalog from frontend)"
    }
    QUIZ_ATTEMPT {
        int id PK
        string student_id FK
        string topic_id "unique with student"
        string lesson_id
        int score
        int perfect_score
        json answers "selected indices"
        string completed_at "YYYY-MM-DD"
    }
    SUMMATIVE_RESULT {
        int id PK
        string student_id FK
        string lesson_id "unique with student"
        int score
        int total
        int percent
        bool passed
        text feedback
        json failed_items "FailedItem[]"
    }
    REMEDIATION_MATERIAL {
        string material_id PK
        string subject
        string original_topic_id
        string title
        text content
        text teacher_notes
        json created_quiz "QuizQuestion[]"
        string publish_date
        string target_section
        bool is_published
    }
```

### Notes
- **`CATALOG_DOCUMENT`** is standalone (no relationships): the entire lessons/topics/quizzes tree is
  stored as one JSON document per subject (`data` = `Lesson[]`, 10 questions/topic), seeded from the
  frontend's `data.ts`. It is read-only and relayed whole.
- **JSON-valued columns:** `QUIZ_ATTEMPT.answers`, `SUMMATIVE_RESULT.failed_items`,
  `REMEDIATION_MATERIAL.created_quiz`, `CATALOG_DOCUMENT.data`.
- **Uniqueness:** `QUIZ_ATTEMPT` is unique per `(student, topic_id)`; `SUMMATIVE_RESULT` is unique per
  `(student, lesson_id)` — so re-submitting upserts the latest.
- **Derived, NOT stored** (computed in [derive.py](../server/wave_api/derive.py)):
  `quizScores` (per-topic %), `completedTopicIds`, and section **`Rankings`** — all assembled from
  `QUIZ_ATTEMPT` / `SUMMATIVE_RESULT` rows on demand.
- **Soft references (dashed):** `API_TOKEN.principal_id` points at a `STUDENT.lrn` *or*
  `TEACHER.teacher_id`; `REMEDIATION_MATERIAL.target_section` matches a `STUDENT.section`. Neither is
  a Django FK, so there's no DB-level cascade.

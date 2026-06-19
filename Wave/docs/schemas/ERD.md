# Wave — Schema ERD

Entity-Relationship Diagram derived from the JSON Schemas in `docs/schemas/`.
The system relays **tokenized payloads** over `app → router → LoRa → AI server` (and back).
Every typed body is wrapped in a `SyncEnvelope`.

Logical hubs (not their own schema files, but the keys everything joins on):

- **Student** — identified by `lrn` / `studentLrn` (12-digit LRN)
- **Teacher** — identified by `teacherId`
- **Section** — free-text key, e.g. `"Grade 6 - Section Newton"`

`direction`: **up** = student → teacher, **down** = teacher → student.

```mermaid
erDiagram
    %% ---------- Conceptual hubs ----------
    STUDENT {
        string lrn PK "12-digit LRN"
        string name
        string section FK
    }
    TEACHER {
        string teacherId PK
        string department
    }
    SECTION {
        string section PK "e.g. Grade 6 - Section Newton"
        string subject
    }

    %% ---------- Transport ----------
    SYNC_ENVELOPE {
        string msgId PK "uuid, dedupe + ACK"
        string type "one of 8 payload types"
        string direction "up | down"
        string subject
        string section FK
        datetime createdAt
        int chunk_index
        int chunk_total
        object payload "typed body"
    }

    %% ---------- Auth payloads ----------
    STUDENT_SIGNUP {
        string lrn PK
        string name
        string gradeLevel
        string section FK
        string pin "6-digit"
    }
    TEACHER_SIGNUP {
        string teacherId PK
        string name
        string department
        string password
    }

    %% ---------- Content catalog ----------
    LESSON_CATALOG {
        string subject "science | mathematics | english"
    }
    LESSON {
        string id PK "L1, L-MATH1..."
        string title
        string description
    }
    TOPIC {
        string id PK "L1-T1"
        string name
        string readingTime
        bool isCustomRemedial
    }
    TOPIC_CONTENT {
        string introduction
        string keyTakeaway
        string importantNote
    }
    QUIZ_QUESTION {
        string id PK "Q1-1"
        string question
        array options
        int correctAnswerIndex
        string explanation
    }

    %% ---------- Quiz generation ----------
    QUIZ_ATTEMPT_REQUEST {
        string studentLrn FK
        string section FK
        string subject
        string lessonId FK
        string topicId FK "null for summative"
        string mode "topic | summative | remedial"
        int quizzesPerTopic
        int seed "deterministic RNG"
        array focusTopicIds FK
    }
    SUMMATIVE_CONFIG {
        int total "norm target = 20"
        int passMark "12"
        int itemsPerTopic
        array templateIds FK
    }
    QUIZ_GENERATION_TEMPLATES {
        string version
        object globals
        object summativeAssembly
    }
    QUESTION_TEMPLATE {
        string templateId PK "tmpl-mcq-definition"
        string intent
        string questionTemplate
        string correctSource
        string distractorSource
        array appliesTo
    }
    VARIABLE_BINDING {
        string topicId PK "keyed by Topic.id"
        object bank "term, function, distractors..."
    }

    %% ---------- Progress / results (UP) ----------
    STUDENT_PROGRESS {
        string studentLrn FK
        string section FK
        array completedTopicIds FK
    }
    QUIZ_ATTEMPT {
        string topicId FK
        int score
        int perfectScore
        array answers
        date completedAt
    }
    QUIZ_SCORE {
        string topicId FK
        int score
        int total
        int percent
        bool passed "percent >= 70"
    }
    SUMMATIVE_SCORE {
        string lessonId FK
        int score
        int perfectScore
        string feedback
    }
    STUDENT_SUMMATIVE_RESULTS {
        string studentLrn FK
        string section FK
        string lessonId FK
        int score
        int total
        int percent
        bool passed "score >= 12 of 20"
    }
    FAILED_ITEM {
        string questionId FK
        string topicId FK
        int selectedOption
        int correctOption
    }

    %% ---------- Leaderboard / remediation (DOWN) ----------
    RANKINGS {
        string section FK
        string subject
    }
    STANDING {
        int rank
        string studentLrn FK
        string name
        int score
        int perfect
        int percent
    }
    TEACHER_REMEDIATION_MATERIAL {
        string id PK "REM-001"
        string originalTopicId FK
        string title
        string content "markdown"
        string teacherNotes
        date publishDate
        string targetSection FK "whole section, never one LRN"
        bool isPublished
    }
    REMEDIATION_CHUNK {
        int index
        int total
        string data "encoded LoRa fragment"
    }

    %% ================= Relationships =================

    %% Hubs
    SECTION   ||--o{ STUDENT                    : enrolls
    TEACHER   ||--o{ SECTION                    : teaches

    %% Envelope wraps every payload
    SYNC_ENVELOPE ||..o| STUDENT_SIGNUP                : wraps
    SYNC_ENVELOPE ||..o| TEACHER_SIGNUP                : wraps
    SYNC_ENVELOPE ||..o| STUDENT_PROGRESS             : wraps
    SYNC_ENVELOPE ||..o| STUDENT_SUMMATIVE_RESULTS    : wraps
    SYNC_ENVELOPE ||..o| QUIZ_ATTEMPT_REQUEST         : wraps
    SYNC_ENVELOPE ||..o| RANKINGS                     : wraps
    SYNC_ENVELOPE ||..o| TEACHER_REMEDIATION_MATERIAL : wraps
    SYNC_ENVELOPE ||..o| LESSON_CATALOG               : wraps

    %% Signups create hub identities
    STUDENT_SIGNUP ||..|| STUDENT : registers
    TEACHER_SIGNUP ||..|| TEACHER : registers

    %% Content hierarchy
    LESSON_CATALOG ||--o{ LESSON        : contains
    LESSON         ||--o{ TOPIC         : contains
    TOPIC          ||--|| TOPIC_CONTENT : has
    TOPIC          ||--o{ QUIZ_QUESTION : "quiz pool"

    %% Quiz request
    QUIZ_ATTEMPT_REQUEST }o--|| LESSON            : targets
    QUIZ_ATTEMPT_REQUEST }o--o| TOPIC             : "targets (topic mode)"
    QUIZ_ATTEMPT_REQUEST ||--o| SUMMATIVE_CONFIG  : "config (summative)"
    QUIZ_ATTEMPT_REQUEST }o--|| STUDENT           : "issued by"

    %% Generation templates
    QUIZ_GENERATION_TEMPLATES ||--o{ QUESTION_TEMPLATE : defines
    QUIZ_GENERATION_TEMPLATES ||--o{ VARIABLE_BINDING  : "banks (per topic)"
    VARIABLE_BINDING          }o--|| TOPIC             : "binds data for"
    SUMMATIVE_CONFIG          }o..o{ QUESTION_TEMPLATE : "selects templateIds"
    QUESTION_TEMPLATE         ||..o{ QUIZ_QUESTION     : "emits items"

    %% Progress (UP)
    STUDENT          ||--o{ STUDENT_PROGRESS  : reports
    STUDENT_PROGRESS ||--o{ QUIZ_ATTEMPT      : "quizAttempts[topicId]"
    STUDENT_PROGRESS ||--o{ QUIZ_SCORE        : "quizScores[topicId]"
    STUDENT_PROGRESS ||--o{ SUMMATIVE_SCORE   : "summativeScores[lessonId]"
    QUIZ_ATTEMPT     }o--|| TOPIC             : on
    QUIZ_SCORE       }o--|| TOPIC             : on
    SUMMATIVE_SCORE  }o--|| LESSON            : on

    %% Summative results (UP) -> drives remediation
    STUDENT                   ||--o{ STUDENT_SUMMATIVE_RESULTS : produces
    STUDENT_SUMMATIVE_RESULTS }o--|| LESSON                    : for
    STUDENT_SUMMATIVE_RESULTS ||--o{ FAILED_ITEM               : lists
    FAILED_ITEM               }o--|| QUIZ_QUESTION             : "missed (questionId)"
    FAILED_ITEM               }o--|| TOPIC                     : "from"
    FAILED_ITEM               }o..o{ QUIZ_ATTEMPT_REQUEST      : "seeds focusTopicIds (remedial)"

    %% Rankings (DOWN)
    SECTION  ||--o{ RANKINGS : "leaderboard for"
    RANKINGS ||--o{ STANDING : ranks
    STANDING }o--|| STUDENT  : "is"

    %% Remediation material (DOWN)
    TEACHER                      ||--o{ TEACHER_REMEDIATION_MATERIAL : authors
    TEACHER_REMEDIATION_MATERIAL }o--|| TOPIC             : "remediates originalTopicId"
    TEACHER_REMEDIATION_MATERIAL }o--|| SECTION           : "addressed to targetSection"
    TEACHER_REMEDIATION_MATERIAL ||--o{ QUIZ_QUESTION     : "createdQuiz"
    TEACHER_REMEDIATION_MATERIAL ||--o{ REMEDIATION_CHUNK : "LoRa fragments"
```

## Relationship notes

| Join key | Connects |
|----------|----------|
| `lrn` / `studentLrn` | `Student` ↔ Signup, Progress, SummativeResults, Standing, QuizAttemptRequest |
| `section` | `Section` ↔ Signup, Envelope, Progress, Rankings, RemediationMaterial (`targetSection`) |
| `teacherId` | `Teacher` ↔ TeacherSignup, RemediationMaterial (author) |
| `lessonId` | `Lesson` ↔ QuizAttemptRequest, SummativeScore, SummativeResults |
| `topicId` | `Topic` ↔ QuizAttemptRequest, QuizAttempt, QuizScore, FailedItem, VariableBinding, RemediationMaterial (`originalTopicId`) |
| `templateId` | `QuestionTemplate` ↔ SummativeConfig (`templateIds`) |
| `questionId` | `QuizQuestion` ↔ FailedItem |
| `msgId` | `SyncEnvelope` dedupe / ACK key |
| `seed` | Makes `QuizAttemptRequest` → template generation deterministic/offline-reproducible |

## Key flows

1. **Signup** — `StudentSignup` (up) / `TeacherSignup` (down) create the Student/Teacher identities.
2. **Learn** — `LessonCatalog` (down) delivers `Lesson → Topic → QuizQuestion` content.
3. **Quiz** — `QuizAttemptRequest` (up) triggers item generation via `QuizGenerationTemplates`
   (`QuestionTemplate` + per-topic `VariableBinding`, deterministic by `seed`).
4. **Report** — `StudentProgress` & `StudentSummativeResults` (up) carry scores; `failedItems`
   feed `focusTopicIds` for **remedial** requests.
5. **React** — Teacher pushes `Rankings` and `TeacherRemediationMaterial` (down),
   the latter fragmented into `REMEDIATION_CHUNK`s for LoRa transport.

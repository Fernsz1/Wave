# Wave Data Schema

Wave uses JSON schemas for all data exchanged between devices. All payloads are wrapped in a `SyncEnvelope` and transmitted over MQTT and LoRa. There are 8 message types split into two directions: **UP** (student → teacher) and **DOWN** (teacher → student).

---

## Table of Contents

1. [SyncEnvelope](#syncenvelope)
2. [UP Messages (student → teacher)](#up-messages-student--teacher)
   - [StudentSignup](#studentsignup)
   - [StudentProgress](#studentprogress)
   - [StudentSummativeResults](#studentsummativeresults)
   - [QuizAttemptRequest](#quizattemptrequest)
3. [DOWN Messages (teacher → student)](#down-messages-teacher--student)
   - [TeacherSignup](#teachersignup)
   - [LessonCatalog](#lessoncatalog)
   - [TeacherRemediationMaterial](#teacherremediationmaterial)
   - [Rankings](#rankings)
4. [Shared Definitions](#shared-definitions)
   - [QuizQuestion](#quizquestion)
   - [TopicContent](#topiccontent)
5. [Quiz Generation Templates](#quiz-generation-templates)

---

## SyncEnvelope

**File:** `envelope.schema.json`

Wraps every payload relayed over app → router → LoRa → AI server (and reverse).

| Field | Type | Required | Description |
|---|---|---|---|
| `msgId` | `string (uuid)` | Yes | Deduplication and ACK key |
| `type` | `string (enum)` | Yes | One of the 8 message types listed below |
| `direction` | `"up" \| "down"` | Yes | `up` = student→teacher, `down` = teacher→student |
| `subject` | `"science" \| "mathematics" \| "english"` | No | Subject scope of the payload |
| `section` | `string` | No | e.g. `"Grade 6 - Section Newton"` |
| `createdAt` | `string (date-time)` | Yes | ISO 8601 timestamp |
| `chunk.index` | `integer` | Yes | Fragment index (0-based) for LoRa reassembly |
| `chunk.total` | `integer` | Yes | Total fragments; `1` when payload fits one frame |
| `payload` | `object` | Yes | One of the typed bodies below |

**Allowed `type` values:**
`StudentSignup` · `TeacherSignup` · `StudentProgress` · `StudentSummativeResults` · `QuizAttemptRequest` · `Rankings` · `TeacherRemediationMaterial` · `LessonCatalog`

---

## UP Messages (student → teacher)

### StudentSignup

**File:** `student_signup.schema.json`

New learner registration credentials.

| Field | Type | Required | Description |
|---|---|---|---|
| `lrn` | `string` | Yes | 12-digit Learner Reference Number (pattern: `^[0-9]{12}$`) |
| `name` | `string` | Yes | Full name |
| `gradeLevel` | `string` | Yes | e.g. `"Grade 6 - Section Newton"` |
| `section` | `string` | Yes | e.g. `"Grade 6 - Section Newton"` |
| `pin` | `string` | Yes | 6-digit PIN (pattern: `^[0-9]{6}$`); default seed `123456` |

---

### StudentProgress

**File:** `student_progress.schema.json`

Per-topic completion and quiz scores, sent after each session sync.

| Field | Type | Required | Description |
|---|---|---|---|
| `studentLrn` | `string` | Yes | 12-digit LRN |
| `section` | `string` | Yes | e.g. `"Grade 6 - Section Newton"` |
| `completedTopicIds` | `string[]` | Yes | e.g. `["L1-T1", "L1-T2"]` |
| `quizAttempts` | `object` | Yes | Keyed by `topicId` — raw attempt records |
| `quizScores` | `object` | Yes | Keyed by `topicId` — computed score summaries |
| `summativeScores` | `object` | Yes | Keyed by `lessonId` — summative outcomes |

#### `quizAttempts[topicId]`

| Field | Type | Description |
|---|---|---|
| `topicId` | `string` | Topic identifier |
| `score` | `integer` | Raw correct count |
| `perfectScore` | `integer` | Maximum possible (default: `3`) |
| `answers` | `integer[]` | User-selected option indices |
| `completedAt` | `string (date)` | ISO 8601 date |

#### `quizScores[topicId]`

| Field | Type | Description |
|---|---|---|
| `score` | `integer` | Correct answers |
| `total` | `integer` | Total questions |
| `percent` | `integer (0–100)` | Percentage score |
| `passed` | `boolean` | `true` when `percent >= 70` |

#### `summativeScores[lessonId]`

| Field | Type | Description |
|---|---|---|
| `score` | `integer` | Raw score |
| `perfectScore` | `integer` | Max attainable (default: `20`) |
| `feedback` | `string` | Textual feedback |

---

### StudentSummativeResults

**File:** `student_summative_results.schema.json`

Final assessment outcome including failed items that drive remediation targeting.

| Field | Type | Required | Description |
|---|---|---|---|
| `studentLrn` | `string` | Yes | 12-digit LRN |
| `section` | `string` | Yes | Section name |
| `lessonId` | `string` | Yes | e.g. `"L1"` |
| `score` | `integer` | Yes | Raw score |
| `total` | `integer` | Yes | Max score (default: `20`) |
| `percent` | `integer (0–100)` | Yes | Percentage score |
| `passed` | `boolean` | Yes | `true` when `score >= 12` out of `20` |
| `failedItems` | `object[]` | Yes | Wrong answers — the primary remediation driver |

#### `failedItems[]`

| Field | Type | Description |
|---|---|---|
| `questionId` | `string` | e.g. `"Q2-1"` |
| `topicId` | `string` | e.g. `"L1-T2"` |
| `selectedOption` | `integer` | Index the student picked |
| `correctOption` | `integer` | Index of the correct answer |

> `failedItems[].topicId` feeds directly into `QuizAttemptRequest.focusTopicIds` and seeds the AI Remediation Wizard context.

---

### QuizAttemptRequest

**File:** `quiz_attempt_request.payload.json`

Emitted when a student starts a topic quiz, summative, or remedial session. Triggers item generation on the catalog or AI server.

| Field | Type | Required | Description |
|---|---|---|---|
| `studentLrn` | `string` | Yes | 12-digit LRN |
| `section` | `string` | Yes | e.g. `"Grade 6 - Section Newton"` |
| `subject` | `string (enum)` | Yes | `science \| mathematics \| english` |
| `lessonId` | `string` | Yes | e.g. `"L1"` |
| `lessonTitle` | `string` | No | e.g. `"Lesson 1: The Human Body Systems"` |
| `topicId` | `string \| null` | No | Set for `mode=topic`; `null` for `mode=summative` |
| `topicTitle` | `string` | No | e.g. `"Muscular System"` |
| `mode` | `"topic" \| "summative" \| "remedial"` | Yes | Quiz mode |
| `quizzesPerTopic` | `integer` | No | Items per topic quiz (default: `3`) |
| `summativeConfig` | `object` | No | Only present when `mode=summative` |
| `seed` | `integer` | Yes | Deterministic RNG seed — same seed + same templates = identical exam on any node |
| `focusTopicIds` | `string[]` | No | For `mode=remedial`: topicIds from `failedItems` to weight item selection |

#### `summativeConfig`

| Field | Type | Default | Description |
|---|---|---|---|
| `total` | `integer` | `20` | Perfect score normalization target |
| `passMark` | `integer` | `12` | Minimum to pass |
| `itemsPerTopic` | `integer` | `2` | Items drawn per topic |
| `shuffleOptions` | `boolean` | `true` | Randomize answer options |
| `shuffleQuestions` | `boolean` | `true` | Randomize question order |
| `templateIds` | `string[]` | — | Which generation templates are eligible |

---

## DOWN Messages (teacher → student)

### TeacherSignup

**File:** `teacher_signup.schema.json`

Faculty account registration credentials.

| Field | Type | Required | Description |
|---|---|---|---|
| `teacherId` | `string` | Yes | e.g. `"T-2026-001"` |
| `name` | `string` | Yes | Full name |
| `department` | `string` | Yes | Default: `"General Academics"` |

---

### LessonCatalog

**File:** `lesson_catalog.schema.json`

Structured lesson content and per-topic quizzes pushed to student devices. Stored locally for offline access.

| Field | Type | Required | Description |
|---|---|---|---|
| `subject` | `string (enum)` | Yes | `science \| mathematics \| english` |
| `lessons` | `Lesson[]` | Yes | Array of lesson objects |

#### `Lesson`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | e.g. `"L1"`, `"L-MATH1"`, `"L-ENG1"` |
| `title` | `string` | Yes | Lesson title |
| `description` | `string` | Yes | Lesson summary |
| `topics` | `Topic[]` | Yes | Array of topic objects |

#### `Topic`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | e.g. `"L1-T1"` |
| `name` | `string` | Yes | Topic name |
| `description` | `string` | Yes | Topic summary |
| `readingTime` | `string` | Yes | e.g. `"5 mins"` |
| `isCustomRemedial` | `boolean` | No | `true` when AI-generated remedial content (default: `false`) |
| `content` | `TopicContent` | Yes | See [TopicContent](#topiccontent) |
| `quiz` | `QuizQuestion[]` | Yes | See [QuizQuestion](#quizquestion) |

---

### TeacherRemediationMaterial

**File:** `teacher_remediation_material.schema.json`

AI-generated remedial lesson and quiz addressed to a whole section. Always passes through teacher review before `isPublished` is set to `true`.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | e.g. `"REM-001"` |
| `originalTopicId` | `string` | Yes | Topic that seeded the diagnostic context, e.g. `"L1-T2"` |
| `title` | `string` | Yes | Material title |
| `content` | `string` | Yes | Markdown body of the remedial handbook |
| `teacherNotes` | `string` | Yes | Notes addressed to the section |
| `createdQuiz` | `QuizQuestion[]` | Yes | AI-generated diagnostic quiz |
| `publishDate` | `string (date)` | Yes | ISO 8601 date |
| `targetSection` | `string` | Yes | Whole-section recipient — never a single LRN |
| `chunks` | `object[]` | Yes | LoRa-frame-sized fragments for reassembly on device |
| `isPublished` | `boolean` | Yes | `false` until teacher approves and publishes |

#### `chunks[]`

| Field | Type | Description |
|---|---|---|
| `index` | `integer` | Fragment index (0-based) |
| `total` | `integer` | Total number of fragments |
| `data` | `string` | Encoded fragment payload |

> Nothing enters the classroom without human oversight. `isPublished` must be explicitly set to `true` by the teacher after reviewing all content.

---

### Rankings

**File:** `rankings.schema.json`

Section leaderboard computed teacher-side and pushed down to students.

| Field | Type | Required | Description |
|---|---|---|---|
| `section` | `string` | Yes | e.g. `"Grade 6 - Section Newton"` |
| `subject` | `string (enum)` | Yes | `science \| mathematics \| english` |
| `standings` | `object[]` | Yes | Ranked list of students |

#### `standings[]`

| Field | Type | Description |
|---|---|---|
| `rank` | `integer` | Position (1-based) |
| `studentLrn` | `string` | 12-digit LRN |
| `name` | `string` | Student name |
| `score` | `integer` | Achieved score |
| `perfect` | `integer` | Max attainable score for the scope |
| `percent` | `integer (0–100)` | Percentage score |

---

## Shared Definitions

### QuizQuestion

Defined in `lesson_catalog.schema.json#/$defs/QuizQuestion`. Reused in `LessonCatalog` topics and `TeacherRemediationMaterial.createdQuiz`.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | e.g. `"Q1-1"` |
| `question` | `string` | Yes | Question text |
| `options` | `string[]` | Yes | Answer choices (min 2) |
| `correctAnswerIndex` | `integer` | Yes | Zero-based index of the correct option |
| `explanation` | `string` | Yes | Why the correct option is right |

---

### TopicContent

Defined in `lesson_catalog.schema.json#/$defs/TopicContent`.

| Field | Type | Required | Description |
|---|---|---|---|
| `introduction` | `string` | Yes | Opening paragraph |
| `sections` | `object[]` | Yes | Body sections with `title` and `body`; optional `codeExample` |
| `definition.term` | `string` | No | Key vocabulary term |
| `definition.meaning` | `string` | No | Definition of the term |
| `keyTakeaway` | `string` | Yes | Summary statement |
| `importantNote` | `string` | No | Supplementary callout |

---

## Quiz Generation Templates

**File:** `quiz_generation_templates.json`

Templates and variable banks used by Gemini (or the offline generator) to produce `QuizQuestion` items deterministically. Driven by `QuizAttemptRequest.seed` — same seed + same templates + same variable bindings = identical exam on any node.

### Globals

| Key | Value | Description |
|---|---|---|
| `topicQuizSize` | `3` | Items per topic quiz |
| `summativePerfectScore` | `20` | Max summative score |
| `summativePassMark` | `12` | Minimum passing score |
| `optionCount` | `4` | Answer choices per question |

### ID Patterns

| Scope | Pattern | Example |
|---|---|---|
| Topic item | `Q{topicNumber}-{itemNumber}` | `Q1-2` |
| Summative item | `S{lessonNumber}-{sequence}` | `S1-4` |
| Remedial item | `QREM-{topicCode}{sequence}` | `QREM-T21` |

### Question Templates

| Template ID | Intent | Applies To |
|---|---|---|
| `tmpl-mcq-definition` | Recall a definition/term | topic, summative |
| `tmpl-mcq-function` | Identify the function/role of a structure | topic, summative |
| `tmpl-mcq-example` | Pick the correct example of a concept | topic, summative |
| `tmpl-mcq-compare` | Distinguish between two related ideas | summative only |
| `tmpl-mcq-numeric` | Compute or recall a numeric fact | topic, summative |

### Summative Assembly Strategy

| Setting | Value |
|---|---|
| Strategy | `drawPerTopic` |
| Items per topic | `2` |
| Scale to | `20` |
| Rounding | `nearest` |
| Shuffle questions | `true` |
| Shuffle options | `true` |
| Failed topic weight multiplier | `2×` (when `focusTopicIds` present) |

### Emitted Item Shape

Every generator must emit items matching this shape for the frontend quiz engine:

```json
{
  "id": "string (per globals.idPattern)",
  "question": "string (resolved questionTemplate)",
  "options": ["string", "string", "string", "string"],
  "correctAnswerIndex": "integer",
  "explanation": "string"
}
```

---

## Data Flow Summary

```
Student Device                        Teacher/AI Server
─────────────────                     ─────────────────
StudentSignup          ──── UP ────>
StudentProgress        ──── UP ────>
StudentSummativeResults──── UP ────>  → seeds AI Remediation Wizard
QuizAttemptRequest     ──── UP ────>  → triggers item generation

                       ──── DOWN ───  TeacherSignup
                       ──── DOWN ───  LessonCatalog
                       ──── DOWN ───  TeacherRemediationMaterial (isPublished=true)
                       ──── DOWN ───  Rankings
```

All payloads are wrapped in `SyncEnvelope` and fragmented via `chunk.index / chunk.total` for LoRa transmission.

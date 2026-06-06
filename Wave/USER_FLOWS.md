# Wave — User Flows & Journeys

> **Wave** is an offline-first educational platform for students in rural areas. The mobile app pairs with a **router + LoRa + AI server** stack so that **tokenized payloads** (signup credentials, quiz results, teacher-generated lessons & quizzes) are relayed from the app → router → **LoRa radio** → AI server, synced, and pushed back the other way. This document describes the **front-end user journeys** for the two user types — **Students** and **Teachers** — covering every screen, button, and interactive element, plus how the two roles interact through the sync layer.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [How the Two Users Connect (Sync Model)](#2-how-the-two-users-connect-sync-model)
3. [Shared Entry Point — The Login Screen](#3-shared-entry-point--the-login-screen)
4. [Student Journeys](#4-student-journeys)
5. [Teacher Journeys](#5-teacher-journeys)
6. [Cross-User Interaction Scenarios](#6-cross-user-interaction-scenarios)
7. [Global UI Elements Reference](#7-global-ui-elements-reference)
8. [Component / Screen Map](#8-component--screen-map)

---

## 1. System Overview

### Roles
| Role | Identity Key | Primary Goal |
|------|--------------|--------------|
| **Student** | 12-digit **LRN** (Learner Reference Number) + 6-digit PIN | Read lessons, take quizzes & summative exams, track rank/progress, complete teacher-assigned remedial work. |
| **Teacher** | **Teacher ID** (e.g. `T-2026-001`) + Name | Monitor class records & analytics, flag failing students, and generate/publish AI remedial lessons + quizzes. |

### Tech Stack (front-end)
- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4** for styling
- **Motion** (`motion/react`) for animations/transitions
- **lucide-react** for icons
- **@google/genai** (Gemini) intended for the AI server side (lesson/quiz generation). In the current front-end build, AI generation is **simulated** via timed progress loaders.
- State is held in React (`App.tsx`) with **localStorage** backing the enrolled-students list (`wave_enrolled_students`).

### Three Course Subjects
Every learner/teacher session is scoped to one **subject track**, each with 4 lessons of multiple topics:
- 🧪 **Science** (default) — Human Body, Matter, Force/Motion/Energy, Earth & Space, Living Things
- 🧮 **Mathematics** — Fractions/Decimals, Geometry
- 📚 **English** — Parts of Speech, Vocabulary & Comprehension

### Data Objects (the "tokenized payload" contents)

Each payload is tagged with its **sync direction** so the router/LoRa layer knows which way to relay it.

**↑ Student → Teacher (sent "up")**
- `StudentSignup` → `{ lrn, name, gradeLevel, section, pin }` — new learner registration credentials.
- `StudentProgress` → `{ studentLrn, section, completedTopicIds[], quizAttempts{}, quizScores{ topicId: { score, total, percent, passed } }, summativeScores{} }` — per-topic completion + **quiz scores** keyed by topic.
- `StudentSummativeResults` → `{ studentLrn, section, lessonId, score, total, percent, passed, failedItems[ { questionId, topicId, selectedOption, correctOption } ] }` — final-assessment outcome including the **list of failed items** that drive remediation targeting.

**↓ Teacher → Student (sent "down")**
- `TeacherSignup` → `{ teacherId, name, department }` — faculty account registration credentials.
- `Rankings` → `{ section, subject, standings[ { rank, studentLrn, name, score, perfect, percent } ] }` — section leaderboard the teacher's end computes and pushes back to students.
- `TeacherRemediationMaterial` → `{ id, originalTopicId, title, content, teacherNotes, createdQuiz[], publishDate, targetSection, chunks[], isPublished }` — AI remedial lessons/quizzes. **Always addressed to a `targetSection`** (never a single student), and **fragmented into `chunks[]`** so each piece fits within a LoRa frame and is reassembled on the student device.

**Shared catalog**
- `Lesson` → `Topic[]` → each `Topic` carries reading `content` + a `quiz` (QuizQuestion[]).

These are exactly the structures that would be serialized, tokenized, and relayed over LoRa between the student app, the router, and the teacher's end.

---

## 2. How the Two Users Connect (Sync Model)

Although the front-end runs locally, the intended production data flow ties the two roles together:

```
   STUDENT APP                ROUTER (Wi-Fi)            LoRa LINK              AI SERVER                TEACHER APP
 ┌──────────────┐          ┌──────────────┐         ┌───────────┐         ┌──────────────┐         ┌──────────────┐
 │ Signup creds │  ──────► │  Tokenize &  │ ──────► │  LoRa TX  │ ──────► │  Decode +    │ ──────► │  Class       │
 │ Quiz results │          │  queue       │         │  /  RX    │         │  Gemini AI   │         │  Records /   │
 │ Progress     │          │  payloads    │ ◄────── │           │ ◄────── │  sync store  │ ◄────── │  Analytics   │
 └──────────────┘          └──────────────┘         └───────────┘         └──────────────┘         └──────────────┘
        ▲                                                                                                   │
        │           Teacher-generated lessons + remedial quizzes flow back down the same path              │
        └───────────────────────────────────────────────────────────────────────────────────────────────┘
```

**What the student sends "up":** signup credentials (`StudentSignup`), per-topic `quizAttempts` + `quizScores`, `summativeScores`/`StudentSummativeResults` (with failed items), `completedTopicIds`.

**What the teacher sends "down":** faculty signup (`TeacherSignup`), section `Rankings`, and AI-generated remedial materials (`TeacherRemediationMaterial`) + custom class lessons/quizzes — **always addressed to a whole `targetSection`, never to a single student**, and delivered in reassembled `chunks`.

In the current app, this round-trip is represented by **shared React state** in `App.tsx`:
- `progressRecords` (student → teacher visibility)
- `remediationMaterials` (teacher → student visibility)

So a quiz a student submits instantly appears in the teacher's analytics, and a remedial pack a teacher publishes instantly appears on the student's home/lessons screens — mirroring what LoRa sync will do asynchronously in production.

---

## 3. Shared Entry Point — The Login Screen

**Component:** `LoginScreen.tsx` — shown whenever `currentUser` is `null`.

### Layout
- **Brand header ribbon** — `WaveLogo`, "Wave" wordmark, "AI-Powered Education Platform" tagline.
- **Role selector** (segmented toggle):
  - `#student-role-btn` — **Student Portal** (default)
  - `#teacher-role-btn` — **Teacher Console**
- **Dynamic form** (changes by role).
- **Error banner** — red, with `ShieldAlert` icon, for validation/auth failures.
- **Quick Demo Shortcuts** — one-click logins for testing.

### 3a. Student Login Flow
| Field | Rule |
|-------|------|
| `#student-lrn` | Exactly **12 digits** (non-digits stripped on input). |
| `#student-pin` | Exactly **6 digits**, masked. Default seeded PIN = `123456`. |

Button: `#login-submit-btn` → **"Sign In to Portal"**

**Validation branches (`handleManualLogin`):**
1. LRN ≠ 12 digits → *"Learner Reference Number (LRN) must be exactly 12 digits."*
2. PIN ≠ 6 digits → *"PIN must be exactly 6 digits."*
3. LRN not found in `students` → *"Student LRN is not enrolled… contact your teacher to enroll your account."* ← **this is the hook into the teacher's enrollment role.**
4. LRN found but wrong PIN → *"Incorrect PIN. Please try again."*
5. Success → `onLoginSuccess('student', found)` → app loads the **Subject Focus** overlay.

### 3b. Teacher Login Flow
| Field | Rule |
|-------|------|
| `#teacher-id` | e.g. `T-2026-001` |
| `#teacher-name` | Full name |

Button: `#login-submit-btn` → **"Sign In to Platform"**

**Behavior:** If the Teacher ID matches `MOCK_TEACHERS`, that teacher logs in. If not, a **new teacher account is created on the fly** (department defaults to "General Academics"). Empty fields → *"Please enter both your Teacher ID and Name."*

### 3c. Quick Demo Shortcuts (`handleShortcutLogin`)
- `#dev-login-juan` — **Sophia Cruz** (top-ranked active student).
- `#dev-login-jasmine` — **Jacob Flores** (flagged for remedial; failed Muscular System).
- `#dev-login-teacher` — **Mrs. Elena Santos** (teacher).
- `#dev-login-teacher-warning` — Mrs. Santos pre-set to **Science / Grade 6 – Section Newton** to demo the *28% Failing Alert*.

> On success the app sets `role` + `currentUser`, resets `activeTab` to `dashboard`. Teachers skip subject selection (already chosen via filters); students hit the subject overlay next.

---

## 4. Student Journeys

After login, the student shell renders:
- **Header** — `WaveLogo`, student name, "`SCI/MATH/ENG` Focus" badge, and a circular **profile avatar button** (initials) that opens the Profile tab.
- **Bottom navigation** (4 tabs): **Home** · **Syllabus** · **Rankings** · **Progress**.

### Scenario S0 — Choosing a Subject Focus (Session Lock)
**Trigger:** Right after student login (`hasSelectedSubject === false`), a full-screen modal overlay (`App.tsx`) appears: *"Mabuhay, {name}! … select your primary subject focus."*

Three interactive cards:
- `#session-subject-science` 🧪
- `#session-subject-math` 🧮
- `#session-subject-english` 📚

A **Session Lock** note warns that the chosen track applies to the whole session; changing it requires logout/login. Selecting a card sets `activeSubject` and `hasSelectedSubject = true`, dismissing the overlay → lands on **Home**.

> Note: A second subject-picker also exists inside the **Syllabus** tab (`StudentLessons`) for the case where a student lands there without a locked subject.

---

### Scenario S1 — Home Dashboard (`StudentHome.tsx`, tab `dashboard`)
The student's landing hub. Elements top-to-bottom:

1. **Welcome banner** — "Mabuhay, {name}!", learner record card (LRN + course).
2. **Remediation Alert** *(conditional)* — amber card "Custom Remedial Path Generated" appears **only if** a teacher has published a `TeacherRemediationMaterial` for this `lrn`.
   - Button `#start-remedial-btn` → **"Start Remedial Work"** → jumps to Lessons tab (`onStartRemedial`).
3. **Academic Progress** — per-subject card showing completed/total lessons and a % progress bar.
4. **Next Lesson Topic** — smart suggestion (`getNextTopicForSubject`) of the first uncompleted topic. Two buttons:
   - **Read Lesson** → `onViewTopic` → opens reading view for that topic.
   - **Quiz** → `onTakeQuiz` → opens the quiz engine for that topic.
   - If all done → *"All Topics Mastered!"* with a check.
5. **Quick Dashboard Actions**:
   - `#tab-lessons-btn` → **Browse Full Syllabus**.
   - `#tab-rankings-btn` → **Learning Progress** (→ Rankings).

---

### Scenario S2 — Browsing the Syllabus (`StudentLessons.tsx`, tab `lessons`)
This is a multi-state screen (`viewState`: `syllabus` → `reading` → `quiz` → `summative`).

**(a) Subject picker** — if no subject locked, three large course cards (Mathematics / Science / English) each "Enter Course".

**(b) Syllabus map** (subject locked):
- Header "Syllabus Course Map".
- **Teacher-Assigned Study Pack** *(conditional)* — amber shelf listing the student's remedial materials with teacher notes; button `#run-remedial-{id}` → **Execute Workbook**.
- **Lessons accordion** — each lesson row (`#lesson-{id}-container`) shows: Lesson #, *X/Y Topics Completed* chip, optional *Summative: n/20* chip, title, description, and Expand/Collapse chevron.
- **Expanded lesson** → vertical **timeline of topic cards** (`#topic-card-{id}`), each with:
  - Status chip: **Not Started / In Progress / Completed / Mastered** (Mastered = perfect quiz score).
  - Quiz-score box (score, %, Passed/Completed/Not Taken).
  - Reading time.
  - Buttons: `#read-topic-{id}` **Study** · `#quiz-topic-{id}` **Take Quiz**.
- **Summative trigger** *(only when all topics in a lesson are completed)* — `#start-summative-{id}` → **"Launch Summative Quiz (20pts)"** or **"Re-take Assessment"**.

**(c) Reading view** (`viewState='reading'`):
- Back link `#back-reading-to-syllabus`, reading-time badge.
- Topic intro, structured sections (optional code block), **definition callout**, **important note**, **key takeaway**.
- Footer buttons: `#quit-reading-study` **Done Reading** · `#jump-to-topic-quiz` **Proceed to Quiz**.

**(d) Quiz engine** (`viewState='quiz'`):
- Progress bar "Question N of M", `#exit-quiz-early` **Abort Setup**.
- Options `#option-{q}-{opt}` (single-select, checkmark).
- Navigation: **Previous**, `#next-question-btn` **Next Question** (disabled until an option is chosen), and on last question `#submit-quiz-answers` **Submit Evaluation**.
- **Results view:** score `#quiz-final-score`, %, correct/incorrect counts, "Completed" badge. Then `#return-to-lesson-btn` **Return to Lesson** and (if available) `#continue-to-next-topic-btn` **Continue to Next Topic**.
- **On submit** → `onSaveQuizScore` writes a `StudentQuizAttempt` plus the topic's **`quizScores` entry** (`{ score, total, percent, passed }`) into `progressRecords` (perfect score = 3 per topic) and marks the topic completed. **→ This is the moment quiz-score data is "sent up" to the teacher.**

**(e) Summative assessment** (`viewState='summative'`):
- Aggregates every topic quiz question in the lesson; single page of questions.
- `#submit-summative-btn` **Post Final Answers** (disabled until all answered) → score normalized to **/20** → `onSaveSummativeScore`.
- Outcome view: scaled grade, **Passed (≥12)** / **Remedial Re-take**, instructor feedback, Return to Syllabus.

---

### Scenario S3 — Rankings (`StudentRankings.tsx`, tab `rankings`)
- Leaderboard is **scoped to the student's own section** (`gradeLevel`) and the active subject.
- **Top-3 podium** (Gold/Silver/Bronze cards) + a full **Class Standings** list (`#section-rank-{n}`), each row showing name, score/perfect, %.
- The current student's row is highlighted with a **"You"** badge (`UserCheck`).
- Bottom toast: *"You are currently ranked #N in your class"* with the student's %.
- Classmates without real records get **deterministic seeded scores** so the board always looks populated.

---

### Scenario S4 — Progress Report (`StudentProgressRep.tsx`, tab `progress`)
- **Radial completion ring** — % of topics completed in the active subject.
- **Lesson Progress Breakdown** — per-lesson bars + summative chips.
- **Topics to Review** — auto-compiled **weaknesses** (quiz < 70%) vs **strengths** (≥ 80%). If everything passes → congratulatory message; if nothing attempted → prompt to take quizzes.

---

### Scenario S5 — Profile & Logout (`StudentProfile.tsx`, tab `profile`)
Opened via the header avatar. Shows avatar, name, **LRN**, Focus Course, "Verified LRN" security badge, notification contact, enrollment date. Button `#app-logout-btn` → **Sign Out from Wave** → `handleLogout` resets the whole session back to the Login screen.

---

### Scenario S6 — Completing Teacher-Assigned Remedial Work
1. Teacher publishes a remedial pack (see T4) targeting this student's LRN.
2. Student's **Home** shows the amber "Custom Remedial Path Generated" alert; **Syllabus** shows the "Teacher-Assigned Study Pack".
3. Student clicks **Start Remedial Work** / **Execute Workbook** → routed into the lessons area to read the custom content and attempt the custom diagnostic quiz.
4. Results flow back into progress → teacher sees the improvement on their end.

---

## 5. Teacher Journeys

After login, the teacher shell renders:
- **Header** — `WaveLogo`, teacher name, a formatted **`SUBJECT * GRADE - SECTION`** badge, profile avatar button.
- **Bottom navigation** (3 tabs): **Home** · **Class Records** · **Analytics**.

### Scenario T0 — Setting the Class Context (Subject + Section)
**Component:** `TeacherHome.tsx` top card.
- **Active Course** dropdown — Science / Mathematics / English.
- **Active Section** dropdown — Grade 4/5/6 × Section Newton/Einstein (6 options).
- **Apply** button — disabled until both chosen; sets `activeSubject` + `activeSection` and reveals the dashboard body (`isApplied = true`).

> The demo "Teacher Warning" shortcut pre-applies Science / Grade 6 – Newton so the failing alert is immediately visible.

---

### Scenario T1 — Teacher Home Dashboard (`TeacherHome.tsx`, tab `dashboard`)
Once a class context is applied:

1. **Welcome banner** — "Welcome Back, {name}".
2. **Performance Warning** (rose alert) — flags that *28% of enrollees* are sub-passing (exceeds the 25% threshold). Button `#critical-launch-wizard` → **"Create Custom Lesson with Quiz"** → opens the **Custom AI Lesson Wizard** (in-component modal, distinct from the per-student RemediationWizard).
3. **Stat bento** — Enrollees · Class Average · Passing Rate · Under Review (fails) — all computed live from `progressRecords` for the filtered section/subject.
4. **Recently Published Remedial Content** *(conditional)* — cards for class lessons published via the custom wizard.
5. **Platform Fast Links** — **Open Class Records** (→ students tab) · **Inspect Course Analytics** (→ analytics tab).
6. **Faculty AI Tools — Copilot Remedial Wizard** — `#faculty-launch-wizard` **Run AI Wizard** → opens the per-student `RemediationWizard` with no preselection.
7. **Remedial Tickers** (right panel) — live list of failing students (`dynamicAlerts`). Each ticket: student, topic, score, and **"Resolve in AI Wizard"** → opens the wizard with the **topic context pre-filled** from that student's failure (`onLaunchWizardForStudent`), while the published pack still **broadcasts to the student's whole section**. Plus a Summative Exam deadline reminder.

**Custom AI Lesson Wizard (modal) steps:** `generating` (animated % + status messages) → `preview` (fully **editable** title, intro, content modules [add/delete], and quiz questions with editable options/correct-answer/explanation) → `confirm` (read-only review + broadcast warning) → `success` (broadcast confirmation). Footer buttons move between steps; **Confirm & Post Remediation** appends to `publishedLessons` and broadcasts to the whole section.

---

### Scenario T2 — Class Records (`TeacherStudents.tsx`, tab `students`)
- **Search bar** `#student-roster-search` — filter by name or LRN.
- **Records table** (`#student-records-table-container`) — one row per student in the section: Name/LRN, Quiz Average, Summative /20, Overall Standing %, **Status** badge (**Passing / Needs Remediation / Needs Assessment**).
- Row actions:
  - `#inspect-student-{lrn}` **View Record** → opens the **deep profile modal**.
  - **Remedial** (`Wand2`) *(only for "Needs Remediation")* → launches `RemediationWizard` pre-targeted to that student.
- **Deep Profile Modal** — 5 cards: Student Information, Academic Performance Status (overall %, standing, completion bar), Topic Assessment Results (per-lesson quiz attempts), Summative Performance (scores + teacher feedback), and auto-generated Teacher Remarks + recommended action. Closeable via `#close-student-detail-modal` / **Close Record**.

> The `onEnrollStudent` handler exists (and `handleEnrollStudent` in `App.tsx` persists new students to localStorage), which is how a teacher would **enroll a new LRN** so that student can then log in (closing the loop with Login validation branch #3).

---

### Scenario T3 — Analytics (`TeacherAnalytics.tsx`, tab `analytics`)
"Administrative Class Report" for the active section/subject:
- **Key Metrics** — Total Enrollees, Class Average, Passing Rate, Under Review.
- **Class Performance Summary** — Avg Lesson Completion, Avg Assessment Score, Overall Class Standing label (Superior/Proficient/Support Target).
- **Visualizations:**
  - **Score Distribution** — Excellent / Proficient / Satisfactory / Remedial-target bands.
  - **Assessment Trends** — per-topic average accuracy, with a **lesson selector** `#trend-lesson-selector`.
  - **Completion Rates** — per-lesson class completion bars.
- **Students Requiring Support** — table of sub-70% students with a tailored recommended intervention; or a "100% Section Success" empty state.

---

### Scenario T4 — Generating & Publishing AI Remediation (`RemediationWizard.tsx`)
The flagship teacher→section action. **All generated lessons/quizzes are addressed to a `targetSection`, never to an individual student** — a flagged student (e.g. Jacob Flores) only seeds the diagnostic context; the published pack still broadcasts to that student's whole section. Steps (`step` state):
1. **Setup** — **Target Section** (read-only, the active section), **Target Lesson** dropdown `#select-lesson`, **Target Topic** dropdown `#select-topic`. If a flagged student informs the topic, an auto-diagnostic note confirms the failed Muscular System (0/3) used to shape the content. Button `#generate-material-btn` **Autogenerate outlines**.
2. **Generating** — animated `WaveLogo` + progress %, status messages ("Connecting to Gemini…", "Decomposing failed quiz telemetry…", etc.). On 100% it synthesizes topic-appropriate content + a custom quiz, **fragmented into `chunks[]`** for LoRa relay.
3. **Preview** — title, notes-to-section, markdown handbook, and custom diagnostic questions (correct option highlighted). Buttons: `#go-edit-remedial` **Polish Content**, `#discard-material-btn` **Discard**, **Configure setup**, `#confirm-publish-remedi` **Publish to section**.
4. **Edit** — editable title / teacher notes / handbook content; **Save Changes** → back to preview.
5. **Published** — confirmation that the pack is on *"{section}'s portal"*. `#finish-wizard-close-btn` **Close wizard**.

**On publish** → `handlePublishRemedialMaterial` prepends to `remediationMaterials` (with `targetSection`) and ensures a progress record exists for each student in the section. **→ This is the moment data is "sent down" to the whole section.**

---

### Scenario T5 — Teacher Profile & Logout (`TeacherProfile.tsx`, tab `profile`)
Avatar, name, department, Teacher ID, current course, teaching section, "Staff Verified LRN Assessor" badge, portal contact, session date. `#app-logout-btn` **Sign Out from Wave Portal** → `handleLogout`.

---

## 6. Cross-User Interaction Scenarios

These end-to-end stories show the two roles meeting through the shared/synced state.

### Interaction A — Enrollment → First Login
1. **Teacher** enrolls a new LRN (Class Records, `onEnrollStudent` → persisted to `localStorage`).
2. The new `StudentUser` (with default PIN `123456`) becomes part of `students`.
3. **Student** opens the app → Login → enters LRN+PIN. Validation now finds the LRN (branch #5 success) instead of rejecting it (branch #3). The student is in.

### Interaction B — Quiz Result → Teacher Visibility (data "up")
1. **Student** completes a topic quiz (S2d) → `onSaveQuizScore` writes to `progressRecords[lrn]`.
2. **Teacher** immediately sees it reflected in:
   - **Class Records** (quiz average, status may flip to *Needs Remediation* if < 70%).
   - **Home Remedial Tickers** + the **28% failing** computation.
   - **Analytics** (distribution, trends, support table).

> Production equivalent: the attempt is tokenized → router → LoRa → AI server → synced to the teacher's device.

### Interaction C — Failing Student → AI Remediation → Student Receives It (data "down")
1. **Student** (e.g. Jacob Flores) fails Muscular System (0/3) — seeded in data, or produced live via Interaction B.
2. **Teacher** sees Jacob in **Remedial Tickers** / Class Records with **Needs Remediation**.
3. Teacher clicks **Resolve in AI Wizard / Remedial** → `RemediationWizard` opens with the topic context pre-filled from Jacob's failure (`L1-T2`), but the **target is his whole section**, not Jacob alone.
4. Teacher generates → previews/edits → **Publish to section**.
5. **Student Jacob** (and every section-mate) logs in → **Home** shows "Custom Remedial Path Generated"; **Syllabus** shows the "Teacher-Assigned Study Pack".
6. Jacob runs the workbook + custom quiz → new results flow back (Interaction B) → teacher sees the recovery.

### Interaction D — Whole-Class Custom Lesson Broadcast
1. **Teacher** triggers the **Custom AI Lesson Wizard** from the *28% failing* warning (T1).
2. Edits/confirms → **Confirm & Post Remediation** → broadcast to the entire **section**.
3. Appears in **Recently Published Remedial Content** on the teacher home, and (in production) is delivered to every student LRN in that section.

### Interaction E — Rankings as Social Feedback Loop
- As students across a section submit quizzes (Interaction B), the **Rankings** board reorders. A student's relative position is recomputed against section-mates, encouraging continued participation — and the same per-student scores feed the teacher's analytics.

---

## 7. Global UI Elements Reference

| Element | Where | Purpose |
|---------|-------|---------|
| `WaveLogo` | Header, banners, loaders | Brand mark (SVG: concentric "signal waves" over a stylized **W** + open-book crest — evoking LoRa signal + learning). |
| Header avatar button | Top-right (both roles) | Opens Profile tab; ring-highlighted when active. |
| Bottom nav bar | Fixed bottom | Student: Home/Syllabus/Rankings/Progress · Teacher: Home/Class Records/Analytics. |
| Subject/Section selectors | Student overlay; Teacher home card | Scope all data to one subject (+ section for teachers). |
| Motion transitions | Tab switches, modals | `AnimatePresence` fade/slide for premium feel. |
| Simulated clock | `App.tsx` | `currentTime` updates each minute (session realism). |
| Session lock | Student | Subject can't change without logout (consistency of scoped data). |

---

## 8. Component / Screen Map

```
App.tsx  (session state, routing, shared stores: progressRecords + remediationMaterials)
│
├─ LoginScreen.tsx ............ shared auth (student LRN+PIN / teacher ID+name / demo shortcuts)
│
├─ STUDENT (role === 'student')
│   ├─ [overlay] Subject Focus picker (in App.tsx)
│   ├─ StudentHome.tsx ........ dashboard: welcome, remedial alert, progress, next topic, quick actions
│   ├─ StudentLessons.tsx ..... syllabus ↔ reading ↔ quiz ↔ summative (+ teacher study pack shelf)
│   ├─ StudentRankings.tsx .... section leaderboard (podium + standings + "You")
│   ├─ StudentProgressRep.tsx . radial ring, lesson bars, strengths/weaknesses
│   └─ StudentProfile.tsx ..... profile + logout
│
├─ TEACHER (role === 'teacher')
│   ├─ TeacherHome.tsx ........ context filters, failing warning, stats, tickers, Custom AI Lesson Wizard (modal)
│   ├─ TeacherStudents.tsx .... class records table + deep student modal (+ enrollment handler)
│   ├─ TeacherAnalytics.tsx ... metrics, distributions, trends, support table
│   └─ TeacherProfile.tsx ..... profile + logout
│
├─ RemediationWizard.tsx ...... per-student AI remedial generator (setup→generating→preview→edit→published)
└─ WaveLogo.tsx ............... brand SVG
```

### Shared State Bridges (the in-app "sync layer")
| Store (in `App.tsx`) | Written by | Read by | Real-world transport |
|----------------------|-----------|---------|----------------------|
| `progressRecords` | Student (quiz/summative submissions — `quizScores`, `StudentSummativeResults` w/ failed items) | Teacher (records, analytics, tickers) | App → router → LoRa → AI server → Teacher |
| `remediationMaterials` | Teacher (RemediationWizard publish — addressed to `targetSection`, sent in `chunks`) | Student (home alert, lessons pack — every LRN in the section) | Teacher → AI server → LoRa → router → App |
| `rankings` | Teacher end (section leaderboard computation) | Student (Rankings tab) | Teacher → AI server → LoRa → router → App |
| `students` (+ localStorage) | Teacher (enrollment) / Student (`StudentSignup`) | Login validation, rankings, tables | Roster sync both directions |

---

*Generated as a comprehensive walkthrough of the Wave front-end. Every screen state, button id, and the student↔teacher data bridge described above maps directly to the source in `Wave/src/`.*

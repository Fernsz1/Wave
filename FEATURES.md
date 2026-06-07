# Wave — Complete Features Reference

> **Wave** is an offline-first, AI-powered educational learning platform built for rural students in Grades 4–6 who have limited or no internet access. It connects students and teachers through a local wireless network (MQTT/LoRa), allowing full learning and real-time monitoring without the internet.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Student Features](#2-student-features)
   - [Login & Authentication](#21-login--authentication)
   - [Subject Focus Selection](#22-subject-focus-selection)
   - [Home Dashboard](#23-home-dashboard)
   - [Syllabus & Lessons](#24-syllabus--lessons)
   - [Topic Reading](#25-topic-reading)
   - [Topic Quizzes](#26-topic-quizzes)
   - [Summative Assessment](#27-summative-assessment)
   - [Class Rankings Leaderboard](#28-class-rankings-leaderboard)
   - [Progress Report](#29-progress-report)
   - [Remedial Study Packs](#210-remedial-study-packs)
   - [Student Profile](#211-student-profile)
3. [Teacher Features](#3-teacher-features)
   - [Teacher Login & Account](#31-teacher-login--account)
   - [Class Context Selector](#32-class-context-selector)
   - [Teacher Home Dashboard](#33-teacher-home-dashboard)
   - [Class Records](#34-class-records)
   - [Student Analytics](#35-student-analytics)
   - [AI Remediation Wizard](#36-ai-remediation-wizard)
   - [Teacher Profile](#37-teacher-profile)
4. [Cross-User Interactions](#4-cross-user-interactions)
   - [Student Enrollment](#41-student-enrollment)
   - [Quiz Results → Teacher Visibility](#42-quiz-results--teacher-visibility)
   - [Remediation Loop](#43-remediation-loop)
5. [Offline-First Architecture](#5-offline-first-architecture)
6. [Sync & Communication Layer](#6-sync--communication-layer)
7. [Data Protocol & Wire Format](#7-data-protocol--wire-format)
8. [Tech Stack Summary](#8-tech-stack-summary)
9. [Subjects & Curriculum Structure](#9-subjects--curriculum-structure)

---

## 1. System Overview

Wave is designed to solve a real-world problem: **how do you deliver quality education and AI-powered remediation when there is no internet?**

The platform works in three layers:

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend App** | React 19 + TypeScript | What students and teachers see and interact with |
| **Backend Server** | Django REST API | Stores data, computes rankings, processes syncs |
| **Sync Layer** | MQTT broker (Mosquitto) | Delivers data between app and server over local network |

Even without a server connection, the app works fully offline — all data is saved locally and synced automatically when a connection is available.

---

## 2. Student Features

### 2.1 Login & Authentication

Students log in using their **12-digit Learner Reference Number (LRN)** and a **6-digit PIN**.

- New students are assigned the default PIN `123456`, which they can use immediately after a teacher enrolls them.
- The system validates the LRN and PIN before granting access.
- There are demo shortcuts on the login screen so teachers and students can quickly try the app.

**Why this matters:** Using the LRN keeps the app aligned with the Philippine education system's official student ID, which students already carry.

---

### 2.2 Subject Focus Selection

After logging in, each student selects which subject they want to study for the session: **Science**, **Mathematics**, or **English**.

- This selection is locked for the entire session — students cannot switch subjects mid-session without logging out.
- The selected subject determines which lessons, quizzes, rankings, and progress data are shown throughout the app.

**Why this matters:** Focusing on one subject at a time reduces cognitive overload and keeps the learning experience organized and purposeful.

---

### 2.3 Home Dashboard

The first screen a student sees after logging in. It gives a quick overview of everything relevant to the student.

What the Home screen shows:
- A **welcome message** with the student's name
- The **currently focused subject** and grade/section
- A **remedial alert card** (amber/yellow) that appears when a teacher has published a new custom remedial lesson for the student's section
- Quick navigation to lessons, rankings, and progress

**Why this matters:** The home screen is designed so a student immediately knows what to do next — whether it is continuing a lesson or completing a teacher-assigned remedial activity.

---

### 2.4 Syllabus & Lessons

Students can browse all available lessons organized by subject. Each subject contains **4 lessons**, and each lesson contains **5–6 topics**.

The Syllabus screen shows:
- All 4 lessons for the selected subject
- Each lesson can be expanded to reveal its individual topics
- A **teacher-assigned study pack shelf** appears at the top when the teacher has published remedial content for the section
- Progress indicators showing which topics have been completed

**Lesson structure example (Science):**
```
Lesson 1: Human Body Systems
  ├── Topic 1: The Skeletal System
  ├── Topic 2: The Muscular System
  ├── Topic 3: The Digestive System
  ├── Topic 4: The Respiratory System
  └── Topic 5: The Circulatory System
```

Students click a topic to begin reading its content or taking its quiz.

---

### 2.5 Topic Reading

Each topic contains a structured **reading module** that students go through before taking a quiz.

Reading content is organized as:
- **Introduction** — A brief overview of the topic
- **Sections** — The main body of the lesson broken into named parts (like chapters)
- **Definition Box** — A highlighted definition for a key term
- **Key Takeaway** — A summary of the most important idea
- **Important Note** — A callout box for critical information students should not miss

Each topic is designed to take approximately **5 minutes** to read, making it suitable for short learning sessions even in low-energy environments.

---

### 2.6 Topic Quizzes

After reading a topic, students take a **3-question multiple choice quiz**.

How it works:
- Each question has 4 options (A, B, C, D)
- Students select one answer per question
- After submitting, they see their **score out of 3** and the correct answers with explanations
- The score is saved and automatically reported to the teacher

Scoring context:
- A score of **2/3 or 3/3** = topic passed
- A score of **0/3 or 1/3** = topic failed → the student may appear in the teacher's remedial list

**Why this matters:** Short quizzes after each topic give both the student and teacher immediate feedback on comprehension, rather than waiting for a big end-of-unit exam.

---

### 2.7 Summative Assessment

After completing all topics in a lesson, students can take a **Summative Assessment** — a comprehensive 20-question exam that covers the entire lesson.

How it works:
- The summative pulls questions from all topic quizzes in the lesson, assembled into one 20-question test
- Students answer all 20 questions at once
- Passing mark is **12/20 (60%)**
- After submitting, students see their score, whether they passed, and feedback

What happens with the results:
- If a student **passes**, they are marked as "Passing" in the teacher's records
- If a student **fails**, they are marked as "Needs Remediation" and may be flagged for a teacher-generated remedial lesson

**Why this matters:** Summative assessments provide a holistic measure of lesson mastery, and the results directly drive the teacher's decision to create remedial content.

---

### 2.8 Class Rankings Leaderboard

Students can see how they rank compared to their classmates within their section, making learning more engaging through friendly competition.

The Rankings screen has two parts:

**Podium (Top 3):**
- The top three students are shown on a visual podium
- Gold (1st), Silver (2nd), and Bronze (3rd) medal indicators
- Shows each student's score and percentage

**Full Standings Table:**
- A list of all students in the section with their rank, name, score, and percentage
- The current student's own row is highlighted so they can immediately find themselves
- Shows the student's personal rank and percentile (e.g., "You are in the top 20% of your class")

Rankings are computed based on quiz scores in the selected subject across all completed topics.

**Why this matters:** Visible rankings encourage students to stay engaged and motivated, turning solo study into a shared class experience even without real-time interaction.

---

### 2.9 Progress Report

The Progress Report gives each student a personalized view of how they are doing across all lessons and topics.

What it shows:
- **Radial completion ring** — A circular chart showing overall lesson completion percentage per subject
- **Lesson-by-lesson progress bars** — A bar for each lesson showing how far along the student is
- **Weakness/Strength classification:**
  - Topics where the student scored **below 70%** are flagged as **Weaknesses** (shown in a warning color)
  - Topics where the student scored **80% or above** are highlighted as **Strengths** (shown in a success color)

**Why this matters:** Students can see exactly where they are excelling and where they need more work, allowing self-directed improvement. Teachers also use this data to guide remediation.

---

### 2.10 Remedial Study Packs

When a teacher creates and publishes a remedial lesson for the section, students receive it as a **Study Pack** directly in the app.

How students experience it:
1. An **amber alert card** appears on the Home screen: "Custom Remedial Path Generated"
2. In the Syllabus, a **"Teacher-Assigned Study Pack" shelf** appears at the top with the remedial lesson
3. The student opens the pack, reads the teacher-written content and notes, and takes the custom diagnostic quiz
4. After submitting, the results are automatically sent back to the teacher for review

**What a study pack contains:**
- A custom lesson title
- Teacher notes (personal message or instructions from the teacher)
- Handbook content (the remedial learning material, written or AI-assisted)
- A custom diagnostic quiz (questions written specifically for this remedial objective)

**Why this matters:** Instead of a generic retry of failed content, students receive targeted material created specifically for their section's identified weaknesses. This closes the loop between assessment and intervention.

---

### 2.11 Student Profile

Students can view their profile information and log out.

Profile shows:
- Full name
- LRN (Learner Reference Number)
- Grade level and section
- Currently focused subject
- A verified account badge

---

## 3. Teacher Features

### 3.1 Teacher Login & Account

Teachers log in using their **Teacher ID** (format: `T-2026-001`) and their name.

- On first login, an account is automatically created — no pre-registration needed
- The system recognizes the teacher ID and grants access to teacher-specific views
- Teachers see a different navigation and dashboard than students

---

### 3.2 Class Context Selector

Before accessing any class data, the teacher selects which class they want to manage:

- **Active Course**: Science, Mathematics, or English
- **Grade and Section**: Grade 4/5/6 × Section Newton or Einstein (6 combinations)

Once selected, all data displayed — student records, analytics, remedial tickers — is filtered to that specific class. This context is always visible in the header as a badge (e.g., `SCIENCE * GRADE 4 - SECTION NEWTON`).

**Why this matters:** A teacher may handle multiple subjects and sections. Scoping the view prevents confusion and ensures actions affect only the intended class.

---

### 3.3 Teacher Home Dashboard

The Teacher Home is the central command screen, providing a real-time snapshot of class health.

What it contains:

**Welcome Card** — Greets the teacher and shows the selected class context.

**Performance Warning Card** (appears when ≥ 25% of students are failing):
- A **rose/red alert** that signals the class needs attention
- Provides a direct "Create Custom Lesson with Quiz" action button
- This triggers an in-dashboard AI lesson creation modal for the whole class

**Stat Bento** — A grid of key metrics:
- Total enrolled students
- Class average score
- Passing rate percentage
- Number of students under review

**Remedial Tickers** (right sidebar — live feed):
- A scrolling list of students who are failing (below 70% on a quiz)
- Each ticker shows the student's name and which topic they failed
- A "Resolve in AI Wizard" button opens the Remediation Wizard with that topic pre-filled
- Also shows **summative deadline reminders** for upcoming assessments

**Recently Published Remedial Content**:
- Cards showing the remedial lessons the teacher has already published to the section

**Fast Links** — Quick navigation to Class Records and Analytics

---

### 3.4 Class Records

The Class Records tab is a full student roster with performance data for every student in the selected class.

**Records Table** — One row per student:
| Column | What it shows |
|---|---|
| Name | Student's full name |
| LRN | 12-digit learner ID |
| Quiz Average | Average score across all quiz attempts (%) |
| Summative | Score out of 20 on the lesson summative |
| Standing | Overall performance percentage |
| Status | Passing / Needs Remediation / Needs Assessment |

**Status badges explained:**
- **Passing** (green) — Student is performing at or above 70%
- **Needs Remediation** (amber) — Student failed a quiz or summative; teacher action recommended
- **Needs Assessment** (gray) — Student has not yet taken any quizzes

**Search** — Teachers can search the roster by student name or LRN to find a specific student quickly.

**Deep Student Profile Modal** — Clicking any student opens a detailed 5-card profile:
1. Personal info and LRN
2. Quiz scores per topic (all topics in the lesson)
3. Summative result and feedback
4. Topic-by-topic performance breakdown
5. Recommended remediation action

**Enroll New Student** — Teachers can add a new student to the section by entering their LRN. The student can then log in immediately using the default PIN.

---

### 3.5 Student Analytics

The Analytics tab provides data visualizations to help teachers understand overall class performance trends.

**Key Metrics Row** — Four summary numbers at a glance:
- Total enrollees in the section
- Class average score
- Passing rate
- Number of students under review

**Score Distribution Chart** — Shows how students are spread across performance bands:
- **Excellent** (≥ 90%)
- **Proficient** (80–89%)
- **Satisfactory** (70–79%)
- **Remedial** (below 70%)

**Assessment Trends** — Shows average topic scores across a selected lesson:
- Teachers can select which lesson to analyze
- A chart or table shows which topics the class struggled with most
- This directly informs which topics to target in a remedial lesson

**Completion Rates** — Shows what percentage of the class has completed each lesson.

**Support Table** — A list of all students who scored below 70%, along with:
- The specific topic where they struggled
- An AI-generated intervention recommendation for the teacher

---

### 3.6 AI Remediation Wizard

The Remediation Wizard is Wave's most powerful teacher feature. It is a **5-step workflow** that guides a teacher through creating and publishing a custom AI-assisted remedial lesson for the class.

**When to use it:**
- A student (or group of students) failed a topic quiz
- The teacher wants to create targeted review material and a custom diagnostic quiz
- Can be opened directly from the Remedial Tickers ("Resolve in AI Wizard") or from the performance warning card

**The 5 Steps:**

**Step 1 — Setup**
- Target Section is pre-filled (read-only) — the remedial lesson always goes to the whole section
- Teacher selects which **lesson** and **topic** to address
- Optionally selects a specific underperforming student to seed the AI context (what that student got wrong is used to guide generation)

**Step 2 — Generating**
- An animated progress screen shows while the system (Gemini AI, when connected) creates the remedial content
- Content includes: a lesson handbook and a custom diagnostic quiz

**Step 3 — Preview**
- The teacher sees the full AI-generated content before publishing:
  - Lesson title
  - Teacher notes placeholder
  - Handbook content (the remedial reading material)
  - Custom quiz questions with options and correct answers

**Step 4 — Edit**
- The teacher can edit any part of the generated content:
  - Change the title
  - Write or update teacher notes (a personal message to the class)
  - Edit the handbook content
  - Modify, add, or remove quiz questions and answer options
  - Mark which answer is correct

**Step 5 — Published**
- Teacher clicks "Publish" and sees a confirmation dialog
- The content is broadcast to **the entire selected section** (not just one student)
- All students in the section immediately receive:
  - A home screen alert
  - The study pack in their Syllabus

**Why this matters:** Most learning platforms offer generic remedial content. Wave's wizard lets a teacher create content shaped by actual student failure data, reviewed and edited by a real teacher, then delivered to the whole class — combining AI efficiency with human judgment.

---

### 3.7 Teacher Profile

Teachers can view their profile and log out.

Profile shows:
- Full name and Teacher ID
- Department (e.g., "Science Dept.")
- Currently selected grade, section, and subject
- Verified account badge

---

## 4. Cross-User Interactions

### 4.1 Student Enrollment

1. Teacher opens **Class Records** and clicks "Enroll New Student"
2. Teacher enters the student's **12-digit LRN**
3. The student now appears in the roster with "Needs Assessment" status
4. The student can log in immediately using LRN + default PIN `123456`

---

### 4.2 Quiz Results → Teacher Visibility

Every time a student submits a quiz, the data flows to the teacher's view automatically:

1. Student completes a topic quiz
2. Score is saved locally and synced to the server
3. Teacher's Class Records updates:
   - The student's quiz average recalculates
   - Status may change from "Needs Assessment" → "Passing" or "Needs Remediation"
4. Teacher's Analytics updates:
   - Score distribution shifts
   - Assessment trends adjust
   - Support table may gain or lose a student
5. If the student scored below 70%, they appear in the **Remedial Tickers** on the Teacher Home

---

### 4.3 Remediation Loop

This is Wave's core feedback cycle — the full journey from a student failing to getting better:

```
Student fails topic quiz (e.g., 0/3 or 1/3)
        ↓
Student appears in Remedial Tickers on Teacher Home
        ↓
Teacher clicks "Resolve in AI Wizard"
        ↓
Teacher generates → edits → publishes remedial lesson
        ↓
Entire section receives home alert + study pack in Syllabus
        ↓
Students complete custom diagnostic quiz
        ↓
Results sent back to teacher
        ↓
Teacher monitors improvement in Class Records & Analytics
```

This loop can run multiple times for the same topic until the class achieves mastery.

---

## 5. Offline-First Architecture

Wave is designed to work **even when there is no internet or server connection**.

How offline mode works:

**Local Storage** — All student progress (completed topics, quiz scores, summative results) is saved in the browser's local storage. Nothing is lost when the connection drops.

**MockRepository** — When running without a server, all data lives in memory and local storage. The app behaves identically from the user's perspective.

**Outbox Queue** — When a student submits a quiz offline, the result is added to an "outbox" queue in local storage. When connectivity is restored, the queue is flushed and all pending data is sent to the server.

**HttpRepository** — When a server is available (set via `VITE_API_BASE` environment variable), the app switches to using real REST API calls automatically.

**MQTT Retained Messages** — When the teacher publishes a remedial lesson while a student is offline, the message is stored on the MQTT broker with a "retain" flag. When the student reconnects, they automatically receive the latest retained message — no polling needed.

---

## 6. Sync & Communication Layer

Wave uses **MQTT** (a lightweight messaging protocol) to sync data between students, teachers, and the server over a local network.

**Two directions of data flow:**

| Direction | What is sent | Who sends it |
|---|---|---|
| **"Up" (Student → Server)** | Quiz scores, progress updates, summative results | Student app |
| **"Down" (Server → Student)** | Rankings, remedial lessons, catalog updates | Server / Teacher |

**MQTT Topic Structure:**
- Per-student messages: `wave/<lrn>/<MessageType>` (e.g., `wave/123456789012/StudentProgress`)
- Section-wide broadcasts: `wave/<section>/<MessageType>` (e.g., `wave/grade4-newton/Rankings`)

**Reliability:**
- QoS 1 (at-least-once delivery) ensures messages are not lost even if the connection drops mid-send
- Retained flag on section-wide messages means late-connecting students always get the latest version

**For future LoRa deployment:**
- The sync layer is designed to be swapped out — MQTT today, LoRa radio in the future
- The chunking system fragments large messages (like remedial packs) into LoRa-frame-sized pieces and reassembles them on the receiving end

---

## 7. Data Protocol & Wire Format

Wave uses a custom **tokenized-array binary wire protocol** to make data transmission as compact as possible — critical for low-bandwidth LoRa radio links.

**How it works:**
- Instead of sending verbose JSON like `{"studentLrn": "123456789012", "score": 3}`, the codec converts data into a compact array of values: `[0, "123456789012", 3]`
- Field names are replaced by their integer positions defined in a shared manifest file (`protocol/wire_manifest.json`)
- This reduces message size dramatically, which matters on LoRa where bandwidth is measured in bytes per second

**Cross-language consistency:**
- The codec is implemented in both **TypeScript** (frontend) and **Python** (backend) from the same manifest
- Golden test fixtures (`protocol/fixtures/golden.json`) are tested by both suites to prove they produce identical output

**Message types supported:**
| Type | Direction | Purpose |
|---|---|---|
| `StudentSignup` | Up | Register a new student |
| `TeacherSignup` | Up | Register a new teacher |
| `StudentProgress` | Up | Send quiz scores and completion |
| `StudentSummativeResults` | Up | Send summative exam results |
| `QuizAttemptRequest` | Up | Request a quiz from the server |
| `Rankings` | Down | Deliver class leaderboard to students |
| `TeacherRemediationMaterial` | Down | Deliver remedial lesson to section |
| `LessonCatalog` | Down | Deliver lesson content to device |

---

## 8. Tech Stack Summary

| Component | Technology | Version |
|---|---|---|
| Frontend Framework | React | 19 |
| Language | TypeScript | 5.8.2 |
| Build Tool | Vite | 6.2.3 |
| Styling | Tailwind CSS | v4 |
| Animations | Motion (Framer Motion) | latest |
| Icons | lucide-react | latest |
| Validation | Zod | 4.4.3 |
| Messaging | MQTT (mqtt.js) | 5.15.1 |
| AI Generation | Google Gemini API | 2.4.0 |
| Testing (Frontend) | Vitest | 4.1.8 |
| Backend Framework | Django + Django REST Framework | 5.x + 3.15+ |
| MQTT Broker | Eclipse Mosquitto | latest |
| MQTT Client (Python) | paho-mqtt | 2.0+ |
| Database | SQLite (development) | — |
| Testing (Backend) | pytest + pytest-django | 8.0+ / 4.8+ |
| Python Version | Python | 3.12+ |

---

## 9. Subjects & Curriculum Structure

Wave covers three subjects across **4 lessons per subject**, each with **5–6 topics**.

### Science
| Lesson | Topics Covered |
|---|---|
| Lesson 1: Human Body Systems | Skeletal, Muscular, Digestive, Respiratory, Circulatory Systems |
| Lesson 2–4 | Life science and physical science topics |

### Mathematics
| Lesson | Topics Covered |
|---|---|
| Lesson 1–4 | Fractions, Decimals, Geometry, and related topics |

### English
| Lesson | Topics Covered |
|---|---|
| Lesson 1–4 | Parts of Speech, Vocabulary, Comprehension, and related topics |

**Assessment structure per topic:**
- 1 reading module (~5 minutes)
- 3-question multiple choice quiz

**Assessment structure per lesson:**
- 1 summative exam (20 questions, passing score = 12/20 = 60%)

---

*This document covers the complete feature set of Wave as implemented. Features marked as "future roadmap" (production LoRa hardware, full Gemini AI integration, PIN hashing) are architecturally planned but not yet active.*

# Wave AI Implementation Guide
## Gemini Integration, Payload Design & Full LoRa Pipeline

---

## Table of Contents

1. [Device Roles & Setup](#1-device-roles--setup)
2. [Network Architecture](#2-network-architecture)
3. [Internet: When It Is Required](#3-internet-when-it-is-required)
4. [What the AI Generates](#4-what-the-ai-generates)
5. [Attempt Logic & AI Trigger Points](#5-attempt-logic--ai-trigger-points)
6. [Full Data Flow](#6-full-data-flow)
7. [Implementing the Django AI Endpoint](#7-implementing-the-django-ai-endpoint)
8. [Wiring the Frontend](#8-wiring-the-frontend)
9. [Payload Specifications](#9-payload-specifications)
10. [How Chunking Works](#10-how-chunking-works)
11. [Running the Full Test Step by Step](#11-running-the-full-test-step-by-step)

---

## 1. Device Roles & Setup

| # | Physical Device | Role in Wave | Internet? | Connects To | What Runs On It |
|---|---|---|---|---|---|
| **Phone 1** | Android phone | **Router** — creates the local hotspot all devices communicate through | No | Its own hotspot (is the hotspot) | Hotspot only. No app. |
| **Laptop** | Windows laptop | **Server** (Django + MQTT) + **Teacher browser** | **Yes** — via ethernet to home/office router | Phone 1 hotspot (LAN) + home router (internet) | Django, Mosquitto MQTT broker, Vite dev server, Teacher browser tab |
| **Phone 2** | Android phone | **Student device** | No | Phone 1 hotspot only | Student opens `http://192.168.x.x:5173` in mobile browser |

> **Key point:** The laptop runs two network connections simultaneously — WiFi to Phone 1's hotspot for LAN communication, and ethernet to a home/office router for internet. Phone 1 and Phone 2 have no internet at all. Only the laptop's Django server reaches the Gemini API — via the ethernet connection.

---

## 2. Network Architecture

```
╔══════════════════════════════════════════════════════════════════╗
║                        INTERNET                                  ║
║               (home router / office WiFi)                        ║
╚══════════════════╦═══════════════════════════════════════════════╝
                   ║ ethernet cable (internet only)
         ╔═════════╩════════════════════════════╗
         ║           LAPTOP                     ║
         ║  ┌─────────────────────────────────┐ ║
         ║  │  Django server  :8000           │ ║
         ║  │  MQTT broker    :9001           │ ║  ← calls Gemini API
         ║  │  Vite frontend  :5173           │ ║     over ethernet
         ║  │  Teacher browser tab            │ ║
         ║  └─────────────────────────────────┘ ║
         ║  WiFi: connected to Phone 1 hotspot  ║
         ║  LAN IP: 192.168.43.x               ║
         ╚══════════════╦═══════════════════════╝
                        ║ WiFi (local LAN only)
              ╔══════════╩═══════════╗
              ║      PHONE 1         ║
              ║   Hotspot Router     ║
              ║   192.168.43.1      ║
              ║   NO internet        ║
              ╚══════╦═══════════════╝
                     ║ WiFi (local LAN only)
              ╔══════╩═══════════════╗
              ║      PHONE 2         ║
              ║   Student Device     ║
              ║   Opens browser →    ║
              ║   192.168.43.x:5173 ║
              ║   NO internet        ║
              ╚══════════════════════╝
```

---

## 3. Internet: When It Is Required

Internet (laptop ethernet) is only needed during AI generation calls. All other sync — quiz submissions, MQTT delivery, LoRa chunk broadcasting — runs entirely on the local LAN.

```
─────────────────────────────────────────────────────────────────────
PHASE 1: Normal Learning  (internet OFF is fine)
  Student reads lessons → takes topic quizzes → submits summative
  Results sync UP to Django over local LAN
  Rankings recomputed and broadcast DOWN via MQTT on local LAN
─────────────────────────────────────────────────────────────────────
PHASE 2: Teacher Generates Remedial Pack  (internet ON — brief)
  Teacher opens RemediationWizard, selects topic + student context
  Clicks "Autogenerate"
  ↓ INTERNET NEEDED HERE ↓
  Django builds prompt from failed items + topic context
  Gemini API returns: lesson content + diagnostic quiz + teacherNotes
  ↓ INTERNET NO LONGER NEEDED ↓
  Generated pack stored in Django SQLite
─────────────────────────────────────────────────────────────────────
PHASE 3: Teacher Publishes (internet OFF)
  Teacher previews → edits if needed → clicks Publish
  Django encodes full pack to tokenized array
  fragment() splits it into 200-byte LoRa chunks
  MQTT broadcasts each chunk to all devices on local LAN
  Phone 2 (student) reassembles → sees remedial lesson + quiz + notes
─────────────────────────────────────────────────────────────────────
PHASE 4: Student Completes Remedial Quiz (internet OFF)
  Student reads AI-generated lesson → takes diagnostic quiz
  Results sync UP to Django over local LAN
  Teacher sees updated status in Class Records
─────────────────────────────────────────────────────────────────────
PHASE 5: Student Submits 2nd Quiz Attempt → AI Selects Variant (internet ON — brief)
  Student submits their 2nd attempt on a topic quiz
  App sends QuizAttemptRequest UP with:
    - failedItems[] (question IDs + selected option + correct option)
    - questionPool[] (the full 10-item pre-authored pool from on-device JSON)
    - score, attempt number, topicId
  ↓ INTERNET NEEDED HERE ↓
  Django sends failedItems + questionPool to Gemini
  Gemini selects the best 5 questions from the pool for this student's gaps
  ↓ INTERNET NO LONGER NEEDED ↓
  Django sends the 5 selected question IDs DOWN via MQTT → student device
  Student takes a 5-item variant drawn from the same on-device JSON for attempt 3
─────────────────────────────────────────────────────────────────────
PHASE 6: Student Submits 2nd Summative Attempt → Failed Items to Teacher (internet OFF)
  Student submits their 2nd (or 3rd) summative attempt
  App sends StudentSummativeResults UP with:
    - score, percent, passed, attemptNumber
    - failedItems[] with full question detail (topic grouping, selected vs correct)
  Django persists the result and increments the attempt counter
  Teacher side receives updated analytics — can see which specific summative
    items each student keeps missing across attempts
  After each summative submission Django checks the section pass rate:
    if ≥ 25% of students in the section have failed after all 3 attempts →
    Remedial Banner is broadcast DOWN via MQTT to the teacher's dashboard
─────────────────────────────────────────────────────────────────────
```

| Action | Internet needed? |
|---|---|
| Student submits 1st quiz or summative attempt | No |
| **Student submits 2nd quiz attempt → AI selects variant for attempt 3** | **Yes — Phase 5 only** |
| AI-selected variant (5 questions) delivered to student via MQTT | No |
| Student submits 2nd / 3rd summative attempt → failed items sent to teacher | No |
| Django checks 25% fail-rate threshold and broadcasts remedial banner | No |
| Teacher views analytics / rankings / failed-item details | No |
| MQTT broadcasts to student devices | No |
| **Teacher clicks "Autogenerate" in wizard** | **Yes — Phase 2 only** |
| Teacher previews / edits / publishes remedial pack | No |
| Remedial pack (lesson + quiz + notes) delivered via LoRa | No |
| Student completes remedial quiz | No |

---

## 4. What the AI Generates

The AI is responsible for two generation events. Everything else in the system (preloaded lessons, topic quizzes, summative tests) is pre-authored in the subject JSON files.

### Generation Event 1 — Remedial Pack (teacher-triggered)

When a teacher clicks "Autogenerate" in the Remediation Wizard, Gemini produces three outputs that are bundled together into one `TeacherRemediationMaterial` object:

| Output | Field | Description | Sent to student? |
|---|---|---|---|
| Remedial lesson | `content` | Markdown lesson body (≤250 words) with a real-world analogy suited to rural Grade 6 children. Targets the exact concepts the student got wrong. | **Yes** — travels in chunked LoRa payload |
| Diagnostic quiz | `createdQuiz[]` | 10 new multiple-choice questions (not from the pre-authored pool) directly testing the failed concepts. Each has 4 options, a correct index, and a one-sentence explanation. | **Yes** — travels in chunked LoRa payload |
| Teacher feedback note | `teacherNotes` | One or two encouraging sentences addressed to the section — a teacher-voice message the student sees at the top of the study pack. | **Yes** — travels in chunked LoRa payload |

All three outputs are encoded together, fragmented into 200-byte LoRa chunks, and broadcast via MQTT to the student device. The student's app reassembles the chunks and displays all three as one study pack.

### Generation Event 2 — Quiz Variant (server-triggered, after student failure)

When a student fails a topic quiz, the server receives the `QuizAttemptRequest` with the student's failed item IDs. Django sends those IDs plus the full 10-question pre-authored pool for that topic to Gemini. Gemini selects and reorders the best subset to address the student's specific gaps. No new questions are invented — the selection comes entirely from the pre-authored JSON.

| Input to Gemini | Source |
|---|---|
| Failed question IDs | `QuizAttemptRequest.failedItems[]` |
| Full question pool (10 items) | `science.json` / `mathematics.json` / `english.json` |

| Output from Gemini | Sent to student? |
|---|---|
| Selected subset of question IDs (5 questions) | Yes — via MQTT, tiny payload, no chunking needed |

---

## 5. Attempt Logic & AI Trigger Points

Both topic quizzes and the summative test allow a maximum of **3 attempts**. The AI is engaged on the **2nd attempt** in both cases — the payload sent on that submission carries richer data that the server uses to either select variant questions (quiz) or surface analytics to the teacher (summative).

---

### 5.1 Topic Quiz — 3-Attempt Cycle

| Attempt | Student experience | Payload sent UP | AI involvement |
|---|---|---|---|
| **1st** | 10-item quiz from the pre-authored on-device JSON pool | `score`, `answers[]`, `completedAt` | None |
| **2nd** | Same 10-item pool again | `score`, `answers[]`, `failedItems[]` (question ID + selected option + correct option for each wrong answer), full `questionPool[]` (all 10 items), `attemptNumber: 2` | **AI triggered:** Django sends `failedItems` + `questionPool` to Gemini → Gemini selects the 5 questions from the pool that best target the student's specific gaps → selected questions sent DOWN via MQTT before the 3rd attempt |
| **3rd** | 5-item AI-selected variant drawn from the same on-device JSON | `score`, `answers[]`, `failedItems[]`, `attemptNumber: 3` | None — this is the final attempt |
| After 3 | "View Result" button only — no more retakes | — | — |

> **Critical constraint:** The AI never invents new questions for a topic quiz variant. Gemini selects from the same pre-authored 10-question pool that is already stored in the subject JSON on the student's device. The AI only decides *which 5 of the 10* to show, prioritising the concepts the student got wrong.

---

### 5.2 Summative Test — 3-Attempt Cycle

The summative draws 20 questions from a 40-item pool stored in the lesson JSON. Each attempt receives a fresh draw of 20.

| Attempt | Student experience | Payload sent UP | Teacher receives |
|---|---|---|---|
| **1st** | 20 questions drawn from the 40-item pool | `score`, `total: 20`, `percent`, `passed`, `failedItems[]`, `attemptNumber: 1` | Score visible in Class Records; no detailed item breakdown yet |
| **2nd** | Fresh draw of 20 from the same 40-item pool | `score`, `total: 20`, `percent`, `passed`, `failedItems[]` with topic grouping + full question text reference, `attemptNumber: 2` | **Failed items surfaced in teacher analytics** — teacher can see which summative questions each student keeps missing and across which topics |
| **3rd** | Another fresh draw of 20 | Same as 2nd, `attemptNumber: 3` | Same teacher analytics update |
| After 3 | "View Result" button only — no more retakes | — | 25% threshold check runs (see below) |

---

### 5.3 25% Threshold — Remedial Banner Trigger

After **every** summative submission, Django re-evaluates the section-level pass rate for that lesson:

```
failCount  = students who have used all 3 attempts AND final score < 60% (12/20)
totalCount = students in the section who have attempted the summative at least once
failRate   = failCount / totalCount
```

If `failRate >= 0.25`, Django broadcasts a `SectionRemediationAlert` payload DOWN via MQTT. The teacher's dashboard shows a **Remedial Banner**:

> *"25%+ of [Section Name] students have failed the [Lesson Title] summative after 3 attempts — a remedial pack is recommended."*

The teacher then opens the **Remediation Wizard**, which is pre-filled with:
- The lesson and its topics
- Aggregated failed items from all students in the section (so the AI can target the class's collective gaps, not just one student's)

The teacher clicks **Autogenerate** → Gemini builds a custom remedial lesson + 10-item diagnostic quiz + teacherNotes. The teacher can **preview and edit** every field before clicking **Publish**, which broadcasts the pack to all students in the section via MQTT/LoRa.

---

## 6. Full Data Flow

### Flow A — Student Submits Quiz or Summative, Results Go Up

```
PHONE 2 (student)
  submits topic quiz or summative (any attempt)
  → app builds StudentProgress or StudentSummativeResults payload
  → 1st attempt: basic payload (score, answers, completedAt)
  → 2nd attempt onward: enriched payload adds failedItems[] + attemptNumber
    (quiz also adds full questionPool[] so server can call AI without re-fetching)
  → encodes with tokenized codec (wave/src/protocol/codec.ts)
  → wraps in SyncEnvelope (wave/src/sync/envelope.ts)
  → POST to http://192.168.43.x:8000/api/sync/push
  → or queued in localStorage outbox if Django is temporarily unreachable

PHONE 1 (router)
  passes the HTTP request transparently to the laptop

LAPTOP (Django server — server/wave_api/ingest.py)
  receives and decodes envelope
  → persists QuizAttempt or SummativeResult row to SQLite (increments attempts counter)
  → derive.py recomputes StudentProgress and Rankings
  → if student quiz score < 70% on 2nd attempt: triggers select_quiz_variant() call
      (see Flow D) → AI-selected variant sent DOWN before student's 3rd attempt
  → if summative 2nd/3rd attempt: failed items surfaced to teacher analytics
  → after every summative submission: checks section fail-rate; if ≥ 25% of
      students exhausted all 3 attempts still failing → broadcasts SectionRemediationAlert
      DOWN via MQTT → Remedial Banner appears on teacher's dashboard
  → broadcasts updated Rankings DOWN via MQTT to all devices
```

### Flow B — Teacher Generates Remedial Pack (AI call)

```
LAPTOP (teacher browser)
  teacher opens RemediationWizard
  selects the failing topic + student context
  clicks "Autogenerate"
  → frontend POSTs to http://localhost:8000/api/remediation/generate
    body: { topicId, topicName, subject, section, studentLrn, failedItems[] }

LAPTOP (Django — server/wave_api/generate.py)
  receives request
  → loads student's failedItems from SQLite (QuizAttempt rows)
  → builds structured Gemini prompt (see Section 6)
  → calls Gemini API over ethernet (internet)
  ← Gemini returns JSON: { title, content, teacherNotes, quiz[10] }
  → persists to RemediationMaterial SQLite row (isPublished: false)
  → returns full generated object to teacher browser

LAPTOP (teacher browser)
  displays preview: lesson content, 10-item quiz, teacherNotes
  teacher reads, edits if needed
  clicks Publish
  → frontend POSTs TeacherRemediationMaterial envelope to Django
```

### Flow C — Remedial Pack Delivered to Student (LoRa pipeline)

```
LAPTOP (Django — server/wave_api/ingest.py)
  receives published TeacherRemediationMaterial
  → serializes full object to tokenized array (codec.py encode())
  → fragment() splits into 200-byte chunks
  → publishes each chunk as separate MQTT message
    topic: wave/<section-slug>/TeacherRemediationMaterial
    QoS 1, retain ON (offline students receive on reconnect)

PHONE 1 (MQTT broker)
  relays each chunk message to all subscribed clients on local LAN

PHONE 2 (student)
  MQTT client receives chunks
  → Reassembler collects all chunks by msgId
  → when index === total-1: reassemble, decode, render
  → Home screen shows amber "Custom Remedial Path Generated" alert
  → Syllabus shows the study pack: teacherNotes banner + lesson + quiz
```

### Flow D — Student Submits 2nd Quiz Attempt → AI Selects Variant

```
PHONE 2 (student)
  submits 2nd attempt on a topic quiz (score < 70%)
  → app sends QuizAttemptRequest UP alongside the normal StudentProgress push
    body: { topicId, attemptNumber: 2, failedItems[], questionPool[] }

LAPTOP (Django — server/wave_api/ingest.py)
  receives QuizAttemptRequest
  → loads the 10-question pre-authored pool for this topicId
    from the subject JSON (science.json / mathematics.json / english.json)
  → calls Gemini API over ethernet (brief call)
    prompt: "Given these failed question IDs and this pool of 10 questions,
             select the 5 that best address the student's gaps"
  ← Gemini returns: selected question IDs (e.g. ["Q3-2","Q3-5","Q3-7","Q3-9","Q3-10"])
  → builds subset of full question objects from the JSON pool
  → publishes them DOWN via MQTT
    topic: wave/<studentLrn>/QuizVariant
    small payload — usually fits in a single MQTT message, no chunking needed

PHONE 2 (student)
  receives selected question subset
  → replaces quiz questions for that topic
  → student takes the tailored retake quiz
```

---

## 7. Implementing the Django AI Endpoint

### Step 1 — Install the Gemini Python package

```bash
cd server
pip install google-generativeai
```

Add to `server/requirements.txt`:
```
google-generativeai>=0.8.0
```

### Step 2 — Add API key to Django settings

In `server/config/settings.py`, add at the bottom:
```python
import os
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
```

Create `server/.env` (never commit this file):
```
GEMINI_API_KEY=your-actual-gemini-api-key-here
```

Install python-dotenv and load it in `server/config/settings.py`:
```python
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env")
```

### Step 3 — Create the generation module

Create `server/wave_api/generate.py`:

```python
"""
Calls Gemini to produce AI content for two scenarios:
  1. generate_remediation()  — full remedial pack (lesson + 10-item quiz + teacherNotes)
  2. select_quiz_variant()   — selects 5 questions from a 10-item pre-authored pool
"""
import json
import google.generativeai as genai
from django.conf import settings


def _configure():
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel("gemini-1.5-flash")


def _parse_response(response_text: str) -> dict:
    """Strip markdown fences if Gemini wraps response in ```json ... ```"""
    text = response_text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


# ─────────────────────────────────────────────────────────────────────────────
# Generation Event 1: Full Remedial Pack
# Called when teacher clicks "Autogenerate" in RemediationWizard
# ─────────────────────────────────────────────────────────────────────────────

def _build_remediation_prompt(
    topic_name: str,
    subject: str,
    grade_level: str,
    failed_items: list[dict]
) -> str:
    failed_summary = "\n".join(
        f"  - Question {item.get('questionId', '?')}: "
        f"student chose option {item.get('selectedOption', '?')}, "
        f"correct was option {item.get('correctOption', '?')}"
        for item in failed_items
    ) or "  - General difficulty with this topic (no specific failed items recorded)"

    return f"""You are an educational content writer for Filipino {grade_level} students in rural areas.

A student failed the {subject} topic: "{topic_name}".

Their specific wrong answers:
{failed_summary}

Write a remedial study pack in this EXACT JSON format. Return ONLY the JSON — no text before or after it.

{{
  "title": "short remedial lesson title, max 10 words",

  "teacherNotes": "One or two warm, encouraging sentences written in the teacher's voice, addressed to the class. Example: 'Class, let us look at {topic_name} one more time using a simple example from everyday life!'",

  "content": "A remedial lesson in plain Markdown, maximum 250 words. Use simple Filipino-friendly English at a Grade 4 reading level. Include one real-world analogy that a child in a rural barrio can picture (farm, river, animals, household items). Structure it with a short intro, 2-3 short sections with ### headings, and a Key Takeaway line.",

  "quiz": [
    {{
      "id": "QREM-1",
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswerIndex": 0,
      "explanation": "one sentence explaining why this is correct"
    }},
    {{
      "id": "QREM-2",
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswerIndex": 1,
      "explanation": "one sentence"
    }},
    {{
      "id": "QREM-3",
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswerIndex": 2,
      "explanation": "one sentence"
    }},
    {{
      "id": "QREM-4",
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswerIndex": 3,
      "explanation": "one sentence"
    }},
    {{
      "id": "QREM-5",
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswerIndex": 0,
      "explanation": "one sentence"
    }},
    {{
      "id": "QREM-6",
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswerIndex": 1,
      "explanation": "one sentence"
    }},
    {{
      "id": "QREM-7",
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswerIndex": 2,
      "explanation": "one sentence"
    }},
    {{
      "id": "QREM-8",
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswerIndex": 3,
      "explanation": "one sentence"
    }},
    {{
      "id": "QREM-9",
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswerIndex": 0,
      "explanation": "one sentence"
    }},
    {{
      "id": "QREM-10",
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswerIndex": 1,
      "explanation": "one sentence"
    }}
  ]
}}

Rules:
- teacherNotes must feel warm and human, like a real teacher speaking to a class
- content must target the exact wrong answers shown above — do not write generic notes
- quiz questions must test the same concepts that the student got wrong
- All 10 quiz questions must be different from each other
- Do not repeat a question concept across the 10 items
- Return ONLY the JSON object, nothing else"""


def generate_remediation(
    topic_name: str,
    subject: str,
    grade_level: str,
    failed_items: list[dict]
) -> dict:
    """
    Calls Gemini and returns a parsed dict with keys:
      title, teacherNotes, content, quiz (list of 10 QuizQuestion dicts)
    """
    model = _configure()
    prompt = _build_remediation_prompt(topic_name, subject, grade_level, failed_items)
    response = model.generate_content(prompt)
    return _parse_response(response.text)


# ─────────────────────────────────────────────────────────────────────────────
# Generation Event 2: Quiz Variant Selection
# Called when student fails a topic quiz and requests a retake
# Selects from the pre-authored 10-question pool in the subject JSON
# ─────────────────────────────────────────────────────────────────────────────

def _build_variant_prompt(
    topic_name: str,
    failed_item_ids: list[str],
    question_pool: list[dict]
) -> str:
    pool_text = "\n".join(
        f"  ID: {q['id']} | Question: {q['question']}"
        for q in question_pool
    )
    failed_text = ", ".join(failed_item_ids) or "none recorded"

    return f"""A Grade 6 student failed a quiz on the topic: "{topic_name}".

Questions the student got wrong: {failed_text}

Available question pool (all 10 pre-authored questions for this topic):
{pool_text}

Select exactly 5 question IDs from the pool that will best help this student
address their specific gaps. Prioritize questions that test the same concepts
as the ones they got wrong, but choose different questions where possible to
avoid showing the exact same items again.

Return ONLY a JSON array of 5 question ID strings, like this:
["Q-ID-1", "Q-ID-2", "Q-ID-3", "Q-ID-4", "Q-ID-5"]

No other text."""


def select_quiz_variant(
    topic_name: str,
    failed_item_ids: list[str],
    question_pool: list[dict]
) -> list[str]:
    """
    Returns a list of 5 question IDs selected from the pre-authored pool.
    The caller looks up the full question objects by these IDs.
    """
    model = _configure()
    prompt = _build_variant_prompt(topic_name, failed_item_ids, question_pool)
    response = model.generate_content(prompt)
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())
```

### Step 4 — Add the endpoints to views.py

Add the following to `server/wave_api/views.py`:

```python
import uuid
import datetime
from .generate import generate_remediation, select_quiz_variant

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def generate_remedial(request):
    """
    Teacher triggers AI generation. Calls Gemini, stores result, returns full pack.

    Request body:
      { topicId, topicName, subject, gradeLevel, section, studentLrn, failedItems[] }

    Response:
      Full TeacherRemediationMaterial object (isPublished: false — teacher must confirm)
    """
    data        = request.data
    topic_id    = data.get("topicId", "")
    topic_name  = data.get("topicName", topic_id)
    subject     = data.get("subject", "science")
    grade_level = data.get("gradeLevel", "Grade 6")
    section     = data.get("section", "")
    student_lrn = data.get("studentLrn", "")
    failed_items = data.get("failedItems", [])

    try:
        generated = generate_remediation(topic_name, subject, grade_level, failed_items)
    except Exception as e:
        return Response({"error": f"Gemini call failed: {e}"}, status=500)

    material_id = f"REM-{uuid.uuid4().hex[:6].upper()}"
    today       = datetime.date.today().isoformat()

    from .models import RemediationMaterial
    RemediationMaterial.objects.create(
        material_id      = material_id,
        original_topic_id= topic_id,
        title            = generated["title"],
        content          = generated["content"],
        teacher_notes    = generated["teacherNotes"],
        created_quiz     = generated["quiz"],
        publish_date     = today,
        assigned_student_lrn = student_lrn,
        target_section   = section,
        is_published     = False,
    )

    return Response({
        "id"             : material_id,
        "originalTopicId": topic_id,
        "title"          : generated["title"],
        "teacherNotes"   : generated["teacherNotes"],
        "content"        : generated["content"],
        "createdQuiz"    : generated["quiz"],
        "publishDate"    : today,
        "assignedStudentLrn": student_lrn,
        "targetSection"  : section,
        "isPublished"    : False,
    })


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def generate_quiz_variant(request):
    """
    Student failed a topic quiz. Selects 5 questions from the pre-authored pool
    that best address the student's specific gaps.

    Request body:
      { topicId, topicName, failedItemIds[], questionPool[] }

    Response:
      { selectedQuestions: [ ...5 full QuizQuestion objects... ] }
    """
    data            = request.data
    topic_name      = data.get("topicName", data.get("topicId", ""))
    failed_item_ids = data.get("failedItemIds", [])
    question_pool   = data.get("questionPool", [])

    if not question_pool:
        return Response({"error": "questionPool is required"}, status=400)

    try:
        selected_ids = select_quiz_variant(topic_name, failed_item_ids, question_pool)
    except Exception as e:
        return Response({"error": f"Gemini call failed: {e}"}, status=500)

    pool_map    = {q["id"]: q for q in question_pool}
    selected_qs = [pool_map[qid] for qid in selected_ids if qid in pool_map]

    # Fallback: if Gemini returned bad IDs, just return first 5 from pool
    if len(selected_qs) < 5:
        selected_qs = question_pool[:5]

    return Response({"selectedQuestions": selected_qs})
```

### Step 5 — Register the URLs

In `server/wave_api/urls.py`, add both routes:

```python
path("api/remediation/generate",    views.generate_remedial),
path("api/quiz/variant",            views.generate_quiz_variant),
```

### Step 6 — Handle QuizAttemptRequest in ingest.py

In `server/wave_api/ingest.py`, add an `elif` branch inside the `handle()` function:

```python
elif msg_type == "QuizAttemptRequest":
    _handle_quiz_variant_request(payload, subject, section)
```

And implement the handler:

```python
def _handle_quiz_variant_request(payload: dict, subject: str, section: str):
    """
    Receives QuizAttemptRequest, calls generate_quiz_variant, broadcasts
    the selected questions DOWN to the student via MQTT.
    """
    import requests as http
    topic_id        = payload.get("topicId", "")
    topic_name      = payload.get("topicTitle", topic_id)
    student_lrn     = payload.get("studentLrn", "")
    failed_item_ids = [f["questionId"] for f in payload.get("failedItems", [])]
    question_pool   = payload.get("questionPool", [])  # client sends full pool

    resp = http.post(
        "http://localhost:8000/api/quiz/variant",
        json={
            "topicId"      : topic_id,
            "topicName"    : topic_name,
            "failedItemIds": failed_item_ids,
            "questionPool" : question_pool,
        },
        timeout=30,
    )
    if resp.status_code != 200:
        return

    selected = resp.json().get("selectedQuestions", [])
    mqtt.publish_downstream(
        msg_type = "QuizVariant",
        payload  = {
            "topicId"          : topic_id,
            "studentLrn"       : student_lrn,
            "selectedQuestions": selected,
        },
        subject  = subject,
        section  = section,
        target   = student_lrn,   # unicast — only this student receives it
    )
```

---

## 8. Wiring the Frontend

### 8.1 Replace the fake RemediationWizard timer

In `Wave/src/components/RemediationWizard.tsx`, replace the fake `setInterval` timer inside the `useEffect` for `step === 'generating'` with a real fetch:

```typescript
useEffect(() => {
  if (step !== 'generating') return;

  const topicObj = allLessons.flatMap(l => l.topics).find(t => t.id === targetTopicId);
  const topicName = topicObj?.name ?? targetTopicId;

  const prog = student ? progressRecords[student.lrn] : null;
  const failedItems = prog
    ? Object.values(prog.quizAttempts)
        .filter(a => a.topicId === targetTopicId)
        .flatMap(a =>
          a.answers.map((selected, idx) => ({
            questionId    : `Q-${idx + 1}`,
            topicId       : a.topicId,
            selectedOption: selected,
            correctOption : 0,   // server will verify against stored correct answers
          }))
        )
    : [];

  const apiBase = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

  setGenStatusMessage('Connecting to Gemini AI model...');
  setGenPercentage(15);

  fetch(`${apiBase}/api/remediation/generate`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      topicId    : targetTopicId,
      topicName,
      subject    : activeSubject,
      gradeLevel : 'Grade 6',
      section    : activeSection,
      studentLrn : student?.lrn ?? '',
      failedItems,
    }),
  })
    .then(res => {
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      setGenPercentage(70);
      setGenStatusMessage('Processing Gemini response...');
      return res.json();
    })
    .then(data => {
      setGenPercentage(100);
      setGeneratedTitle(data.title);
      setGeneratedContent(data.content);
      setGeneratedNotes(data.teacherNotes);
      setGeneratedQuiz(data.createdQuiz);
      setStep('preview');
    })
    .catch(err => {
      setGenStatusMessage(
        `Generation failed: ${err.message}. Check that the server has internet (ethernet) and GEMINI_API_KEY is set.`
      );
      setGenPercentage(0);
    });
}, [step]);
```

### 8.2 Send QuizAttemptRequest with the question pool on 2nd attempt

On the **2nd quiz attempt**, the client attaches the failed items and full question pool so the server can immediately call Gemini for a variant without a round-trip to fetch the pool. On the 1st attempt these extra fields are omitted.

```typescript
// In the quiz submission handler (App.tsx or StudentLessons.tsx)
const topicQuestions = topic.quiz; // the 10 pre-authored questions from on-device JSON
const attemptNumber  = (existingAttempts[topic.id]?.attempts ?? 0) + 1;

const failed = answers
  .map((selected, idx) => ({
    questionId    : topicQuestions[idx]?.id ?? `Q-${idx}`,
    topicId       : topic.id,
    selectedOption: selected,
    correctOption : topicQuestions[idx]?.correctAnswerIndex ?? 0,
  }))
  .filter((item) => item.selectedOption !== item.correctOption);

await repo.saveQuizAttempt({
  lrn          : student.lrn,
  topicId      : topic.id,
  lessonId     : lesson.id,
  score,
  answers,
  attemptNumber,
  section      : student.section ?? student.gradeLevel,
  subject      : activeSubject,
  // Only populated on attempt 2+ (triggers AI variant on the server):
  failedItems  : attemptNumber >= 2 ? failed : [],
  questionPool : attemptNumber >= 2 ? topicQuestions : [],
  mode         : attemptNumber >= 2 && score / topicQuestions.length < 0.7
                   ? 'quiz-variant-request'
                   : 'topic',
});
```

### 8.3 Receive and display the quiz variant

Subscribe to the `QuizVariant` MQTT topic and update the topic's questions when received:

```typescript
// In httpRepository.ts subscribeToLive() or equivalent:
transport.subscribe(`wave/${studentLrn}/QuizVariant`, (envelope) => {
  const { topicId, selectedQuestions } = parseEnvelope(envelope).payload;
  onQuizVariantReceived(topicId, selectedQuestions);
});
```

---

## 9. Payload Specifications

Every payload is wrapped in a **SyncEnvelope** before transmission. The envelope carries routing metadata and chunk position.

### Envelope structure (all messages)

```json
{
  "msgId"    : "uuid-v4",
  "type"     : "one of the message types",
  "direction": "up or down",
  "subject"  : "science",
  "section"  : "Grade 6 - Section Newton",
  "createdAt": "2026-06-07T10:30:00Z",
  "chunk"    : { "index": 0, "total": 1 },
  "payload"  : { }
}
```

---

### 9.1 Student Submits Quiz → StudentProgress (UP)

**Direction:** Phone 2 → Phone 1 (router) → Laptop (Django)  
**When:** Student submits any topic quiz attempt  
**File:** `Wave/src/repo/httpRepository.ts` → `saveQuizAttempt()`

#### 1st Attempt — basic payload

```json
{
  "msgId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "StudentProgress",
  "direction": "up",
  "subject": "science",
  "section": "Grade 6 - Section Newton",
  "createdAt": "2026-06-07T09:15:00Z",
  "chunk": { "index": 0, "total": 1 },
  "payload": {
    "studentLrn": "101234567900",
    "topicId": "L1-T2",
    "lessonId": "L1",
    "score": 3,
    "perfectScore": 10,
    "attemptNumber": 1,
    "answers": [1, 0, 3, 2, 1, 0, 2, 3, 1, 0],
    "completedAt": "2026-06-07T09:15:00Z"
  }
}
```

#### 2nd Attempt — enriched payload (triggers AI variant selection)

On the 2nd submission the client adds `failedItems[]`, the full `questionPool[]`, and `attemptNumber: 2`. These extra fields allow the server to call Gemini without needing to reload the question pool from a separate source — the device already has it.

```json
{
  "msgId": "a1b2c3d4-e5f6-7890-abcd-ef1234567891",
  "type": "StudentProgress",
  "direction": "up",
  "subject": "science",
  "section": "Grade 6 - Section Newton",
  "createdAt": "2026-06-07T09:40:00Z",
  "chunk": { "index": 0, "total": 1 },
  "payload": {
    "studentLrn": "101234567900",
    "topicId": "L1-T2",
    "lessonId": "L1",
    "score": 5,
    "perfectScore": 10,
    "attemptNumber": 2,
    "answers": [0, 0, 2, 2, 1, 0, 3, 3, 1, 0],
    "completedAt": "2026-06-07T09:40:00Z",
    "failedItems": [
      { "questionId": "Q2-1", "topicId": "L1-T2", "selectedOption": 0, "correctOption": 1 },
      { "questionId": "Q2-3", "topicId": "L1-T2", "selectedOption": 2, "correctOption": 0 },
      { "questionId": "Q2-7", "topicId": "L1-T2", "selectedOption": 3, "correctOption": 2 },
      { "questionId": "Q2-8", "topicId": "L1-T2", "selectedOption": 3, "correctOption": 1 },
      { "questionId": "Q2-10","topicId": "L1-T2", "selectedOption": 0, "correctOption": 3 }
    ],
    "questionPool": [
      { "id": "Q2-1",  "question": "...", "options": ["..."], "correctAnswerIndex": 1, "explanation": "..." },
      { "id": "Q2-2",  "question": "...", "options": ["..."], "correctAnswerIndex": 0, "explanation": "..." },
      "...all 10 pre-authored questions for L1-T2 from science.json..."
    ],
    "mode": "quiz-variant-request"
  }
}
```

**What Django does on 2nd attempt:**
- Persists to `QuizAttempt` SQLite row (increments attempt counter)
- Detects `attemptNumber == 2` + `score < 70%` → calls `select_quiz_variant()`
- Gemini selects 5 questions from `questionPool` targeting the failed concepts
- Django broadcasts the 5-question variant DOWN via MQTT (unicast to this student's LRN topic) before the student can start attempt 3
- Recomputes `StudentProgress` and `Rankings` via `derive.py`

---

### 9.2 Student Submits Summative → StudentSummativeResults (UP)

**Direction:** Phone 2 → Phone 1 → Laptop (Django)  
**When:** Student submits any summative attempt (max 3)

#### 1st Attempt — basic result

```json
{
  "msgId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "type": "StudentSummativeResults",
  "direction": "up",
  "subject": "science",
  "section": "Grade 6 - Section Newton",
  "createdAt": "2026-06-07T09:45:00Z",
  "chunk": { "index": 0, "total": 1 },
  "payload": {
    "studentLrn": "101234567900",
    "section"   : "Grade 6 - Section Newton",
    "lessonId"  : "L1",
    "score"     : 9,
    "total"     : 20,
    "percent"   : 45,
    "passed"    : false,
    "attemptNumber": 1,
    "failedItems": [
      { "questionId": "S1-3",  "topicId": "L1-T2", "selectedOption": 0, "correctOption": 1 },
      { "questionId": "S1-7",  "topicId": "L1-T2", "selectedOption": 3, "correctOption": 2 },
      { "questionId": "S1-11", "topicId": "L1-T3", "selectedOption": 2, "correctOption": 0 }
    ]
  }
}
```

#### 2nd and 3rd Attempts — enriched result (surfaced to teacher analytics)

Starting from the 2nd attempt, the `failedItems` payload includes topic grouping so that the server can aggregate which topics the whole section is struggling with. This data is written to `SummativeResult` and exposed to the teacher in Class Records.

```json
{
  "msgId": "b2c3d4e5-f6a7-8901-bcde-f12345678902",
  "type": "StudentSummativeResults",
  "direction": "up",
  "subject": "science",
  "section": "Grade 6 - Section Newton",
  "createdAt": "2026-06-07T10:30:00Z",
  "chunk": { "index": 0, "total": 1 },
  "payload": {
    "studentLrn": "101234567900",
    "section"   : "Grade 6 - Section Newton",
    "lessonId"  : "L1",
    "score"     : 10,
    "total"     : 20,
    "percent"   : 50,
    "passed"    : false,
    "attemptNumber": 2,
    "failedItems": [
      {
        "questionId"     : "S1-3",
        "topicId"        : "L1-T2",
        "topicName"      : "Muscular System",
        "questionText"   : "What type of muscle is the bicep?",
        "selectedOption" : 0,
        "selectedText"   : "Involuntary",
        "correctOption"  : 1,
        "correctText"    : "Voluntary skeletal muscle"
      },
      {
        "questionId"     : "S1-11",
        "topicId"        : "L1-T3",
        "topicName"      : "Digestive System",
        "questionText"   : "Where does most nutrient absorption occur?",
        "selectedOption" : 2,
        "selectedText"   : "Stomach",
        "correctOption"  : 0,
        "correctText"    : "Small intestine"
      }
    ]
  }
}
```

**What Django does after each summative submission:**
1. Persists to `SummativeResult` SQLite row; increments `attempts` counter (max 3)
2. On attempt 2 and 3: stores `failed_items` detail in `SummativeResult.failed_items` JSON field — accessible to teacher in Class Records
3. After every submission: re-evaluates section fail-rate for this lesson
   - `failCount` = students in section who have `attempts >= 3` AND `passed = false`
   - `totalCount` = students in section who have `attempts >= 1`
   - If `failCount / totalCount >= 0.25` → broadcasts `SectionRemediationAlert` DOWN via MQTT

---

### 9.3 SectionRemediationAlert → Remedial Banner on Teacher Dashboard (DOWN)

**Direction:** Laptop Django → Phone 1 (MQTT broker) → Laptop teacher browser  
**When:** After any summative submission, if ≥ 25% of the section have failed after exhausting all 3 attempts  
**MQTT topic:** `wave/<section-slug>/SectionRemediationAlert`

```json
{
  "msgId": "f7a8b9c0-d1e2-3456-fabc-678901234567",
  "type": "SectionRemediationAlert",
  "direction": "down",
  "subject": "science",
  "section": "Grade 6 - Section Newton",
  "createdAt": "2026-06-07T11:00:00Z",
  "chunk": { "index": 0, "total": 1 },
  "payload": {
    "lessonId"       : "L1",
    "lessonTitle"    : "The Human Body Systems",
    "section"        : "Grade 6 - Section Newton",
    "failCount"      : 8,
    "totalAttempted" : 30,
    "failRate"       : 0.27,
    "topicBreakdown" : [
      { "topicId": "L1-T2", "topicName": "Muscular System",   "failCount": 6 },
      { "topicId": "L1-T3", "topicName": "Digestive System",  "failCount": 5 },
      { "topicId": "L1-T1", "topicName": "Skeletal System",   "failCount": 3 }
    ],
    "aggregatedFailedItems": [
      { "questionId": "S1-3",  "topicId": "L1-T2", "failCount": 7, "questionText": "What type of muscle is the bicep?" },
      { "questionId": "S1-11", "topicId": "L1-T3", "failCount": 6, "questionText": "Where does most nutrient absorption occur?" }
    ]
  }
}
```

**What the teacher's browser does:**
- Renders the **Remedial Banner** on the teacher dashboard Home screen:
  > *"27% of Grade 6 - Section Newton failed the The Human Body Systems summative after 3 attempts."*
- Banner includes a **"Generate Remedial Pack with AI"** button
- Clicking opens the Remediation Wizard pre-filled with:
  - `lessonId`, `section`, subject
  - `topicBreakdown` sorted by fail count (so the AI focuses on the weakest topics)
  - `aggregatedFailedItems` passed as `failedItems` to the Gemini prompt (class-wide, not a single student)

---

### 9.4 Teacher Triggers AI Generation (Internal REST — stays on laptop)

**Direction:** Teacher browser → Django (same machine, never leaves laptop)  
**When:** Teacher clicks "Autogenerate" in RemediationWizard

**Request:**
```
POST http://localhost:8000/api/remediation/generate
Content-Type: application/json
```
```json
{
  "topicId"    : "L1-T2",
  "topicName"  : "Muscular System",
  "subject"    : "science",
  "gradeLevel" : "Grade 6",
  "section"    : "Grade 6 - Section Newton",
  "studentLrn" : "101234567900",
  "failedItems": [
    { "questionId": "Q2-1", "topicId": "L1-T2", "selectedOption": 1, "correctOption": 0 },
    { "questionId": "Q2-3", "topicId": "L1-T2", "selectedOption": 3, "correctOption": 2 }
  ]
}
```

**Response — what Gemini returns (via Django):**
```json
{
  "id"             : "REM-A3F9B2",
  "originalTopicId": "L1-T2",
  "title"          : "Why Muscles Always Work in Pairs",
  "teacherNotes"   : "Class, let us look at the Muscular System one more time — think of your muscles like rubber bands on a seesaw, and it will all make sense!",
  "content"        : "## Muscles Are Like Rubber Bands\n\nHave you ever stretched a rubber band? When you pull it, it shortens — and when you let go, it returns. Your muscles work exactly this way.\n\nA muscle can only **pull** — it cannot push. This is why every joint in your body has two muscles: one to pull it one way, and one to pull it back.\n\n### The Arm Example\n- To **bend your elbow**: your bicep contracts (shortens and pulls). Your tricep relaxes.\n- To **straighten your elbow**: your tricep contracts. Your bicep relaxes.\n\nThey take turns, like two children on a seesaw.\n\n### Two Types of Muscle\n- **Voluntary** — you control them: waving, writing, kicking a ball.\n- **Involuntary** — they work on their own: your heart never stops beating even when you sleep.\n\n**Key Takeaway:** Muscles pull in pairs because a single muscle can only move in one direction.",
  "createdQuiz": [
    {
      "id": "QREM-1",
      "question": "Why do muscles always work in opposing pairs?",
      "options": [
        "Because a muscle can only pull, never push",
        "Because two muscles produce more heat",
        "Because bones need warmth from two sides",
        "Because the brain sends signals in pairs"
      ],
      "correctAnswerIndex": 0,
      "explanation": "A muscle can only contract and shorten in one direction, so a partner muscle is needed to reverse the movement."
    },
    {
      "id": "QREM-2",
      "question": "Which of the following is an involuntary muscle?",
      "options": [
        "Bicep used when lifting a bag",
        "Heart muscle that beats on its own",
        "Hand muscles used for writing",
        "Leg muscles used for running"
      ],
      "correctAnswerIndex": 1,
      "explanation": "The heart beats automatically without any conscious thought, making it involuntary."
    },
    {
      "id": "QREM-3",
      "question": "When you bend your elbow, what happens to the tricep?",
      "options": [
        "It contracts and gets shorter",
        "It relaxes and gets longer",
        "It stops working completely",
        "It switches sides"
      ],
      "correctAnswerIndex": 1,
      "explanation": "When the bicep contracts to bend the elbow, the opposing tricep must relax to allow the movement."
    },
    {
      "id": "QREM-4",
      "question": "What does 'voluntary muscle' mean?",
      "options": [
        "A muscle that works without you thinking about it",
        "A muscle you control with your thoughts",
        "A muscle found only in the heart",
        "A muscle that never gets tired"
      ],
      "correctAnswerIndex": 1,
      "explanation": "Voluntary muscles respond to conscious commands, like deciding to wave your hand."
    },
    {
      "id": "QREM-5",
      "question": "Which analogy best describes how muscle pairs work?",
      "options": [
        "A river flowing in one direction",
        "Two children on a seesaw taking turns",
        "A single rope pulling a cart",
        "A fan spinning in circles"
      ],
      "correctAnswerIndex": 1,
      "explanation": "Like a seesaw, when one muscle goes up (contracts), the opposing one goes down (relaxes)."
    },
    {
      "id": "QREM-6",
      "question": "What connects a muscle to a bone so it can pull it?",
      "options": ["Ligaments", "Cartilage", "Tendons", "Veins"],
      "correctAnswerIndex": 2,
      "explanation": "Tendons are the tough, cord-like tissues that attach muscle ends to the bones they move."
    },
    {
      "id": "QREM-7",
      "question": "Your heart is an example of which muscle type?",
      "options": ["Voluntary", "Skeletal", "Involuntary", "Connective"],
      "correctAnswerIndex": 2,
      "explanation": "The heart is cardiac muscle — involuntary — and never stops working even during sleep."
    },
    {
      "id": "QREM-8",
      "question": "If a muscle can only pull, how does your arm straighten after bending?",
      "options": [
        "The bicep pushes the arm back",
        "The tricep contracts and pulls the arm straight",
        "Gravity pulls the arm down by itself",
        "The tendon snaps the arm open"
      ],
      "correctAnswerIndex": 1,
      "explanation": "The tricep contracts to pull the forearm back to a straight position while the bicep relaxes."
    },
    {
      "id": "QREM-9",
      "question": "Which activity uses voluntary muscles?",
      "options": [
        "Your stomach digesting food while you sleep",
        "Your heart pumping blood during a race",
        "Kicking a ball during recess",
        "Your lungs breathing while you are unconscious"
      ],
      "correctAnswerIndex": 2,
      "explanation": "Kicking a ball is a conscious, deliberate action — a voluntary muscle movement you choose to make."
    },
    {
      "id": "QREM-10",
      "question": "Why is the rubber band a good analogy for a muscle?",
      "options": [
        "Both can stretch and push things away",
        "Both can only pull and then return to rest",
        "Both are made of the same material",
        "Both are found inside the human body"
      ],
      "correctAnswerIndex": 1,
      "explanation": "Like a muscle, a rubber band shortens when pulled and returns to its resting length — it cannot push outward."
    }
  ],
  "publishDate"   : "2026-06-07",
  "targetSection" : "Grade 6 - Section Newton",
  "isPublished"   : false
}
```

> **Note on the three AI outputs:**
> - `teacherNotes` — the warm teacher-voice message the student sees at the top of the study pack
> - `content` — the remedial lesson body the student reads
> - `createdQuiz` — 10 new diagnostic questions the student answers after reading
>
> All three are bundled in the same `TeacherRemediationMaterial` object and all three travel together over the LoRa pipeline when the teacher publishes.

---

### 9.5 Teacher Publishes → TeacherRemediationMaterial (DOWN, chunked over LoRa)

**Direction:** Laptop Django → Phone 1 (MQTT broker) → Phone 2 (student)  
**When:** Teacher clicks "Publish" after previewing the generated pack  
**MQTT topic:** `wave/grade-6-section-newton/TeacherRemediationMaterial`  
**QoS 1, retain ON** — offline students receive it on reconnect

The full object is typically 3,000–6,000 bytes. With 200-byte LoRa frames this becomes ~20–30 chunks. Each chunk is one MQTT message. Shown here as logical groups for clarity:

**Chunk 0 — metadata, teacherNotes, title:**
```json
{
  "msgId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "type": "TeacherRemediationMaterial",
  "direction": "down",
  "subject": "science",
  "section": "Grade 6 - Section Newton",
  "createdAt": "2026-06-07T10:00:00Z",
  "chunk": { "index": 0, "total": 22 },
  "payload": {
    "id"            : "REM-A3F9B2",
    "originalTopicId": "L1-T2",
    "title"         : "Why Muscles Always Work in Pairs",
    "teacherNotes"  : "Class, let us look at the Muscular System one more time — think of your muscles like rubber bands on a seesaw!",
    "publishDate"   : "2026-06-07",
    "targetSection" : "Grade 6 - Section Newton",
    "isPublished"   : true
  }
}
```

**Chunks 1–8 — lesson content (split across frames by fragment()):**
```json
{
  "msgId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "type": "TeacherRemediationMaterial",
  "direction": "down",
  "chunk": { "index": 1, "total": 22 },
  "payload": {
    "id": "REM-A3F9B2",
    "contentSlice": "## Muscles Are Like Rubber Bands\n\nHave you ever stretched a rubber band? When you pull it, it shortens"
  }
}
```
*(subsequent content chunks continue the lesson text)*

**Chunks 9–21 — createdQuiz (10 questions, split across frames):**
```json
{
  "msgId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "type": "TeacherRemediationMaterial",
  "direction": "down",
  "chunk": { "index": 9, "total": 22 },
  "payload": {
    "id": "REM-A3F9B2",
    "quizSlice": [
      {
        "id": "QREM-1",
        "question": "Why do muscles always work in opposing pairs?",
        "options": ["Because a muscle can only pull, never push", "..."],
        "correctAnswerIndex": 0,
        "explanation": "A muscle can only contract in one direction."
      }
    ]
  }
}
```

**What Phone 2 does as chunks arrive:**
1. `Reassembler` collects each chunk by `msgId`
2. When `index === total - 1` (all chunks present): reassemble
3. Concatenate `contentSlice` strings in order → full `content`
4. Concatenate `quizSlice` arrays in order → full `createdQuiz[10]`
5. Merge with metadata from chunk 0 → complete `TeacherRemediationMaterial`
6. Home screen shows amber alert: "New study pack from your teacher"
7. Syllabus shows: teacherNotes banner → lesson content → 10-item quiz

---

### 9.6 Student Requests Quiz Variant → QuizAttemptRequest (UP)

**Direction:** Phone 2 → Phone 1 → Laptop  
**When:** Student fails a topic quiz; client sends failed items + question pool

```json
{
  "msgId": "d4e5f6a7-b8c9-0123-defa-234567890123",
  "type": "QuizAttemptRequest",
  "direction": "up",
  "subject": "science",
  "section": "Grade 6 - Section Newton",
  "createdAt": "2026-06-07T11:00:00Z",
  "chunk": { "index": 0, "total": 1 },
  "payload": {
    "studentLrn"   : "101234567900",
    "topicId"      : "L1-T2",
    "topicTitle"   : "Muscular System",
    "mode"         : "remedial",
    "failedItemIds": ["Q2-1", "Q2-3", "Q2-7"],
    "questionPool" : [
      { "id": "Q2-1",  "question": "...", "options": ["..."], "correctAnswerIndex": 0, "explanation": "..." },
      { "id": "Q2-2",  "question": "...", "options": ["..."], "correctAnswerIndex": 1, "explanation": "..." },
      "... 10 questions total from science.json for topic L1-T2 ..."
    ]
  }
}
```

**What Django does:**
- Sends `failedItemIds` + `questionPool` to Gemini via `select_quiz_variant()`
- Gemini returns 5 selected question IDs from the pool
- Django resolves full question objects and broadcasts DOWN

---

### 9.7 Server Sends Quiz Variant → QuizVariant (DOWN)

**Direction:** Laptop → Phone 1 → Phone 2 (student only)  
**MQTT topic:** `wave/<studentLrn>/QuizVariant`  
**Small payload — fits in one message, no chunking needed**

```json
{
  "msgId": "e5f6a7b8-c9d0-1234-efab-345678901234",
  "type": "QuizVariant",
  "direction": "down",
  "subject": "science",
  "section": "Grade 6 - Section Newton",
  "createdAt": "2026-06-07T11:00:05Z",
  "chunk": { "index": 0, "total": 1 },
  "payload": {
    "topicId"  : "L1-T2",
    "studentLrn": "101234567900",
    "selectedQuestions": [
      {
        "id": "Q2-3",
        "question": "Which of the following is a voluntary muscle action?",
        "options": ["Heart beating", "Stomach digesting", "Kicking a ball", "Lungs breathing while asleep"],
        "correctAnswerIndex": 2,
        "explanation": "Kicking a ball is a deliberate action you control — voluntary."
      },
      "... 4 more selected questions ..."
    ]
  }
}
```

---

## 10. How Chunking Works

### Why chunking is needed

LoRa radio frames have a maximum payload of approximately **200 bytes**. A `TeacherRemediationMaterial` with a 250-word lesson, 10 quiz questions, and teacherNotes is typically 4,000–6,000 bytes — it must be fragmented before transmission.

### Splitting — server side

```
Full TeacherRemediationMaterial JSON string
    ↓
codec.py encode()          → tokenized positional array (compact representation)
    ↓
fragment(msgId, data, 200) → list of Chunk objects
    each Chunk: { index: int, total: int, data: str (200-byte slice) }
    ↓
For each Chunk:
    buildEnvelope(chunk) → SyncEnvelope
    mqtt.publish(topic, envelope)   ← one MQTT message per chunk
```

`fragment()` is implemented in `Wave/src/sync/chunk.ts` on the TypeScript side (used in tests) and mirrored in `server/wave_api/codec.py` on the Python side (used in production).

### Reassembly — student device

```
Receive Chunk { index: 0, total: 22, data: "..." } → Reassembler.add()
Receive Chunk { index: 1, total: 22, data: "..." } → Reassembler.add()
...
Receive Chunk { index: 21, total: 22, data: "..." } → Reassembler.add()
                                                            ↓
                                                  all 22 chunks present?
                                                            ↓
                                                  sort by index
                                                  concatenate data fields
                                                  codec.decode() → full object
                                                  render study pack
```

`Reassembler` handles out-of-order arrival and deduplicates by `(msgId, index)`. It is implemented in `Wave/src/sync/chunk.ts`.

### Over WiFi hotspot vs. physical LoRa

On a local WiFi hotspot (testing), bandwidth is not the constraint — all chunks arrive in milliseconds. Chunking still runs for protocol consistency, so the same code path works when deployed on physical LoRa hardware. In WiFi testing, `total` for small payloads may be 1 (single message).

---

## 11. Running the Full Test Step by Step

### Prerequisites

- Laptop has an ethernet port (or USB-to-ethernet adapter) for internet
- Phone 1 creates a mobile hotspot with **mobile data OFF** (WiFi hotspot only, for LAN)
- Laptop WiFi connects to Phone 1's hotspot
- Laptop ethernet connects to home/office router (internet)
- Phone 2 WiFi connects to Phone 1's hotspot
- `GEMINI_API_KEY` set in `server/.env`

> **No ethernet port?** Use USB tethering: plug Phone 1 into the laptop via USB, enable USB tethering with mobile data ON. Laptop gets internet via USB. Then Phone 1 also creates a WiFi hotspot (separate from USB tethering) for Phone 2. Laptop WiFi connects to Phone 1's hotspot for LAN.

---

### Step 1 — Set Up Phone 1 (Router)

1. Settings → Hotspot & Tethering → Mobile Hotspot → **ON**
2. Turn **OFF** mobile data (hotspot stays alive, no internet flows through it)
3. Note the hotspot IP (usually `192.168.43.1`)

---

### Step 2 — Connect Laptop to Both Networks

1. Connect laptop WiFi to Phone 1's hotspot
2. Plug ethernet cable into laptop → connect to home/office router
3. Open PowerShell → `ipconfig` → find the WiFi adapter IP (e.g. `192.168.43.87`)
4. Confirm: `ping 8.8.8.8` succeeds (internet via ethernet) and `ping 192.168.43.1` succeeds (LAN via WiFi)

---

### Step 3 — Update Environment Files

`Wave/.env.local`:
```
VITE_API_BASE=http://192.168.43.87:8000
VITE_MQTT_URL=ws://192.168.43.87:9001
```

`server/.env`:
```
GEMINI_API_KEY=your-actual-key-here
```

---

### Step 4 — Start All Services on the Laptop

Open three separate terminals:

**Terminal 1 — MQTT Broker:**
```bash
mosquitto -c server/mqtt/mosquitto.conf
```

**Terminal 2 — Django + MQTT subscriber:**
```bash
cd server
python manage.py runserver 0.0.0.0:8000
# In a separate process or thread:
python manage.py run_mqtt
```

**Terminal 3 — React Frontend:**
```bash
cd Wave
npm run dev --host
```

`--host` makes Vite listen on all interfaces so Phone 2 can reach it.

---

### Step 5 — Connect Phone 2 (Student)

1. Connect WiFi to Phone 1's hotspot
2. Open mobile browser → `http://192.168.43.87:5173`
3. Log in as student (enter an LRN enrolled by the teacher)

---

### Step 6 — Open Teacher View on Laptop

1. Open browser → `http://localhost:5173`
2. Log in as teacher (enter any Teacher ID + Full Name)

---

### Step 7 — Run the Full Test Flow

**Phase A — Student takes 1st quiz attempt (internet not needed)**
1. On Phone 2: Syllabus → Lesson 1 → pick any topic → Take Quiz
2. Answer some questions wrong (score < 7/10) and submit
3. Django stores attempt 1; teacher sees student score in Class Records

**Phase B — Student takes 2nd quiz attempt → AI variant triggered (internet ON)**
1. On Phone 2: re-take the same quiz (attempt 2)
2. Intentionally get several questions wrong again
3. On submit: client sends enriched payload with `failedItems[]`, `questionPool[]`, `attemptNumber: 2`
4. Django detects 2nd attempt + score < 70% → calls `select_quiz_variant()` → Gemini API over ethernet
5. Gemini selects 5 of the 10 pre-authored questions targeting the student's gaps
6. Django broadcasts `QuizVariant` DOWN via MQTT (unicast to this student's LRN topic)
7. Phone 2 receives the 5-question variant — student can now take attempt 3 with tailored questions

**Phase C — Student takes 2nd and 3rd summative attempts → failed items visible to teacher (internet not needed)**
1. On Phone 2: unlock the summative → take attempt 1 (fail it)
2. Re-take summative (attempt 2) — submit with wrong answers
3. On submit: client sends `failedItems[]` with full question + topic detail, `attemptNumber: 2`
4. Django stores the failed item detail; teacher can now see per-question breakdown in Class Records
5. Repeat for attempt 3 if needed
6. After attempt 3: student sees "View Result" only — no more retakes
7. Django evaluates section fail-rate; if ≥ 25% exhausted all 3 attempts → broadcasts Remedial Banner DOWN

**Phase D — Teacher sees Remedial Banner → generates AI remedial pack (internet ON)**
1. On laptop teacher view: Remedial Banner appears on Home dashboard
   *"27% of Grade 6 - Section Newton failed the summative after 3 attempts"*
2. Click "Generate Remedial Pack with AI" → Wizard opens pre-filled with topic breakdown + aggregated failed items
3. Click "Autogenerate" → Django calls Gemini API over ethernet (5–15 seconds)
4. Preview shows all three AI outputs: teacherNotes banner, lesson content, 10-item quiz
5. Teacher reads, edits any field if needed, clicks "Publish"

**Phase E — Remedial pack delivered to all students (internet not needed)**
1. Django encodes → `fragment()` → MQTT broadcasts all chunks over LAN
2. On Phone 2: Home screen shows amber alert "New study pack from your teacher"
3. Syllabus shows the study pack with teacherNotes, lesson, and quiz

**Phase F — Student completes remedial pack (internet not needed)**
1. On Phone 2: open the study pack, read the AI lesson, take the 10-item diagnostic quiz
2. Submit answers → syncs UP to Django over local LAN
3. On laptop teacher view: Class Records updates — student status may change to Passing

---

### Verification Checklist

**Basic connectivity**
- [ ] Phone 2 opens `http://192.168.43.87:5173` successfully in mobile browser
- [ ] Student can log in with an enrolled LRN
- [ ] Teacher view opens on laptop browser

**Quiz attempt logic**
- [ ] 1st quiz attempt (score < 70%): basic payload stored; teacher sees score in Class Records
- [ ] 2nd quiz attempt (score < 70%): enriched payload with `failedItems[]` and `questionPool[]` sent UP
- [ ] AI `select_quiz_variant()` called on server after 2nd attempt submission (check Django logs)
- [ ] `QuizVariant` with 5 selected questions arrives on Phone 2 via MQTT before attempt 3
- [ ] Attempt 3 uses the AI-selected 5-question variant drawn from the on-device JSON pool
- [ ] After 3 attempts: "View Result" only — Take Quiz button no longer appears

**Summative attempt logic**
- [ ] 1st summative attempt: score stored; teacher sees it in Class Records
- [ ] 2nd summative attempt: `failedItems[]` with topic + question detail stored server-side
- [ ] Teacher can see per-question failed item breakdown for 2nd/3rd attempt in Class Records
- [ ] After attempt 3: "View Result" only — Attempt Summative button no longer appears
- [ ] Django re-evaluates section fail-rate after each summative submission (check logs)

**25% threshold → remedial banner**
- [ ] With ≥ 25% of section students failing summative after 3 attempts: `SectionRemediationAlert` broadcast
- [ ] Remedial Banner appears on teacher dashboard Home screen with section + lesson info
- [ ] Wizard opens pre-filled with `topicBreakdown` and `aggregatedFailedItems`

**AI remedial generation**
- [ ] "Autogenerate" returns real AI content with `teacherNotes`, `content`, and 10 `createdQuiz` items
- [ ] Teacher can edit all three outputs in the preview before publishing
- [ ] Published pack appears on Phone 2's Home screen and Syllabus simultaneously
- [ ] `teacherNotes` is visible at the top of the study pack on Phone 2
- [ ] All 10 diagnostic quiz questions are available to the student
- [ ] Student remedial quiz result syncs back and updates teacher's Class Records

**Resilience**
- [ ] Disconnecting ethernet stops AI generation but does **not** break student ↔ teacher sync
- [ ] If Django is unreachable when a student submits, the outbox flushes on reconnect

# Wave — AI Implementation

> How Wave uses **Google Gemini** to deliver personalized remediation to classrooms with no
> internet — safely, with mandatory human review, and over a LoRa radio link.
>
> Source-of-truth references: [AI Implementation Guide](../AI_IMPLEMENTATION_GUIDE.md) ·
> [README — AI & Ethical Safeguards](../README.md).

---

## Engine

| Item | Detail |
|---|---|
| AI engine | Google **Gemini** (`gemini-2.0-flash`) |
| Client | `@google/genai` (frontend) / Gemini API call from Django |
| Backend entry point | `server/wave_api/ai.py` |
| Configuration | `GEMINI_API_KEY`, `GEMINI_MODEL` in `server/.env` |
| Fallback | Static stub lesson when the key is blank or the call fails |

Only the **Django server** (on the internet-connected "town" laptop) ever calls Gemini.
Student and teacher devices never need internet — generated content is delivered to them
offline over the local LAN and the LoRa radio link.

---

## The Two AI Generation Events

Everything else in Wave (preloaded lessons, topic quizzes, summative tests) is **pre-authored**
in subject JSON files. The AI is responsible for exactly two events.

### Event 1 — Remedial Pack (teacher-triggered)

When a teacher clicks **Autogenerate** in the Remediation Wizard, Gemini produces three outputs
bundled into one `TeacherRemediationMaterial` object:

| Output | Field | Description |
|---|---|---|
| Remedial lesson | `content` | Markdown lesson body (≤ 250 words) with a real-world analogy suited to rural Grade 6 children, targeting the exact concepts the class got wrong |
| Diagnostic quiz | `createdQuiz[]` | 10 multiple-choice questions directly testing the failed concepts (4 options, a correct index, a one-sentence explanation each) |
| Teacher feedback note | `teacherNotes` | One or two encouraging, teacher-voice sentences shown at the top of the study pack |

### Event 2 — Quiz Variant Selection (anti-hallucination)

On a student's **second failed attempt** at a topic quiz, Wave sends Gemini the student's wrong
answers plus the full **10-question pre-authored pool**. Gemini **selects the 5 questions** that
best address that student's gaps for attempt 3.

> **Gemini never invents assessment questions.** For graded topic quizzes it can only *choose*
> among pre-vetted items — eliminating the risk of hallucinated or factually wrong questions
> reaching students.

---

## When Internet Is (and Isn't) Required

Internet is needed **only** for the two brief Gemini calls. Everything else — sync, delivery,
LoRa broadcast, quiz-taking — runs fully offline.

| Action | Internet? |
|---|---|
| Student submits 1st quiz / summative attempt | No |
| **Student's 2nd quiz attempt → AI selects variant** | **Yes (brief)** |
| AI-selected 5-question variant delivered via MQTT/LoRa | No |
| Student submits 2nd / 3rd summative attempt → failed items to teacher | No |
| Django checks 25% fail-rate threshold and broadcasts remedial banner | No |
| Teacher views analytics / rankings / failed-item detail | No |
| **Teacher clicks "Autogenerate" in wizard** | **Yes (brief)** |
| Teacher previews / edits / publishes remedial pack | No |
| Remedial pack delivered over LoRa | No |
| Student completes remedial quiz | No |

---

## AI Trigger Logic

- A student failing a topic quiz (0/3 or 1/3) surfaces in the **Remedial Tickers**.
- A second failed quiz attempt triggers **AI variant selection** for attempt 3.
- After each summative submission, Django checks the section pass rate. When **≥ 25% of the
  section has failed after all 3 attempts**, a **Remedial Banner** is broadcast to the teacher's
  dashboard, prompting the Remediation Wizard.

---

## Ethical Safeguards

Wave is built so AI accelerates the teacher without ever replacing their judgment.

- **Hallucination prevention in assessments** — graded topic-quiz items always come from a
  pre-authored, teacher-reviewed JSON pool (`science.json`, `mathematics.json`, `english.json`);
  Gemini only selects which to show.
- **Prompt constraints for relevance** — the remedial prompt enforces:
  - **Grade-4 reading level** (simple, accessible English)
  - **Filipino rural context** (analogies a child in a *barrio* can picture — farm, river, animals)
  - **Strict JSON schema** (deviations caught and handled before the teacher sees output)
  - **Teacher-voice notes** (warm and human, not robotic)
- **Mandatory human review** — the Wizard enforces **Preview → Edit → Publish**. Every field
  (title, lesson, notes, each question) is editable, and publishing is an explicit, confirmable step.

---

## Offline Fallback Mode

If `GEMINI_API_KEY` is blank or the Gemini call fails, the backend returns a static stub instead
of erroring out (`server/wave_api/ai.py — _fallback()`):

```python
{
  "title": "Remedial Review: {topic_id} ({subject})",
  "content": "## Introduction\n\nThis remedial lesson covers key concepts...",
  "teacherNotes": "Focus on the items that {class} struggled with most...",
  "createdQuiz": []
}
```

The teacher still gets the full preview-and-edit workflow and can author content by hand — no
crash, no blank screen.

---

## AI → Wire → LoRa Pipeline

The output of AI generation is what makes Wave's offline delivery possible:

```
Gemini returns remedial pack (lesson + quiz + teacherNotes)
        ↓
Django stores it in SQLite
        ↓
Pack encoded to a compact tokenized array (protocol/wire_manifest.json)
        ↓
fragment() splits the array into ~200-byte LoRa chunks
        ↓
MQTT broadcasts each chunk over the local LAN / LoRa radio link
        ↓
Student device reassembles the chunks → renders lesson + quiz + notes (offline)
```

A full remedial lesson with 10 questions fits in **under 30 frames** at 200 bytes each — see
[Hardware Integration](05-HARDWARE-INTEGRATION.md) for the radio specifics.

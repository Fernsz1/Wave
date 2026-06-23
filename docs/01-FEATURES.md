# Wave — Features

> **Wave** is an offline-first, AI-powered education platform for rural students in
> Grades 4–6 who have limited or no internet. Students and teachers connect through a
> local wireless network — and, over distance, through a **LoRa long-range radio link** —
> so full learning, real-time monitoring, and AI-assisted remediation all work with
> **no internet on the student side**.
>
> Detailed source-of-truth references: [README](../README.md) · [Full feature reference](../FEATURES.md).

---

## ⭐ The Selling Point — LoRa Makes AI Usable Offline

Most "offline" EdTech only means *"works after you download it."* Wave is different:
**LoRa is what lets genuinely AI-generated content physically reach a classroom that
has no internet at all.**

When a teacher generates a remedial study pack with Gemini AI, Wave does **not** ask
the student's device to be online. Instead:

1. The full pack (lesson + diagnostic quiz + teacher notes) is encoded into a compact
   **tokenized array** defined by a shared manifest (`protocol/wire_manifest.json`) —
   far smaller than JSON.
2. A chunking pipeline (`fragment()`) splits that payload into **~200-byte LoRa frames**.
3. The frames are broadcast over a **town ↔ village LoRa radio link** (Heltec WiFi LoRa
   32 V3, 863–928 MHz) and re-assembled on the student device.
4. **MQTT retained messages** mean a student who was offline when the pack was sent still
   receives the latest version the moment they reconnect — no polling.

> **Why this is the differentiator:** AI remediation is only valuable if it actually
> arrives. LoRa gives Wave kilometers of range on cheap, license-free radio, so a single
> internet-connected "town" node can serve a "village" classroom that will never have a
> data plan. A full remedial lesson with 10 quiz questions fits in **under 30 frames**.

See [Hardware Integration](05-HARDWARE-INTEGRATION.md) and [AI Implementation](02-AI_IMPLEMENTATION.md) for the full pipeline.

---

## Feature Map

| Area | Highlights |
|---|---|
| **Connectivity** | Offline-first; local Wi-Fi LAN; LoRa long-range radio; MQTT sync with retained messages |
| **Students** | Lessons, topic quizzes, summative exams, rankings, progress reports, AI remedial study packs |
| **Teachers** | Class records, analytics, performance alerts, 5-step AI Remediation Wizard |
| **AI** | Gemini-generated remediation + hallucination-proof quiz variant selection, always teacher-reviewed |
| **Data** | Compact tokenized wire protocol, LoRa chunking, outbox queue, local storage |

---

## Student Features

- **Login & Authentication** — 12-digit **LRN** (the official Philippine learner ID) + 6-digit PIN.
- **Subject Focus** — pick Science, Mathematics, or English for the session.
- **Home Dashboard** — welcome card, current subject/section, and an amber **remedial alert**
  when the teacher publishes a new study pack.
- **Syllabus & Lessons** — 4 lessons per subject, each with 5–6 topics; teacher-assigned study
  pack shelf appears at the top.
- **Topic Reading** — structured ~5-minute modules (introduction, sections, definition box, key
  takeaway, important note).
- **Topic Quizzes** — 3-question multiple choice; 2/3 or 3/3 passes; failing may flag the student
  for remediation.
- **Summative Assessment** — 20-question lesson exam; passing mark 12/20 (60%).
- **Class Rankings** — top-3 podium + full standings table with the student's own row highlighted.
- **Progress Report** — radial completion ring, per-lesson bars, automatic strengths/weaknesses.
- **Remedial Study Packs** — targeted AI-assisted lessons + diagnostic quizzes delivered to the
  whole section; results flow back to the teacher.

---

## Teacher Features

- **Class Context Selector** — scope every view to one subject × grade × section.
- **Home Dashboard** — stat bento (enrollees, class average, passing rate, students under review),
  live **Remedial Tickers**, and a **performance warning card** when ≥ 25% of students are failing.
- **Class Records** — full roster with quiz average, summative, standing, and status
  (Passing / Needs Remediation / Needs Assessment); deep per-student profile modal; one-click enroll.
- **Student Analytics** — score-distribution bands, assessment trends per lesson, completion rates,
  and a support table of below-70% students with intervention recommendations.
- **AI Remediation Wizard (5 steps)** — **Setup → Generating → Preview → Edit → Published.** The
  teacher picks lesson/topic (optionally seeded by a specific student's wrong answers), Gemini
  autogenerates a pack, and the teacher reviews and edits *everything* before publishing it to the
  whole section.

---

## Offline-First Architecture

Wave keeps working with no internet **and** no server:

- **Local Storage** — all progress, quiz scores, and summative results persist in the browser.
- **MockRepository** — with no server, data lives in memory + local storage; UX is identical.
- **Outbox Queue** — offline submissions queue locally and flush automatically on reconnect.
- **HttpRepository** — switches to real REST calls when a server is configured (`VITE_API_BASE`).
- **MQTT Retained Messages** — late-connecting students always receive the latest section broadcast.
- **Footprint** — designed to run on 2–4 GB RAM mobile devices.

---

## The Remediation Loop

```
Student fails topic quiz (e.g., 0/3 or 1/3)
        ↓
Student appears in Remedial Tickers on Teacher Home
        ↓
Teacher clicks "Resolve in AI Wizard"
        ↓
Teacher generates → edits → publishes remedial pack (Gemini)
        ↓
Pack encoded → chunked into 200-byte LoRa frames → broadcast over MQTT/LoRa
        ↓
Entire section receives home alert + study pack in Syllabus (even if they were offline)
        ↓
Students complete custom diagnostic quiz
        ↓
Results sync back to teacher
        ↓
Teacher monitors improvement in Class Records & Analytics
```

This loop is Wave's core value: **assessment → AI intervention → delivery → re-measurement**,
all reachable over radio with no student-side internet.

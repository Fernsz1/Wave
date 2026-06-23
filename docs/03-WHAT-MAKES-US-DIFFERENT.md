# Wave — What Makes Our System Different

> Most EdTech assumes a stable internet connection that rural classrooms simply do not have.
> Wave is engineered from the radio up for the opposite reality.
>
> Source-of-truth references: [README](../README.md) · [Features](01-FEATURES.md) ·
> [AI Implementation](02-AI_IMPLEMENTATION.md).

---

## 1. Truly Offline-First AI Delivery Over LoRa

Other platforms call themselves "offline" when they let you *download* content while online.
Wave delivers **freshly AI-generated remediation to devices that have no internet at all**, over
a **LoRa long-range radio link**. A single internet-connected "town" node serves a "village"
classroom kilometers away on cheap, license-free radio. **This is the core differentiator** — AI
is only useful if it actually reaches the student, and Wave is built so it does.

## 2. A Purpose-Built Tokenized Wire Protocol

Instead of verbose JSON, Wave encodes every message into a compact **positional array** defined by
a shared manifest (`protocol/wire_manifest.json`).

- The same codec is implemented in **both TypeScript (frontend) and Python (backend)**.
- Both are verified against **shared golden test fixtures** (`protocol/fixtures/golden.json`) so
  they produce byte-identical output.
- A full remedial lesson with 10 quiz questions fits in **under 30 frames** at 200 bytes each —
  essential when bandwidth is measured in bytes per second.

## 3. Hallucination-Proof Assessments

Graded topic-quiz questions are **never AI-generated**. They come from a pre-authored,
teacher-reviewed pool; Gemini only **selects** which pre-vetted items to show a struggling student.
No invented or factually wrong questions can reach a graded assessment.

## 4. Human-in-the-Loop by Design

No AI output reaches students without passing through the teacher's hands. The Remediation Wizard
enforces a **Preview → Edit → Publish** sequence with every field editable and an explicit,
confirmable publish step. The AI accelerates creation; the teacher controls quality.

## 5. Data-Driven, Section-Wide Remediation

Remedial packs are shaped by **real class failure data** — the weakest topics and aggregated wrong
answers from the whole section — not generic retries. Packs are delivered section-wide, and **MQTT
retained messages** ensure a student who was offline still gets the latest pack on reconnect.

## 6. Built for the Hardware Reality of Rural Schools

- Runs on **2–4 GB RAM** mobile devices in any browser — no app install.
- Uses commodity, license-free hardware (Heltec LoRa + Raspberry Pi).
- Aligns with the **official Philippine DepEd learner ID (LRN)** students already carry.

---

## Wave vs. Typical Cloud EdTech

| Dimension | Typical Cloud EdTech | **Wave** |
|---|---|---|
| Connectivity assumption | Stable internet per student | **No student-side internet**; LoRa + local LAN |
| AI content delivery | Streamed from the cloud | Generated once at the town node, **chunked over LoRa** |
| Assessment AI safety | AI may generate questions (hallucination risk) | **AI selects from pre-vetted pool only** |
| Human oversight | Often fully automated | **Mandatory teacher Preview → Edit → Publish** |
| Wire format | Verbose JSON over HTTP | **Compact tokenized array** in ~200-byte frames |
| Late/offline learners | Miss the update | **MQTT retained messages** deliver on reconnect |
| Device footprint | Modern phones / good bandwidth | **2–4 GB RAM phones, browser-only** |
| Localization | Generic | **Grade-4 reading level, Filipino rural analogies** |
| Cost per student | Ongoing data + subscription | **No per-student data plan**; free/OSS stack |

---

## In One Sentence

**Wave is the only education platform in its class that uses AI where there is no internet — by
treating LoRa radio as a first-class delivery channel, keeping AI out of graded assessment content,
and putting a real teacher in the loop on everything that reaches a student.**

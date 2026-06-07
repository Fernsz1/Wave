# Wave — Hackathon Demo Video Script

> **Two versions included:**
> - **Short Cut (3–5 min)** — marked with ⚡ — streamlined narration, tighter scene flow
> - **Full Cut (7–10 min)** — marked with 🎬 — extended narration, deeper feature walkthroughs
>
> Scenes shared by both versions are marked **[BOTH]**.
> Scenes exclusive to the Full Cut are marked **[FULL ONLY]**.
> Where the Short Cut uses a compressed version of the same scene, the short narration is indented under ⚡.

---

## Pre-Production Notes

| Item | Detail |
|---|---|
| **Recording tool** | Screen recording (OBS / QuickTime) + optional webcam PiP |
| **App URL** | `http://localhost:5173` (run `npm run dev` inside `Wave/`) |
| **Demo accounts** | Use Quick Demo Shortcuts on the login screen for reliable seed data |
| **Resolution** | 1920×1080 minimum; record the browser in full-screen mode |
| **Font size** | Zoom browser to 110–120% so UI text is legible |
| **Transitions** | Fade-to-black (0.5 s) between major scenes |
| **Background music** | Optional: soft, upbeat instrumental; duck to –20 dB under narration |
| **Total runtime** | Short Cut ≈ 3 min 30 s · Full Cut ≈ 8 min 30 s |

---

## Presenter Cue Legend

| Symbol | Meaning |
|---|---|
| `[CLICK]` | Click a UI element |
| `[TYPE]` | Type into a field |
| `[WAIT]` | Pause for animation to complete |
| `[HIGHLIGHT]` | Mouse slowly circles / hovers over area |
| `[ZOOM]` | Zoom in on a portion of the screen |
| `[CUT]` | Hard cut to next view |
| `[FADE]` | Fade-to-black transition |
| *(beat)* | One-second natural pause in narration |

---

---

# SCENE 1 — Introduction [BOTH]

**Duration:** ⚡ 20 s · 🎬 35 s

---

### On-Screen Action

> The browser is open but the recording has not started yet.
> Start the recording on the Wave login screen.
> The `WaveLogo` animation plays.
> Slowly pan the camera (or mouse) over the login screen — brand header, role selector, clean card UI.
> Do NOT log in yet.

---

### Narration

**🎬 Full Cut:**

> "Forty-three million students in the Philippines study in schools where internet access is unreliable — or simply doesn't exist. In remote and rural areas, the digital divide does not just slow learning; it stops it altogether.
>
> *(beat)*
>
> Meet **Wave** — an AI-powered, offline-first educational platform built specifically for classrooms that the internet forgot."

---

**⚡ Short Cut:**

> "In rural Philippine classrooms, unreliable internet puts millions of students at a disadvantage. **Wave** is an AI-powered, offline-first educational platform built to change that."

---

### Key Message

> Education should reach every student, regardless of connectivity.

---

---

# SCENE 2 — Solution Overview [BOTH]

**Duration:** ⚡ 30 s · 🎬 60 s

---

### On-Screen Action

> `[HIGHLIGHT]` the login screen while narrating — do not interact yet.
> If available, cut to a simple **architecture slide** or **diagram** for 10–15 seconds, then return to the app.
>
> The diagram should show:
> ```
> Student App → Wi-Fi Router → LoRa Radio → AI Server → Teacher App
> ```
> Arrows in both directions. Label the LoRa link "Low-bandwidth, long-range."

---

### Narration

**🎬 Full Cut:**

> "Wave runs completely on-device. Students and teachers do not need an internet connection to learn, teach, or track progress.
>
> *(beat)*
>
> Here is how it works. Each classroom connects to a small Wi-Fi router. That router relays data through a **LoRa radio link** — a low-bandwidth, long-range wireless technology capable of sending small packets over several kilometers, even in areas with no cellular coverage.
>
> *(beat)*
>
> On the other side, an AI server powered by **Google Gemini** processes student results, generates personalized remedial lessons, and pushes them back down to every student in the class — all without a single student needing to touch the internet directly.
>
> *(beat)*
>
> The version you are about to see is a fully functional prototype. The sync layer is simulated through shared application state, so every action you see here represents exactly what will happen over the radio link in production."

---

**⚡ Short Cut:**

> "Wave runs offline. A Wi-Fi router bridges student devices to a LoRa radio, which relays small data packets to an AI server running Google Gemini. Quiz results travel up; personalized remedial lessons travel back down — all without internet. What you see today is a fully functional prototype of that system."

---

### Key Message

> LoRa radio + AI server = internet-independent, AI-powered learning.

---

---

# SCENE 3 — The Login Screen [BOTH]

**Duration:** ⚡ 20 s · 🎬 30 s

---

### On-Screen Action

> `[HIGHLIGHT]` the **role selector** — Student Portal / Teacher Console toggle.
> `[HIGHLIGHT]` the brand tagline: "AI-Powered Education Platform."
> `[HIGHLIGHT]` the Quick Demo Shortcuts at the bottom of the form.

---

### Narration

**🎬 Full Cut:**

> "Wave serves two roles from a single entry point. Students log in with their 12-digit Learner Reference Number and a PIN. Teachers log in with their ID and name.
>
> *(beat)*
>
> The platform supports three subject tracks — **Science, Mathematics, and English** — each with structured lessons, topic quizzes, and a final summative assessment. We will start with the student experience."

---

**⚡ Short Cut:**

> "One login screen, two roles. Students use their Learner Reference Number; teachers use their faculty ID. Let's log in as a student."

---

### Key Message

> Simple, accessible login for both students and teachers.

---

---

# SCENE 4 — Student Experience [BOTH]

**Duration:** ⚡ 70 s · 🎬 150 s

---

### On-Screen Action (Step-by-step)

> **Step 4a — Login**
> `[CLICK]` the **"Sophia Cruz"** Quick Demo Shortcut (top-ranked student).
> A full-screen subject selection overlay appears.
> `[HIGHLIGHT]` the three subject cards briefly.
> `[CLICK]` **Science** (🧪).
> The Home dashboard loads.

> **Step 4b — Home Dashboard**
> `[HIGHLIGHT]` the Welcome banner — name, LRN card.
> `[HIGHLIGHT]` the **Academic Progress** section — progress bars per subject.
> `[HIGHLIGHT]` the **Next Lesson Topic** card with "Read Lesson" and "Quiz" buttons.
> `[ZOOM]` on the bottom navigation bar — Home / Syllabus / Rankings / Progress.

> **Step 4c — Syllabus**
> `[CLICK]` **Syllabus** tab (bottom nav).
> `[HIGHLIGHT]` the Lessons accordion — lesson rows with topic completion chips.
> `[CLICK]` a lesson row to expand it.
> `[HIGHLIGHT]` the topic timeline — status chips (Completed / In Progress / Not Started), quiz scores.
> `[CLICK]` **Study** on one topic.
> Reading view opens — structured content, definition callout, key takeaway.
> `[HIGHLIGHT]` the reading content briefly.
> `[CLICK]` **Proceed to Quiz**.
> Quiz engine loads.
> `[HIGHLIGHT]` the question, multiple-choice options.
> Answer all three questions.
> `[CLICK]` **Submit Evaluation**.
> Results screen — score, pass/fail badge.
> `[CLICK]` **Return to Lesson**.

> **Step 4d — Rankings**
> `[CLICK]` **Rankings** tab.
> `[HIGHLIGHT]` the top-3 podium (Gold / Silver / Bronze).
> `[HIGHLIGHT]` the full standings list — the student's row highlighted with "You" badge.
> `[ZOOM]` on the bottom toast: "You are currently ranked #N in your class."

> **Step 4e — Progress Report**
> `[CLICK]` **Progress** tab.
> `[HIGHLIGHT]` the radial completion ring.
> `[HIGHLIGHT]` the Strengths and Topics to Review breakdown.

---

### Narration

**🎬 Full Cut:**

> "Let's log in as Sophia Cruz, one of our top-ranked students.
>
> *(beat)*
>
> The first thing she sees is a **subject selection screen**. Wave locks each session to one subject track — this keeps data payloads small and focused as they travel over the radio link. She chooses Science.
>
> *(beat)*
>
> Her home dashboard shows a personalized welcome, her progress across all three subjects, and a smart suggestion for the next topic she should tackle. Everything she needs is one tap away.
>
> *(beat)*
>
> Over in the Syllabus, she can see every lesson in her Science course. Each lesson expands into a timeline of topics, each with a clear status — Not Started, In Progress, Completed, or Mastered. Mastery means a perfect quiz score.
>
> *(beat)*
>
> She reads a lesson on the Human Body — structured sections, a definition callout, and a key takeaway. Then she moves directly into the quiz. Three targeted questions, instant feedback, and her score is recorded.
>
> *(beat)*
>
> That score is now 'on its way up' — in production, it would be tokenized and relayed through the LoRa link to the teacher's device. In this prototype, it updates the teacher's dashboard immediately.
>
> *(beat)*
>
> The **Rankings** tab shows a live class leaderboard. The top three students appear on a podium. Sophia's own row is highlighted, and a toast at the bottom confirms her rank. This leaderboard is pushed down from the teacher's side, so it reflects the entire section's progress.
>
> *(beat)*
>
> Finally, the **Progress Report** gives Sophia a clear picture of where she stands — a radial completion ring, lesson-by-lesson breakdowns, and an automatically generated list of topics where she is strong versus topics she should revisit."

---

**⚡ Short Cut:**

> "Logged in as Sophia Cruz, she selects Science for this session. Her Home dashboard shows her progress, her next suggested topic, and quick navigation to every feature.
>
> In the Syllabus, every lesson expands into a topic timeline. She reads the content, takes the quiz — and that score is immediately relayed to the teacher's side.
>
> The Rankings tab shows a live class leaderboard, pushed down from the teacher, encouraging healthy competition. And the Progress Report gives a clear view of strengths and areas to review."

---

### Key Message

> An intuitive, complete learning journey — read, quiz, track, compete.

---

---

# SCENE 5 — Teacher Experience [BOTH]

**Duration:** ⚡ 60 s · 🎬 130 s

---

### On-Screen Action (Step-by-step)

> **Step 5a — Login as Teacher (with Warning)**
> `[CLICK]` **Teacher Console** tab in the role selector.
> `[CLICK]` the **"Teacher Warning"** Quick Demo Shortcut (Mrs. Elena Santos, pre-set to Science / Grade 6 – Section Newton).
> Teacher Home dashboard loads.

> **Step 5b — Teacher Home**
> `[HIGHLIGHT]` the Active Course and Active Section selectors at the top.
> `[ZOOM]` on the **rose-colored Performance Warning banner**: "28% of enrollees are below the passing threshold."
> `[HIGHLIGHT]` the stats bento: Enrollees, Class Average, Passing Rate, Under Review.
> `[HIGHLIGHT]` the **Remedial Tickers** on the right — failing students, their topic, their score.
> Scroll down to show the **Faculty AI Tools** section.

> **Step 5c — Class Records**
> `[CLICK]` **Class Records** tab.
> `[HIGHLIGHT]` the student roster table — Name/LRN, Quiz Average, Summative score, Status badge.
> `[ZOOM]` on a student with "Needs Remediation" status badge (Jacob Flores).
> `[CLICK]` **View Record** on Jacob Flores.
> Deep profile modal opens.
> `[HIGHLIGHT]` the five sections: Student Information, Academic Performance, Topic Assessment Results, Summative Performance, Teacher Remarks.
> `[CLICK]` close the modal.

> **Step 5d — Analytics**
> `[CLICK]` **Analytics** tab.
> `[HIGHLIGHT]` Key Metrics at the top.
> `[HIGHLIGHT]` Score Distribution bands (Excellent / Proficient / Satisfactory / Remedial-target).
> `[HIGHLIGHT]` Assessment Trends chart and lesson selector dropdown.
> `[HIGHLIGHT]` Students Requiring Support table at the bottom.

---

### Narration

**🎬 Full Cut:**

> "Now let's switch perspectives. We log in as Mrs. Elena Santos, a Science teacher for Grade 6 — Section Newton.
>
> *(beat)*
>
> The teacher selects her subject and section, and the dashboard responds immediately. She does not have to search for problems — Wave surfaces them for her. A bold warning tells her that **28% of her students are below the passing threshold**, exceeding the intervention trigger. The stats bento gives her the full picture at a glance: total enrollees, class average, passing rate, and the number of students currently under review.
>
> *(beat)*
>
> The Remedial Tickers on the right are a live feed of failing students — name, which topic they struggled on, and their exact score. Each one is a direct gateway into the AI Wizard. Mrs. Santos never has to hunt through a spreadsheet to find who needs help.
>
> *(beat)*
>
> In Class Records, the roster table shows every student's quiz average, summative score, and a clear status badge — Passing, Needs Remediation, or Needs Assessment. She clicks into Jacob Flores's deep profile. Five panels give her the complete picture: his academic standing, his per-topic quiz attempts, his summative results, and auto-generated teacher remarks with a recommended next step.
>
> *(beat)*
>
> The Analytics tab takes it a step further. A score distribution chart shows how the class is clustered across performance bands. An assessment trends view lets her drill into any lesson and see per-topic accuracy across the whole section. At the bottom, a targeted support table lists every student below 70%, with tailored intervention recommendations."

---

**⚡ Short Cut:**

> "Switching to the teacher — Mrs. Santos logs into Grade 6, Science. The dashboard immediately flags that 28% of her class is below passing, shows live stats, and lists failing students by name and topic in the Remedial Tickers.
>
> Class Records gives a full roster with status badges. Jacob Flores is flagged for remediation — one click opens a deep profile with his quiz history and auto-generated teacher remarks.
>
> The Analytics tab shows score distribution, assessment trends per lesson, and a targeted support table — everything a teacher needs to act, not just observe."

---

### Key Message

> Teachers see problems before they become failures — and act with one click.

---

---

# SCENE 6 — Offline-First Workflow [BOTH]

**Duration:** ⚡ 25 s · 🎬 50 s

---

### On-Screen Action

> Stay on the Teacher Analytics or Home tab.
> If you have a network diagram slide prepared, cut to it for 10 s, then return to the app.
> Otherwise, `[HIGHLIGHT]` the live data on screen while narrating — data that arrived without any external internet call.

---

### Narration

**🎬 Full Cut:**

> "Everything you have seen so far — the quiz scores, the rankings, the failing alerts, the student profiles — none of it required an internet connection to get here.
>
> *(beat)*
>
> In production, student quiz results are serialized into small, compressed JSON payloads, wrapped in a common envelope, and sent through the Wi-Fi router to the LoRa radio transmitter. LoRa relays the packet to the AI server at the school's edge — which may be a single-board computer in the principal's office. The AI server decodes the payload, updates its store, and when the teacher's tablet checks in over the same radio link, the updated data arrives.
>
> *(beat)*
>
> Large content, like remedial lesson handbooks, is **fragmented into chunks** that fit within a single LoRa frame and are reassembled on the student's device. The student never sees the fragmentation — they just see the lesson appear.
>
> *(beat)*
>
> This architecture means the entire platform operates within the bandwidth constraints of a LoRa link — typically 250 bytes per packet — while still delivering rich, AI-generated educational content."

---

**⚡ Short Cut:**

> "None of this needs the internet. Student quiz data is compressed into small LoRa-compatible payloads and relayed through the radio link to an edge AI server. Large content like lesson handbooks is fragmented into chunks that fit a LoRa frame and reassembled on-device. Rich learning, within 250-byte packets."

---

### Key Message

> LoRa-compatible payload design: rich content, minimal bandwidth.

---

---

# SCENE 7 — AI Features: The Remediation Wizard [BOTH]

**Duration:** ⚡ 55 s · 🎬 120 s

---

### On-Screen Action (Step-by-step)

> Return to the Teacher Home tab (or still on it from Scene 5).
>
> **Step 7a — Launch Wizard from Remedial Ticker**
> `[HIGHLIGHT]` a Remedial Ticker row for Jacob Flores — topic "Muscular System", score "0/3".
> `[CLICK]` **"Resolve in AI Wizard"** on that ticker row.
> The Remediation Wizard opens. Setup step is shown.
>
> **Step 7b — Setup Step**
> `[HIGHLIGHT]` the target section field (read-only — locked to the whole section, not just Jacob).
> `[HIGHLIGHT]` the auto-diagnostic note: "Student Jacob Flores failed Muscular System (0/3) — this context shapes the generated content."
> `[CLICK]` **"Autogenerate outlines"** (Generate button).
>
> **Step 7c — Generating Step**
> `[HIGHLIGHT]` the animated WaveLogo + progress bar.
> `[HIGHLIGHT]` the status messages as they appear: "Connecting to Gemini…", "Decomposing failed quiz telemetry…", "Synthesizing remedial handbook…", "Fragmenting into LoRa chunks…"
> `[WAIT]` for 100% to complete.
>
> **Step 7d — Preview Step**
> `[HIGHLIGHT]` the generated lesson title and teacher notes field.
> `[HIGHLIGHT]` a section of the generated handbook content (scroll briefly).
> `[HIGHLIGHT]` the custom diagnostic quiz questions below — correct answer is highlighted in green.
> `[CLICK]` **"Polish Content"** (Edit button).
>
> **Step 7e — Edit Step**
> `[HIGHLIGHT]` the editable title and teacher notes.
> Make a small edit to the teacher notes — type a brief personal message.
> `[CLICK]` **"Save Changes"** → returns to Preview.
>
> **Step 7f — Publish**
> `[CLICK]` **"Publish to section"**.
> A broadcast warning is shown: "This will be delivered to all students in Section Newton."
> `[CLICK]` confirm.
> Success screen — pack is on the section's portal.
> `[CLICK]` **"Close wizard"**.

---

### Narration

**🎬 Full Cut:**

> "This is where Wave's AI capability becomes concrete. In the Remedial Tickers, Jacob Flores has scored zero out of three on the Muscular System topic. Mrs. Santos clicks 'Resolve in AI Wizard' — and the wizard opens, already pre-configured with the context of Jacob's failure.
>
> *(beat)*
>
> Notice that the target is not Jacob alone. Wave broadcasts remedial content to the **entire section**. This is a deliberate design choice — LoRa does not support targeted unicast in the same efficient way it supports broadcast, and more importantly, if one student is struggling, others likely are too.
>
> *(beat)*
>
> The diagnostic note at the top confirms what the AI will use as its seed: the specific question Jacob got wrong, his selected answer, and the correct answer. This telemetry shapes the lesson.
>
> *(beat)*
>
> Mrs. Santos clicks Generate. Watch the status messages as the AI works — connecting to Gemini, decomposing the failure telemetry, synthesizing a remedial handbook, and finally fragmenting the output into LoRa-compatible chunks for transmission.
>
> *(beat)*
>
> The preview gives her the complete generated output — a structured lesson with an introduction, content sections, a definition callout, and a key takeaway — followed by a custom diagnostic quiz where the correct answers are already highlighted for her review.
>
> *(beat)*
>
> She can edit anything. She adds a personal note to the section, then publishes. A broadcast confirmation warns her that every student in Section Newton will receive this pack. She confirms — and it is done.
>
> *(beat)*
>
> The moment she publishes, every student's Home screen will show a remedial alert, and their Syllabus will show the Teacher-Assigned Study Pack — ready to read and complete."

---

**⚡ Short Cut:**

> "This is Wave's flagship AI feature. Jacob Flores scored zero on the Muscular System — one click on his Remedial Ticker opens the AI Wizard, pre-filled with the context of his failure.
>
> The target is the entire section — a broadcast design that matches LoRa's strengths and acknowledges that struggling students are rarely alone.
>
> Gemini synthesizes a tailored remedial lesson and custom diagnostic quiz, then fragments the output into LoRa-compatible chunks. Mrs. Santos can preview and edit everything before publishing. One click — and every student's Home screen shows the remedial alert, their Syllabus shows the Teacher-Assigned Study Pack."

---

### Key Message

> AI turns a quiz failure into a targeted, teacher-reviewed lesson — delivered to the whole class.

---

---

# SCENE 8 — Receiving Remediation as a Student [BOTH]

**Duration:** ⚡ 30 s · 🎬 55 s

---

### On-Screen Action

> `[CLICK]` **Sign Out** from the teacher session.
> Login screen reappears.
> `[CLICK]` the **"Jacob Flores"** Quick Demo Shortcut (flagged for remediation).
> `[CLICK]` **Science** on the subject overlay.
> Home dashboard loads.
>
> `[ZOOM]` on the amber **"Custom Remedial Path Generated"** alert card at the top of the dashboard.
> `[HIGHLIGHT]` the **"Start Remedial Work"** button.
> `[CLICK]` the Syllabus tab.
> `[HIGHLIGHT]` the **"Teacher-Assigned Study Pack"** shelf — the published lesson from Mrs. Santos appears, with her teacher notes visible.
> `[CLICK]` **"Execute Workbook"**.
> The remedial lesson opens in the reading view — same familiar interface, custom content.

---

### Narration

**🎬 Full Cut:**

> "We close the teacher session and log in as Jacob Flores — the student whose failure seeded the remediation.
>
> *(beat)*
>
> His Home screen is different now. An amber alert card has appeared at the top: 'Custom Remedial Path Generated.' This is the payload that arrived from Mrs. Santos — in production, it would have traveled down the LoRa link and been reassembled from chunks on Jacob's device. In the prototype, it appears instantly.
>
> *(beat)*
>
> Over in the Syllabus, the Teacher-Assigned Study Pack is waiting — the lesson title, Mrs. Santos's personal note to the section, and an 'Execute Workbook' button. Jacob clicks through, reads the custom lesson, and completes the diagnostic quiz. His new results flow back up to the teacher, and she can see whether the intervention worked."

---

**⚡ Short Cut:**

> "Logged in as Jacob, the impact is immediate. An amber alert on his Home screen reads 'Custom Remedial Path Generated.' In the Syllabus, the Teacher-Assigned Study Pack is waiting — Mrs. Santos's lesson, her personal note, and the custom diagnostic quiz. He completes the workbook, his results travel back to the teacher, and the cycle closes."

---

### Key Message

> The student–teacher feedback loop closes — without the internet.

---

---

# SCENE 9 — Impact [BOTH]

**Duration:** ⚡ 25 s · 🎬 50 s

---

### On-Screen Action

> Hold on Jacob's Syllabus or the completed quiz results screen.
> Optionally cut to a **statistics slide** for 10–15 seconds with the impact figures below, then return to the app.

---

### Narration

**🎬 Full Cut:**

> "Step back and consider what just happened.
>
> *(beat)*
>
> A student in a classroom with no internet connection struggled on a quiz. His teacher was alerted automatically. An AI model synthesized a personalized lesson. The teacher reviewed and approved it. Every student in the class received it — over a radio link capable of penetrating walls and reaching kilometers away.
>
> *(beat)*
>
> Wave does not require a school to wait for infrastructure investment, fiber rollout, or government subsidy to deliver quality, data-driven education. It works with what rural Philippine schools already have — a teacher, a tablet, and a small radio.
>
> *(beat)*
>
> The curriculum spans Science, Mathematics, and English — aligned to DepEd grade levels, with structured lessons, topic quizzes, summative assessments, a class rankings system, and full per-student analytics. Every feature you have seen is functional today."

---

**⚡ Short Cut:**

> "A student struggled. A teacher was alerted. An AI built a lesson. The whole class received it over a radio signal. No internet required.
>
> Wave turns a tablet, a router, and a small LoRa radio into a complete, AI-powered learning environment — ready for the classrooms that need it most."

---

### Key Message

> Meaningful AI for the students who need it most — today, not after infrastructure catches up.

---

---

# SCENE 10 — Technical Summary [FULL ONLY]

**Duration:** 🎬 40 s

---

### On-Screen Action

> Cut to a clean **slide or split screen** showing the tech stack and architecture.
> If no slide is prepared, stay on the app and pan slowly while narrating.

---

### Narration

**🎬 Full Cut:**

> "Under the hood, Wave is built on **React 19** with TypeScript, styled with Tailwind CSS v4, and animated with Motion — the successor to Framer Motion. The AI layer uses **Google Gemini** via a thin Express.js server that handles content generation server-side.
>
> *(beat)*
>
> Every data structure in the app maps directly to a **JSON Schema** that defines the exact wire format for LoRa transmission — including the envelope structure, chunking indices, and direction flags. The schemas are production-ready; the radio integration is the remaining engineering milestone.
>
> *(beat)*
>
> The platform is mobile-first, designed for low-end Android tablets. It is offline-first in architecture, not just in name — every core flow, from login to quiz submission to remediation delivery, is designed to work without a live internet connection."

---

### Key Message

> Production-grade architecture, not just a prototype.

---

---

# SCENE 11 — Conclusion [BOTH]

**Duration:** ⚡ 25 s · 🎬 40 s

---

### On-Screen Action

> Return to (or hold on) the Wave login screen — the `WaveLogo` centered, the tagline visible.
> Slowly zoom out to frame the full login card.
> Optionally fade to a **title card** with the project name, team name, and a one-line tagline.

---

### Narration

**🎬 Full Cut:**

> "Wave is not a concept. It is a working platform that demonstrates a viable path to AI-powered education in offline environments.
>
> *(beat)*
>
> The pieces are all here — the student experience, the teacher dashboard, the AI remediation engine, and the data architecture designed for constrained radio transmission.
>
> *(beat)*
>
> We built Wave because we believe that access to a good teacher should not depend on a Wi-Fi signal. Thank you."

---

**⚡ Short Cut:**

> "Wave is a working platform — student experience, teacher dashboard, AI remediation, and LoRa-ready data architecture, all functional today. We built it because quality education should not depend on a Wi-Fi signal. Thank you."

---

### Key Message

> Wave is real, it is ready, and it is built for the students who need it most.

---

---

## Runtime Estimates

| Version | Scenes Included | Estimated Runtime |
|---|---|---|
| **Short Cut** | 1, 2, 3, 4, 5, 6, 7, 8, 9, 11 | **≈ 3 min 40 s** |
| **Full Cut** | All scenes including 10 | **≈ 8 min 30 s** |

---

## Recording Checklist

- [ ] Run `npm run dev` in `Wave/` directory — confirm app loads at `localhost:5173`
- [ ] Browser zoom set to 110–120%
- [ ] Quick Demo Shortcuts visible on login screen (scroll to bottom if needed)
- [ ] Screen recorder set to 1920×1080 with audio input enabled
- [ ] Microphone test completed — narration is clear, no background noise
- [ ] Architecture diagram slide or image ready (optional but recommended for Scene 2)
- [ ] Impact statistics slide ready (optional for Scene 9)
- [ ] Tech stack slide ready (optional for Scene 10, Full Cut only)
- [ ] Background music at –20 dB or lower
- [ ] Practice run completed — all demo shortcuts work as expected
- [ ] Fade-to-black transitions between major scenes

---

## Scene Order Quick Reference

| # | Scene | Short ⚡ | Full 🎬 | Start Cue |
|---|---|---|---|---|
| 1 | Introduction | 20 s | 35 s | Wave login screen visible |
| 2 | Solution Overview | 30 s | 60 s | Still on login / architecture slide |
| 3 | Login Screen Tour | 20 s | 30 s | Highlight role selector |
| 4 | Student Experience | 70 s | 150 s | Click Sophia Cruz shortcut |
| 5 | Teacher Experience | 60 s | 130 s | Click Teacher Console + Teacher Warning shortcut |
| 6 | Offline-First Workflow | 25 s | 50 s | Hold on teacher dashboard |
| 7 | AI Remediation Wizard | 55 s | 120 s | Click Resolve in AI Wizard |
| 8 | Student Receives Remediation | 30 s | 55 s | Log out → Jacob Flores login |
| 9 | Impact | 25 s | 50 s | Hold on completed quiz / impact slide |
| 10 | Technical Summary | — | 40 s | Cut to tech stack slide |
| 11 | Conclusion | 25 s | 40 s | Return to login screen |

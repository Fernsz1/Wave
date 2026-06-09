<div align="center">

# 🌊 Wave
### Offline-First AI Education for Remote Classrooms

*Delivering personalized, AI-powered learning to students where the internet never reaches.*

---

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Django](https://img.shields.io/badge/Django-5.x-092E20?style=flat-square&logo=django&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-2.0--flash-4285F4?style=flat-square&logo=google&logoColor=white)
![MQTT](https://img.shields.io/badge/MQTT-Mosquitto-660066?style=flat-square&logo=eclipsemosquitto&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite&logoColor=white)

</div>

---

## The Problem

Across rural municipalities in the Philippines — and throughout ASEAN — millions of students study in classrooms that have no reliable internet, intermittent power, and teachers stretched thin across large multi-grade classes. Standard EdTech platforms assume a stable connection that simply does not exist.

When a student fails a quiz in a remote barangay school, there is no adaptive system to intervene. The teacher may not know until end-of-term. The student falls further behind.

## The Solution

Wave is an offline-first educational platform that runs entirely over a local wireless network — **no internet required for students**. A battery-backed laptop acts as the server and teacher terminal. Students access Wave from any mobile browser over a local hotspot. Data travels over MQTT with a custom tokenized-array wire protocol designed to fit inside **200-byte LoRa radio frames** for future long-range deployment.

When a student fails a topic quiz, Wave's AI Remediation Wizard gives the teacher a single button to generate a personalized remedial lesson and diagnostic quiz using Gemini AI — targeting the exact questions the class got wrong. The teacher reviews and edits everything before publishing. The content is broadcast over the local network and arrives on every student device even if they were offline when it was sent.

---

## Key Features

### Offline First
The entire student and teacher experience works without internet. All quiz scores, progress data, and lesson content are stored locally and synced automatically over the local LAN when the server is reachable. A LoRa-compatible chunking pipeline fragments large payloads (remedial packs) into 200-byte frames for transmission on constrained radio links. Designed to run on 2–4 GB RAM mobile devices.

### Tokenized Wire Protocol
Instead of verbose JSON, Wave encodes every message into a compact positional array defined by a shared manifest (`protocol/wire_manifest.json`). The same codec is implemented in both TypeScript (frontend) and Python (backend) and verified by shared golden test fixtures. A full remedial lesson with 10 quiz questions fits in under 30 MQTT messages at 200 bytes each.

### AI Remediation Wizard
When ≥ 25% of a class section fails a summative exam after three attempts, Wave automatically raises a Remedial Banner on the teacher's dashboard. The teacher opens the AI Remediation Wizard — pre-filled with the weakest topics and aggregated wrong answers from the whole class — and clicks **Autogenerate**. Gemini returns a complete remedial study pack: a Markdown lesson, teacher notes addressed to the class, and a 10-question diagnostic quiz. All of it tailored to the specific misconceptions the data revealed.

### AI Quiz Variant Selection
On a student's second failed attempt at a topic quiz, Wave sends the student's wrong answers and the full 10-question pre-authored pool to Gemini. Gemini selects the 5 questions from that pool that best address the student's specific gaps. No new questions are invented — the AI only decides which pre-vetted items to show, preventing hallucination in assessment content.

### Human-in-the-Loop
The teacher sees a full preview of every AI-generated output before it reaches students. Every field — title, lesson content, teacher notes, and each quiz question — is editable. Publishing requires explicit confirmation. The AI accelerates creation; the teacher controls quality.

---

## Architecture & Tech Stack

```
┌──────────────────────────────────────────────────────┐
│                 Teacher Browser (Laptop)              │
│           React 19 + TypeScript + Tailwind            │
└────────────────────┬─────────────────────────────────┘
                     │ HTTP REST + WebSocket MQTT
┌────────────────────▼─────────────────────────────────┐
│              Django REST Framework (Laptop)           │
│   wave_api/ai.py  ──►  Gemini API (via ethernet)     │
│   Eclipse Mosquitto MQTT Broker  :9001               │
│   SQLite database                                     │
└────────────────────┬─────────────────────────────────┘
                     │ MQTT over local WiFi LAN
┌────────────────────▼─────────────────────────────────┐
│            Student Device (Mobile Browser)            │
│      React 19 PWA  ·  Offline localStorage cache     │
│      Chunked MQTT reassembler (200-byte LoRa frames)  │
└──────────────────────────────────────────────────────┘
```

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | React | 19 |
| Language | TypeScript | 5.8.2 |
| Build Tool | Vite | 6.2.3 |
| Styling | Tailwind CSS | v4 |
| Animations | Motion (Framer Motion) | 12.x |
| Messaging (client) | mqtt.js | 5.15.1 |
| Schema Validation | Zod | 4.4.3 |
| Backend Framework | Django + Django REST Framework | 5.x / 3.15+ |
| AI Engine | Google Gemini (`gemini-2.0-flash`) | `@google/genai` 2.4+ |
| MQTT Broker | Eclipse Mosquitto | latest |
| MQTT Client (Python) | paho-mqtt | 2.0+ |
| Database | SQLite | — |
| Frontend Tests | Vitest | 4.1.8 |
| Backend Tests | pytest + pytest-django | 8.0+ / 4.8+ |
| Runtime | Python | 3.12+ |

---

## Hardware Setup

Wave is not a standard web app. The prototype runs across three physical devices that form an isolated local network.

| # | Device | Role | Internet? |
|---|---|---|---|
| **Phone 1** | Android phone | **Hotspot Router** — creates the local WiFi network all devices communicate through | No |
| **Laptop** | Windows laptop | **Server + Teacher terminal** — runs Django, Mosquitto, Vite, and the teacher browser tab | Yes (ethernet only, for Gemini API calls) |
| **Phone 2** | Android phone | **Student device** — opens the Wave PWA in a mobile browser | No |

### Network Diagram

```
         INTERNET (home router — ethernet cable)
                        │
               ┌────────▼───────────────────┐
               │         LAPTOP             │
               │  Django      :8000         │──► Gemini API
               │  Mosquitto   :9001         │    (ethernet only)
               │  Vite        :5173         │
               │  WiFi IP: 192.168.43.x     │
               └────────────┬───────────────┘
                            │ WiFi (LAN only)
                   ┌────────▼────────┐
                   │    PHONE 1      │
                   │  Hotspot Router │
                   │  192.168.43.1   │
                   └────────┬────────┘
                            │ WiFi (LAN only)
                   ┌────────▼────────┐
                   │    PHONE 2      │
                   │ Student browser │
                   │ :5173 via LAN   │
                   └─────────────────┘
```

> **Key point:** Phone 1 and Phone 2 have zero internet access. Only the laptop's Django server reaches the Gemini API — and only during the brief moments the teacher triggers AI generation. All other sync (quiz scores, rankings, remedial delivery) runs entirely on the local LAN.

---

## Installation & Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Python](https://www.python.org/) 3.12+
- [Eclipse Mosquitto](https://mosquitto.org/download/) MQTT broker

---

### 1. Clone the repository

```bash
git clone https://github.com/SherieHub/Wave.git
cd Wave
```

---

### 2. Backend Setup

```bash
cd server

# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

# Install Python dependencies
pip install -r requirements.txt

# Create the environment file
copy .env.example .env        # Windows
# cp .env.example .env        # macOS / Linux
```

Edit `server/.env`:

```env
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.0-flash
```

> Leave `GEMINI_API_KEY` blank to run in offline fallback mode (see below).

```bash
# Apply migrations and seed the database
python manage.py migrate
python manage.py seed

# Start the Django server (accessible on the local network)
python manage.py runserver 0.0.0.0:8000

# In a second terminal — start the MQTT subscriber
python manage.py run_mqtt
```

---

### 3. MQTT Broker

```bash
mosquitto -c server/mqtt/mosquitto.conf
```

---

### 4. Frontend Setup

```bash
cd Wave

# Install dependencies
npm install
```

Create `Wave/.env.local`:

```env
VITE_API_BASE=http://localhost:8000
VITE_MQTT_URL=ws://localhost:9001
GEMINI_API_KEY=your-gemini-api-key-here
```

For multi-device testing (Phone 2 as student), replace `localhost` with the laptop's LAN IP (e.g. `192.168.43.87`):

```env
VITE_API_BASE=http://192.168.43.87:8000
VITE_MQTT_URL=ws://192.168.43.87:9001
```

```bash
# Start the frontend (--host makes it accessible on the network)
npm run dev -- --host
```

Open the teacher view at `http://localhost:5173` on the laptop.  
Open the student view at `http://192.168.43.87:5173` on Phone 2.

---

### Environment Variables Reference

| Variable | Where | Required | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | `server/.env` | No* | Gemini API key for AI generation |
| `GEMINI_MODEL` | `server/.env` | No | Model to use (default: `gemini-2.0-flash`) |
| `VITE_API_BASE` | `Wave/.env.local` | Yes | Django server base URL |
| `VITE_MQTT_URL` | `Wave/.env.local` | Yes | Mosquitto WebSocket URL |

*\*If absent, the app runs in offline fallback mode — see below.*

---

## Offline Fallback Mode

Wave is designed to keep working even without a Gemini API key or internet connection. When `GEMINI_API_KEY` is blank or the Gemini call fails for any reason, the backend automatically returns a static stub lesson instead of erroring out:

```python
# server/wave_api/ai.py — _fallback()
{
  "title": "Remedial Review: {topic_id} ({subject})",
  "content": "## Introduction\n\nThis remedial lesson covers key concepts...",
  "teacherNotes": "Focus on the items that {class} struggled with most...",
  "createdQuiz": []
}
```

The teacher still sees the full preview-and-edit workflow. They can write the lesson content manually and add quiz questions by hand before publishing. No crash, no blank screen — the workflow continues in fully offline mode.

---

## AI & Ethical Safeguards

### Hallucination Prevention in Assessments
Topic quiz questions are never AI-generated. All quiz content for student topic attempts is drawn from a **pre-authored, teacher-reviewed JSON pool** (`science.json`, `mathematics.json`, `english.json`) stored on the device. When a student fails a quiz, Gemini only **selects** which 5 of the 10 pre-authored questions to show — it cannot invent new items. This eliminates the risk of hallucinated or factually incorrect assessment questions reaching students.

### Prompt Constraints for Cultural Relevance
The remedial generation prompt enforces explicit constraints to ensure AI output is appropriate for its audience:

- **Grade 4 reading level** — content must use simple, accessible English
- **Filipino rural context** — lessons must include a real-world analogy a child in a rural *barrio* can picture (farm, river, animals, household items)
- **Structured output** — Gemini is required to return a strict JSON schema; any deviation is caught and handled before the teacher sees the result
- **Teacher-voice notes** — the `teacherNotes` field is explicitly prompted to sound warm and human, not robotic

### Human Review is Mandatory
No AI-generated content reaches students without passing through the teacher's hands. The Remediation Wizard enforces a **Preview → Edit → Publish** sequence. The teacher reads the lesson, teacher notes, and every quiz question before confirming publication. The publish action is a deliberate, confirmable step — not automatic.

---

## Team — A.I.Con

| Name | Role |
|---|---|
| **Sherielyn C. Guadiana** | Project Manager |
| **Christian Luis Fernandez** | Frontend Developer |
| **Austine John Lomocso** | Backend Developer |
| **Jamiel Kyne Pinca** | AI Developer |
| **Jozette Sheen Jayma** | Researcher |

---

<div align="center">

*Built for the students who wait the longest for a teacher's attention.*

</div>

"""
Gemini AI helpers for Wave.

generate_remediation() — builds a personalized remedial lesson + quiz for a
section that failed a topic, using the teacher's failing-item context.

Falls back to a safe stub when the API key is missing or the call fails so
the rest of the app keeps working in offline / dev mode.
"""
import json
import re
import uuid

from django.conf import settings


# ── internal helper ──────────────────────────────────────────────────────────

def _client():
    """Return a configured Gemini client, or None if the key is absent."""
    key = getattr(settings, "GEMINI_API_KEY", "") or ""
    if not key:
        return None
    try:
        from google import genai
        return genai.Client(api_key=key)
    except Exception:
        return None


def _fallback(
    subject: str,
    topic_id: str,
    student_name: str,
    topic_ids: list[str] | None = None,
    teacher_prompt: str = "",
) -> dict:
    topics = topic_ids or ([topic_id] if topic_id else [])
    topics_label = ", ".join(topics) if topics else (teacher_prompt[:60] or topic_id)
    title = (
        f"{subject.title()} Lesson: {topics_label}".strip()
        if topics or teacher_prompt
        else f"Remedial Review: {topic_id} ({subject.title()})"
    )

    concepts = []
    if teacher_prompt:
        concepts.append({
            "header_title": "Overview",
            "explanation": f"Lesson generated from the teacher's instruction: \"{teacher_prompt}\".",
        })
    for t in topics:
        concepts.append({
            "header_title": f"Key Concepts — {t}",
            "explanation": f"This module covers the core concepts of {t} in {subject.title()} for {student_name}.",
        })
    if not concepts:
        concepts = [
            {
                "header_title": "Introduction",
                "explanation": f"This lesson covers key concepts from {topic_id} in {subject.title()} for {student_name}.",
            },
            {
                "header_title": "Practice Tips",
                "explanation": "Re-read the materials, work through examples step by step, and ask your teacher if a concept is unclear.",
            },
        ]

    return {
        "lesson_number": 1,
        "lesson_title": title,
        "learning_gap": f"Misunderstandings on core elements of {topics_label}." if topics else f"Misunderstandings on core elements of {topic_id}.",
        "grade_level_section": student_name,
        "teachers_notes": [
            "Encourage step-by-step reasoning and class discussion.",
            "Focus on the concepts students struggled with most during evaluation."
        ],
        "concepts": concepts,
        # MOCK quiz so the wizard/TeacherHome preview has usable items until the
        # AI agent is integrated. Shape matches what the frontend maps
        # (question / choices / correct_answer).
        "summative_test": [
            {
                "question": f"Which best describes the main idea of {topic_id}?",
                "choices": ["A foundational concept", "An unrelated topic", "A type of assessment", "None of these"],
                "correct_answer": "A foundational concept",
            },
            {
                "question": "What is the best first step when reviewing a topic you found difficult?",
                "choices": ["Skip it", "Re-read the lesson and examples", "Guess on the quiz", "Wait for the exam"],
                "correct_answer": "Re-read the lesson and examples",
            },
            {
                "question": "Who can you ask if a concept is still unclear after reviewing?",
                "choices": ["No one", "Your teacher", "Only classmates", "Search engines only"],
                "correct_answer": "Your teacher",
            },
        ],
        "generator": "mock",
    }


# ── LangGraph multi-agent path ──────────────────────────────────────────────

def _parse_grade_level(value) -> int:
    """Extract an int grade from 'Grade 6' / '6' / 6. Defaults to 6."""
    if isinstance(value, int):
        return value
    digits = "".join(c for c in str(value or "") if c.isdigit())
    return int(digits) if digits else 6


def _generate_with_agents(
    subject: str,
    topic_id: str,
    student_name: str,
    failed_items: list | None,
    prompt: str,
    grade_level: int,
    include_quiz: bool,
) -> dict | None:
    """Run the LangGraph lesson (+optionally quiz) agents and return the AI JSON
    schema the frontend maps. Returns None if the agent stack/key is unavailable
    so the caller can fall back. Generate-only — never persists to the DB.
    """
    import os
    import uuid as _uuid

    if not os.getenv("GOOGLE_API_KEY"):
        return None
    try:
        from wave_api.agents import orchestrator
    except ImportError:
        return None

    # Agents expect failed_items as dicts; the frontend sends question strings.
    raw_items = failed_items or []
    fi_dicts = [({"question": q} if isinstance(q, str) else dict(q)) for q in raw_items]
    if not fi_dicts:
        # Lesson-generator (no failures) — seed the diagnosis from the prompt/topic.
        fi_dicts = [{"question": prompt or f"Introduce {topic_id}"}]

    sid = str(_uuid.uuid4())
    start = orchestrator.start_remediation_session(
        session_id=sid,
        subject=subject,
        grade_level=grade_level,
        original_topic_id=topic_id,
        topic="",
        lesson_context=prompt or "",
        failed_items=fi_dicts,
        target_section=student_name,
    )

    def _as_dict(v):
        return v.model_dump() if hasattr(v, "model_dump") else (dict(v) if isinstance(v, dict) else {})

    # The lesson agent's draft_lesson is a RemediationLesson: {concepts:[{header_title, explanation}]}.
    draft = _as_dict(start.get("draft_lesson"))
    diagnosis = _as_dict(start.get("core_diagnosis"))

    concepts = [
        {"header_title": c.get("header_title", ""), "explanation": c.get("explanation", "")}
        for c in (draft.get("concepts") or [])
        if isinstance(c, dict)
    ]
    content = "\n\n".join(f"## {c['header_title']}\n{c['explanation']}" for c in concepts)
    title = diagnosis.get("topic") or topic_id or "Generated Lesson"
    learning_gap = diagnosis.get("learning_gap") or ""
    teacher_notes = diagnosis.get("intervention_hint") or ""

    summative_test: list = []
    if include_quiz:
        # Run the quiz graph directly off the approved lesson. We avoid
        # orchestrator.finalize_and_publish here because its lesson-finalize node
        # writes a (placeholder-content) RemediationMaterial row as a side effect;
        # generation must not persist — the teacher publishes via /sync/push.
        try:
            from wave_api.agents.orchestrator import _quiz_graph, _quiz_config
            quiz_state = _quiz_graph().invoke(
                {
                    "subject": subject,
                    "grade_level": grade_level,
                    "original_topic_id": topic_id,
                    "topic": title,
                    "lesson_context": prompt or "",
                    "failed_items": fi_dicts,
                    "core_diagnosis": diagnosis,
                    "has_lesson_content": True,
                    "remedial_lesson": json.dumps({"concepts": concepts}),
                    "human_feedback": "approve",
                    "is_revision": False,
                    "draft_attempts": 0,
                },
                _quiz_config(sid),
            )
            # quiz_draft is a QuizDraftResponse dump: {"quiz_items": [...]}.
            quiz_draft = quiz_state.get("quiz_draft") or {}
            if hasattr(quiz_draft, "quiz_items"):
                quiz_items = quiz_draft.quiz_items
            elif isinstance(quiz_draft, dict):
                quiz_items = quiz_draft.get("quiz_items", [])
            elif isinstance(quiz_draft, list):
                quiz_items = quiz_draft
            else:
                quiz_items = []
            for item in quiz_items:
                raw = _as_dict(item)
                opts_dict = raw.get("options", {}) or {}
                choices = [opts_dict[k] for k in ("A", "B", "C", "D") if k in opts_dict]
                letter = (raw.get("correct_answer") or "").strip().upper()
                summative_test.append({
                    "question": raw.get("question_text", ""),
                    "choices": choices,
                    "correct_answer": opts_dict.get(letter, choices[0] if choices else ""),
                })
        except Exception as exc:
            print(f"[ai] quiz agent failed: {exc}")

    return {
        "lesson_number": 1,
        "lesson_title": title,
        "learning_gap": learning_gap,
        "grade_level_section": student_name,
        "teachers_notes": [teacher_notes] if teacher_notes else [],
        "concepts": concepts,
        "content": content,
        "summative_test": summative_test,
        "generator": "agent",
    }


# ── public API ────────────────────────────────────────────────────────────────

def generate_remediation(
    subject: str,
    topic_id: str,
    student_name: str,
    failed_items: list[str] | None = None,
    topic_ids: list[str] | None = None,
    prompt: str = "",
    grade_level=6,
    include_quiz: bool = True,
) -> dict:
    """
    Returns the new AI schema matching format:
    {"lesson_number", "lesson_title", "learning_gap", "grade_level_section", "teachers_notes", "concepts", "summative_test"}.

    Generation strategy, in order:
      1. LangGraph multi-agent pipeline   (if GOOGLE_API_KEY set + stack installed)
      2. Single-shot Gemini               (if GEMINI_API_KEY set + google-genai)
      3. Deterministic mock               (offline / no key)

    `topic_ids` (one or more catalog topics) and `prompt` (free-text teacher
    instruction) drive the lesson-generator flow; `failed_items` drives the
    remediation flow. `include_quiz=False` skips quiz generation (Lesson Wizard).
    """
    # 1. Real AI via the agent pipeline (the configured path).
    try:
        agent_result = _generate_with_agents(
            subject, topic_id, student_name, failed_items, prompt,
            _parse_grade_level(grade_level), include_quiz,
        )
        if agent_result is not None:
            return agent_result
    except Exception as exc:  # never let the agent path break generation
        print(f"[ai] agent generation failed, falling back: {exc}")

    # 2. Single-shot Gemini, else 3. mock.
    client = _client()
    if client is None:
        return _fallback(subject, topic_id, student_name, topic_ids=topic_ids, teacher_prompt=prompt)

    failed_block = ""
    if failed_items:
        items_list = "\n".join(f"- {q}" for q in failed_items[:5])
        failed_block = f"\n\nThe following questions were most commonly answered incorrectly by students:\n{items_list}"

    topics_block = ""
    if topic_ids:
        topics_block = f"\nBase the lesson on these catalog topics: {', '.join(topic_ids)}."
    prompt_block = ""
    if prompt:
        prompt_block = f"\nTeacher's instruction for this lesson: {prompt}"

    ai_prompt = f"""You are an expert Grade 6-8 teacher in the Philippines creating a lesson.

Subject: {subject.title()}
Topic ID: {topic_id}
Class / Section: {student_name}{topics_block}{prompt_block}{failed_block}

Generate a complete remedial learning package as a single JSON object matching this schema:

{{
  "lesson_number": 1,
  "lesson_title": "<engaging topic title, max 12 words>",
  "learning_gap": "<the specific misunderstanding being addressed>",
  "grade_level_section": "{student_name}",
  "teachers_notes": [
    "<actionable tip or warning 1>",
    "<actionable tip or warning 2>"
  ],
  "concepts": [
    {{
      "header_title": "<concept block subtitle>",
      "explanation": "<instructional explanation text>"
    }}
  ],
  "summative_test": [
    {{
      "question": "<multiple-choice question>",
      "choices": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correct_answer": "<the exact string from the choices array that is correct>"
    }}
  ]
}}

Rules:
- concepts must contain at least 2 key concept blocks.
- summative_test must contain exactly 3 multiple choice questions.
- Respond with ONLY the JSON object — no markdown fences, no extra text."""

    try:
        model = getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash")
        response = client.models.generate_content(model=model, contents=ai_prompt)
        raw = response.text.strip()
        # Strip markdown code fences if Gemini wraps the JSON anyway
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)

        # Normalize the keys to fit the requested AI JSON schema
        lesson_number = data.get("lesson_number", 1)
        lesson_title = data.get("lesson_title") or data.get("title") or f"Remedial Review: {topic_id}"
        learning_gap = data.get("learning_gap") or f"Address gaps in {topic_id}"
        grade_level_section = data.get("grade_level_section") or student_name
        
        raw_notes = data.get("teachers_notes") or data.get("teacherNotes") or []
        if isinstance(raw_notes, str):
            teachers_notes = [raw_notes]
        else:
            teachers_notes = [str(n) for n in raw_notes]
            
        concepts = []
        raw_concepts = data.get("concepts")
        if not raw_concepts and data.get("content"):
            concepts.append({
                "header_title": "Review Outline",
                "explanation": str(data.get("content"))
            })
        elif isinstance(raw_concepts, list):
            for c in raw_concepts:
                concepts.append({
                    "header_title": str(c.get("header_title", "Concept Block")),
                    "explanation": str(c.get("explanation", ""))
                })
                
        summative_test = []
        raw_test = data.get("summative_test") or data.get("createdQuiz") or []
        for q in raw_test:
            choices = [str(o) for o in q.get("choices") or q.get("options") or []]
            correct_answer = q.get("correct_answer")
            if not correct_answer and "correctAnswerIndex" in q:
                try:
                    idx = int(q["correctAnswerIndex"])
                    if 0 <= idx < len(choices):
                        correct_answer = choices[idx]
                except Exception:
                    pass
            if not correct_answer and choices:
                correct_answer = choices[0]
                
            summative_test.append({
                "question": str(q.get("question", "")),
                "choices": choices[:4],
                "correct_answer": str(correct_answer or "")
            })

        return {
            "lesson_number": lesson_number,
            "lesson_title": lesson_title,
            "learning_gap": learning_gap,
            "grade_level_section": grade_level_section,
            "teachers_notes": teachers_notes,
            "concepts": concepts,
            "summative_test": summative_test,
            "generator": "single_shot",
        }

    except Exception as exc:
        print(f"[ai] generate_remediation failed: {exc}")
        return _fallback(subject, topic_id, student_name)

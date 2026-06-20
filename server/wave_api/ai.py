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
    }


# ── public API ────────────────────────────────────────────────────────────────

def generate_remediation(
    subject: str,
    topic_id: str,
    student_name: str,
    failed_items: list[str] | None = None,
    topic_ids: list[str] | None = None,
    prompt: str = "",
) -> dict:
    """
    Returns the new AI schema matching format:
    {"lesson_number", "lesson_title", "learning_gap", "grade_level_section", "teachers_notes", "concepts", "summative_test"}.

    `topic_ids` (one or more catalog topics) and `prompt` (free-text teacher
    instruction) drive the lesson-generator flow; `failed_items` drives the
    remediation flow. Any combination is accepted.
    """
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
            "summative_test": summative_test
        }

    except Exception as exc:
        print(f"[ai] generate_remediation failed: {exc}")
        return _fallback(subject, topic_id, student_name)

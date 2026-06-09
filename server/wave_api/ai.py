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


def _fallback(subject: str, topic_id: str, student_name: str) -> dict:
    return {
        "title": f"Remedial Review: {topic_id} ({subject.title()})",
        "content": (
            f"## Introduction\n\nThis remedial lesson covers key concepts from {topic_id} "
            f"in {subject.title()} that students in {student_name} found challenging.\n\n"
            "## Key Concepts\n\nReview the core ideas from this topic carefully.\n\n"
            "## Practice Tips\n\n- Re-read the lesson materials.\n"
            "- Work through the examples step by step.\n"
            "- Ask your teacher if any concept remains unclear."
        ),
        "teacherNotes": (
            f"Focus on the items that {student_name} struggled with most. "
            "Encourage step-by-step reasoning and class discussion."
        ),
        "createdQuiz": [],
    }


# ── public API ────────────────────────────────────────────────────────────────

def generate_remediation(
    subject: str,
    topic_id: str,
    student_name: str,
    failed_items: list[str] | None = None,
) -> dict:
    """
    Returns {"title", "content", "teacherNotes", "createdQuiz"}.
    `createdQuiz` items: {id, question, options[4], correctAnswerIndex, explanation}.
    """
    client = _client()
    if client is None:
        return _fallback(subject, topic_id, student_name)

    failed_block = ""
    if failed_items:
        items_list = "\n".join(f"- {q}" for q in failed_items[:5])
        failed_block = f"\n\nThe following questions were most commonly answered incorrectly by students:\n{items_list}"

    prompt = f"""You are an expert Grade 6 teacher in the Philippines creating a personalized remedial lesson.

Subject: {subject.title()}
Topic ID: {topic_id}
Class / Section: {student_name}{failed_block}

Generate a complete remedial learning package as a single JSON object with exactly these keys:

{{
  "title": "<engaging lesson title, max 12 words>",
  "content": "<full lesson in Markdown: use ## for main sections, ### for subsections, **bold** for key terms, - for bullet points. At least 3 sections with substantive content>",
  "teacherNotes": "<2-3 sentence note to the teacher about what to emphasize and common misconceptions>",
  "createdQuiz": [
    {{
      "id": "rq-1",
      "question": "<clear multiple-choice question>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correctAnswerIndex": <0-3>,
      "explanation": "<why the correct answer is right, 1-2 sentences>"
    }}
  ]
}}

Rules:
- createdQuiz must contain exactly 3 questions.
- All 4 options must be plausible but only one correct.
- Content must directly address the failed items if provided.
- Respond with ONLY the JSON object — no markdown fences, no extra text."""

    try:
        model = getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash")
        response = client.models.generate_content(model=model, contents=prompt)
        raw = response.text.strip()
        # Strip markdown code fences if Gemini wraps the JSON anyway
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)

        # Normalise and assign stable IDs
        quiz = []
        for i, q in enumerate(data.get("createdQuiz", [])[:3]):
            quiz.append({
                "id": q.get("id") or f"rq-{uuid.uuid4().hex[:6]}",
                "question": str(q.get("question", "")),
                "options": [str(o) for o in q.get("options", [])[:4]],
                "correctAnswerIndex": int(q.get("correctAnswerIndex", 0)),
                "explanation": str(q.get("explanation", "")),
            })

        return {
            "title": str(data.get("title", f"Remedial: {topic_id}")),
            "content": str(data.get("content", "")),
            "teacherNotes": str(data.get("teacherNotes", "")),
            "createdQuiz": quiz,
        }

    except Exception as exc:
        print(f"[ai] generate_remediation failed: {exc}")
        return _fallback(subject, topic_id, student_name)

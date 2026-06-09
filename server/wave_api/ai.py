"""
AI generation for remedial material and topic quizzes (Google Gemini).

Server-side so the API key never reaches the browser. Every function is grounded
on the real lesson content in the catalog and validates the model output against
the wire `QuizQuestion` shape before returning it. If `GEMINI_API_KEY` is unset
or anything fails, it falls back to a deterministic, catalog-derived result so the
endpoints (and the offline demo) never hard-fail.
"""
from __future__ import annotations

import json

from django.conf import settings

from .models import CatalogDocument

QUIZ_SIZE = 10
SUBJECTS = ("science", "mathematics", "english")


# ── catalog lookup ────────────────────────────────────────────────────────────
def _find_topic(subject: str, topic_id: str) -> tuple[dict | None, dict | None]:
    """Return (lesson, topic) dicts for a topic id, searching the given subject
    first then all subjects (topic ids are unique across the catalog)."""
    order = [subject] + [s for s in SUBJECTS if s != subject]
    for subj in order:
        doc = CatalogDocument.objects.filter(subject=subj).first()
        if not doc:
            continue
        for lesson in doc.data:
            for topic in lesson.get("topics", []):
                if topic.get("id") == topic_id:
                    return lesson, topic
    return None, None


def _topic_context(lesson: dict, topic: dict) -> str:
    """Compact, model-friendly summary of a topic's real content for grounding."""
    c = topic.get("content", {}) or {}
    parts = [
        f"Lesson: {lesson.get('title', '')}",
        f"Topic: {topic.get('name', '')}",
        f"Summary: {topic.get('description', '')}",
        f"Introduction: {c.get('introduction', '')}",
    ]
    if c.get("definition"):
        parts.append(f"Key term: {c['definition'].get('term')} — {c['definition'].get('meaning')}")
    for s in c.get("sections", []):
        parts.append(f"Section '{s.get('title', '')}': {s.get('body', '')}")
    if c.get("keyTakeaway"):
        parts.append(f"Key takeaway: {c['keyTakeaway']}")
    return "\n".join(p for p in parts if p)


# ── validation ────────────────────────────────────────────────────────────────
def _valid_question(q: object) -> bool:
    if not isinstance(q, dict):
        return False
    opts = q.get("options")
    idx = q.get("correctAnswerIndex")
    return (
        isinstance(q.get("question"), str)
        and isinstance(opts, list)
        and 2 <= len(opts) <= 6
        and all(isinstance(o, str) for o in opts)
        and isinstance(idx, int)
        and 0 <= idx < len(opts)
        and isinstance(q.get("explanation", ""), str)
    )


def _normalize_quiz(quiz: object, topic_id: str) -> list[dict] | None:
    if not isinstance(quiz, list) or not quiz:
        return None
    out: list[dict] = []
    for i, q in enumerate(quiz):
        if not _valid_question(q):
            return None
        out.append(
            {
                "id": q.get("id") or f"{topic_id}-AI{i + 1}",
                "question": q["question"],
                "options": q["options"],
                "correctAnswerIndex": q["correctAnswerIndex"],
                "explanation": q.get("explanation", ""),
            }
        )
    return out


# ── Gemini client (lazy; degrades when unavailable) ───────────────────────────
def _get_client():
    key = getattr(settings, "GEMINI_API_KEY", "")
    if not key:
        return None
    try:
        from google import genai  # imported lazily so the dep is optional

        return genai.Client(api_key=key)
    except Exception as exc:  # noqa: BLE001 — missing dep / bad key: fall back
        print(f"[ai] Gemini unavailable: {exc}")
        return None


def _generate_json(prompt: str) -> object | None:
    client = _get_client()
    if client is None:
        return None
    try:
        model = getattr(settings, "GEMINI_MODEL", "gemini-flash-latest")
        resp = client.models.generate_content(
            model=model,
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
        return json.loads(resp.text)
    except Exception as exc:  # noqa: BLE001
        print(f"[ai] generation failed, using fallback: {exc}")
        return None


# ── deterministic, catalog-derived fallbacks ──────────────────────────────────
def _fallback_quiz(topic: dict, topic_id: str, n: int) -> list[dict]:
    base = _normalize_quiz(topic.get("quiz", []), topic_id) or []
    return base[:n] if base else [
        {
            "id": f"{topic_id}-AI1",
            "question": f"Which best describes {topic.get('name', 'this topic')}?",
            "options": [topic.get("description", "It is a key concept."), "None of these", "Not applicable", "Unknown"],
            "correctAnswerIndex": 0,
            "explanation": topic.get("content", {}).get("keyTakeaway", "Review the topic summary."),
        }
    ]


def _fallback_remediation(lesson: dict, topic: dict, topic_id: str, student_name: str) -> dict:
    c = topic.get("content", {}) or {}
    name = topic.get("name", "this topic")
    body = [f"## Remedial Review: {name}", "", c.get("introduction", "")]
    for s in c.get("sections", []):
        body.append(f"\n### {s.get('title', '')}\n{s.get('body', '')}")
    if c.get("keyTakeaway"):
        body.append(f"\n**Key takeaway:** {c['keyTakeaway']}")
    return {
        "title": f"Remedial Topic: {name}",
        "content": "\n".join(p for p in body if p),
        "teacherNotes": f"Custom review pack on {name} for {student_name}. Read through, then take the quick check.",
        "createdQuiz": _fallback_quiz(topic, topic_id, 3),
    }


# ── public API ────────────────────────────────────────────────────────────────
def generate_remediation(subject: str, topic_id: str, student_name: str, failed_items=None) -> dict:
    """Generate a remedial pack {title, content, teacherNotes, createdQuiz}."""
    lesson, topic = _find_topic(subject, topic_id)
    if topic is None:
        return {
            "title": "Remedial Topic",
            "content": "Review the topic and try the quiz again.",
            "teacherNotes": f"Custom review pack for {student_name}.",
            "createdQuiz": [],
        }

    ctx = _topic_context(lesson, topic)
    missed = ", ".join(failed_items) if failed_items else "the topic's core ideas"
    prompt = (
        "You are a grade-school teacher writing a short remedial lesson for a student who "
        f"struggled with: {missed}. Ground everything ONLY in the material below.\n\n"
        f"{ctx}\n\n"
        f"Write for a student named {student_name}. Respond with STRICT JSON of the form: "
        '{"title": str, "content": markdown str, "teacherNotes": str, '
        '"createdQuiz": [{"question": str, "options": [str, str, str, str], '
        '"correctAnswerIndex": int (0-based), "explanation": str}]}. '
        "Include 2-3 quiz questions, each with exactly 4 options."
    )
    data = _generate_json(prompt)
    if isinstance(data, dict):
        quiz = _normalize_quiz(data.get("createdQuiz"), topic_id)
        if quiz and isinstance(data.get("title"), str) and isinstance(data.get("content"), str):
            return {
                "title": data["title"],
                "content": data["content"],
                "teacherNotes": data.get("teacherNotes", ""),
                "createdQuiz": quiz,
            }
    return _fallback_remediation(lesson, topic, topic_id, student_name)


def generate_topic_quiz(subject: str, topic_id: str, n: int = QUIZ_SIZE) -> list[dict]:
    """Generate up to `n` quiz questions for a lesson topic."""
    lesson, topic = _find_topic(subject, topic_id)
    if topic is None:
        return []

    ctx = _topic_context(lesson, topic)
    prompt = (
        "Write a multiple-choice quiz grounded ONLY in the material below.\n\n"
        f"{ctx}\n\n"
        f"Respond with STRICT JSON: a list of exactly {n} objects, each "
        '{"question": str, "options": [str, str, str, str], '
        '"correctAnswerIndex": int (0-based), "explanation": str}.'
    )
    data = _generate_json(prompt)
    quiz = _normalize_quiz(data, topic_id) if data is not None else None
    if quiz:
        return quiz[:n]
    return _fallback_quiz(topic, topic_id, n)

"""AI generation: deterministic catalog-derived fallback when no API key is set."""
import pytest

from wave_api import ai
from wave_api.models import CatalogDocument


@pytest.fixture
def catalog(db, settings):
    settings.GEMINI_API_KEY = ""  # force the deterministic fallback (no network)
    CatalogDocument.objects.create(
        subject="science",
        data=[{"id": "L1", "title": "Lesson 1: Body", "description": "systems",
               "topics": [{"id": "L1-T1", "name": "Skeletal System", "description": "the bone framework",
                           "readingTime": "5 mins",
                           "content": {"introduction": "Bones form your frame.",
                                       "sections": [{"title": "Functions", "body": "Support, protect, move."}],
                                       "keyTakeaway": "206 living bones."},
                           "quiz": [{"id": "Q1", "question": "How many bones?",
                                     "options": ["106", "206", "306", "270"],
                                     "correctAnswerIndex": 1, "explanation": "206 in adults."},
                                    {"id": "Q2", "question": "What protects the brain?",
                                     "options": ["Ribs", "Skull", "Spine", "Hip"],
                                     "correctAnswerIndex": 1, "explanation": "The skull."}]}]}],
    )


def _valid_quiz(quiz):
    return quiz and all(
        isinstance(q["question"], str)
        and isinstance(q["options"], list) and len(q["options"]) >= 2
        and isinstance(q["correctAnswerIndex"], int) and 0 <= q["correctAnswerIndex"] < len(q["options"])
        for q in quiz
    )


def test_remediation_fallback_is_grounded_and_valid(catalog):
    out = ai.generate_remediation("science", "L1-T1", "Sophia Cruz")
    assert "Skeletal System" in out["title"]
    assert "Bones form your frame." in out["content"]  # grounded on real catalog content
    assert "Sophia Cruz" in out["teacherNotes"]
    assert _valid_quiz(out["createdQuiz"])


def test_topic_quiz_fallback_returns_catalog_questions(catalog):
    quiz = ai.generate_topic_quiz("science", "L1-T1", n=2)
    assert len(quiz) == 2
    assert _valid_quiz(quiz)


def test_unknown_topic_degrades_gracefully(catalog):
    out = ai.generate_remediation("science", "NOPE", "Sophia Cruz")
    assert out["createdQuiz"] == []
    assert ai.generate_topic_quiz("science", "NOPE") == []

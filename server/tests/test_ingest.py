"""Ingest routing tests — focus on the QuizAttemptRequest -> AI -> broadcast path."""
import pytest

from wave_api import ingest
from wave_api.models import RemediationMaterial


@pytest.mark.django_db
def test_quiz_attempt_request_remedial_generates_and_broadcasts():
    # No GEMINI key in tests -> ai.generate_remediation returns its safe stub,
    # so this exercises the full up -> generate -> persist -> down path offline.
    payload = {
        "studentLrn": "101234567891",
        "section": "Grade 7 - Section Rizal",
        "subject": "science",
        "lessonId": "L1",
        "topicId": "L1-T2",
        "mode": "remedial",
        "seed": 42,
    }
    downstream = ingest.handle("QuizAttemptRequest", payload, subject="science", section="Grade 7 - Section Rizal")

    # A single TeacherRemediationMaterial cast back down to the section.
    casts = [m for m in downstream if m["type"] == "TeacherRemediationMaterial"]
    assert len(casts) == 1
    cast = casts[0]
    assert cast["section"] == "Grade 7 - Section Rizal"
    assert cast["obj"]["subject"] == "science"
    assert cast["obj"]["originalTopicId"] == "L1-T2"

    # Persisted and idempotent on the seed-derived id.
    row = RemediationMaterial.objects.get(material_id=cast["obj"]["id"])
    assert row.target_section == "Grade 7 - Section Rizal"
    assert row.subject == "science"
    assert row.is_published is True

    # Re-sending the same request updates rather than duplicates.
    ingest.handle("QuizAttemptRequest", payload, subject="science", section="Grade 7 - Section Rizal")
    assert RemediationMaterial.objects.filter(material_id=cast["obj"]["id"]).count() == 1


@pytest.mark.django_db
def test_quiz_attempt_request_non_remedial_is_noop():
    # topic/summative quizzes already travel inside LessonCatalog.
    payload = {
        "studentLrn": "101234567891",
        "section": "Grade 7 - Section Rizal",
        "subject": "science",
        "lessonId": "L1",
        "mode": "summative",
        "seed": 1,
    }
    downstream = ingest.handle("QuizAttemptRequest", payload, subject="science", section="Grade 7 - Section Rizal")
    assert downstream == []
    assert RemediationMaterial.objects.count() == 0

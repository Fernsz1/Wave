"""Integration tests for the /api/generate-lesson and /api/submit-feedback routes."""
import importlib
import json

import pytest
from rest_framework.test import APIClient

# These tests drive the actual LangGraph orchestrator behind a stubbed LLM.
# If the agent dependency stack isn't installed (e.g. CI without
# langchain-google-genai), skip the whole module — the unit-level tests in
# test_agent_adapters.py still cover the schema/adapter contract.
for _mod in ("langchain_core", "langgraph"):
    try:
        importlib.import_module(_mod)
    except ImportError:
        pytest.skip(
            f"{_mod} not installed; install the agent extras (pip install -r requirements.txt) "
            "to run lesson_generation_view integration tests",
            allow_module_level=True,
        )


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def started_session(client, stub_agents, db):
    payload = {
        "subject": "science",
        "grade_level": 6,
        "original_topic_id": "L1-T2",
        "topic": "Muscles",
        "lesson_context": "lesson body",
        "target_section": "Grade 6 - Section Newton",
        "failed_items": [{"questionId": "Q2-1", "topicId": "L1-T2", "selectedOption": 0, "correctOption": 1}],
    }
    resp = client.post("/api/generate-lesson", payload, format="json")
    assert resp.status_code == 200, resp.content
    return resp.json()


def test_start_returns_session_id_and_draft(started_session):
    assert "session_id" in started_session
    draft = started_session["draft_lesson"]
    assert draft["title"]
    assert draft["content"]
    assert draft["teacher_notes"]


@pytest.mark.django_db
def test_empty_failed_items_rejected(client, stub_agents):
    resp = client.post(
        "/api/generate-lesson",
        {
            "subject": "science",
            "grade_level": 6,
            "original_topic_id": "L1-T2",
            "failed_items": [],
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "failed_items" in resp.json()


@pytest.mark.django_db
def test_invalid_feedback_value_400(client, stub_agents):
    resp = client.post(
        "/api/submit-feedback",
        {"session_id": "00000000-0000-0000-0000-000000000000", "feedback": "banana"},
        format="json",
    )
    assert resp.status_code == 400
    assert "feedback" in resp.json()


@pytest.mark.django_db
def test_unknown_session_id_404(client, stub_agents):
    resp = client.post(
        "/api/submit-feedback",
        {"session_id": "11111111-1111-1111-1111-111111111111", "feedback": "PASS"},
        format="json",
    )
    assert resp.status_code == 404


@pytest.mark.django_db
def test_pass_persists_wire_material(client, started_session):
    from wave_api.models import RemediationMaterial

    resp = client.post(
        "/api/submit-feedback",
        {"session_id": started_session["session_id"], "feedback": "PASS"},
        format="json",
    )
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body["status"] == "completed"
    assert body["type"] == "TeacherRemediationMaterial"
    wire = body["material"]
    expected_keys = {
        "id", "originalTopicId", "title", "content", "teacherNotes",
        "createdQuiz", "createdSummative", "publishDate", "targetSection",
        "chunks", "isPublished", "subject",
    }
    assert set(wire.keys()) == expected_keys
    assert wire["subject"] == "science"
    assert wire["originalTopicId"] == "L1-T2"
    assert wire["targetSection"] == "Grade 6 - Section Newton"
    assert wire["isPublished"] is True
    assert wire["chunks"] == []
    assert len(wire["createdQuiz"]) == 3
    assert wire["createdQuiz"][0]["id"] == "QREM-L1T201"
    assert isinstance(wire["createdQuiz"][0]["correctAnswerIndex"], int)
    # Internal-only fields must not appear anywhere in the payload.
    blob = json.dumps(wire)
    for forbidden in ("cognitive_level", "targeted_distractor_key",
                      "cognitiveLevel", "targetedDistractorKey"):
        assert forbidden not in blob

    # Material persisted with analytics sidecar populated.
    row = RemediationMaterial.objects.get(material_id=wire["id"])
    assert row.target_section == "Grade 6 - Section Newton"
    assert row.is_published is True
    assert "quiz_items" in row.analytics
    assert len(row.analytics["quiz_items"]) == 3
    assert row.analytics["quiz_items"][0]["cognitive_level"] == "Understanding"
    assert row.analytics["quiz_items"][0]["targeted_distractor_key"] == "A"


@pytest.mark.django_db
def test_simplify_feedback_routes_revision(client, started_session, stub_agents):
    from tests.fixtures import agent_outputs as out

    stub_agents.draft_response = out.draft_simplified()
    resp = client.post(
        "/api/submit-feedback",
        {"session_id": started_session["session_id"], "feedback": "simplify"},
        format="json",
    )
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body["status"] == "needs_review"
    assert body["draft_lesson"]["title"] == "Easy Muscles Guide"


@pytest.mark.django_db
def test_idempotent_material_id(client, started_session):
    """Re-PASSing with the same material_id updates rather than duplicates."""
    from wave_api.models import RemediationMaterial

    material_id = "REM-IDEMPOTENT1"
    resp = client.post(
        "/api/submit-feedback",
        {
            "session_id": started_session["session_id"],
            "feedback": "PASS",
            "material_id": material_id,
        },
        format="json",
    )
    assert resp.status_code == 200, resp.content
    assert RemediationMaterial.objects.filter(material_id=material_id).count() == 1

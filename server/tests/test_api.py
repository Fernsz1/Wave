"""End-to-end API + ingest tests."""
import uuid

import pytest
from rest_framework.test import APIClient

from wave_api import codec
from wave_api.models import CatalogDocument, QuizAttempt, Student


@pytest.fixture
def student(db):
    return Student.objects.create(
        lrn="101234567891", name="Sophia Cruz",
        grade_level="Grade 4 - Section Newton", section="Grade 4 - Section Newton", pin="123456",
    )


@pytest.fixture
def catalog(db):
    CatalogDocument.objects.create(
        subject="science",
        data=[{"id": "L1", "title": "Lesson 1", "description": "d",
               "topics": [{"id": "L1-T1", "name": "Skeletal", "description": "d", "readingTime": "5 mins",
                           "content": {"introduction": "i", "sections": [], "keyTakeaway": "k"},
                           "quiz": [{"id": "Q1-1", "question": "q", "options": ["a", "b"],
                                     "correctAnswerIndex": 1, "explanation": "e"}]}]}],
    )


def test_student_login_returns_token(student):
    client = APIClient()
    resp = client.post("/api/auth/login", {"role": "student", "lrn": student.lrn, "pin": "123456"}, format="json")
    assert resp.status_code == 200
    assert resp.data["token"]
    assert resp.data["user"]["name"] == "Sophia Cruz"


def test_login_wrong_pin_rejected(student):
    client = APIClient()
    resp = client.post("/api/auth/login", {"role": "student", "lrn": student.lrn, "pin": "000000"}, format="json")
    assert resp.status_code == 401


def _auth_client(student):
    from wave_api.models import ApiToken
    token = ApiToken.issue("student", student.lrn)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return client


def test_catalog_tokens_decode_to_lessons(student, catalog):
    client = _auth_client(student)
    resp = client.get("/api/catalog", {"subject": "science"})
    assert resp.status_code == 200
    decoded = codec.decode("LessonCatalog", resp.data["tokens"])
    assert decoded["subject"] == "science"
    assert decoded["lessons"][0]["topics"][0]["quiz"][0]["correctAnswerIndex"] == 1


def test_sync_push_persists_progress_and_acks(student):
    client = _auth_client(student)
    progress = {
        "studentLrn": student.lrn,
        "section": student.section,
        "completedTopicIds": ["L1-T1"],
        "quizAttempts": {"L1-T1": {"topicId": "L1-T1", "score": 3, "perfectScore": 3,
                                   "answers": [1, 2, 1], "completedAt": "2026-06-07"}},
        "quizScores": {},
        "summativeScores": {},
    }
    env = codec.encode_envelope({
        "version": codec.PROTOCOL_VERSION, "msgId": str(uuid.uuid4()),
        "type": "StudentProgress", "direction": "up", "subject": "science",
        "section": student.section, "createdAt": "2026-06-07T00:00:00Z",
        "chunkIndex": 0, "chunkTotal": 1, "payload": codec.encode("StudentProgress", progress),
    })
    resp = client.post("/api/sync/push", {"envelopes": [env]}, format="json")
    assert resp.status_code == 200
    assert len(resp.data["acks"]) == 1
    assert QuizAttempt.objects.filter(student=student, topic_id="L1-T1", score=3).exists()


def test_progress_endpoint_reflects_ingest(student):
    QuizAttempt.objects.create(student=student, topic_id="L1-T1", score=2, perfect_score=3,
                               answers=[1, 0, 1], completed_at="2026-06-07")
    client = _auth_client(student)
    resp = client.get(f"/api/progress/{student.lrn}")
    decoded = codec.decode("StudentProgress", resp.data["tokens"])
    assert decoded["quizScores"]["L1-T1"]["percent"] == 67
    assert "L1-T1" in decoded["completedTopicIds"]


@pytest.fixture
def teacher(db):
    from wave_api.models import Teacher
    return Teacher.objects.create(
        teacher_id="T-2026-001", name="Mrs. Elena Santos", department="General Academics", password="password123"
    )


def test_teacher_login_returns_token(teacher):
    client = APIClient()
    resp = client.post("/api/auth/login", {"role": "teacher", "teacherId": teacher.teacher_id, "password": "password123"}, format="json")
    assert resp.status_code == 200
    assert resp.data["token"]
    assert resp.data["user"]["name"] == "Mrs. Elena Santos"


def test_teacher_login_wrong_password_rejected(teacher):
    client = APIClient()
    resp = client.post("/api/auth/login", {"role": "teacher", "teacherId": teacher.teacher_id, "password": "wrongpassword"}, format="json")
    assert resp.status_code == 401


"""
Route a decoded "up" message to persistence, and report what should be
published back "down" as a side effect (e.g. recomputed Rankings).

Shared by the MQTT subscriber (mqtt.py) and the REST fallback (views.py) so both
ingress paths behave identically.
"""
from .derive import assemble_progress, compute_rankings
from .models import RemediationMaterial, Student, SummativeResult, Teacher


def summative_feedback(percent: int) -> str:
    """Deterministic, subject-agnostic summative feedback by score band.

    Mirror of `summativeFeedback` in Wave/src/feedback.ts so the teacher sees the
    same feedback the student saw, without adding a field to the wire protocol.
    """
    if percent >= 90:
        return "Excellent mastery."
    if percent >= 60:
        return "Good effort — light review recommended."
    return "Needs targeted review."


def _upsert_student_from_signup(p: dict) -> Student:
    student, _ = Student.objects.update_or_create(
        lrn=p["lrn"],
        defaults={
            "name": p["name"],
            "grade_level": p["gradeLevel"],
            "section": p["section"],
            "pin": p["pin"],
        },
    )
    return student


def _save_progress(p: dict) -> None:
    student = Student.objects.filter(lrn=p["studentLrn"]).first()
    if not student:
        return
    for topic_id, att in (p.get("quizAttempts") or {}).items():
        student.attempts.update_or_create(
            topic_id=topic_id,
            defaults={
                "score": att["score"],
                "perfect_score": att.get("perfectScore", 3),
                "answers": att.get("answers", []),
                "completed_at": att.get("completedAt", ""),
            },
        )
    for lesson_id, summ in (p.get("summativeScores") or {}).items():
        student.summatives.update_or_create(
            lesson_id=lesson_id,
            defaults={
                "score": summ["score"],
                "total": summ.get("perfectScore", 20),
                "feedback": summ.get("feedback", ""),
            },
        )


def _save_summative_results(p: dict) -> None:
    student = Student.objects.filter(lrn=p["studentLrn"]).first()
    if not student:
        return
    total = p.get("total", 20) or 20
    percent = p.get("percent")
    if percent is None:
        percent = round((p["score"] / total) * 100) if total else 0
    student.summatives.update_or_create(
        lesson_id=p["lessonId"],
        defaults={
            "score": p["score"],
            "total": total,
            "percent": percent,
            "passed": p.get("passed", percent >= 60),
            "failed_items": p.get("failedItems", []),
            # Derived identically on the client so teacher/student agree.
            "feedback": summative_feedback(percent),
        },
    )


def _save_remediation(p: dict, subject: str) -> None:
    RemediationMaterial.objects.update_or_create(
        material_id=p["id"],
        defaults={
            "subject": subject or "science",
            "original_topic_id": p["originalTopicId"],
            "title": p["title"],
            "content": p["content"],
            "teacher_notes": p.get("teacherNotes", ""),
            "created_quiz": p.get("createdQuiz", []),
            "publish_date": p.get("publishDate", ""),
            "target_section": p["targetSection"],
            "is_published": p.get("isPublished", True),
        },
    )


def handle(msg_type: str, payload: dict, *, subject: str = "", section: str = "") -> list[dict]:
    """
    Persist one decoded message. Returns a list of downstream "down" messages to
    publish, each as {"type", "subject", "section", "topicKey", "obj"}.
    """
    downstream: list[dict] = []

    if msg_type == "StudentSignup":
        _upsert_student_from_signup(payload)

    elif msg_type == "TeacherSignup":
        Teacher.objects.update_or_create(
            teacher_id=payload["teacherId"],
            defaults={"name": payload["name"], "department": payload.get("department", "General Academics")},
        )

    elif msg_type == "StudentProgress":
        _save_progress(payload)
        section = section or payload.get("section", "")

    elif msg_type == "StudentSummativeResults":
        _save_summative_results(payload)
        section = section or payload.get("section", "")

    # Broadcast the student's freshly-assembled progress to the section so the
    # teacher's records/analytics update live (down-cast; run_mqtt ignores it).
    if msg_type in ("StudentProgress", "StudentSummativeResults"):
        lrn = payload.get("studentLrn", "")
        student = Student.objects.filter(lrn=lrn).first()
        if student:
            downstream.append(
                {
                    "type": "StudentProgress",
                    "subject": subject,
                    "section": student.section,
                    "topicKey": student.section,
                    "obj": assemble_progress(student),
                }
            )

    elif msg_type == "TeacherRemediationMaterial":
        _save_remediation(payload, subject)
        # Broadcast the (re)published pack back down to the whole section.
        downstream.append(
            {
                "type": "TeacherRemediationMaterial",
                "subject": subject,
                "section": payload["targetSection"],
                "topicKey": payload["targetSection"],
                "obj": payload,
            }
        )

    # Any progress/summative change recomputes the section leaderboard and pushes it down.
    if msg_type in ("StudentProgress", "StudentSummativeResults") and section and subject:
        downstream.append(
            {
                "type": "Rankings",
                "subject": subject,
                "section": section,
                "topicKey": section,
                "obj": compute_rankings(section, subject),
            }
        )

    return downstream

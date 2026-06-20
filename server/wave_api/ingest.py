"""
Route a decoded "up" message to persistence, and report what should be
published back "down" as a side effect (e.g. recomputed Rankings).

Shared by the MQTT subscriber (mqtt.py) and the REST fallback (views.py) so both
ingress paths behave identically.
"""
from .derive import PASS_PERCENT, _percent, assemble_progress, compute_rankings
from .models import RemediationMaterial, Student, SummativeResult, Teacher


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


def _upsert_summative(
    student: Student,
    lesson_id: str,
    *,
    score: int,
    total: int,
    feedback: str,
    percent: int | None = None,
    passed: bool | None = None,
    failed_items: list | None = None,
) -> SummativeResult:
    """Shared by both ingress paths that can write a SummativeResult row
    (a `StudentProgress` message carrying `summativeScores`, and a dedicated
    `StudentSummativeResults` message) so neither one leaves the row partially
    populated or skips the attempts counter.
    """
    if percent is None:
        percent = _percent(score, total)
    if passed is None:
        passed = percent >= PASS_PERCENT
    obj, _ = student.summatives.update_or_create(
        lesson_id=lesson_id,
        defaults={
            "score": score,
            "total": total,
            "feedback": feedback,
            "percent": percent,
            "passed": passed,
            "failed_items": failed_items or [],
        },
    )
    obj.attempts = min(obj.attempts + 1, 3)
    obj.save(update_fields=["attempts"])
    return obj


def _save_progress(p: dict) -> None:
    student = Student.objects.filter(lrn=p["studentLrn"]).first()
    if not student:
        return
    for topic_id, att in (p.get("quizAttempts") or {}).items():
        existing = student.attempts.filter(topic_id=topic_id).first()
        prev_attempts = existing.attempts if existing else 0
        student.attempts.update_or_create(
            topic_id=topic_id,
            defaults={
                "score": att["score"],
                "perfect_score": att.get("perfectScore", 10),
                "answers": att.get("answers", []),
                "completed_at": att.get("completedAt", ""),
                "lesson_id": att.get("lessonId", ""),
                "attempts": att.get("attempts", min(prev_attempts + 1, 3)),
            },
        )
    for lesson_id, summ in (p.get("summativeScores") or {}).items():
        _upsert_summative(
            student,
            lesson_id,
            score=summ["score"],
            total=summ.get("total", 20),
            feedback=summ.get("feedback", ""),
            percent=summ.get("percent"),
            passed=summ.get("passed"),
            failed_items=summ.get("failedItems"),
        )


def _save_summative_results(p: dict) -> None:
    student = Student.objects.filter(lrn=p["studentLrn"]).first()
    if not student:
        return
    passed = p.get("passed", False)
    feedback = p.get("feedback") or (
        "Good job! You passed the summative assessment." if passed
        else "Keep reviewing the topics and ask your teacher for help."
    )
    _upsert_summative(
        student,
        p["lessonId"],
        score=p["score"],
        total=p.get("total", 20),
        feedback=feedback,
        percent=p.get("percent"),
        passed=passed,
        failed_items=p.get("failedItems"),
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
            "created_summative": p.get("createdSummative", []),
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
            defaults={
                "name": payload["name"],
                "department": payload.get("department", "General Academics"),
                "password": payload.get("password", "password123"),
            },
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

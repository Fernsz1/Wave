"""
Route a decoded "up" message to persistence, and report what should be
published back "down" as a side effect (e.g. recomputed Rankings).

Shared by the MQTT subscriber (mqtt.py) and the REST fallback (views.py) so both
ingress paths behave identically.
"""
from .derive import assemble_progress, compute_rankings
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


def _save_progress(p: dict) -> None:
    student = Student.objects.filter(lrn=p["studentLrn"]).first()
    if not student:
        return
    for topic_id, att in (p.get("quizAttempts") or {}).items():
        student.attempts.update_or_create(
            topic_id=topic_id,
            defaults={
                "score": att["score"],
                "perfect_score": att.get("perfectScore", 10),
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
    passed = p.get("passed", False)
    feedback = p.get("feedback") or (
        "Good job! You passed the summative assessment." if passed
        else "Keep reviewing the topics and ask your teacher for help."
    )
    obj, _ = student.summatives.update_or_create(
        lesson_id=p["lessonId"],
        defaults={
            "score": p["score"],
            "total": p.get("total", 20),
            "percent": p.get("percent", 0),
            "passed": passed,
            "feedback": feedback,
            "failed_items": p.get("failedItems", []),
        },
    )
    obj.attempts = min(obj.attempts + 1, 3)
    obj.save(update_fields=["attempts"])


def _save_remediation(p: dict, subject: str) -> None:
    RemediationMaterial.objects.update_or_create(
        material_id=p["id"],
        defaults={
            "subject": p.get("subject") or subject or "science",
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


def _quiz_attempt_request_to_material(req: dict) -> dict:
    """Turn a decoded QuizAttemptRequest into a wire TeacherRemediationMaterial.

    Reuses the existing one-shot generator (which itself falls back to a safe
    deterministic stub when no API key is present), then maps its lesson/quiz
    shape onto the wire schema. `seed` makes the material id idempotent so a
    re-sent request updates rather than duplicates.
    """
    from . import ai  # lazy: pulls in django settings / optional genai client

    subject = req.get("subject", "science")
    topic_id = req.get("topicId") or (req.get("focusTopicIds") or [req.get("lessonId", "")])[0]
    section = req.get("section", "")

    result = ai.generate_remediation(
        subject=subject,
        topic_id=topic_id,
        student_name=section or "your class",
        failed_items=[],
    )

    content = "\n\n".join(
        f"## {c.get('header_title', '')}\n{c.get('explanation', '')}"
        for c in result.get("concepts", [])
    )
    quiz = []
    for i, q in enumerate(result.get("summative_test", []), start=1):
        choices = [str(o) for o in q.get("choices", [])]
        correct = q.get("correct_answer", "")
        idx = choices.index(correct) if correct in choices else 0
        quiz.append({
            "id": f"QREM-{i:02d}",
            "question": q.get("question", ""),
            "options": choices,
            "correctAnswerIndex": idx,
            "explanation": "",
        })

    return {
        "id": f"REM-{topic_id}-{req.get('seed', 0)}".replace(" ", ""),
        "originalTopicId": topic_id,
        "title": result.get("lesson_title", f"Remedial: {topic_id}"),
        "content": content,
        "teacherNotes": "\n".join(result.get("teachers_notes", [])),
        "createdQuiz": quiz,
        "publishDate": "",
        "targetSection": section,
        "isPublished": True,
        "subject": subject,
    }


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

    elif msg_type == "QuizAttemptRequest":
        # LoRa-capable trigger for AI remedial generation (see OWNERSHIP.md).
        # Topic/summative quizzes already travel inside LessonCatalog, so only
        # the remedial mode generates and broadcasts new material here.
        if payload.get("mode") == "remedial":
            material = _quiz_attempt_request_to_material(payload)
            req_subject = material["subject"]
            _save_remediation(material, req_subject)
            downstream.append(
                {
                    "type": "TeacherRemediationMaterial",
                    "subject": req_subject,
                    "section": material["targetSection"],
                    "topicKey": material["targetSection"],
                    "obj": material,
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

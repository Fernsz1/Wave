"""
Server-side derivations: StudentProgress assembly and section Rankings.

These mirror the client-side computations the frontend does today, so the data
the teacher pulls matches what the student app would have shown — only now it is
computed once, server-side, from the persisted rows.
"""
from .models import CatalogDocument, QuizAttempt, Student, SummativeResult

PASS_PERCENT = 70


def _percent(score: int, total: int) -> int:
    return round((score / total) * 100) if total else 0


def assemble_progress(student: Student) -> dict:
    """Build the StudentProgress wire object from a student's persisted rows."""
    attempts = list(student.attempts.all())
    summatives = list(student.summatives.all())

    quiz_attempts = {}
    quiz_scores = {}
    completed = []
    for a in attempts:
        completed.append(a.topic_id)
        quiz_attempts[a.topic_id] = {
            "topicId": a.topic_id,
            "score": a.score,
            "perfectScore": a.perfect_score,
            "answers": a.answers,
            "completedAt": a.completed_at,
        }
        quiz_scores[a.topic_id] = {
            "score": a.score,
            "total": a.perfect_score,
            "percent": _percent(a.score, a.perfect_score),
            "passed": _percent(a.score, a.perfect_score) >= PASS_PERCENT,
        }

    summative_scores = {
        s.lesson_id: {"score": s.score, "perfectScore": s.total, "feedback": s.feedback}
        for s in summatives
    }

    return {
        "studentLrn": student.lrn,
        "section": student.section,
        "completedTopicIds": completed,
        "quizAttempts": quiz_attempts,
        "quizScores": quiz_scores,
        "summativeScores": summative_scores,
    }


def _subject_total_questions(subject: str) -> int:
    doc = CatalogDocument.objects.filter(subject=subject).first()
    if not doc:
        return 1
    total = 0
    for lesson in doc.data:
        for topic in lesson.get("topics", []):
            total += len(topic.get("quiz", []))
    return total or 1


def compute_rankings(section: str, subject: str) -> dict:
    """Section leaderboard for a subject, computed from quiz attempt scores."""
    perfect = _subject_total_questions(subject)
    rows = []
    for student in Student.objects.filter(section=section):
        score = sum(a.score for a in student.attempts.all())
        rows.append(
            {
                "studentLrn": student.lrn,
                "name": student.name,
                "score": score,
                "perfect": perfect,
                "percent": _percent(score, perfect),
            }
        )
    rows.sort(key=lambda r: r["percent"], reverse=True)
    standings = [{"rank": i + 1, **r} for i, r in enumerate(rows)]
    return {"section": section, "subject": subject, "standings": standings}

"""
Seed the DB from the JSON exported out of the frontend (Wave/scripts/export-seed.ts),
so the server starts with the exact catalog/roster/progress the app ships with.

Run:  python manage.py seed_data
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand

from wave_api.models import (
    CatalogDocument,
    QuizAttempt,
    RemediationMaterial,
    Student,
    SummativeResult,
    Teacher,
)

SEED_DIR = Path(__file__).resolve().parents[2] / "seed"


def _load(name):
    path = SEED_DIR / name
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


class Command(BaseCommand):
    help = "Seed catalog, roster, progress, and remediation from frontend export."

    def handle(self, *args, **options):
        catalog = _load("catalog.json") or {}
        for subject, lessons in catalog.items():
            CatalogDocument.objects.update_or_create(subject=subject, defaults={"data": lessons})
        self.stdout.write(f"catalog: {len(catalog)} subjects")

        students = _load("students.json") or []
        for s in students:
            Student.objects.update_or_create(
                lrn=s["lrn"],
                defaults={
                    "name": s["name"],
                    "grade_level": s["gradeLevel"],
                    "section": s.get("section", s["gradeLevel"]),
                    "pin": s.get("pin", "123456"),
                },
            )
        self.stdout.write(f"students: {len(students)}")

        teachers = _load("teachers.json") or []
        for t in teachers:
            Teacher.objects.update_or_create(
                teacher_id=t["teacherId"],
                defaults={"name": t["name"], "department": t.get("department", "General Academics")},
            )
        self.stdout.write(f"teachers: {len(teachers)}")

        progress = _load("progress.json") or {}
        for lrn, rec in progress.items():
            student = Student.objects.filter(lrn=lrn).first()
            if not student:
                continue
            for topic_id, att in (rec.get("quizAttempts") or {}).items():
                QuizAttempt.objects.update_or_create(
                    student=student,
                    topic_id=topic_id,
                    defaults={
                        "score": att["score"],
                        "perfect_score": att.get("perfectScore", 3),
                        "answers": att.get("answers", []),
                        "completed_at": att.get("completedAt", ""),
                    },
                )
            for lesson_id, summ in (rec.get("summativeScores") or {}).items():
                SummativeResult.objects.update_or_create(
                    student=student,
                    lesson_id=lesson_id,
                    defaults={
                        "score": summ["score"],
                        "total": summ.get("perfectScore", 20),
                        "feedback": summ.get("feedback", ""),
                    },
                )
        self.stdout.write(f"progress records: {len(progress)}")

        # Remediation seed is in the old single-student shape; derive targetSection
        # from the assigned student's section (canonical = whole-section cast).
        remediation = _load("remediation.json") or []
        for m in remediation:
            assigned = m.get("assignedStudentLrn", "")
            student = Student.objects.filter(lrn=assigned).first()
            target_section = student.section if student else "Grade 6 - Section Einstein"
            RemediationMaterial.objects.update_or_create(
                material_id=m["id"],
                defaults={
                    "original_topic_id": m["originalTopicId"],
                    "title": m["title"],
                    "content": m["content"],
                    "teacher_notes": m.get("teacherNotes", ""),
                    "created_quiz": m.get("createdQuiz", []),
                    "publish_date": m.get("publishDate", ""),
                    "target_section": target_section,
                    "is_published": m.get("isPublished", True),
                },
            )
        self.stdout.write(f"remediation: {len(remediation)}")
        self.stdout.write(self.style.SUCCESS("seed complete"))

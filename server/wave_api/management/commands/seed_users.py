"""
Create one demo student, one demo teacher, and seed the lesson catalog
from the frontend content JSON files so lessons appear in the syllabus.

Run:  python manage.py seed_users
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand

from wave_api.models import CatalogDocument, Student, Teacher

# Content files sit at Wave/src/content/ relative to the repo root
CONTENT_DIR = Path(__file__).resolve().parents[4] / "Wave" / "src" / "content"

SUBJECTS = {
    "science": "science.json",
    "mathematics": "mathematics.json",
    "english": "english.json",
}

DEMO_STUDENT = {
    "lrn": "101234567891",
    "name": "Maria Santos",
    "grade_level": "Grade 6",
    "section": "Grade 6 - Section Einstein",
    "pin": "123456",
}

DEMO_TEACHER = {
    "teacher_id": "T-2026-001",
    "name": "Mrs. Elena Santos",
    "department": "General Academics",
    "password": "password123",
}


class Command(BaseCommand):
    help = "Seed demo student, teacher, and lesson catalog for immediate use."

    def handle(self, *args, **options):
        # --- Users ---
        student, created = Student.objects.update_or_create(
            lrn=DEMO_STUDENT["lrn"],
            defaults={
                "name": DEMO_STUDENT["name"],
                "grade_level": DEMO_STUDENT["grade_level"],
                "section": DEMO_STUDENT["section"],
                "pin": DEMO_STUDENT["pin"],
            },
        )
        self.stdout.write(f"Student  {student.name} ({student.lrn}) — {'created' if created else 'already exists'}")

        teacher, created = Teacher.objects.update_or_create(
            teacher_id=DEMO_TEACHER["teacher_id"],
            defaults={
                "name": DEMO_TEACHER["name"],
                "department": DEMO_TEACHER["department"],
                "password": DEMO_TEACHER["password"],
            },
        )
        self.stdout.write(f"Teacher  {teacher.name} ({teacher.teacher_id}) — {'created' if created else 'already exists'}")

        # --- Lesson catalog ---
        for subject, filename in SUBJECTS.items():
            path = CONTENT_DIR / filename
            if not path.exists():
                self.stdout.write(self.style.WARNING(f"Catalog  {subject} — file not found at {path}"))
                continue
            with path.open(encoding="utf-8") as f:
                data = json.load(f)
            lessons = data.get("lessons", [])
            CatalogDocument.objects.update_or_create(
                subject=subject,
                defaults={"data": lessons},
            )
            self.stdout.write(f"Catalog  {subject} — {len(lessons)} lessons seeded")

        self.stdout.write(self.style.SUCCESS("\nDemo credentials:"))
        self.stdout.write(f"  Student LRN : {DEMO_STUDENT['lrn']}")
        self.stdout.write(f"  Student PIN : {DEMO_STUDENT['pin']}")
        self.stdout.write(f"  Teacher ID  : {DEMO_TEACHER['teacher_id']}")
        self.stdout.write(f"  Teacher Name: {DEMO_TEACHER['name']}")

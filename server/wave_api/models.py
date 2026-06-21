"""
Relational models for Wave.

Design note: the STATIC catalog (lessons/topics/quizzes, deeply nested) is stored
as a per-subject JSON document (`CatalogDocument`) seeded from the frontend's
data.ts — it is read-only and only ever relayed whole. The DYNAMIC student data
(attempts, summatives, remediation) gets proper relational models so it can be
queried/aggregated. `quizScores`, `completedTopicIds`, and `Rankings` are DERIVED
from these rows (see rankings.py / serializers), never stored redundantly.
"""
import secrets

from django.db import models


class ApiToken(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    role = models.CharField(max_length=10)  # student|teacher
    principal_id = models.CharField(max_length=40)  # lrn or teacher_id

    @classmethod
    def issue(cls, role: str, principal_id: str) -> "ApiToken":
        cls.objects.filter(role=role, principal_id=principal_id).delete()
        return cls.objects.create(key=secrets.token_hex(20), role=role, principal_id=principal_id)


class Student(models.Model):
    lrn = models.CharField(max_length=12, primary_key=True)
    name = models.CharField(max_length=120)
    grade_level = models.CharField(max_length=80)
    section = models.CharField(max_length=80)
    pin = models.CharField(max_length=6)  # demo: plaintext; hash for production

    def __str__(self):
        return f"{self.name} ({self.lrn})"


class Teacher(models.Model):
    teacher_id = models.CharField(max_length=40, primary_key=True)
    name = models.CharField(max_length=120)
    department = models.CharField(max_length=120, default="General Academics")
    password = models.CharField(max_length=40, default="password123")

    def __str__(self):
        return f"{self.name} ({self.teacher_id})"


class CatalogDocument(models.Model):
    subject = models.CharField(max_length=20, primary_key=True)  # science|mathematics|english
    data = models.JSONField(default=list)  # Lesson[] as produced by the frontend


class QuizAttempt(models.Model):
    student = models.ForeignKey(Student, related_name="attempts", on_delete=models.CASCADE)
    topic_id = models.CharField(max_length=40)
    lesson_id = models.CharField(max_length=40, blank=True, default="")
    score = models.IntegerField()
    perfect_score = models.IntegerField(default=10)
    answers = models.JSONField(default=list)
    completed_at = models.CharField(max_length=20)  # YYYY-MM-DD, matches app
    attempts = models.IntegerField(default=0)  # capped at 3, incremented in ingest._save_progress

    class Meta:
        unique_together = ("student", "topic_id")


class SummativeResult(models.Model):
    student = models.ForeignKey(Student, related_name="summatives", on_delete=models.CASCADE)
    lesson_id = models.CharField(max_length=40)
    score = models.IntegerField()
    total = models.IntegerField(default=20)
    percent = models.IntegerField(default=0)
    passed = models.BooleanField(default=False)
    feedback = models.TextField(blank=True, default="")
    failed_items = models.JSONField(default=list)  # FailedItem[]
    attempts = models.IntegerField(default=0)

    class Meta:
        unique_together = ("student", "lesson_id")


class RemediationMaterial(models.Model):
    material_id = models.CharField(max_length=40, primary_key=True)
    subject = models.CharField(max_length=20, default="science")
    original_topic_id = models.CharField(max_length=40)
    title = models.CharField(max_length=200)
    content = models.TextField()
    teacher_notes = models.TextField(blank=True, default="")
    # Remedial materials have a summative test only (no separate quiz).
    created_summative = models.JSONField(default=list)  # QuizQuestion[] — 20-item summative
    publish_date = models.CharField(max_length=20)
    target_section = models.CharField(max_length=80)  # whole-section recipient
    is_published = models.BooleanField(default=True)
    # Frontend models carry these; stored so the schema is a superset ready for
    # full remediation/AI integration (not all are transmitted by the UI yet).
    assigned_student_lrn = models.CharField(max_length=12, blank=True, default="")
    target_lesson_id = models.CharField(max_length=40, blank=True, default="")
    # AI generation metadata (the /remediation/generate JSON shape). The UI folds
    # most of these into `content`/`teacher_notes` before publishing, so these
    # discrete columns let the backend retain the full AI output without loss.
    # Populated by the AI generation/finalize path; empty for mock-published rows.
    lesson_number = models.IntegerField(default=0)
    learning_gap = models.TextField(blank=True, default="")
    grade_level_section = models.CharField(max_length=120, blank=True, default="")
    concepts = models.JSONField(default=list)  # [{header_title, explanation}]
    # Server-only sidecar: pedagogical metadata from the quiz-generation agent
    # (cognitive_level, targeted_distractor_key per item). Never sent over LoRa.
    analytics = models.JSONField(default=dict, blank=True)

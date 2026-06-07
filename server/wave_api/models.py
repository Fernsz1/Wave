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
    created_quiz = models.JSONField(default=list)  # QuizQuestion[]
    created_summative = models.JSONField(default=list)  # QuizQuestion[] — custom summative from AI wizard
    publish_date = models.CharField(max_length=20)
    target_section = models.CharField(max_length=80)  # whole-section recipient
    is_published = models.BooleanField(default=True)

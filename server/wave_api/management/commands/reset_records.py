"""
Reset all student records: delete every quiz attempt and summative result,
leaving the roster, teachers, catalog, and remediation packs intact.

Run:  python manage.py reset_records
"""
from django.core.management.base import BaseCommand

from wave_api.models import QuizAttempt, SummativeResult


class Command(BaseCommand):
    help = "Delete all student progress (quiz attempts + summative results)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--lrn", help="Only reset this student's records (default: all students)."
        )

    def handle(self, *args, **options):
        attempts = QuizAttempt.objects.all()
        summatives = SummativeResult.objects.all()
        lrn = options.get("lrn")
        if lrn:
            attempts = attempts.filter(student_id=lrn)
            summatives = summatives.filter(student_id=lrn)

        a = attempts.count()
        s = summatives.count()
        attempts.delete()
        summatives.delete()
        scope = f"student {lrn}" if lrn else "all students"
        self.stdout.write(self.style.SUCCESS(f"reset {scope}: removed {a} quiz attempts, {s} summative results"))

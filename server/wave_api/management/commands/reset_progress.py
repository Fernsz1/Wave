"""
Wipe all student progress and published remediation materials so every
student starts fresh from Lesson 1.  Catalog, students, and teachers are
kept exactly as-is.

Also clears MQTT retained messages for every section so phones that
reconnect don't receive stale remedial material from the broker cache.

Run:  python manage.py reset_progress
"""
import json

from django.core.management.base import BaseCommand

from wave_api.models import QuizAttempt, RemediationMaterial, Student, SummativeResult
from wave_api.mqtt import _get_client, slug


class Command(BaseCommand):
    help = "Clear all quiz attempts, summative results, and remediation materials."

    def handle(self, *args, **options):
        qa = QuizAttempt.objects.all().delete()
        sr = SummativeResult.objects.all().delete()
        rm = RemediationMaterial.objects.all().delete()

        self.stdout.write(f"quiz attempts deleted:        {qa[0]}")
        self.stdout.write(f"summative results deleted:    {sr[0]}")
        self.stdout.write(f"remediation materials deleted:{rm[0]}")

        # Clear MQTT retained messages so reconnecting devices don't get stale data.
        # Publishing an empty payload to a retained topic clears it from the broker.
        sections = list(Student.objects.values_list('section', flat=True).distinct())
        sections.append('all-sections')

        client = _get_client()
        if client:
            cleared = 0
            for section in sections:
                topic = f"wave/{slug(section)}/TeacherRemediationMaterial"
                client.publish(topic, json.dumps([]), qos=1, retain=True)
                cleared += 1
            self.stdout.write(f"mqtt retained topics cleared: {cleared}")
        else:
            self.stdout.write("mqtt broker unreachable — retained messages not cleared")

        self.stdout.write(self.style.SUCCESS("reset complete — all students start from Lesson 1"))

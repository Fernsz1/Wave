from django.urls import path

from . import views
from . import lesson_generation_view

urlpatterns = [
    path("auth/login", views.login),
    path("roster", views.roster),
    path("catalog", views.catalog),
    path("allprogress", views.all_progress),
    path("progress/<str:lrn>", views.progress),
    path("rankings", views.rankings),
    path("remediation", views.remediation),
    path("remediation/generate", views.generate_remediation),
    path("sync/push", views.sync_push),
    path('generate-lesson', lesson_generation_view.start_lesson_generation, name='generate_lesson'),
    path('submit-feedback', lesson_generation_view.submit_teacher_feedback, name='submit_feedback'),
    path('generate-lesson-only', lesson_generation_view.start_lesson_only, name='generate_lesson_only'),
    path('generate-lesson-and-quiz', lesson_generation_view.start_lesson_and_quiz, name='generate_lesson_and_quiz'),
]

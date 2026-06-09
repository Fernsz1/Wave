from django.urls import path

from . import views

urlpatterns = [
    path("auth/login", views.login),
    path("roster", views.roster),
    path("catalog", views.catalog),
    path("allprogress", views.all_progress),
    path("progress/<str:lrn>", views.progress),
    path("rankings", views.rankings),
    path("remediation", views.remediation),
    path("remediation/generate", views.generate_remediation),
    path("quiz/generate", views.generate_quiz),
    path("sync/push", views.sync_push),
]

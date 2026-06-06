from django.urls import include, path

urlpatterns = [
    path("api/", include("wave_api.urls")),
]

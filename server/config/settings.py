"""
Django settings for the Wave server (dev / LAN-demo profile).

SQLite + DRF + a lightweight custom token auth. Tuned for the offline-LAN demo:
ALLOWED_HOSTS and CORS are wide open so a phone on the same router can reach it.
Not a production configuration.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent

# Load server/.env (if present) so DATABASE_URL / MQTT / GEMINI vars are picked
# up without exporting them manually. Safe no-op if python-dotenv isn't installed.
try:
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass

# Shared protocol contract (same file the TS codec imports).
WIRE_MANIFEST_PATH = REPO_ROOT / "protocol" / "wire_manifest.json"

SECRET_KEY = "dev-only-not-secret-change-for-production"
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "wave_api",
]

MIDDLEWARE = [
    "wave_api.cors.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Database: DATABASE_URL set -> Postgres (or any dj-database-url URL); unset ->
# bundled SQLite (offline/dev default). Same models/migrations drive both.
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if DATABASE_URL:
    import dj_database_url

    DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
TIME_ZONE = "UTC"
LANGUAGE_CODE = "en-us"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["wave_api.auth.ApiTokenAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "UNAUTHENTICATED_USER": None,
}

# MQTT broker (the demo's Mosquitto). Override via env on the demo machine.
MQTT_HOST = os.getenv("WAVE_BROKER_HOST", "127.0.0.1")
MQTT_PORT = int(os.getenv("WAVE_BROKER_PORT", "1883"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# The LangGraph agents (langchain-google-genai) authenticate via GOOGLE_API_KEY,
# while the single-shot path uses GEMINI_API_KEY. Mirror one to the other so a
# single key in .env activates both generation paths.
if not os.getenv("GOOGLE_API_KEY") and GEMINI_API_KEY:
    os.environ["GOOGLE_API_KEY"] = GEMINI_API_KEY

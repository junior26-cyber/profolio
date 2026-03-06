import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

load_dotenv()

def _split_csv(value: str, default: list[str]) -> list[str]:
    if not value:
        return default
    items = [item.strip() for item in value.split(",")]
    return [item for item in items if item]


BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "").strip() or "dev-secret-change-me"
DEBUG = os.getenv("DEBUG", "1") == "1"
_render_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
_default_allowed_hosts = ["127.0.0.1", "localhost", "testserver"]
if _render_hostname:
    _default_allowed_hosts.extend([_render_hostname, ".onrender.com"])
ALLOWED_HOSTS = _split_csv(os.getenv("ALLOWED_HOSTS", ""), _default_allowed_hosts)

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "core.middleware.AccountActivationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.jinja2.Jinja2",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": False,
        "OPTIONS": {
            "environment": "config.jinja2.environment",
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

_database = dj_database_url.config(
    default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
    conn_max_age=600,
    ssl_require=not DEBUG,
)
# `sslmode` is valid for PostgreSQL, but breaks SQLite connections.
if _database.get("ENGINE") == "django.db.backends.sqlite3":
    options = _database.get("OPTIONS", {})
    options.pop("sslmode", None)
    if options:
        _database["OPTIONS"] = options
    else:
        _database.pop("OPTIONS", None)

DATABASES = {"default": _database}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Lome"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LOGIN_URL = "/login/"
LOGIN_REDIRECT_URL = "/cv/create/"

_default_csrf_origins = []
if _render_hostname:
    _default_csrf_origins.append(f"https://{_render_hostname}")
CSRF_TRUSTED_ORIGINS = _split_csv(os.getenv("CSRF_TRUSTED_ORIGINS", ""), _default_csrf_origins)
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "1" if not DEBUG else "0") == "1"
CSRF_COOKIE_SECURE = os.getenv("CSRF_COOKIE_SECURE", "1" if not DEBUG else "0") == "1"
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# Render termine TLS au niveau du reverse proxy.
SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "1" if not DEBUG else "0") == "1"
# Autorise les iframes uniquement depuis le même domaine
# (nécessaire pour les aperçus CV intégrés dans l'app).
X_FRAME_OPTIONS = "SAMEORIGIN"
SECURE_REFERRER_POLICY = "same-origin"

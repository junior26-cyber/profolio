import html
import json
import os
import re
import secrets
import string
import zipfile
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.decorators import login_required
from django.http import FileResponse, HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.template.loader import get_template
from django.utils import timezone
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from ai.client import GeminiConfigurationError
from ai.client import generate as gemini_generate
from ai.generator import generate_cover_letter, generate_cv_content
from ai.voice import extract_cv_from_voice, extract_letter_from_voice, transcribe_audio_bytes
from core.models import Letter, Resume, UserProfile

BASE_DIR = Path(__file__).resolve().parent.parent
User = get_user_model()

CV_CREATE_TEMPLATES = [
    {"id": "vertex", "name": "Vertex", "premium": False, "color": "#3B82F6"},
    {"id": "lumina", "name": "Lumina", "premium": False, "color": "#14B8A6"},
    {"id": "apex", "name": "Apex", "premium": False, "color": "#6366F1"},
    {"id": "elite", "name": "Elite", "premium": False, "color": "#0EA5E9"},
    {"id": "executive", "name": "Executive", "premium": True, "color": "#334155"},
    {"id": "prestige", "name": "Prestige", "premium": True, "color": "#7C3AED"},
    {"id": "horizon", "name": "Horizon", "premium": True, "color": "#0F766E"},
]

CV_PREVIEW_MODELS = [
    {"id": "classique", "name": "Classique", "premium": False},
    {"id": "moderne", "name": "Moderne", "premium": False},
    {"id": "informel", "name": "Informel", "premium": False},
    {"id": "horizon", "name": "Horizon", "premium": False},
    {"id": "vertical", "name": "Vertical", "premium": True},
    {"id": "pro", "name": "Pro", "premium": True},
    {"id": "simple", "name": "Simple", "premium": True},
    {"id": "metro", "name": "Metro", "premium": True},
]

HOME_CV_EXAMPLES = [
    {"id": "cv-01", "model_id": "classique", "name": "Classique"},
    {"id": "cv-02", "model_id": "moderne", "name": "Moderne"},
    {"id": "cv-03", "model_id": "informel", "name": "Informel"},
    {"id": "cv-04", "model_id": "horizon", "name": "Horizon"},
    {"id": "cv-05", "model_id": "vertical", "name": "Vertical"},
    {"id": "cv-06", "model_id": "pro", "name": "Pro"},
    {"id": "cv-07", "model_id": "simple", "name": "Simple"},
    {"id": "cv-08", "model_id": "metro", "name": "Metro"},
]

PRICING_PLANS = {
    "monthly": {
        "fr": {
            "price": "1 000 FCFA / mois",
            "features": ["CV illimites", "Tous les templates premium", "Generation IA complete", "Portfolio public", "Export PDF sans mention"],
        },
        "en": {
            "price": "1,000 XOF / month",
            "features": ["Unlimited resumes", "All premium templates", "Full AI generation", "Public portfolio", "Clean PDF export"],
        },
    },
    "yearly": {
        "fr": {
            "price": "5 000 FCFA / an",
            "features": ["CV illimites", "Tous les templates premium", "Generation IA complete", "Portfolio public", "Export PDF sans mention"],
        },
        "en": {
            "price": "5,000 XOF / year",
            "features": ["Unlimited resumes", "All premium templates", "Full AI generation", "Public portfolio", "Clean PDF export"],
        },
    },
}


def _safe_json_body(request: HttpRequest) -> dict:
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return {}


def _render_page(request: HttpRequest, template_name: str, context: dict | None = None, *, status: int = 200) -> HttpResponse:
    payload = dict(context or {})
    payload["csrf_token"] = get_token(request)
    return render(request, template_name, payload, status=status)


def _safe_ai(callable_fn):
    try:
        return callable_fn()
    except GeminiConfigurationError as exc:
        raise ValueError(str(exc)) from exc
    except Exception as exc:
        raise ValueError("AI generation failed.") from exc


def _is_user_approved(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser:
        return True
    profile = getattr(user, "profile", None)
    if profile is None:
        return True
    return bool(getattr(profile, "is_approved", True))


def _preview_model_by_id(template_id: str) -> dict:
    for model in CV_PREVIEW_MODELS:
        if model["id"] == template_id:
            return model
    return CV_PREVIEW_MODELS[0]


def _template_color_for_create(template_id: str) -> str:
    for item in CV_CREATE_TEMPLATES:
        if item["id"] == template_id:
            return item.get("color", "#3B82F6")
    return "#3B82F6"


def _resolve_cv_template_id(template_id: str) -> str:
    available = {item["id"] for item in CV_PREVIEW_MODELS}
    return template_id if template_id in available else "classique"


def _safe_list(value) -> list:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        nested = value.get("all")
        if isinstance(nested, list):
            return nested
    return []


def _safe_skill_level(value) -> int:
    try:
        number = int(value)
    except Exception:
        number = 3
    return max(1, min(5, number))


def _wrap_as_django_like(items):
    return {"all": items}


def _template_reference_photo(template_id: str) -> str:
    mapping = {
        "classique": "/static/image/20.jpg",
        "moderne": "/static/image/1131w-Y3HBVMtorcU.webp",
        "informel": "/static/image/19.jpeg",
        "horizon": "/static/image/cv-15-red-1200.webp",
        "vertical": "/static/image/cv-6-blue-1200.webp",
        "pro": "/static/image/cv-facile.webp",
        "simple": "/static/image/modele-de-cv-professionnel-gratuit-word.jpg",
        "metro": "/static/image/18.jpg",
    }
    return mapping.get(_resolve_cv_template_id(template_id), "/static/image/1131w-Y3HBVMtorcU.webp")


def _cv_template_context_from_preview(data: dict) -> dict:
    full_name = str(data.get("full_name", "")).strip() or "Aurélien Kokou"
    job_title = str(data.get("job_title", "")).strip() or "Développeur Full Stack"
    email = str(data.get("email", "")).strip() or "aurelien.kokou@email.com"
    phone = str(data.get("phone", "")).strip() or "+228 90 12 34 56"
    address = str(data.get("address", "")).strip() or "14 rue des Rosiers"
    city = str(data.get("city", "")).strip() or "Lomé, Togo"
    summary = str(data.get("summary", "")).strip() or "Développeur passionné avec 5 ans d'expérience en Django et React."

    skills_input = _safe_list(data.get("skills"))
    interests_input = _safe_list(data.get("interests"))
    skills = [{"name": str(item).strip(), "level": 4, "order": idx} for idx, item in enumerate(skills_input) if str(item).strip()]
    interests = [str(item).strip() for item in interests_input if str(item).strip()]

    if not skills:
        skills = [
            {"name": "Python", "level": 5, "order": 0},
            {"name": "Django", "level": 4, "order": 1},
            {"name": "React", "level": 4, "order": 2},
        ]
    if not interests:
        interests = ["Lecture", "Football", "Open Source"]

    experience_text = str(data.get("experience", "")).strip() or "3 à 5 ans — Confirmé"
    experiences = [
        {
            "title": "Développeur Full Stack",
            "company": "TechLomé SARL",
            "location": city,
            "start_date": "Jan 2022",
            "end_date": "",
            "is_current": True,
            "description": f"Expérience globale : {experience_text}. Développement d'applications web et APIs.",
            "order": 0,
        },
        {
            "title": "Développeur Junior",
            "company": "Digital Africa",
            "location": "Cotonou",
            "start_date": "Mars 2020",
            "end_date": "Déc 2021",
            "is_current": False,
            "description": "Création de sites web et intégration de maquettes HTML/CSS.",
            "order": 1,
        },
    ]

    education = [
        {"degree": "Master Informatique", "school": "Université de Lomé", "year": "2019", "order": 0},
        {"degree": "Licence Génie Logiciel", "school": "IFRI Cotonou", "year": "2017", "order": 1},
    ]
    languages = [{"name": "Français", "level": "Natif"}, {"name": "Anglais", "level": "Courant"}]

    template_hint = str(data.get("template", "")).strip()
    photo_data_url = str(data.get("photo_data_url", "")).strip()
    if not (photo_data_url.startswith("data:image/") or photo_data_url.startswith("/static/")):
        photo_data_url = _template_reference_photo(template_hint)

    return {
        "personal_info": {
            "name": full_name,
            "job_title": job_title,
            "email": email,
            "phone": phone,
            "address": address,
            "city": city,
            "linkedin": str(data.get("linkedin", "")).strip(),
            "github": str(data.get("github", "")).strip(),
            "photo_data_url": photo_data_url,
        },
        "summary": summary,
        "experiences": _wrap_as_django_like(experiences),
        "education": _wrap_as_django_like(education),
        "skills": _wrap_as_django_like([{**item, "level": _safe_skill_level(item.get("level", 3))} for item in skills]),
        "languages": _wrap_as_django_like(languages),
        "interests": _wrap_as_django_like(interests),
        "qualities": _wrap_as_django_like(["Dynamique", "Rigoureux", "Créatif"]),
        "photo": None,
    }


def _cv_template_reference_context(template_id: str) -> dict:
    base = _cv_template_context_from_preview({})
    personal = base["personal_info"]

    by_template = {
        "classique": {"name": "Prénom NOM", "job_title": "Intitulé du poste", "city": "Ville-Pays"},
        "moderne": {"name": "Olivia Wilson", "job_title": "Chargée de Communication", "city": "Any City"},
        "informel": {"name": "Abdou Ndiaye", "job_title": "Chauffeur-Livreur / Permis B", "city": "Dakar"},
        "horizon": {"name": "Nom Prénom", "job_title": "Métier", "city": "Paris"},
        "vertical": {"name": "Nom Prénom", "job_title": "Métier", "city": "Mon adresse postale"},
        "pro": {"name": "Elodie Danois", "job_title": "Titre du poste recherché", "city": "75012 Paris"},
        "simple": {"name": "Jenny Cruz", "job_title": "Marketing Specialist", "city": "New York"},
        "metro": {"name": "Nom Prénom", "job_title": "Intitulé du poste", "city": "75000 Paris, France"},
    }
    selected = by_template.get(_resolve_cv_template_id(template_id), by_template["classique"])
    personal["name"] = selected["name"]
    personal["job_title"] = selected["job_title"]
    personal["city"] = selected["city"]
    personal["address"] = selected["city"]
    personal["email"] = "nom@email.com"
    personal["phone"] = "06 00 00 00 01"
    personal["photo_data_url"] = _template_reference_photo(template_id)
    base["summary"] = "Je travaille avec rigueur et méthode. J'assimile les objectifs métiers et je propose des solutions concrètes adaptées au poste visé."
    return base


def _resume_to_dict(resume: Resume) -> dict:
    return {
        "id": resume.id,
        "owner_email": resume.user.email,
        "template": resume.template or {},
        "input": resume.input_data or {},
        "optional": resume.optional_data or {},
        "generated": resume.generated_data or {},
        "updated_at": (resume.updated_at or timezone.now()).isoformat(),
        "portfolio": resume.portfolio_data,
    }


def _cv_template_context_from_saved(cv_data: dict) -> dict:
    generated = cv_data.get("generated", {})
    optional = cv_data.get("optional", {})
    personal = generated.get("personal_info", {}) if isinstance(generated, dict) else {}

    skills = []
    for idx, skill in enumerate(_safe_list(generated.get("skills") if isinstance(generated, dict) else [])):
        if isinstance(skill, dict):
            name = str(skill.get("name", "")).strip()
            if name:
                skills.append({"name": name, "level": _safe_skill_level(skill.get("level", 3)), "order": skill.get("order", idx)})

    experiences = []
    for idx, exp in enumerate(_safe_list(generated.get("experiences") if isinstance(generated, dict) else [])):
        if isinstance(exp, dict):
            experiences.append(
                {
                    "title": str(exp.get("title", "")).strip() or "Expérience",
                    "company": str(exp.get("company", "")).strip(),
                    "location": str(exp.get("location", "")).strip(),
                    "start_date": str(exp.get("start_date", "")).strip(),
                    "end_date": str(exp.get("end_date", "")).strip(),
                    "is_current": bool(exp.get("is_current")),
                    "description": str(exp.get("description", "")).strip(),
                    "order": exp.get("order", idx),
                }
            )

    education = []
    for idx, edu in enumerate(_safe_list(generated.get("education") if isinstance(generated, dict) else [])):
        if isinstance(edu, dict):
            education.append(
                {
                    "degree": str(edu.get("degree", "")).strip() or "Formation",
                    "school": str(edu.get("school", "")).strip(),
                    "year": str(edu.get("year", "")).strip(),
                    "city": str(edu.get("city", "")).strip(),
                    "description": str(edu.get("description", "")).strip(),
                    "order": edu.get("order", idx),
                }
            )

    languages = []
    for lang in _safe_list(generated.get("languages") if isinstance(generated, dict) else []):
        if isinstance(lang, dict):
            label = str(lang.get("name", "")).strip()
            if label:
                languages.append({"name": label, "level": str(lang.get("level", "")).strip()})

    interests = _safe_list(optional.get("interests") or personal.get("interests"))
    interests = [str(item).strip() for item in interests if str(item).strip()]

    if not experiences:
        experiences = [{"title": "Expérience", "company": "", "location": "", "start_date": "", "end_date": "", "is_current": False, "description": "", "order": 0}]
    if not education:
        education = [{"degree": "Formation", "school": "", "year": "", "city": "", "description": "", "order": 0}]
    if not skills:
        skills = [{"name": "Compétence", "level": 3, "order": 0}]
    if not languages:
        languages = [{"name": "Français", "level": "Professionnel"}]

    return {
        "personal_info": {
            "name": str(personal.get("name", "")).strip() or "Candidat",
            "job_title": str(personal.get("job_title", "")).strip() or "Poste visé",
            "email": str(personal.get("email", "")).strip() or str(optional.get("email", "")).strip(),
            "phone": str(personal.get("phone", "")).strip() or str(optional.get("phone", "")).strip(),
            "address": str(personal.get("address", "")).strip(),
            "city": str(personal.get("city", "")).strip(),
            "linkedin": str(personal.get("linkedin", "")).strip() or str(optional.get("linkedin", "")).strip(),
            "github": str(personal.get("github", "")).strip() or str(optional.get("github", "")).strip(),
            "photo_data_url": str(optional.get("photo_data_url", "")).strip() or str(personal.get("photo_data_url", "")).strip(),
        },
        "summary": str(generated.get("summary", "")).strip() or "Résumé professionnel non renseigné.",
        "experiences": _wrap_as_django_like(experiences),
        "education": _wrap_as_django_like(education),
        "skills": _wrap_as_django_like(skills),
        "languages": _wrap_as_django_like(languages),
        "interests": _wrap_as_django_like(interests),
        "qualities": _wrap_as_django_like(["Dynamique", "Rigoureux", "Créatif"]),
        "photo": None,
    }


def _cv_context_to_editor_data(cv_context: dict) -> dict:
    personal = cv_context.get("personal_info", {})
    experiences = _safe_list(cv_context.get("experiences"))
    education = _safe_list(cv_context.get("education"))
    skills = _safe_list(cv_context.get("skills"))
    languages = _safe_list(cv_context.get("languages"))
    interests = _safe_list(cv_context.get("interests"))
    qualities = _safe_list(cv_context.get("qualities"))

    standard = {"name", "job_title", "email", "phone", "address", "city", "linkedin", "github", "photo_data_url"}
    custom_fields = []
    for key, value in personal.items():
        if key in standard:
            continue
        text = str(value).strip()
        if text:
            custom_fields.append({"key": key, "label": key.replace("_", " ").title(), "value": text})

    return {
        "personal_info": {
            "name": str(personal.get("name", "")).strip(),
            "job_title": str(personal.get("job_title", "")).strip(),
            "email": str(personal.get("email", "")).strip(),
            "phone": str(personal.get("phone", "")).strip(),
            "address": str(personal.get("address", "")).strip(),
            "city": str(personal.get("city", "")).strip(),
            "linkedin": str(personal.get("linkedin", "")).strip(),
            "github": str(personal.get("github", "")).strip(),
            "photo_data_url": str(personal.get("photo_data_url", "")).strip(),
            "custom_fields": custom_fields,
        },
        "summary": str(cv_context.get("summary", "")).strip(),
        "experiences": experiences,
        "education": education,
        "skills": [{"name": str(item.get("name", "")).strip(), "level": _safe_skill_level(item.get("level", 3))} for item in skills if isinstance(item, dict)],
        "languages": [{"name": str(item.get("name", "")).strip(), "level": str(item.get("level", "")).strip()} for item in languages if isinstance(item, dict)],
        "interests": [str(item).strip() for item in interests if str(item).strip()],
        "qualities": [str(item).strip() for item in qualities if str(item).strip()],
    }


def _cv_editor_payload_to_context(data: dict) -> dict:
    personal = data.get("personal_info", {}) if isinstance(data.get("personal_info"), dict) else {}

    photo_data_url = str(personal.get("photo_data_url", "")).strip()
    if photo_data_url and not photo_data_url.startswith(("data:image/", "/static/")):
        photo_data_url = ""

    personal_output = {
        "name": str(personal.get("name", "")).strip() or "Candidat",
        "job_title": str(personal.get("job_title", "")).strip() or "Poste visé",
        "email": str(personal.get("email", "")).strip(),
        "phone": str(personal.get("phone", "")).strip(),
        "address": str(personal.get("address", "")).strip(),
        "city": str(personal.get("city", "")).strip(),
        "linkedin": str(personal.get("linkedin", "")).strip(),
        "github": str(personal.get("github", "")).strip(),
        "photo_data_url": photo_data_url,
    }

    custom_fields = personal.get("custom_fields", []) if isinstance(personal.get("custom_fields"), list) else []
    for item in custom_fields:
        if not isinstance(item, dict):
            continue
        key = re.sub(r"[^a-zA-Z0-9_]+", "_", str(item.get("key") or item.get("label") or "").strip().lower()).strip("_") or "field"
        value = str(item.get("value", "")).strip()
        if value:
            personal_output[key] = value

    experiences = []
    for idx, exp in enumerate(data.get("experiences", []) if isinstance(data.get("experiences"), list) else []):
        if not isinstance(exp, dict):
            continue
        experiences.append(
            {
                "title": str(exp.get("title", "")).strip() or "Expérience",
                "company": str(exp.get("company", "")).strip(),
                "location": str(exp.get("location", "")).strip(),
                "start_date": str(exp.get("start_date", "")).strip(),
                "end_date": str(exp.get("end_date", "")).strip(),
                "is_current": bool(exp.get("is_current")),
                "description": str(exp.get("description", "")).strip(),
                "order": idx,
            }
        )
    if not experiences:
        experiences = [{"title": "Expérience", "company": "", "location": "", "start_date": "", "end_date": "", "is_current": False, "description": "", "order": 0}]

    education = []
    for idx, edu in enumerate(data.get("education", []) if isinstance(data.get("education"), list) else []):
        if not isinstance(edu, dict):
            continue
        education.append(
            {
                "degree": str(edu.get("degree", "")).strip() or "Formation",
                "school": str(edu.get("school", "")).strip(),
                "year": str(edu.get("year", "")).strip(),
                "city": str(edu.get("city", "")).strip(),
                "description": str(edu.get("description", "")).strip(),
                "order": idx,
            }
        )
    if not education:
        education = [{"degree": "Formation", "school": "", "year": "", "city": "", "description": "", "order": 0}]

    skills = []
    for idx, skill in enumerate(data.get("skills", []) if isinstance(data.get("skills"), list) else []):
        if not isinstance(skill, dict):
            continue
        name = str(skill.get("name", "")).strip()
        if not name:
            continue
        skills.append({"name": name, "level": _safe_skill_level(skill.get("level", 3)), "order": idx})
    if not skills:
        skills = [{"name": "Compétence", "level": 3, "order": 0}]

    languages = []
    for lang in data.get("languages", []) if isinstance(data.get("languages"), list) else []:
        if not isinstance(lang, dict):
            continue
        label = str(lang.get("name", "")).strip()
        if label:
            languages.append({"name": label, "level": str(lang.get("level", "")).strip()})
    if not languages:
        languages = [{"name": "Français", "level": "Professionnel"}]

    interests = [str(item).strip() for item in (data.get("interests", []) if isinstance(data.get("interests"), list) else []) if str(item).strip()]
    qualities = [str(item).strip() for item in (data.get("qualities", []) if isinstance(data.get("qualities"), list) else []) if str(item).strip()]

    return {
        "personal_info": personal_output,
        "summary": str(data.get("summary", "")).strip() or "Résumé professionnel non renseigné.",
        "experiences": _wrap_as_django_like(experiences),
        "education": _wrap_as_django_like(education),
        "skills": _wrap_as_django_like(skills),
        "languages": _wrap_as_django_like(languages),
        "interests": _wrap_as_django_like(interests),
        "qualities": _wrap_as_django_like(qualities),
        "photo": None,
    }


def _render_cv_template_html(template_id: str, cv_context: dict) -> str:
    safe_template_id = _resolve_cv_template_id(template_id)
    template_obj = get_template(f"cv/pdf/{safe_template_id}.html")
    return template_obj.render({"cv": cv_context})


def _render_cv_pdf_html(cv_data: dict) -> str:
    context = _cv_template_context_from_saved(cv_data)
    template_id = str(cv_data.get("template", {}).get("id", "classique"))
    return _render_cv_template_html(template_id, context)


def _render_letter_html(*, template_id: str, content: str, company: str, position: str, recruiter: str, now_value: datetime | None = None) -> str:
    now_value = now_value or datetime.now()
    date_label = now_value.strftime("%d/%m/%Y")
    safe_company = html.escape(company.strip() or "Entreprise")
    safe_position = html.escape(position.strip() or "Poste visé")
    safe_recruiter = html.escape(recruiter.strip() or "Madame, Monsieur")
    safe_content = html.escape(content.strip())

    if not safe_content:
        body_paragraphs = [
            "Je vous adresse ma candidature avec un fort intérêt pour ce poste.",
            "Mon parcours et mes compétences me permettent de contribuer rapidement à vos objectifs.",
            "Je serais heureux d'échanger avec vous lors d'un entretien.",
        ]
    else:
        body_paragraphs = [line.strip() for line in safe_content.splitlines() if line.strip()]
    body_html = "".join(f"<p>{paragraph}</p>" for paragraph in body_paragraphs)

    template_styles = {
        "executive": {"header_bg": "#0A0F1E", "accent": "#F59E0B", "subject_style": "text-transform:uppercase;font-weight:800;letter-spacing:.06em;"},
        "prestige": {"header_bg": "#111827", "accent": "#D4AF37", "subject_style": "text-transform:uppercase;font-weight:800;border-bottom:2px solid #3B82F6;padding-bottom:6px;"},
        "horizon": {"header_bg": "#0F766E", "accent": "#14B8A6", "subject_style": "font-weight:700;color:#0F766E;"},
        "elite": {"header_bg": "#1E293B", "accent": "#3B82F6", "subject_style": "font-weight:700;"},
    }
    style = template_styles.get(template_id, template_styles["elite"])
    name_color = "#FFFFFF"
    text_color = "#1F2937"

    return f"""
    <html>
      <body style=\"margin:0;padding:0;background:#fff;font-family:'DM Sans',Arial,sans-serif;color:{text_color}\">
        <div style=\"width:595px;min-height:842px;margin:0 auto;padding:0;box-sizing:border-box;\">
          <header style=\"padding:28px 34px 20px;background:{style['header_bg']};color:{name_color};\">
            <div style=\"font-size:28px;font-weight:700;line-height:1.1;\">CANDIDATURE</div>
            <div style=\"margin-top:10px;font-size:12px;opacity:.9;\">{date_label} • {safe_company}</div>
          </header>
          <div style=\"height:4px;background:{style['accent']};\"></div>
          <main style=\"padding:28px 34px 20px;\">
            <div style=\"font-size:13px;color:#4B5563;line-height:1.7;\">
              <div>{safe_company}</div>
              <div>{safe_recruiter}</div>
              <div style=\"margin-top:8px;\">Objet : <span style=\"{style['subject_style']}\">Candidature au poste de {safe_position}</span></div>
            </div>
            <section style=\"margin-top:20px;font-size:15px;line-height:1.9;color:#1F2937;\">{body_html}</section>
            <section style=\"margin-top:34px;font-size:15px;color:#1F2937;\">
              <p style=\"margin:0 0 20px;\">Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>
              <p style=\"margin:0;font-weight:600;\">Signature</p>
            </section>
          </main>
        </div>
      </body>
    </html>
    """


def _html_to_pdf_response(html_text: str, filename: str) -> HttpResponse:
    def _patch_weasyprint_transform_bug() -> None:
        try:
            from weasyprint.pdf.stream import Matrix, Stream
        except Exception:
            return

        if getattr(Stream, "_profolio_transform_patch", False):
            return

        def _patched_transform(self, a=1, b=0, c=0, d=1, e=0, f=0):
            parent_transform = getattr(super(Stream, self), "transform", None)
            if callable(parent_transform):
                parent_transform(a, b, c, d, e, f)
            else:
                # Compatibilité avec implémentations pydyf sans transform.
                self.set_matrix(a, b, c, d, e, f)
            self._ctm_stack[-1] = Matrix(a, b, c, d, e, f) @ self.ctm

        Stream.transform = _patched_transform

        # Compatibilité pydyf: certains environnements n'ont plus text_matrix.
        if not hasattr(Stream, "text_matrix"):
            def _patched_text_matrix(self, a, b, c, d, e, f):
                self.set_text_matrix(a, b, c, d, e, f)
            Stream.text_matrix = _patched_text_matrix

        Stream._profolio_transform_patch = True

    _patch_weasyprint_transform_bug()

    try:
        from weasyprint import HTML
    except Exception:
        return JsonResponse({"detail": "Export PDF indisponible sur le serveur."}, status=500)

    try:
        pdf_bytes = HTML(string=html_text, base_url=str(BASE_DIR)).write_pdf()
    except Exception as exc:
        # Fallback: certains contenus (souvent images intégrées invalides)
        # peuvent faire échouer le rendu PDF. On retente sans balises <img>.
        html_without_images = re.sub(r"<img\b[^>]*>", "", html_text, flags=re.IGNORECASE)
        if html_without_images != html_text:
            try:
                pdf_bytes = HTML(string=html_without_images, base_url=str(BASE_DIR)).write_pdf()
            except Exception as fallback_exc:
                return JsonResponse(
                    {
                        "detail": (
                            f"Échec de génération du PDF. ({exc.__class__.__name__}: {exc}) "
                            f"[fallback: {fallback_exc.__class__.__name__}: {fallback_exc}]"
                        )
                    },
                    status=500,
                )
        else:
            return JsonResponse(
                {"detail": f"Échec de génération du PDF. ({exc.__class__.__name__}: {exc})"},
                status=500,
            )

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def _extract_json_object(text: str) -> dict:
    cleaned = text.strip().replace("```json", "").replace("```", "").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in model response.")
    return json.loads(cleaned[start : end + 1])


def _read_upload_text(filename: str, content: bytes) -> str:
    lower = filename.lower()
    if lower.endswith((".txt", ".md", ".json", ".csv")):
        return content.decode("utf-8", errors="ignore")

    if lower.endswith(".docx"):
        try:
            with zipfile.ZipFile(BytesIO(content)) as zf:
                xml = zf.read("word/document.xml").decode("utf-8", errors="ignore")
                xml = re.sub(r"<[^>]+>", " ", xml)
                return re.sub(r"\s+", " ", xml).strip()
        except Exception as exc:
            raise ValueError("DOCX non lisible.") from exc

    if lower.endswith(".pdf"):
        try:
            from pypdf import PdfReader

            reader = PdfReader(BytesIO(content), strict=False)
            text = "\n".join((page.extract_text() or "") for page in reader.pages).strip()
            if text:
                return text
            raise ValueError("PDF sans couche texte exploitable.")
        except Exception as exc:
            raise ValueError("PDF non lisible automatiquement. Essayez un PDF texte (non scanné) ou exportez en DOCX/TXT.") from exc

    raise ValueError("Format non supporté. Utilisez TXT, MD, JSON, DOCX ou PDF.")


def _extract_cv_basics_fallback(extracted_text: str, mode: str = "cv") -> dict:
    text = extracted_text or ""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    full_text = re.sub(r"\s+", " ", text).strip()

    def _first_match(pattern: str, source: str, flags: int = re.IGNORECASE) -> str:
        match = re.search(pattern, source, flags)
        return match.group(1).strip() if match else ""

    email = _first_match(r"([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})", text, re.IGNORECASE)
    phone = _first_match(r"(\+?\d[\d\s().-]{7,}\d)", text, re.IGNORECASE)
    linkedin = _first_match(r"(https?://(?:www\.)?linkedin\.com/[^\s,;]+)", text, re.IGNORECASE)
    github = _first_match(r"(https?://(?:www\.)?github\.com/[^\s,;]+)", text, re.IGNORECASE)

    full_name = ""
    for line in lines[:10]:
        clean = re.sub(r"[^A-Za-zÀ-ÖØ-öø-ÿ' -]", "", line).strip()
        words = [w for w in clean.split() if w]
        if 2 <= len(words) <= 4 and "@" not in line and "http" not in line.lower():
            full_name = " ".join(words)
            break

    job_title = ""
    section_probe = "\n".join(lines[:35])
    for pattern in [
        r"(?:poste|position|titre|job\s*title)\s*[:\-]\s*([^\n]{2,80})",
        r"(?:développeur|developpeur|developer|engineer|designer|manager|analyste|consultant)[^\n]{0,60}",
    ]:
        job_title = _first_match(pattern, section_probe)
        if job_title:
            break
    if not job_title and full_name and lines:
        idx = lines.index(full_name) if full_name in lines else -1
        if idx != -1 and idx + 1 < len(lines):
            candidate = lines[idx + 1]
            if len(candidate) <= 80 and "@" not in candidate and "http" not in candidate.lower():
                job_title = candidate

    skills_pool = [
        "python", "django", "flask", "fastapi", "java", "javascript", "typescript", "react", "vue",
        "angular", "node", "sql", "postgresql", "mysql", "mongodb", "docker", "kubernetes", "aws",
        "azure", "gcp", "git", "linux", "excel", "figma", "photoshop", "communication", "leadership",
        "gestion de projet", "project management", "scrum",
    ]
    lower_full_text = full_text.lower()
    skills = []
    for skill in skills_pool:
        if skill in lower_full_text:
            label = skill.upper() if skill in {"aws", "gcp", "sql"} else skill.title()
            skills.append(label)
    skills = list(dict.fromkeys(skills))[:20]

    interests = []
    interests_match = re.search(
        r"(?:centres?\s+d['’]int[eé]r[eê]t|hobbies|interests?)\s*[:\-]\s*([^\n]+)",
        text,
        re.IGNORECASE,
    )
    if interests_match:
        raw = interests_match.group(1)
        interests = [item.strip(" -•,.;") for item in re.split(r"[,;|/•]", raw) if item.strip()]
    interests = interests[:20]

    years = _first_match(r"(\d{1,2}\+?\s*(?:ans|an|years?))", text, re.IGNORECASE)
    experience = years or _first_match(
        r"(?:exp[eé]rience|experience)\s*[:\-]\s*([^\n]{5,160})",
        text,
        re.IGNORECASE,
    )
    if not experience and full_text:
        experience = full_text[:160]

    role_hint = job_title or ("Professional Profile" if mode == "linkedin_en" else "Profil professionnel")
    skills_hint = ", ".join(skills[:5]) if skills else ("core competencies" if mode == "linkedin_en" else "compétences clés")
    if mode == "linkedin_en":
        cv_prompt = (
            f"Professional resume for {role_hint}. Emphasize measurable achievements, clear structure, "
            f"and these strengths: {skills_hint}."
        )
    else:
        cv_prompt = (
            f"CV professionnel pour {role_hint}. Mettre en avant des résultats concrets, une structure claire, "
            f"et les compétences suivantes : {skills_hint}."
        )

    return {
        "full_name": full_name,
        "job_title": job_title[:120],
        "cv_prompt": cv_prompt[:280],
        "experience": str(experience).strip()[:240],
        "skills": skills,
        "interests": interests,
        "email": email,
        "phone": phone,
        "linkedin": linkedin,
        "github": github,
    }


def _is_valid_linkedin_profile_url(url: str) -> bool:
    try:
        parsed = urlparse(url.strip())
    except Exception:
        return False
    host = (parsed.netloc or "").lower()
    path = (parsed.path or "").strip("/")
    return parsed.scheme in {"http", "https"} and "linkedin.com" in host and path.startswith("in/")


def _fetch_linkedin_profile_proxycurl(linkedin_url: str) -> dict:
    api_key = os.getenv("PROXYCURL_API_KEY", "").strip()
    if not api_key:
        raise ValueError("PROXYCURL_API_KEY manquant dans .env.")

    configured_endpoint = os.getenv("PROXYCURL_PERSON_ENDPOINT", "").strip()
    endpoints = [configured_endpoint, "https://api.proxycurl.com/api/v2/linkedin"]
    endpoints = [ep for ep in endpoints if ep]
    # remove duplicates while preserving order
    endpoints = list(dict.fromkeys(endpoints))
    query = urlencode(
        {
            "url": linkedin_url,
            "fallback_to_cache": "on-error",
            "use_cache": "if-present",
            "skills": "include",
            "extra": "include",
            "github_profile_id": "include",
        }
    )

    errors: list[str] = []
    for endpoint in endpoints:
        url = f"{endpoint.rstrip('/')}?{query}"
        request = Request(url=url, method="GET")
        request.add_header("Authorization", f"Bearer {api_key}")
        try:
            with urlopen(request, timeout=20) as response:
                payload = response.read().decode("utf-8", errors="ignore")
                return json.loads(payload or "{}")
        except HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="ignore") if hasattr(exc, "read") else ""
            try:
                body = json.loads(raw or "{}")
                detail = body.get("message") or body.get("detail") or raw
            except Exception:
                detail = raw or str(exc)
            errors.append(f"{endpoint} -> HTTP {exc.code}: {detail}")
            continue
        except URLError as exc:
            errors.append(f"{endpoint} -> réseau: {exc}")
            continue
        except json.JSONDecodeError as exc:
            errors.append(f"{endpoint} -> JSON invalide: {exc}")
            continue

    details = " | ".join(errors) if errors else "aucun endpoint valide."
    raise ValueError(f"Erreur provider LinkedIn: {details}")


def _normalize_linkedin_profile(profile: dict, linkedin_url: str, lang: str) -> dict:
    first_name = str(profile.get("first_name", "")).strip()
    last_name = str(profile.get("last_name", "")).strip()
    full_name = " ".join(part for part in [first_name, last_name] if part).strip()
    if not full_name:
        full_name = str(profile.get("full_name", "")).strip()

    job_title = str(profile.get("occupation", "")).strip() or str(profile.get("headline", "")).strip()

    skills_raw = profile.get("skills") if isinstance(profile.get("skills"), list) else []
    skills: list[str] = []
    for item in skills_raw:
        if isinstance(item, str):
            name = item.strip()
        elif isinstance(item, dict):
            name = str(item.get("name", "")).strip()
        else:
            name = ""
        if name:
            skills.append(name)
    skills = list(dict.fromkeys(skills))[:20]

    experiences_raw = profile.get("experiences") if isinstance(profile.get("experiences"), list) else []
    exp_lines = []
    for exp in experiences_raw[:3]:
        if not isinstance(exp, dict):
            continue
        title = str(exp.get("title", "")).strip()
        company = str(exp.get("company", "")).strip() or str(exp.get("company_name", "")).strip()
        if title and company:
            exp_lines.append(f"{title} chez {company}")
        elif title:
            exp_lines.append(title)
    experience = " ; ".join(exp_lines)

    email = str(profile.get("personal_email", "")).strip()
    phone = str(profile.get("personal_contact_number", "")).strip()
    github = str(profile.get("github_profile_id", "")).strip()
    if github and not github.startswith("http"):
        github = f"https://github.com/{github.lstrip('@')}"

    city = str(profile.get("city", "")).strip()
    country = str(profile.get("country_full_name", "")).strip()
    location = ", ".join([x for x in [city, country] if x]).strip(", ")

    skills_hint = ", ".join(skills[:5]) if skills else ("core skills" if lang == "en" else "compétences clés")
    role_hint = job_title or ("Professional Profile" if lang == "en" else "Profil professionnel")
    if lang == "en":
        cv_prompt = (
            f"Professional resume for {role_hint}. Highlight measurable achievements, clear structure, "
            f"and these strengths: {skills_hint}."
        )
    else:
        cv_prompt = (
            f"CV professionnel pour {role_hint}. Mettre en avant des résultats concrets, une structure claire, "
            f"et les compétences suivantes : {skills_hint}."
        )
    if location:
        cv_prompt = f"{cv_prompt} Localisation: {location}."

    return {
        "full_name": full_name,
        "job_title": job_title[:120],
        "cv_prompt": cv_prompt[:320],
        "experience": experience[:240],
        "skills": skills,
        "interests": [],
        "email": email,
        "phone": phone,
        "linkedin": linkedin_url,
        "github": github,
    }


@ensure_csrf_cookie
@require_GET
def home(request: HttpRequest):
    return _render_page(request, "index.html", {"pricing_plans": PRICING_PLANS, "home_cv_examples": HOME_CV_EXAMPLES})


@login_required(login_url="/login/")
def dashboard(request: HttpRequest):
    resumes = Resume.objects.filter(user=request.user).order_by("-id")
    letters = Letter.objects.filter(user=request.user).order_by("-id")

    cv_items = [_resume_to_dict(r) for r in resumes]
    letter_items = [
        {
            "id": item.id,
            "title": item.title,
            "company": item.company,
            "updated_at": item.updated_at.isoformat(),
        }
        for item in letters
    ]
    portfolio_items = [{"cv_id": item["id"], "title": item.get("input", {}).get("job_title", "Portfolio"), "updated_at": item.get("updated_at", "")} for item in cv_items if item.get("portfolio")]

    return _render_page(request, "dashboard.html", {"user": request.user, "cv_items": cv_items, "letter_items": letter_items, "portfolio_items": portfolio_items})


@login_required(login_url="/login/")
@require_GET
def inactive_account_page(request: HttpRequest):
    if _is_user_approved(request.user):
        return redirect("/cv/create/")
    return _render_page(request, "inactive_account.html", {"user": request.user})


@login_required(login_url="/login/")
@require_GET
def admin_panel(request: HttpRequest):
    if not (request.user.is_staff or request.user.is_superuser):
        return redirect("/dashboard/")

    now = timezone.now()
    period_days = 7
    days = [(now - timedelta(days=delta)).date() for delta in range(period_days - 1, -1, -1)]
    labels = [day.strftime("%d/%m") for day in days]

    users_series = [User.objects.filter(date_joined__date=day).count() for day in days]
    resumes_series = [Resume.objects.filter(created_at__date=day).count() for day in days]
    letters_series = [Letter.objects.filter(created_at__date=day).count() for day in days]

    total_users = User.objects.count()
    total_resumes = Resume.objects.count()
    total_letters = Letter.objects.count()
    created_last_30d = now - timedelta(days=30)
    users_30d = User.objects.filter(date_joined__gte=created_last_30d).count()
    resumes_30d = Resume.objects.filter(created_at__gte=created_last_30d).count()
    letters_30d = Letter.objects.filter(created_at__gte=created_last_30d).count()
    cv_per_user = round(total_resumes / total_users, 2) if total_users else 0

    template_counts: dict[str, int] = {}
    for template in Resume.objects.values_list("template", flat=True):
        template_id = str((template or {}).get("id", "classique")).strip() or "classique"
        template_counts[template_id] = template_counts.get(template_id, 0) + 1

    top_templates = sorted(template_counts.items(), key=lambda item: item[1], reverse=True)[:5]
    top_templates = [{"name": name.capitalize(), "count": count} for name, count in top_templates]

    context = {
        "period_label": f"Derniers {period_days} jours",
        "total_users": total_users,
        "total_resumes": total_resumes,
        "total_letters": total_letters,
        "users_30d": users_30d,
        "resumes_30d": resumes_30d,
        "letters_30d": letters_30d,
        "cv_per_user": cv_per_user,
        "daily_labels": labels,
        "daily_users": users_series,
        "daily_resumes": resumes_series,
        "daily_letters": letters_series,
        "top_templates": top_templates,
        "recent_resumes": Resume.objects.select_related("user").order_by("-created_at")[:6],
        "recent_letters": Letter.objects.select_related("user").order_by("-created_at")[:6],
        "pending_users": User.objects.filter(profile__is_approved=False, is_staff=False, is_superuser=False).order_by("-date_joined")[:20],
    }
    return _render_page(request, "admin_panel.html", context)


@login_required(login_url="/login/")
@require_POST
def activate_user_account(request: HttpRequest, user_id: int):
    if not (request.user.is_staff or request.user.is_superuser):
        return redirect("/dashboard/")
    target = get_object_or_404(User.objects.select_related("profile"), id=user_id)
    profile = getattr(target, "profile", None)
    if profile:
        profile.is_approved = True
        profile.save(update_fields=["is_approved"])
    return redirect("/admin/panel/")


@require_http_methods(["GET", "POST"])
@ensure_csrf_cookie
def login_page(request: HttpRequest):
    if request.user.is_authenticated:
        if _is_user_approved(request.user):
            return redirect("/cv/create/")
        return redirect("/inactive-account/")

    if request.method == "POST":
        email = (request.POST.get("email") or "").strip().lower()
        password = request.POST.get("password") or ""
        user = User.objects.filter(email=email).first()
        if not user or not user.check_password(password):
            return _render_page(request, "login.html", {"error": "Email ou mot de passe incorrect.", "form_data": {"email": email}}, status=400)
        login(request, user)
        if not _is_user_approved(user):
            return redirect("/inactive-account/")
        return redirect(request.GET.get("next") or "/cv/create/")

    return _render_page(request, "login.html", {"error": None, "form_data": {"email": ""}})


@login_required(login_url="/login/")
@require_POST
def logout_view(request: HttpRequest):
    logout(request)
    return redirect("/")


@require_http_methods(["GET", "POST"])
@ensure_csrf_cookie
def register_page(request: HttpRequest):
    if request.user.is_authenticated:
        if _is_user_approved(request.user):
            return redirect("/cv/create/")
        return redirect("/inactive-account/")

    if request.method == "POST":
        first_name = (request.POST.get("first_name") or "").strip()
        last_name = (request.POST.get("last_name") or "").strip()
        email = (request.POST.get("email") or "").strip().lower()
        username = (request.POST.get("username") or "").strip().lower()
        password = request.POST.get("password") or ""
        password2 = request.POST.get("password2") or ""
        referral_code = (request.POST.get("referral_code") or "").strip().upper()
        terms = request.POST.get("terms") or ""

        error = None
        if not terms:
            error = "Vous devez accepter les conditions d'utilisation."
        elif password != password2:
            error = "Les mots de passe ne correspondent pas."
        elif len(password) < 8:
            error = "Le mot de passe doit contenir au moins 8 caractères."
        elif not email:
            error = "Adresse email requise."
        elif User.objects.filter(email=email).exists():
            error = "Cette adresse email est déjà utilisée."
        elif not username:
            error = "Nom d'utilisateur requis."
        elif User.objects.filter(username=username).exists():
            error = "Ce nom d'utilisateur est déjà pris."

        if error:
            return _render_page(request, "register.html", {"error": error, "form_data": {"first_name": first_name, "last_name": last_name, "email": email, "username": username, "referral_code": referral_code}}, status=400)

        user = User(username=username, email=email, first_name=first_name, last_name=last_name)
        user.set_password(password)
        user.save()

        chars = string.ascii_uppercase + string.digits
        code = ""
        while True:
            code = "".join(secrets.choice(chars) for _ in range(8))
            if not UserProfile.objects.filter(referral_code=code).exists():
                break

        UserProfile.objects.create(
            user=user,
            referral_code=code,
            referred_by=referral_code if UserProfile.objects.filter(referral_code=referral_code).exists() else "",
            is_approved=False,
        )
        login(request, user)
        return redirect("/inactive-account/")

    return _render_page(request, "register.html", {"error": None, "form_data": {}})


@require_GET
def check_username(request: HttpRequest):
    username = (request.GET.get("username") or "").strip().lower()
    taken = User.objects.filter(username=username).exists() if username else False
    return JsonResponse({"taken": taken})


@require_GET
def check_referral(request: HttpRequest):
    code = (request.GET.get("code") or "").strip().upper()
    valid = UserProfile.objects.filter(referral_code=code).exists() if code else False
    return JsonResponse({"valid": valid})


@require_GET
def templates_gallery(request: HttpRequest):
    return redirect("/")


@require_GET
def cv_templates(request: HttpRequest):
    return render(request, "cv_templates.html", {"templates_list": CV_PREVIEW_MODELS})


@login_required(login_url="/login/")
@require_GET
def cv_create_page(request: HttpRequest):
    template_id = request.GET.get("template", "classique")
    selected_model = _preview_model_by_id(template_id)
    return _render_page(
        request,
        "cv_create.html",
        {
            "selected_template": selected_model,
            "templates_list": CV_PREVIEW_MODELS,
            "models_gallery": CV_PREVIEW_MODELS,
            "selected_model_id": selected_model.get("id", "classique"),
        },
    )


@login_required(login_url="/login/")
@require_GET
def cv_build_page(request: HttpRequest, cv_id: int):
    resume = get_object_or_404(Resume, id=cv_id, user=request.user)
    cv_data = _resume_to_dict(resume)
    cv_context = _cv_template_context_from_saved(cv_data)
    editor_data = _cv_context_to_editor_data(cv_context)
    selected_model_id = str((cv_data.get("template") or {}).get("id", "classique"))
    return _render_page(request, "cv_build.html", {"cv": cv_data, "models_gallery": CV_PREVIEW_MODELS, "selected_model_id": selected_model_id, "editor_data": editor_data})


@login_required(login_url="/login/")
@require_POST
def preview_cv(request: HttpRequest):
    payload = _safe_json_body(request)
    data = payload.get("data", {}) if isinstance(payload.get("data"), dict) else {}
    template_id = _resolve_cv_template_id(str(payload.get("template", "classique")))
    context = _cv_template_context_from_preview(data)
    html_doc = _render_cv_template_html(template_id, context)
    return HttpResponse(html_doc)


@require_GET
def template_preview(request: HttpRequest, template_id: str):
    context = _cv_template_reference_context(template_id)
    html_doc = _render_cv_template_html(template_id, context)
    return HttpResponse(html_doc)


@login_required(login_url="/login/")
@require_POST
def render_template_from_editor(request: HttpRequest):
    payload = _safe_json_body(request)
    template_id = _resolve_cv_template_id(str(payload.get("template", "classique")))
    cv_payload = payload.get("cv", {}) if isinstance(payload.get("cv"), dict) else {}
    context = _cv_editor_payload_to_context(cv_payload)
    html_doc = _render_cv_template_html(template_id, context)
    return HttpResponse(html_doc)


@login_required(login_url="/login/")
@require_POST
def generate_cv_from_ai(request: HttpRequest):
    payload = _safe_json_body(request)
    try:
        full_name = str(payload.get("full_name", "")).strip()
        job_title = str(payload.get("job_title", "")).strip()
        cv_prompt = str(payload.get("cv_prompt", "")).strip()
        skills = payload.get("skills", []) if isinstance(payload.get("skills"), list) else []
        interests = payload.get("interests", []) if isinstance(payload.get("interests"), list) else []
        lang = str(payload.get("lang", "fr")).lower()
        template_id = _resolve_cv_template_id(str(payload.get("template", "classique")))
        if not full_name or not job_title or not cv_prompt or not skills or not interests:
            return JsonResponse({"success": False, "detail": "Champs obligatoires manquants."}, status=400)

        gen_input = {
            "name": full_name,
            "job_title": job_title,
            "years_experience": cv_prompt,
            "skills": ", ".join([str(s).strip() for s in skills if str(s).strip()]),
            "city": "Non spécifié" if lang == "fr" else "Not specified",
        }
        generated = _safe_ai(lambda: generate_cv_content(gen_input, lang))

        resume = Resume.objects.create(
            user=request.user,
            template={"id": template_id, "name": _preview_model_by_id(template_id).get("name", "Classique"), "color": _template_color_for_create(template_id)},
            input_data={"name": full_name, "job_title": job_title, "years_experience": cv_prompt, "skills": gen_input["skills"], "city": gen_input["city"], "lang": lang},
            optional_data={
                "email": str(payload.get("email", "")).strip(),
                "phone": str(payload.get("phone", "")).strip(),
                "linkedin": str(payload.get("linkedin", "")).strip(),
                "github": str(payload.get("github", "")).strip(),
                "interests": [str(s).strip() for s in interests if str(s).strip()],
                "photo_data_url": str(payload.get("photo_data_url", "")).strip(),
            },
            generated_data={
                "summary": str(generated.get("summary", "")).strip(),
                "experiences": generated.get("experiences", []),
                "education": generated.get("education", []),
                "skills": generated.get("skills", []),
                "languages": generated.get("languages", []),
                "personal_info": {
                    "name": full_name,
                    "job_title": job_title,
                    "city": gen_input["city"],
                    "email": str(payload.get("email", "")).strip(),
                    "phone": str(payload.get("phone", "")).strip(),
                    "linkedin": str(payload.get("linkedin", "")).strip(),
                    "github": str(payload.get("github", "")).strip(),
                    "photo_data_url": str(payload.get("photo_data_url", "")).strip(),
                },
            },
        )
        return JsonResponse({"success": True, "cv_id": resume.id})
    except ValueError as exc:
        return JsonResponse({"success": False, "detail": str(exc)}, status=500)


@login_required(login_url="/login/")
@require_POST
def save_cv_draft(request: HttpRequest):
    payload = _safe_json_body(request)
    cv_id = payload.get("cv_id")
    resume = None
    if cv_id:
        resume = Resume.objects.filter(id=int(cv_id), user=request.user).first()
    if not resume:
        resume = Resume(user=request.user)

    template_id = _resolve_cv_template_id(str(payload.get("template", "classique")))
    full_name = str(payload.get("full_name", "")).strip() or "Candidat"
    job_title = str(payload.get("job_title", "")).strip() or "Poste visé"
    lang = str(payload.get("lang", "fr")).strip().lower()
    safe_city = "Non spécifié" if lang == "fr" else "Not specified"

    resume.template = {"id": template_id, "name": _preview_model_by_id(template_id).get("name", "Classique"), "color": _template_color_for_create(template_id)}
    resume.input_data = {
        "name": full_name,
        "job_title": job_title,
        "years_experience": str(payload.get("experience", "")).strip(),
        "skills": ", ".join([str(s).strip() for s in (payload.get("skills", []) if isinstance(payload.get("skills"), list) else []) if str(s).strip()]),
        "city": safe_city,
        "lang": lang,
    }
    resume.optional_data = {
        "email": str(payload.get("email", "")).strip(),
        "phone": str(payload.get("phone", "")).strip(),
        "linkedin": str(payload.get("linkedin", "")).strip(),
        "github": str(payload.get("github", "")).strip(),
        "interests": [str(s).strip() for s in (payload.get("interests", []) if isinstance(payload.get("interests"), list) else []) if str(s).strip()],
        "photo_data_url": str(payload.get("photo_data_url", "")).strip(),
    }
    if not resume.generated_data:
        skills = [str(s).strip() for s in (payload.get("skills", []) if isinstance(payload.get("skills"), list) else []) if str(s).strip()]
        if not skills:
            skills = ["Compétence principale"]
        resume.generated_data = {
            "summary": "Profil en cours de finalisation.",
            "experiences": [],
            "education": [],
            "skills": [{"name": item, "level": 3} for item in skills[:12]],
            "languages": [{"name": "Français", "level": "Professionnel"}],
            "personal_info": {
                "name": full_name,
                "job_title": job_title,
                "city": safe_city,
                "email": str(payload.get("email", "")).strip(),
                "phone": str(payload.get("phone", "")).strip(),
                "linkedin": str(payload.get("linkedin", "")).strip(),
                "github": str(payload.get("github", "")).strip(),
                "photo_data_url": str(payload.get("photo_data_url", "")).strip(),
            },
        }

    resume.save()
    return JsonResponse({"success": True, "cv_id": resume.id})


@login_required(login_url="/login/")
@require_GET
def letters_home(request: HttpRequest):
    return redirect("/dashboard/")


@login_required(login_url="/login/")
@require_GET
def letters_create_page(request: HttpRequest):
    letter_id = request.GET.get("letter_id")
    user_cvs = [{"id": r.id, "title": (r.input_data or {}).get("job_title") or "CV sans titre", "updated_at": r.updated_at.isoformat(), "template_name": (r.template or {}).get("name", "CV")} for r in Resume.objects.filter(user=request.user).order_by("-id")]

    current_letter = None
    if letter_id and str(letter_id).isdigit():
        letter = Letter.objects.filter(id=int(letter_id), user=request.user).first()
        if letter:
            current_letter = {
                "id": letter.id,
                "tone": letter.tone,
                "company": letter.company,
                "position": letter.position,
                "recruiter": letter.recruiter,
                "content": letter.content,
                "linked_cv_id": letter.linked_cv_id,
            }

    return _render_page(request, "letters_create.html", {"user_cvs": user_cvs, "letter_draft": current_letter})


@login_required(login_url="/login/")
@require_POST
def letter_preview_api(request: HttpRequest):
    payload = _safe_json_body(request)
    html_doc = _render_letter_html(
        template_id=str(payload.get("template", "elite")),
        content=str(payload.get("content", "")),
        company=str(payload.get("company", "")),
        position=str(payload.get("position", "")),
        recruiter=str(payload.get("recruiter", "")),
    )
    return HttpResponse(html_doc)


@login_required(login_url="/login/")
@require_POST
def generate_letter_api(request: HttpRequest):
    payload = _safe_json_body(request)
    company = str(payload.get("company", "")).strip()
    position = str(payload.get("position", "")).strip()
    tone = str(payload.get("tone", "formel"))
    recruiter = str(payload.get("recruiter", "")).strip()
    cv_id = payload.get("cv_id")

    if not company or not position:
        return JsonResponse({"success": False, "detail": "Champs requis manquants."}, status=400)

    linked_cv_data = {}
    if cv_id:
        resume = Resume.objects.filter(id=int(cv_id), user=request.user).first()
        if resume:
            linked_cv_data = resume.generated_data or {}

    try:
        content = _safe_ai(lambda: generate_cover_letter(company=company, position=position, tone=tone, cv_data=linked_cv_data, recruiter=recruiter, lang="fr"))
    except ValueError as exc:
        return JsonResponse({"success": False, "detail": str(exc)}, status=500)

    letter = Letter.objects.create(
        user=request.user,
        linked_cv=Resume.objects.filter(id=int(cv_id), user=request.user).first() if cv_id else None,
        title=f"Lettre — {position}",
        company=company,
        position=position,
        content=content,
        template="elite",
        tone=tone,
        recruiter=recruiter,
        is_draft=False,
    )
    return JsonResponse({"success": True, "content": content, "letter_id": letter.id})


@login_required(login_url="/login/")
@require_POST
def save_letter_draft(request: HttpRequest):
    payload = _safe_json_body(request)
    letter_id = payload.get("letter_id")
    letter = None
    if letter_id:
        letter = Letter.objects.filter(id=int(letter_id), user=request.user).first()
    if not letter:
        letter = Letter(user=request.user)

    content = str(payload.get("content", "")).strip() or "Madame, Monsieur,\n\nJe vous adresse ma candidature..."
    position = str(payload.get("position", "")).strip()
    cv_id = payload.get("cv_id")

    letter.title = f"Lettre — {position or 'Sans titre'}"
    letter.company = str(payload.get("company", "")).strip()
    letter.position = position
    letter.content = content
    letter.template = "elite"
    letter.tone = str(payload.get("tone", "formel"))
    letter.recruiter = str(payload.get("recruiter", "")).strip()
    letter.linked_cv = Resume.objects.filter(id=int(cv_id), user=request.user).first() if cv_id else None
    letter.is_draft = True
    letter.save()

    return JsonResponse({"success": True, "letter_id": letter.id, "content": content})


@login_required(login_url="/login/")
@require_POST
def enhance_letter_api(request: HttpRequest):
    payload = _safe_json_body(request)
    content = str(payload.get("content", "")).strip()
    mode = str(payload.get("mode", "tone"))
    tone = str(payload.get("tone", "formel"))

    if len(content) < 30:
        return JsonResponse({"success": False, "detail": "Contenu insuffisant."}, status=400)

    mode_instruction = "Réécris la lettre avec le même sens, mais améliore le ton pour le rendre plus convaincant." if mode == "tone" else "Corrige uniquement les fautes d'orthographe et de grammaire sans changer le style."
    prompt = f"""
{mode_instruction}
Ton cible: {tone}
Langue: fr

Texte:
{content}

Retourne uniquement la lettre finale.
"""
    try:
        improved = _safe_ai(lambda: gemini_generate(prompt)).strip().replace("```", "")
    except ValueError as exc:
        return JsonResponse({"success": False, "detail": str(exc)}, status=500)

    return JsonResponse({"success": True, "content": improved})


@login_required(login_url="/login/")
@require_GET
def edit_letter(request: HttpRequest, letter_id: int):
    letter = Letter.objects.filter(id=letter_id, user=request.user).first()
    if not letter:
        return redirect("/letters/create/")
    return redirect(f"/letters/create/?letter_id={letter_id}")


@login_required(login_url="/login/")
@require_GET
def download_letter(request: HttpRequest, letter_id: int):
    letter = get_object_or_404(Letter, id=letter_id, user=request.user)
    html_doc = _render_letter_html(
        template_id=letter.template or "elite",
        content=letter.content,
        company=letter.company,
        position=letter.position,
        recruiter=letter.recruiter,
    )
    return _html_to_pdf_response(html_doc, f"lettre-{letter.id}.pdf")


@login_required(login_url="/login/")
@require_POST
def extract_cv_basics(request: HttpRequest):
    upload = request.FILES.get("file")
    mode = request.POST.get("mode", "cv")
    if not upload:
        return JsonResponse({"success": False, "detail": "Fichier manquant."}, status=400)

    raw = upload.read()
    if not raw:
        return JsonResponse({"success": False, "detail": "Fichier vide."}, status=400)
    if len(raw) > 8 * 1024 * 1024:
        return JsonResponse({"success": False, "detail": "Fichier trop volumineux (max 8MB)."}, status=400)

    try:
        extracted_text = _read_upload_text(upload.name or "upload.txt", raw)
    except ValueError as exc:
        return JsonResponse({"success": False, "detail": str(exc)}, status=400)

    lang_instruction = "Reponds en francais." if mode != "linkedin_en" else "Reply in English."
    prompt = f"""
{lang_instruction}

Tu reçois un texte source ({mode}) qui vient d'un CV ou d'un profil.
Extrais uniquement les informations utiles pour pré-remplir un builder CV.
Retourne UNIQUEMENT un JSON valide avec ce format exact:
{{
  "full_name": "Nom complet ou vide",
  "job_title": "Poste visé ou vide",
  "cv_prompt": "Un prompt court pour guider l'IA sur le style et l'orientation du CV",
  "experience": "Texte libre court résumant le niveau/profil (compatibilité)",
  "skills": ["skill1", "skill2"],
  "interests": ["interet1", "interet2"],
  "email": "",
  "phone": "",
  "linkedin": "",
  "github": ""
}}

Texte source:
{extracted_text[:12000]}
"""

    extraction_mode = "ai"
    warning = ""
    try:
        model_text = _safe_ai(lambda: gemini_generate(prompt))
        data = _extract_json_object(model_text)
    except Exception as exc:
        extraction_mode = "fallback"
        warning = f"Extraction IA indisponible ({exc}). Mode de secours activé."
        data = _extract_cv_basics_fallback(extracted_text, mode)

    skills = data.get("skills") if isinstance(data.get("skills"), list) else []
    interests = data.get("interests") if isinstance(data.get("interests"), list) else []
    normalized = {
        "full_name": str(data.get("full_name", "")).strip(),
        "job_title": str(data.get("job_title", "")).strip(),
        "cv_prompt": str(data.get("cv_prompt", "")).strip(),
        "experience": str(data.get("experience", "")).strip(),
        "skills": [str(s).strip() for s in skills if str(s).strip()][:20],
        "interests": [str(s).strip() for s in interests if str(s).strip()][:20],
        "email": str(data.get("email", "")).strip(),
        "phone": str(data.get("phone", "")).strip(),
        "linkedin": str(data.get("linkedin", "")).strip(),
        "github": str(data.get("github", "")).strip(),
    }
    return JsonResponse({"success": True, "data": normalized, "mode": extraction_mode, "warning": warning})


@login_required(login_url="/login/")
@require_POST
def extract_linkedin_profile(request: HttpRequest):
    payload = _safe_json_body(request)
    linkedin_url = str(payload.get("linkedin_url", "")).strip()
    lang = str(payload.get("lang", "fr")).lower().strip()
    if lang not in {"fr", "en"}:
        lang = "fr"

    if not linkedin_url:
        return JsonResponse({"success": False, "detail": "URL LinkedIn manquante."}, status=400)
    if not _is_valid_linkedin_profile_url(linkedin_url):
        return JsonResponse({"success": False, "detail": "URL LinkedIn invalide. Utilisez un lien de profil /in/."}, status=400)

    try:
        profile = _fetch_linkedin_profile_proxycurl(linkedin_url)
        normalized = _normalize_linkedin_profile(profile, linkedin_url, lang)
    except ValueError as exc:
        return JsonResponse({"success": False, "detail": str(exc)}, status=500)
    except Exception:
        return JsonResponse({"success": False, "detail": "Échec de récupération du profil LinkedIn."}, status=500)

    return JsonResponse({"success": True, "data": normalized})


@login_required(login_url="/login/")
@require_POST
def voice_extract_api(request: HttpRequest):
    payload = _safe_json_body(request)
    transcript = str(payload.get("transcript", "")).strip()
    mode = str(payload.get("mode", "cv")).strip().lower()
    lang = str(payload.get("lang", "fr")).strip().lower()
    if lang not in {"fr", "en"}:
        lang = "fr"

    if not transcript:
        return JsonResponse({"success": False, "error": "Transcription vide."}, status=400)

    try:
        if mode == "letter":
            fields = extract_letter_from_voice(transcript, lang)
        else:
            fields = extract_cv_from_voice(transcript, lang)
        return JsonResponse({"success": True, "fields": fields})
    except Exception as exc:
        return JsonResponse({"success": False, "error": str(exc)}, status=500)


@login_required(login_url="/login/")
@require_POST
def voice_transcribe_api(request: HttpRequest):
    upload = request.FILES.get("audio")
    lang = str(request.POST.get("lang", "fr")).strip().lower()
    if lang not in {"fr", "en"}:
        lang = "fr"
    if not upload:
        return JsonResponse({"success": False, "error": "Fichier audio manquant."}, status=400)
    try:
        audio_bytes = upload.read()
        transcript = transcribe_audio_bytes(audio_bytes, upload.content_type or "audio/webm", lang)
        return JsonResponse({"success": True, "transcript": transcript})
    except Exception as exc:
        return JsonResponse({"success": False, "error": str(exc)}, status=500)


@login_required(login_url="/login/")
@require_GET
def download_cv(request: HttpRequest, cv_id: int):
    resume = get_object_or_404(Resume, id=cv_id, user=request.user)
    html_doc = _render_cv_pdf_html(_resume_to_dict(resume))
    return _html_to_pdf_response(html_doc, f"cv-{cv_id}.pdf")


@login_required(login_url="/login/")
@require_GET
def download_latest_cv(request: HttpRequest):
    latest = Resume.objects.filter(user=request.user).order_by("-id").first()
    if not latest:
        return JsonResponse({"detail": "Aucun CV trouvé pour votre compte."}, status=404)
    return download_cv(request, latest.id)


@login_required(login_url="/login/")
@require_POST
def update_cv_build(request: HttpRequest, cv_id: int):
    resume = get_object_or_404(Resume, id=cv_id, user=request.user)
    payload = _safe_json_body(request)

    template_id = _resolve_cv_template_id(str(payload.get("template", "classique")))
    context = _cv_editor_payload_to_context(payload.get("cv", {}) if isinstance(payload.get("cv"), dict) else {})
    editor = _cv_context_to_editor_data(context)
    personal = context.get("personal_info", {})

    resume.template = {"id": template_id, "name": _preview_model_by_id(template_id).get("name", "Classique"), "color": _template_color_for_create(template_id)}
    resume.input_data = {
        "name": personal.get("name", ""),
        "job_title": personal.get("job_title", ""),
        "years_experience": (resume.input_data or {}).get("years_experience", ""),
        "skills": ", ".join([s.get("name", "") for s in editor.get("skills", []) if isinstance(s, dict)]),
        "city": personal.get("city", ""),
    }
    resume.optional_data = {
        "email": personal.get("email", ""),
        "phone": personal.get("phone", ""),
        "linkedin": personal.get("linkedin", ""),
        "github": personal.get("github", ""),
        "interests": editor.get("interests", []),
        "photo_data_url": personal.get("photo_data_url", ""),
    }
    resume.generated_data = {
        "summary": editor.get("summary", ""),
        "experiences": editor.get("experiences", []),
        "education": editor.get("education", []),
        "skills": editor.get("skills", []),
        "languages": editor.get("languages", []),
        "personal_info": personal,
    }
    resume.save()
    return JsonResponse({"success": True, "cv_id": resume.id})


@login_required(login_url="/login/")
@require_POST
def generate_portfolio(request: HttpRequest, cv_id: int):
    return JsonResponse({"detail": "La création de portfolio est temporairement désactivée. Fonctionnalité bientôt disponible."}, status=503)

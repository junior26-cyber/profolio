import json
from typing import Any

from ai.client import generate
from ai.generator import get_language_instruction


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip().replace("```json", "").replace("```", "").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Réponse IA invalide: JSON introuvable.")
    return json.loads(cleaned[start : end + 1])


def extract_cv_from_voice(transcript: str, lang: str) -> dict[str, Any]:
    lang_instruction = get_language_instruction(lang if lang in {"fr", "en"} else "fr")
    prompt = f"""
{lang_instruction}

Extrais les informations CV depuis cette phrase parlée.
Retourne UNIQUEMENT un JSON valide.

Phrase: "{transcript}"

JSON:
{{
  "full_name": "nom complet ou null",
  "job_title": "métier/poste ou null",
  "experience": "durée ex: 3 ans, 5-10 ans ou null",
  "skills": ["skill1", "skill2"],
  "city": "ville ou null"
}}
"""
    data = _extract_json(generate(prompt))
    skills = data.get("skills") if isinstance(data.get("skills"), list) else []
    return {
        "full_name": str(data.get("full_name", "")).strip(),
        "job_title": str(data.get("job_title", "")).strip(),
        "experience": str(data.get("experience", "")).strip(),
        "skills": [str(item).strip() for item in skills if str(item).strip()][:20],
        "city": str(data.get("city", "")).strip(),
    }


def extract_letter_from_voice(transcript: str, lang: str) -> dict[str, Any]:
    lang_instruction = get_language_instruction(lang if lang in {"fr", "en"} else "fr")
    prompt = f"""
{lang_instruction}

Extrais les informations lettre depuis cette phrase parlée.
Retourne UNIQUEMENT un JSON valide.

Phrase: "{transcript}"

JSON:
{{
  "company": "entreprise ou null",
  "position": "poste visé ou null",
  "tone": "formel ou dynamique ou creatif"
}}
"""
    data = _extract_json(generate(prompt))
    tone = str(data.get("tone", "")).strip().lower()
    if tone not in {"formel", "dynamique", "creatif"}:
        tone = "formel"
    return {
        "company": str(data.get("company", "")).strip(),
        "position": str(data.get("position", "")).strip(),
        "tone": tone,
    }

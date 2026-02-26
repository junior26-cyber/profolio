import json
from typing import Any

from ai.client import generate


def get_language_instruction(lang_code: str) -> str:
    if lang_code == "fr":
        return "Reponds uniquement en francais. Utilise un ton professionnel."
    return "Reply only in English. Use a professional tone."


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip().replace("```json", "").replace("```", "").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in Gemini response.")
    return json.loads(cleaned[start : end + 1])


def generate_cv_content(data: dict[str, str], lang: str) -> dict[str, Any]:
    lang_instruction = get_language_instruction(lang)
    prompt = f"""
{lang_instruction}

Generate a complete professional resume content for the candidate below.
Return ONLY a valid JSON object. No markdown. No explanation.

Candidate information:
- Full name: {data['name']}
- Target role: {data['job_title']}
- Years of experience: {data['years_experience']}
- Main skills: {data['skills']}
- City: {data['city']}

JSON format expected:
{{
  "summary": "3-4 compelling professional sentences",
  "experiences": [
    {{
      "title": "Job title",
      "company": "Realistic company name",
      "location": "{data['city']}",
      "start_date": "Jan 2022",
      "end_date": "Present",
      "is_current": true,
      "description": "Detailed responsibilities and achievements"
    }}
  ],
  "education": [
    {{
      "degree": "Realistic degree",
      "school": "Realistic school",
      "year": "2021",
      "description": "Specialization or distinction"
    }}
  ],
  "skills": [
    {{"name": "skill", "level": 4}}
  ],
  "languages": [
    {{"name": "French", "level": "Native"}},
    {{"name": "English", "level": "Professional"}}
  ]
}}
"""
    result = generate(prompt)
    return _extract_json(result)


def generate_cover_letter(
    company: str,
    position: str,
    tone: str = "formel",
    cv_data: dict[str, Any] | None = None,
    recruiter: str = "",
    lang: str = "fr",
) -> str:
    lang_instruction = get_language_instruction("fr" if lang == "fr" else lang)
    cv_data = cv_data or {}
    personal = cv_data.get("personal_info", {}) if isinstance(cv_data, dict) else {}
    skills = ", ".join(
        [s.get("name", "") for s in cv_data.get("skills", []) if isinstance(s, dict) and s.get("name")]
    )

    tone_instructions = {
        "formel": "Adopte un ton formel, respectueux et traditionnel.",
        "dynamique": "Adopte un ton moderne, dynamique et percutant.",
        "creatif": "Adopte un ton créatif et mémorable.",
    }

    recruiter_line = (
        f"Adresse la lettre directement à {recruiter}."
        if recruiter.strip()
        else "Commence par 'Madame, Monsieur,'."
    )

    prompt = f"""
{lang_instruction}
{tone_instructions.get(tone, tone_instructions['formel'])}

Rédige une lettre de motivation complète et professionnelle.
Retourne uniquement le texte de la lettre, sans markdown.

Profil candidat (si disponible):
- Nom: {personal.get('name', '')}
- Poste: {personal.get('job_title', '')}
- Compétences clés: {skills}
- Résumé: {cv_data.get('summary', '') if isinstance(cv_data, dict) else ''}

Entreprise cible: {company}
Poste visé: {position}
{recruiter_line}

Structure:
1) Accroche
2) Motivation pour l'entreprise
3) Valeur ajoutée du candidat
4) Conclusion avec appel à l'action

Contraintes:
- La lettre finale doit etre entierement en francais si la langue est 'fr'
- 280 à 350 mots
- Pas de placeholders
- Style naturel et prêt à envoyer
"""

    return generate(prompt).strip().replace("```", "")


def generate_portfolio_from_cv(cv_data: dict[str, Any], lang: str) -> dict[str, Any]:
    lang_instruction = get_language_instruction(lang)

    prompt = f"""
{lang_instruction}

Generate professional portfolio content from this CV data.
Return ONLY valid JSON.

Input CV data:
{json.dumps(cv_data, ensure_ascii=False)}

JSON expected:
{{
  "headline": "Short impactful headline",
  "about": "3 short paragraphs",
  "services": [
    {{"title": "Service name", "description": "Concrete value proposition"}}
  ],
  "projects": [
    {{
      "name": "Project name",
      "description": "What was built and business impact",
      "stack": ["Python", "Django", "React"],
      "result": "Measurable result"
    }}
  ],
  "contact_cta": "Strong CTA to contact"
}}
"""

    return _extract_json(generate(prompt))

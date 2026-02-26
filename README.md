# ProFolio Django Refonte

Ce dossier contient la migration de ton projet vers Django, en gardant la logique existante (CV, lettres, auth, preview live, export PDF).

## Stack

- Django (backend + sessions + auth)
- Jinja2 templates (compatibles avec tes templates actuels)
- WeasyPrint (export PDF, intégré côté Django)
- SQLite (par défaut)

## Installation

```bash
cd django_refonte
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

## URLs clés

- `/` accueil
- `/register/` inscription
- `/login/` connexion
- `/dashboard/`
- `/cv/create/`
- `/cv/build/<id>/`
- `/letters/create/`

## API clés (compatibles JS existant)

- `POST /api/ai/generate-cv/`
- `POST /api/cv/save-draft/`
- `POST /api/cv/render-template/`
- `POST /api/letters/generate/`
- `POST /api/letters/save/`
- `POST /api/letters/enhance/`
- `GET /cv/download/<id>/`
- `GET /letters/download/<id>/`

## Notes

- La création portfolio reste bloquée (retour `503`) comme demandé.
- La génération de lettre est forcée en français.
- CSRF est temporairement désactivé pour garder la compatibilité immédiate avec ton JS actuel.
  - Prochaine étape recommandée: réactiver CSRF et ajouter les tokens dans les formulaires/fetch.

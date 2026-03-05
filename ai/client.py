import os

try:
    import google.generativeai as genai
except ModuleNotFoundError:  # pragma: no cover
    genai = None


_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
_GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")

if _GEMINI_KEY and genai:
    genai.configure(api_key=_GEMINI_KEY)

_model = genai.GenerativeModel(_GEMINI_MODEL) if (_GEMINI_KEY and genai) else None


class GeminiConfigurationError(RuntimeError):
    pass


def generate(prompt: str) -> str:
    """Simple call to configured Gemini model."""
    if genai is None:
        raise GeminiConfigurationError(
            "google-generativeai is not installed. Run: pip install -r requirements.txt"
        )

    if not _model:
        raise GeminiConfigurationError(
            "GEMINI_API_KEY is missing. Add it in your environment or .env file."
        )

    try:
        response = _model.generate_content(prompt)
        return (response.text or "").strip()
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"Gemini error: {exc}") from exc

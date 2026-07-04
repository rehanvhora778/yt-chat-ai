"""
config.py
---------
Central configuration loaded from environment variables.
All other modules import the `Config` object from here so that there is a
single source of truth for settings.
"""

import os
from dotenv import load_dotenv

# Load variables from a local .env file (if present) into os.environ
load_dotenv()


class Config:
    """Application configuration pulled from environment variables."""

    # ---- Flask ----
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    PORT = int(os.getenv("PORT", 5000))
    DEBUG = FLASK_ENV == "development"

    # ---- JWT ----
    JWT_SECRET = os.getenv("JWT_SECRET", "dev-jwt-secret")
    JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", 24))

    # ---- MongoDB ----
    MONGO_URI = os.getenv("MONGO_URI", "")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "yt_chat_genai")

    # ---- Groq (free, high-limit LLM — PREFERRED over Gemini when a key is set) ----
    # Groq's free tier allows thousands of requests/day vs Gemini's ~20/day, so
    # text generation (chat/summary/key-points) uses Groq when GROQ_API_KEY
    # is present, and only falls back to Gemini otherwise.
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    # Fallback Groq model, used automatically when GROQ_MODEL hits a free-tier
    # limit (llama-3.3-70b is only ~100k tokens/DAY, which a few full-transcript
    # notes/summaries exhaust). Must have a high enough per-MINUTE token limit to
    # accept a full-transcript request: llama-3.1-8b-instant caps at 6k TPM (too
    # small for ~6k-token notes), whereas openai/gpt-oss-120b handles it and has
    # its own separate daily budget. Set equal to GROQ_MODEL/blank to disable.
    GROQ_FALLBACK_MODEL = os.getenv("GROQ_FALLBACK_MODEL", "openai/gpt-oss-120b")
    # Cap on completion length (defensive — bounds tokens per call).
    GROQ_MAX_OUTPUT_TOKENS = int(os.getenv("GROQ_MAX_OUTPUT_TOKENS", 4096))
    # Groq Whisper used to transcribe videos without captions (free).
    GROQ_WHISPER_MODEL = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3")

    # ---- Google Gemini ----
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
    # gemini-2.5-flash-lite has a higher free-tier quota than 2.5-flash on this
    # key (2.5-flash is capped at ~20/day; 2.0-flash has 0 free quota).
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "models/gemini-embedding-001")
    # Local fallback embedding model (FastEmbed) used when the Gemini embedding
    # quota is exhausted (429). Lightweight, runs offline, ~130MB on first use.
    LOCAL_EMBEDDING_MODEL = os.getenv(
        "LOCAL_EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"
    )

    # ---- FAISS ----
    # Absolute path to the folder that stores per-video FAISS indexes
    FAISS_STORE_PATH = os.path.abspath(
        os.getenv("FAISS_STORE_PATH", "faiss_store")
    )

    # ---- CORS ----
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173"
        ).split(",")
        if origin.strip()
    ]

    @classmethod
    def validate(cls):
        """Warn (do not crash) if critical secrets are missing."""
        missing = []
        if not cls.MONGO_URI:
            missing.append("MONGO_URI")
        # An LLM key is required, but either provider is fine.
        if not cls.GROQ_API_KEY and not cls.GOOGLE_API_KEY:
            missing.append("GROQ_API_KEY or GOOGLE_API_KEY")
        if missing:
            print(
                "[config] WARNING: missing environment variables: "
                + ", ".join(missing)
                + ". Some features will not work until they are set."
            )
        return not missing

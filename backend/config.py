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
    # NOTE: Groq retires models regularly. llama-3.3-70b-versatile was
    # decommissioned and now 404s ("model does not exist"), so the default is
    # gpt-oss-120b (131k context, clean Markdown output, no <think> leakage).
    # Check https://console.groq.com/docs/models before changing this.
    GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    # Fallback Groq model, used automatically when GROQ_MODEL hits a free-tier
    # daily cap OR is unavailable/decommissioned. Must have a high enough
    # per-MINUTE token limit to accept a full-transcript request and its own
    # separate daily budget. gpt-oss-20b qualifies and, like 120b, returns
    # clean prose (qwen3.6-27b leaks visible <think> blocks - do not use it).
    # Set equal to GROQ_MODEL/blank to disable.
    GROQ_FALLBACK_MODEL = os.getenv("GROQ_FALLBACK_MODEL", "openai/gpt-oss-20b")
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

    # ---- Email / SMTP (used to deliver signup OTP codes) ----
    # For Gmail use an APP PASSWORD (Google Account > Security > 2-Step
    # Verification > App passwords) — a normal account password will not work
    # and should never be put here.
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM = os.getenv("SMTP_FROM", "") or SMTP_USER
    SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "YT Chat GenAI")
    # STARTTLS on 587 (Gmail default); set false only for an SSL-on-connect host.
    SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    @classmethod
    def smtp_configured(cls):
        return bool(cls.SMTP_HOST and cls.SMTP_USER and cls.SMTP_PASSWORD)

    # ---- One-time passwords (email verification at signup) ----
    OTP_LENGTH = int(os.getenv("OTP_LENGTH", 6))
    OTP_TTL_MINUTES = int(os.getenv("OTP_TTL_MINUTES", 10))
    OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", 5))
    OTP_RESEND_COOLDOWN_SECONDS = int(os.getenv("OTP_RESEND_COOLDOWN_SECONDS", 60))
    OTP_MAX_SENDS_PER_HOUR = int(os.getenv("OTP_MAX_SENDS_PER_HOUR", 5))
    # Require an emailed code on login too. Off: signup-only verification.
    OTP_ON_LOGIN = os.getenv("OTP_ON_LOGIN", "false").lower() == "true"
    # DEV ONLY: when SMTP is not configured, print the code to the backend
    # console so signup is testable. Never enable this in production — it is
    # ignored unless FLASK_ENV is development.
    OTP_DEV_ECHO = os.getenv("OTP_DEV_ECHO", "true").lower() == "true"

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

"""
config.py
---------
Central configuration loaded from environment variables.
All other modules import the `Config` object from here so that there is a
single source of truth for settings.
"""

import os
import re
from urllib.parse import quote

from dotenv import load_dotenv

# Load variables from a local .env file (if present) into os.environ
load_dotenv()

# Absolute path of the backend folder, so paths below never depend on the
# working directory the process happens to be started from.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Placeholder secrets: fine locally, must never reach production. validate()
# refuses to boot a production process that is still using them.
_DEV_SECRET_KEY = "dev-secret-key"
_DEV_JWT_SECRET = "dev-jwt-secret"


def _normalise_origin(raw: str) -> str:
    """
    Clean one configured origin into the exact form a browser sends.

    A browser's Origin header is always scheme + host (+ port) with no path and
    no trailing slash, and it must match character for character. Every kind of
    near-miss a dashboard field invites therefore matches nothing while looking
    perfectly correct in the UI, and fails invisibly — the browser reports a
    blocked request the same as an unreachable server, and the server logs a
    normal 200. So the near-misses are corrected here:

        "https://site.com"      quotes from a copied string literal
        https://site.com/       trailing slash from a browser address bar
        site.com                no scheme, the easiest one to overlook
        # a comment             a line carried along by a bulk paste
    """
    origin = (raw or "").strip().strip('"').strip("'").strip().rstrip("/")
    if not origin or origin.startswith("#"):
        return ""
    if "://" not in origin:
        # Bare host. Local development is plain HTTP; anything else deployed is
        # HTTPS, and guessing http:// for a public host would be both wrong and
        # a downgrade.
        host = origin.split(":", 1)[0].lower()
        local = host in ("localhost", "127.0.0.1", "0.0.0.0", "[::1]")
        origin = ("http://" if local else "https://") + origin
    return origin


def _resolve(path: str) -> str:
    """Absolute path, resolved against the backend folder when relative."""
    return path if os.path.isabs(path) else os.path.join(BASE_DIR, path)


class Config:
    """Application configuration pulled from environment variables."""

    # ---- Flask ----
    SECRET_KEY = os.getenv("SECRET_KEY", _DEV_SECRET_KEY)
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    PORT = int(os.getenv("PORT", 5000))
    DEBUG = FLASK_ENV == "development"
    IS_PRODUCTION = FLASK_ENV == "production"
    # Reject request bodies larger than this (a transcript question is tiny;
    # anything huge is a mistake or an attack). 1 MB.
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 1024 * 1024))

    # ---- JWT ----
    JWT_SECRET = os.getenv("JWT_SECRET", _DEV_JWT_SECRET)
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

    # ---- Google Sign-In ----
    # OAuth 2.0 Web client ID from Google Cloud Console. NOT a secret - it is
    # visible in the frontend bundle - but the backend needs it too, because
    # every ID token is verified against it as the expected audience. Without
    # that check any valid Google token, minted for any other site, would be
    # accepted here. Blank disables Google sign-in end to end.
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()

    @classmethod
    def google_auth_enabled(cls):
        return bool(cls.GOOGLE_CLIENT_ID)

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
    # Absolute path to the folder that stores per-video FAISS indexes.
    # WARNING: on Render the filesystem is EPHEMERAL unless a persistent disk
    # is mounted at this path — without one, every index is wiped on each
    # redeploy/restart and those videos must be processed again. See
    # DEPLOYMENT.md.
    FAISS_STORE_PATH = _resolve(os.getenv("FAISS_STORE_PATH", "faiss_store"))

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

    # ---- HTTP email APIs ----
    # Render's free plan blocks outbound SMTP (ports 25, 465, 587), so a Gmail
    # App Password cannot deliver anything there — it fails with "Network is
    # unreachable" however correct it is. These APIs go over 443 instead.
    #
    #   Brevo   - 300 emails/day free, and one verified sender address is
    #             enough. No domain of your own needed, so this is the one that
    #             works for a project mailing arbitrary Gmail addresses.
    #   Resend  - more generous, but the free tier will only mail the account
    #             owner until you verify a domain you control.
    BREVO_API_KEY = os.getenv("BREVO_API_KEY", "").strip()
    RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()

    # Who the mail comes from, for every transport. Falls back to the SMTP
    # settings so an existing configuration keeps working untouched.
    MAIL_FROM = (
        os.getenv("MAIL_FROM", "").strip()
        or os.getenv("SMTP_FROM", "").strip()
        or os.getenv("SMTP_USER", "").strip()
    )
    MAIL_FROM_NAME = (
        os.getenv("MAIL_FROM_NAME", "").strip()
        or os.getenv("SMTP_FROM_NAME", "").strip()
        or "YT Chat GenAI"
    )

    @classmethod
    def mail_provider(cls):
        """
        Which transport send_otp_email should use.

        HTTP APIs win over SMTP because a deployment that has both configured
        is almost certainly on a host that blocks SMTP — that being the reason
        the API key was added at all.
        """
        if cls.BREVO_API_KEY and cls.MAIL_FROM:
            return "brevo"
        if cls.RESEND_API_KEY and cls.MAIL_FROM:
            return "resend"
        if cls.smtp_configured():
            return "smtp"
        return "none"

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

    # ---- Outbound proxy for YouTube requests ----
    # YouTube blocks most datacenter IP ranges, so transcript and audio
    # downloads that work from a laptop routinely fail on a cloud host like
    # Render with "RequestBlocked" / "IpBlocked". Routing YouTube traffic
    # through a residential proxy is the documented way around it.
    #
    # Both options are opt-in; blank means "connect directly", which is what
    # you want locally.
    #   * Webshare (recommended by youtube-transcript-api): paste the ROTATING
    #     RESIDENTIAL proxy username/password from the Webshare dashboard.
    #   * Any other provider: set YOUTUBE_PROXY_URL to a full proxy URL, e.g.
    #     http://user:pass@host:port
    WEBSHARE_PROXY_USERNAME = os.getenv("WEBSHARE_PROXY_USERNAME", "").strip()
    WEBSHARE_PROXY_PASSWORD = os.getenv("WEBSHARE_PROXY_PASSWORD", "").strip()
    YOUTUBE_PROXY_URL = os.getenv("YOUTUBE_PROXY_URL", "").strip()

    @classmethod
    def youtube_proxy_url(cls):
        """
        A single proxy URL for plain HTTP clients (yt-dlp), or "" to go direct.
        The "-rotate" suffix is what tells Webshare to pick a fresh IP per
        request, which is the point of using it here.
        """
        if cls.YOUTUBE_PROXY_URL:
            return cls.YOUTUBE_PROXY_URL
        if cls.WEBSHARE_PROXY_USERNAME and cls.WEBSHARE_PROXY_PASSWORD:
            user = quote(cls.WEBSHARE_PROXY_USERNAME, safe="")
            password = quote(cls.WEBSHARE_PROXY_PASSWORD, safe="")
            return f"http://{user}-rotate:{password}@p.webshare.io:80"
        return ""

    # ---- CORS ----
    # Exact origins allowed to call the API, comma separated. In production
    # this must contain the deployed frontend origin (e.g. the Vercel domain);
    # a trailing slash is not part of an origin and is stripped.
    # Quotes are stripped as well as whitespace and the trailing slash: a
    # value pasted into a dashboard as "https://site.com" arrives with the
    # quote characters inside the string, and an origin that differs by one
    # character matches nothing while looking completely correct in the UI.
    CORS_ORIGINS = [
        _normalise_origin(origin)
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if _normalise_origin(origin)
    ]
    # Optional regex for origins that cannot be listed one by one. Vercel gives
    # every preview deployment its own hostname, so allowing them needs a
    # pattern rather than a fixed list, e.g.
    #   CORS_ORIGIN_REGEX=^https://yt-chat-ai-[a-z0-9-]+\.vercel\.app$
    # Leave blank to allow only the exact origins above (production default).
    CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX", "").strip()

    @classmethod
    def cors_origins(cls):
        """Origins to hand flask-cors: exact strings plus the optional regex."""
        origins = list(cls.CORS_ORIGINS)
        if cls.CORS_ORIGIN_REGEX:
            origins.append(re.compile(cls.CORS_ORIGIN_REGEX))
        return origins

    @classmethod
    def validate(cls):
        """
        Check the critical settings.

        Locally this only warns, so the app still boots while you are filling
        in your .env. In production a missing database, a missing LLM key or a
        leftover dev secret means the deployment is broken or insecure, so the
        process refuses to start instead of serving a half-working API — the
        reason is then visible in the Render deploy logs.
        """
        missing = []
        if not cls.MONGO_URI:
            missing.append("MONGO_URI")
        # An LLM key is required, but either provider is fine.
        if not cls.GROQ_API_KEY and not cls.GOOGLE_API_KEY:
            missing.append("GROQ_API_KEY or GOOGLE_API_KEY")

        if cls.IS_PRODUCTION:
            if cls.SECRET_KEY == _DEV_SECRET_KEY:
                missing.append("SECRET_KEY (still the shared dev placeholder)")
            if cls.JWT_SECRET == _DEV_JWT_SECRET:
                missing.append("JWT_SECRET (still the shared dev placeholder)")
            if missing:
                raise RuntimeError(
                    "Refusing to start in production without: "
                    + ", ".join(missing)
                    + ". Set them in the Render dashboard (Environment tab) "
                    "and redeploy."
                )
            # Not fatal, but the frontend cannot call the API without it.
            if not cls.CORS_ORIGIN_REGEX and all(
                ("localhost" in o or "127.0.0.1" in o) for o in cls.CORS_ORIGINS
            ):
                print(
                    "[config] WARNING: CORS_ORIGINS only contains localhost. "
                    "The deployed frontend will be blocked by the browser — "
                    "set CORS_ORIGINS to your Vercel URL."
                )

        if missing:
            print(
                "[config] WARNING: missing environment variables: "
                + ", ".join(missing)
                + ". Some features will not work until they are set."
            )
        return not missing

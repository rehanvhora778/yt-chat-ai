"""
app.py
------
Application factory and entry point for the YT Chat GenAI backend.

Run locally:
    python app.py
Run in production (Render uses exactly this — see gunicorn.conf.py):
    gunicorn -c gunicorn.conf.py app:app
"""

from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

from config import Config
from extensions import init_db
from routes.auth_routes import auth_bp
from routes.video_routes import video_bp
from routes.chat_routes import chat_bp
from routes.analytics_routes import analytics_bp
from routes.history_routes import history_bp
from routes.quiz_routes import quiz_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    # Render terminates TLS at its edge and forwards over plain HTTP, so
    # without this Flask sees every request as http:// and the client IP as
    # the proxy's. One proxy hop is what Render puts in front of a service.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    # Warn about missing secrets and connect to MongoDB up front
    Config.validate()
    init_db()

    # Cross-Origin Resource Sharing for the React frontend. cors_origins()
    # returns the exact allowed origins plus, if CORS_ORIGIN_REGEX is set, a
    # compiled pattern that matches Vercel's per-deployment preview hostnames.
    CORS(
        app,
        resources={r"/api/*": {"origins": Config.cors_origins()}},
        supports_credentials=True,
    )

    # ---- Blueprints (all under /api) ----
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(video_bp, url_prefix="/api")
    app.register_blueprint(chat_bp, url_prefix="/api")
    app.register_blueprint(analytics_bp, url_prefix="/api")
    app.register_blueprint(history_bp, url_prefix="/api")
    app.register_blueprint(quiz_bp, url_prefix="/api")

    # ---- Health check ----
    @app.route("/")
    @app.route("/api/health")
    def health():
        # Report the model that actually serves generation: Groq is preferred
        # whenever a key is set, so reporting GEMINI_MODEL unconditionally was
        # misleading when diagnosing model errors.
        groq = bool(Config.GROQ_API_KEY)
        return jsonify(
            {
                "status": "ok",
                "service": "YT Chat GenAI API",
                "provider": "groq" if groq else "gemini",
                "model": Config.GROQ_MODEL if groq else Config.GEMINI_MODEL,
                "fallback_model": Config.GROQ_FALLBACK_MODEL if groq else None,
                # Lets the frontend confirm both halves of Google sign-in are
                # configured — the client id has to be set here AND in the
                # Vercel build, and only one of them being set is silent.
                "google_auth": Config.google_auth_enabled(),
                # Echoed back because a CORS rejection is invisible from the
                # browser — it reports a blocked request identically to a dead
                # server — and invisible in the logs, since the request was
                # served fine. Seeing the configured list is the difference
                # between diagnosing this in seconds and guessing at it.
                # Allowed origins are not secret; any browser can discover
                # them by trying.
                "cors_origins": Config.CORS_ORIGINS,
                "cors_origin_regex": Config.CORS_ORIGIN_REGEX or None,
                # "smtp" on a free host means signup email cannot work: those
                # ports are blocked there. Surfaced so that is visible without
                # having to fail a registration to find out.
                "mail_provider": Config.mail_provider(),
            }
        )

    # ---- Generic error handlers ----
    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(_):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(413)
    def payload_too_large(_):
        return jsonify({"error": "Request body is too large"}), 413

    @app.errorhandler(500)
    def server_error(_):
        return jsonify({"error": "Internal server error"}), 500

    return app


# Module-level app so "gunicorn app:app" also works
app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)

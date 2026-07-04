"""
app.py
------
Application factory and entry point for the YT Chat GenAI backend.

Run locally:
    python app.py
Run in production:
    gunicorn "app:create_app()" -b 0.0.0.0:5000
"""

from flask import Flask, jsonify
from flask_cors import CORS

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

    # Warn about missing secrets and connect to MongoDB up front
    Config.validate()
    init_db()

    # Cross-Origin Resource Sharing for the React frontend
    CORS(
        app,
        resources={r"/api/*": {"origins": Config.CORS_ORIGINS}},
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
        return jsonify(
            {
                "status": "ok",
                "service": "YT Chat GenAI API",
                "model": Config.GEMINI_MODEL,
            }
        )

    # ---- Generic error handlers ----
    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(_):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def server_error(_):
        return jsonify({"error": "Internal server error"}), 500

    return app


# Module-level app so "gunicorn app:app" also works
app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)

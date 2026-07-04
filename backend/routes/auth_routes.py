"""
routes/auth_routes.py
---------------------
Registration, login and "who am I" endpoints using JWT authentication.
"""

import re

from flask import Blueprint, request, jsonify, g
from pymongo.errors import DuplicateKeyError

from models import user as user_model
from utils.auth import generate_token, token_required

auth_bp = Blueprint("auth", __name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    # ---- Validation ----
    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required"}), 400
    if not _EMAIL_RE.match(email):
        return jsonify({"error": "Please provide a valid email address"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    try:
        if user_model.find_by_email(email):
            return jsonify({"error": "An account with this email already exists"}), 409

        user = user_model.create_user(name, email, password)
        token = generate_token(user["_id"])
        return (
            jsonify(
                {
                    "message": "Registration successful",
                    "token": token,
                    "user": user_model.serialize_user(user),
                }
            ),
            201,
        )
    except DuplicateKeyError:
        return jsonify({"error": "An account with this email already exists"}), 409
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": f"Registration failed: {exc}"}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        user = user_model.find_by_email(email)
        if not user or not user_model.verify_password(user, password):
            return jsonify({"error": "Invalid email or password"}), 401

        token = generate_token(user["_id"])
        return jsonify(
            {
                "message": "Login successful",
                "token": token,
                "user": user_model.serialize_user(user),
            }
        )
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": f"Login failed: {exc}"}), 500


@auth_bp.route("/me", methods=["GET"])
@token_required
def me():
    user = user_model.find_by_id(g.user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user_model.serialize_user(user)})

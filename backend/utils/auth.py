"""
utils/auth.py
-------------
JWT helpers and a `@token_required` decorator used to protect routes.
"""

import datetime
from functools import wraps

import jwt
from flask import request, jsonify, g

from config import Config


def generate_token(user_id: str) -> str:
    """Create a signed JWT for the given user id."""
    payload = {
        "user_id": str(user_id),
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow()
        + datetime.timedelta(hours=Config.JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    """Decode and verify a JWT. Raises on invalid/expired tokens."""
    return jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])


def token_required(fn):
    """
    Decorator that rejects requests without a valid `Authorization: Bearer`
    header. On success it stores the user id in flask's `g.user_id`.
    """

    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization token is missing"}), 401

        token = auth_header.split(" ", 1)[1].strip()

        try:
            payload = decode_token(token)
            g.user_id = payload["user_id"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired, please log in again"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid authentication token"}), 401

        return fn(*args, **kwargs)

    return wrapper

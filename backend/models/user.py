"""
models/user.py
--------------
Data-access layer for the `users` collection.

Schema:
    {
        _id: ObjectId,
        name: str,
        email: str (unique, lowercase),
        password: str (hashed),
        created_at: datetime
    }
"""

from datetime import datetime

from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash

from extensions import get_db


def _users():
    db = get_db()
    if db is None:
        raise RuntimeError("Database is not available")
    return db.users


def create_user(name: str, email: str, password: str) -> dict:
    """Insert a new user with a securely hashed password."""
    user = {
        "name": name.strip(),
        "email": email.strip().lower(),
        "password": generate_password_hash(password),
        "created_at": datetime.utcnow(),
    }
    result = _users().insert_one(user)
    user["_id"] = result.inserted_id
    return user


def find_by_email(email: str):
    return _users().find_one({"email": email.strip().lower()})


def find_by_id(user_id: str):
    try:
        return _users().find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None


def verify_password(user: dict, password: str) -> bool:
    """Check a plaintext password against the stored hash."""
    return check_password_hash(user.get("password", ""), password)


def serialize_user(user: dict) -> dict:
    """Return a JSON-safe user object without the password hash."""
    if not user:
        return {}
    return {
        "id": str(user["_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "created_at": user.get("created_at").isoformat()
        if user.get("created_at")
        else None,
    }

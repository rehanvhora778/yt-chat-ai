"""
models/user.py
--------------
Data-access layer for the `users` collection.

Schema:
    {
        _id: ObjectId,
        name: str,
        email: str (unique, lowercase),
        password: str (hashed)   - absent for Google-only accounts,
        google_id: str           - absent for password-only accounts,
        avatar: str              - Google profile picture, if any,
        email_verified: bool,
        created_at: datetime
    }

An account can hold both credentials at once: signing in with Google using the
address of an existing password account links the two rather than colliding on
the unique email index, and from then on either route signs the same person in.
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


def create_verified_user(name: str, email: str, password_hash: str) -> dict:
    """
    Insert a user whose password is ALREADY hashed and whose email has been
    proven by an OTP. Used by the two-step signup, where the hash is produced at
    /register time so the plaintext never reaches the otps collection.
    """
    user = {
        "name": name.strip(),
        "email": email.strip().lower(),
        "password": password_hash,
        "email_verified": True,
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
    """
    Check a plaintext password against the stored hash.

    Google-only accounts have no hash at all, and werkzeug raises on a malformed
    one rather than returning False — so guard first and let the caller turn a
    False into "use Google instead".
    """
    stored = user.get("password") or ""
    if not stored:
        return False
    try:
        return check_password_hash(stored, password)
    except (ValueError, TypeError):
        return False


def has_password(user: dict) -> bool:
    """True when this account can be signed into with a password."""
    return bool(user and user.get("password"))


def auth_providers(user: dict) -> list:
    """
    How this account can sign in, derived from what it actually holds.

    Derived rather than stored so accounts created before Google sign-in
    existed report correctly without a migration.
    """
    if not user:
        return []
    providers = []
    if user.get("password"):
        providers.append("password")
    if user.get("google_id"):
        providers.append("google")
    return providers


def find_by_google_id(google_id: str):
    return _users().find_one({"google_id": google_id})


def create_google_user(name: str, email: str, google_id: str, avatar: str = "") -> dict:
    """
    Insert an account proven by Google. No password is stored: there is nothing
    to store, and a placeholder hash would be a credential nobody chose.

    email_verified is True because Google only issues a token for an address it
    has confirmed — which is the same guarantee the OTP flow provides, so these
    signups skip it.
    """
    user = {
        "name": name.strip(),
        "email": email.strip().lower(),
        "google_id": google_id,
        "avatar": avatar or "",
        "email_verified": True,
        "created_at": datetime.utcnow(),
    }
    result = _users().insert_one(user)
    user["_id"] = result.inserted_id
    return user


def link_google_account(user_id, google_id: str, avatar: str = "") -> dict:
    """
    Attach a Google identity to an existing account and return it updated.

    The existing name is deliberately left alone — the person chose it here,
    and Google's display name should not silently overwrite it. An avatar is
    only filled in when there is not one already.
    """
    updates = {"google_id": google_id, "email_verified": True}
    user = _users().find_one({"_id": ObjectId(str(user_id))})
    if avatar and not (user or {}).get("avatar"):
        updates["avatar"] = avatar
    _users().update_one({"_id": ObjectId(str(user_id))}, {"$set": updates})
    return _users().find_one({"_id": ObjectId(str(user_id))})


def serialize_user(user: dict) -> dict:
    """Return a JSON-safe user object without the password hash."""
    if not user:
        return {}
    return {
        "id": str(user["_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "avatar": user.get("avatar") or "",
        # Lets the UI say "you signed up with Google" and hide password
        # controls for an account that has no password to change.
        "auth_providers": auth_providers(user),
        "email_verified": bool(user.get("email_verified")),
        "created_at": user.get("created_at").isoformat()
        if user.get("created_at")
        else None,
    }

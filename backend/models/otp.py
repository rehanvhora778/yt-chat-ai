"""
models/otp.py
-------------
Data-access layer for the `otps` collection: short-lived one-time codes that
verify a user owns an email address before their account is created.

Schema:
    {
        _id: ObjectId,
        email: str (lowercase),
        purpose: "register" | "login",
        code_hash: str,          # HMAC-SHA256, never the code itself
        payload: dict | None,    # pending signup (name + already-hashed password)
        attempts: int,           # wrong guesses so far
        expires_at: datetime,    # TTL index drops the doc after this
        created_at: datetime,
        consumed_at: datetime | None,
    }

The plaintext code is returned to the caller once, at creation, so it can be
emailed — it is never persisted and cannot be read back.
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from config import Config
from extensions import get_db


def _otps():
    db = get_db()
    if db is None:
        raise RuntimeError("Database is not available")
    return db.otps


def _hash_code(email: str, purpose: str, code: str) -> str:
    """
    HMAC the code with the app secret. Binding the email + purpose into the
    message means a code issued for one address/flow can never validate another.
    """
    message = f"{email.strip().lower()}:{purpose}:{code}".encode("utf-8")
    return hmac.new(
        Config.SECRET_KEY.encode("utf-8"), message, hashlib.sha256
    ).hexdigest()


def _generate_code() -> str:
    """Cryptographically random numeric code, zero-padded to OTP_LENGTH."""
    upper = 10 ** Config.OTP_LENGTH
    return str(secrets.randbelow(upper)).zfill(Config.OTP_LENGTH)


def recent_send_count(email: str, purpose: str, within_minutes: int = 60) -> int:
    """How many codes we've sent this address recently (abuse throttle)."""
    since = datetime.utcnow() - timedelta(minutes=within_minutes)
    return _otps().count_documents(
        {
            "email": email.strip().lower(),
            "purpose": purpose,
            "created_at": {"$gte": since},
        }
    )


def seconds_since_last_send(email: str, purpose: str):
    """Seconds since the most recent code, or None if there isn't one."""
    last = _otps().find_one(
        {"email": email.strip().lower(), "purpose": purpose},
        sort=[("created_at", -1)],
    )
    if not last or not last.get("created_at"):
        return None
    return (datetime.utcnow() - last["created_at"]).total_seconds()


def create_otp(email: str, purpose: str, payload: dict = None) -> str:
    """
    Issue a new code, invalidating any outstanding one for this email+purpose
    so only the newest code can be used. Returns the PLAINTEXT code to email.
    """
    email = email.strip().lower()
    now = datetime.utcnow()

    # Retire older codes for this flow — a resend must supersede its predecessor.
    # Mark them rather than delete: recent_send_count() counts these rows, so
    # deleting would silently defeat the per-hour abuse throttle.
    _otps().update_many(
        {"email": email, "purpose": purpose, "consumed_at": None},
        {"$set": {"consumed_at": now, "superseded": True}},
    )

    code = _generate_code()
    _otps().insert_one(
        {
            "email": email,
            "purpose": purpose,
            "code_hash": _hash_code(email, purpose, code),
            "payload": payload,
            "attempts": 0,
            "created_at": now,
            # When the CODE stops working.
            "expires_at": now + timedelta(minutes=Config.OTP_TTL_MINUTES),
            # When the ROW is dropped (TTL index). Deliberately longer than the
            # code's life so the send throttle has a full hour of history.
            "purge_at": now + timedelta(hours=1),
            "consumed_at": None,
        }
    )
    return code


class OtpError(Exception):
    """Verification failed; `message` is safe to show the user."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def verify_otp(email: str, purpose: str, code: str) -> dict:
    """
    Check a submitted code. On success the record is consumed (single use) and
    its stored payload returned. Raises OtpError otherwise.
    """
    email = email.strip().lower()
    code = (code or "").strip()

    record = _otps().find_one(
        {"email": email, "purpose": purpose, "consumed_at": None},
        sort=[("created_at", -1)],
    )
    if not record:
        raise OtpError("No verification code is pending. Please request a new one.")

    now = datetime.utcnow()
    if record["expires_at"] < now:
        _otps().update_one({"_id": record["_id"]}, {"$set": {"consumed_at": now}})
        raise OtpError("That code has expired. Please request a new one.")

    if record.get("attempts", 0) >= Config.OTP_MAX_ATTEMPTS:
        _otps().update_one({"_id": record["_id"]}, {"$set": {"consumed_at": now}})
        raise OtpError("Too many incorrect attempts. Please request a new code.", 429)

    # compare_digest keeps the check constant-time.
    if not hmac.compare_digest(record["code_hash"], _hash_code(email, purpose, code)):
        _otps().update_one({"_id": record["_id"]}, {"$inc": {"attempts": 1}})
        remaining = Config.OTP_MAX_ATTEMPTS - (record.get("attempts", 0) + 1)
        if remaining > 0:
            raise OtpError(
                f"That code is incorrect. {remaining} attempt"
                f"{'s' if remaining != 1 else ''} left."
            )
        raise OtpError("Too many incorrect attempts. Please request a new code.", 429)

    _otps().update_one(
        {"_id": record["_id"]}, {"$set": {"consumed_at": datetime.utcnow()}}
    )
    return record.get("payload") or {}


def pending_payload(email: str, purpose: str):
    """
    The details captured when the code was first issued, so a resend can mint a
    fresh code without asking for the signup form again. None if nothing pends.
    """
    record = _otps().find_one(
        {"email": email.strip().lower(), "purpose": purpose, "payload": {"$ne": None}},
        sort=[("created_at", -1)],
    )
    return (record or {}).get("payload")


def clear_for(email: str, purpose: str = None):
    """Drop pending codes for an address (e.g. once the account exists)."""
    query = {"email": email.strip().lower()}
    if purpose:
        query["purpose"] = purpose
    _otps().delete_many(query)

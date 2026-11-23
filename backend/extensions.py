"""
extensions.py
-------------
Holds shared singletons (the MongoDB connection) so they can be imported by
models and routes without creating circular imports.
"""

import threading
import time

from pymongo import MongoClient, ASCENDING
from pymongo.errors import PyMongoError

from config import Config

# Module level singletons
_client = None
_db = None

# After a failed connection attempt, wait this long before trying again.
# Without it, every request during an outage blocks for the full server
# selection timeout before failing, so the whole site feels hung instead of
# answering "try again shortly" at once.
_RETRY_COOLDOWN_SECONDS = 15
_last_failure_at = 0.0
_last_error = ""
# Exception class only - safe to show on the public health endpoint, unlike the
# full message, which names the cluster host.
_last_error_kind = ""
_lock = threading.Lock()

# What users see. The real cause goes to the log, never to the browser: a raw
# driver error leaks the cluster hostname and means nothing to a visitor.
DB_UNAVAILABLE_MESSAGE = (
    "The service can't reach its database right now. Please try again in a minute."
)


class DatabaseUnavailable(RuntimeError):
    """Raised by the models when MongoDB cannot be reached.

    Subclasses RuntimeError so every route that already maps RuntimeError to a
    503 keeps working unchanged.
    """

    def __init__(self, message: str = DB_UNAVAILABLE_MESSAGE):
        super().__init__(message)


def init_db():
    """
    Create the MongoDB client/connection (only once) and ensure indexes.
    Returns the database handle. Safe to call multiple times.
    """
    global _last_error_kind

    if _db is not None:
        return _db

    if not Config.MONGO_URI:
        _last_error_kind = "MONGO_URI is not set"
        print("[db] MONGO_URI is not set - database features disabled.")
        return None

    with _lock:
        # Another thread may have connected while this one waited.
        if _db is not None:
            return _db
        if time.monotonic() - _last_failure_at < _RETRY_COOLDOWN_SECONDS:
            return None
        return _connect()


def _connect():
    global _client, _db, _last_failure_at, _last_error, _last_error_kind
    try:
        _client = MongoClient(
            Config.MONGO_URI,
            serverSelectionTimeoutMS=8000,
            connectTimeoutMS=8000,
            retryWrites=True,
        )
        # Force a round-trip so we fail fast if the URI is wrong
        _client.admin.command("ping")
        _db = _client[Config.MONGO_DB_NAME]

        # Indexes -------------------------------------------------------
        _db.users.create_index([("email", ASCENDING)], unique=True)
        # Sparse: only documents that actually have a google_id are indexed.
        # A plain unique index would treat every password-only account as
        # holding the same missing value and reject all but the first.
        _db.users.create_index(
            [("google_id", ASCENDING)], unique=True, sparse=True
        )
        _db.videos.create_index([("video_id", ASCENDING)], unique=True)
        # OTPs: compound lookup, plus a TTL index so expired codes are
        # reaped by MongoDB itself rather than lingering as stale secrets.
        _db.otps.create_index([("email", ASCENDING), ("purpose", ASCENDING)])
        _db.otps.create_index("purge_at", expireAfterSeconds=0)
        _db.chats.create_index([("user_id", ASCENDING)])
        _db.chats.create_index([("video_id", ASCENDING)])
        # Upgrade collections
        _db.history.create_index(
            [("user_id", ASCENDING), ("video_id", ASCENDING)], unique=True
        )
        _db.analytics.create_index([("user_id", ASCENDING)])

        _last_error = _last_error_kind = ""
        _last_failure_at = 0.0
        print(f"[db] Connected to MongoDB database '{Config.MONGO_DB_NAME}'.")
        return _db
    except PyMongoError as exc:
        # The SRV lookup failing ("DNS query name does not exist") means the
        # Atlas cluster in MONGO_URI no longer exists - deleted, or the URI was
        # mistyped. A timeout usually means Atlas Network Access does not allow
        # 0.0.0.0/0, which Render needs because its outbound IPs are not fixed.
        _last_error_kind = exc.__class__.__name__
        _last_error = f"{_last_error_kind}: {exc}"
        _last_failure_at = time.monotonic()
        print(f"[db] Could not connect to MongoDB: {_last_error}")
        if _client is not None:
            _client.close()
        _client = None
        _db = None
        return None


def get_db():
    """Return the active database handle, initialising it if needed."""
    if _db is None:
        return init_db()
    return _db


def require_db():
    """Like get_db(), but raises DatabaseUnavailable instead of returning None."""
    db = get_db()
    if db is None:
        raise DatabaseUnavailable()
    return db


def db_status() -> dict:
    """Live database state for the health check: pings, never raises."""
    db = get_db()
    if db is None:
        return {"database": "unavailable", "database_error": _last_error_kind or None}
    try:
        db.client.admin.command("ping")
        return {"database": "connected", "database_error": None}
    except PyMongoError as exc:
        print(f"[db] Health ping failed: {exc}")
        return {"database": "unavailable", "database_error": exc.__class__.__name__}

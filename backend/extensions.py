"""
extensions.py
-------------
Holds shared singletons (the MongoDB connection) so they can be imported by
models and routes without creating circular imports.
"""

from pymongo import MongoClient, ASCENDING
from pymongo.errors import PyMongoError

from config import Config

# Module level singletons
_client = None
_db = None


def init_db():
    """
    Create the MongoDB client/connection (only once) and ensure indexes.
    Returns the database handle. Safe to call multiple times.
    """
    global _client, _db

    if _db is not None:
        return _db

    if not Config.MONGO_URI:
        print("[db] MONGO_URI is not set - database features disabled.")
        return None

    try:
        _client = MongoClient(Config.MONGO_URI, serverSelectionTimeoutMS=8000)
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

        print(f"[db] Connected to MongoDB database '{Config.MONGO_DB_NAME}'.")
        return _db
    except PyMongoError as exc:
        print(f"[db] Could not connect to MongoDB: {exc}")
        _db = None
        return None


def get_db():
    """Return the active database handle, initialising it if needed."""
    if _db is None:
        return init_db()
    return _db

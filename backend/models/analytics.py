"""
models/analytics.py
--------------------
`analytics` collection — one event per AI call, used to compute the analytics
dashboard (tokens used, average response time, daily usage).

Schema:
    { user_id, type, tokens, response_time_ms, video_id, timestamp }
"""

from datetime import datetime

from extensions import get_db


def _col():
    db = get_db()
    if db is None:
        raise RuntimeError("Database is not available")
    return db.analytics


def record_event(
    user_id: str,
    event_type: str,
    tokens: int = 0,
    response_time_ms: int = 0,
    video_id: str = None,
):
    """Record a usage event. Never raises — analytics must not break a request."""
    try:
        _col().insert_one(
            {
                "user_id": user_id,
                "type": event_type,
                "tokens": int(tokens or 0),
                "response_time_ms": int(response_time_ms or 0),
                "video_id": video_id,
                "timestamp": datetime.utcnow(),
            }
        )
    except Exception:
        pass


def events_for(user_id: str):
    return list(_col().find({"user_id": user_id}))

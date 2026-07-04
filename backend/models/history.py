"""
models/history.py
-----------------
`history` collection — one entry per (user, processed video). Powers the
advanced History page and the "Videos Processed" analytics metric.

Schema:
    { user_id, video_id, title, thumbnail, url, author, source,
      processed_at, last_opened }
"""

from datetime import datetime

from extensions import get_db


def _col():
    db = get_db()
    if db is None:
        raise RuntimeError("Database is not available")
    return db.history


def record_processed(user_id: str, video: dict, source: str = "captions"):
    """Upsert a processed-video history entry for a user."""
    now = datetime.utcnow()
    _col().update_one(
        {"user_id": user_id, "video_id": video["video_id"]},
        {
            "$set": {
                "user_id": user_id,
                "video_id": video["video_id"],
                "title": video.get("title"),
                "thumbnail": video.get("thumbnail"),
                "url": video.get("url"),
                "author": video.get("author"),
                "source": source,
                "last_opened": now,
            },
            "$setOnInsert": {"processed_at": now},
        },
        upsert=True,
    )


def list_history(user_id: str):
    return list(_col().find({"user_id": user_id}).sort("processed_at", -1))


def delete_history(user_id: str, video_id: str = None) -> int:
    query = {"user_id": user_id}
    if video_id:
        query["video_id"] = video_id
    return _col().delete_many(query).deleted_count


def count_videos(user_id: str) -> int:
    return _col().count_documents({"user_id": user_id})


def serialize(h: dict) -> dict:
    if not h:
        return {}
    return {
        "video_id": h.get("video_id"),
        "title": h.get("title"),
        "thumbnail": h.get("thumbnail"),
        "url": h.get("url"),
        "author": h.get("author"),
        "source": h.get("source", "captions"),
        "processed_at": h.get("processed_at").isoformat()
        if h.get("processed_at")
        else None,
    }

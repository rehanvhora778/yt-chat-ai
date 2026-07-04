"""
models/video.py
---------------
Data-access layer for the `videos` collection. Videos are de-duplicated by
their YouTube `video_id` so the transcript / FAISS index is only built once
and then shared between users.

Schema:
    {
        _id: ObjectId,
        video_id: str (unique YouTube id),
        title: str,
        url: str,
        author: str,
        thumbnail: str,
        language: str,
        transcript: str,            # full plain-text transcript
        segments: [ {text, start, duration}, ... ],
        created_at: datetime
    }
"""

from datetime import datetime

from bson import ObjectId

from extensions import get_db


def _videos():
    db = get_db()
    if db is None:
        raise RuntimeError("Database is not available")
    return db.videos


def find_by_video_id(video_id: str):
    return _videos().find_one({"video_id": video_id})


def find_by_id(_id: str):
    try:
        return _videos().find_one({"_id": ObjectId(_id)})
    except Exception:
        return None


def upsert_video(data: dict) -> dict:
    """
    Insert the video if it does not exist yet, otherwise update its metadata.
    Returns the stored document.
    """
    video_id = data["video_id"]
    data["created_at"] = data.get("created_at", datetime.utcnow())

    _videos().update_one(
        {"video_id": video_id},
        {"$set": data},
        upsert=True,
    )
    return find_by_video_id(video_id)


def serialize_video(video: dict, include_transcript: bool = False) -> dict:
    """Return a JSON-safe video object."""
    if not video:
        return {}
    out = {
        "id": str(video["_id"]),
        "video_id": video.get("video_id"),
        "title": video.get("title"),
        "url": video.get("url"),
        "author": video.get("author"),
        "thumbnail": video.get("thumbnail"),
        "language": video.get("language"),
        "created_at": video.get("created_at").isoformat()
        if video.get("created_at")
        else None,
    }
    if include_transcript:
        out["transcript"] = video.get("transcript", "")
        out["segments"] = video.get("segments", [])
    return out

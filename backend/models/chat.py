"""
models/chat.py
--------------
Data-access layer for the `chats` collection (one document per Q&A turn).

Schema:
    {
        _id: ObjectId,
        user_id: str,
        video_id: str,           # YouTube id
        video_title: str,
        question: str,
        answer: str,
        language: str,
        timestamp: datetime
    }
"""

from datetime import datetime

from bson import ObjectId

from extensions import get_db


def _chats():
    db = get_db()
    if db is None:
        raise RuntimeError("Database is not available")
    return db.chats


def add_chat(
    user_id: str,
    video_id: str,
    video_title: str,
    question: str,
    answer: str,
    language: str = "en",
) -> dict:
    doc = {
        "user_id": user_id,
        "video_id": video_id,
        "video_title": video_title,
        "question": question,
        "answer": answer,
        "language": language,
        "timestamp": datetime.utcnow(),
    }
    result = _chats().insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def get_history(user_id: str, video_id: str = None, limit: int = 200):
    """Return chats for a user (optionally filtered by video), newest last."""
    query = {"user_id": user_id}
    if video_id:
        query["video_id"] = video_id
    cursor = _chats().find(query).sort("timestamp", 1).limit(limit)
    return list(cursor)


def get_recent_turns(user_id: str, video_id: str, limit: int = 6):
    """Return the most recent turns for a video to use as conversation memory."""
    cursor = (
        _chats()
        .find({"user_id": user_id, "video_id": video_id})
        .sort("timestamp", -1)
        .limit(limit)
    )
    return list(reversed(list(cursor)))


def delete_history(user_id: str, video_id: str = None) -> int:
    query = {"user_id": user_id}
    if video_id:
        query["video_id"] = video_id
    result = _chats().delete_many(query)
    return result.deleted_count


def delete_one(user_id: str, chat_id: str) -> int:
    try:
        result = _chats().delete_one(
            {"_id": ObjectId(chat_id), "user_id": user_id}
        )
        return result.deleted_count
    except Exception:
        return 0


def serialize_chat(chat: dict) -> dict:
    if not chat:
        return {}
    return {
        "id": str(chat["_id"]),
        "user_id": chat.get("user_id"),
        "video_id": chat.get("video_id"),
        "video_title": chat.get("video_title"),
        "question": chat.get("question"),
        "answer": chat.get("answer"),
        "language": chat.get("language", "en"),
        "timestamp": chat.get("timestamp").isoformat()
        if chat.get("timestamp")
        else None,
    }

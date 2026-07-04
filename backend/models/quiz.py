"""
models/quiz.py
--------------
Data-access layer for the `quizzes` collection. One document per generated
quiz; the correct answers live ONLY here (never sent to the client before
submission), so grading is done server-side.

Schema:
    {
        _id: ObjectId,
        user_id: str,
        video_id: str,           # YouTube id
        video_title: str,
        language: str,           # "en" | "hi"
        difficulty: str,         # "easy" | "medium" | "hard"
        questions: [ {question, options: [4], correct_index, explanation} ],
        answers: [int|None],     # user's picks, set on submit
        score: int,              # correct count, set on submit
        status: str,             # "pending" | "completed"
        created_at: datetime,
        completed_at: datetime | None
    }
"""

from datetime import datetime

from bson import ObjectId

from extensions import get_db


def _quizzes():
    db = get_db()
    if db is None:
        raise RuntimeError("Database is not available")
    return db.quizzes


def create_quiz(
    user_id: str,
    video_id: str,
    video_title: str,
    questions: list,
    language: str = "en",
    difficulty: str = "medium",
) -> dict:
    doc = {
        "user_id": user_id,
        "video_id": video_id,
        "video_title": video_title,
        "language": language,
        "difficulty": difficulty,
        "questions": questions,
        "answers": None,
        "score": 0,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "completed_at": None,
    }
    result = _quizzes().insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def find_by_id(user_id: str, quiz_id: str) -> dict | None:
    try:
        return _quizzes().find_one({"_id": ObjectId(quiz_id), "user_id": user_id})
    except Exception:
        return None


def save_result(user_id: str, quiz_id: str, answers: list, score: int) -> dict | None:
    """Store the user's answers + score and mark the quiz completed."""
    try:
        return _quizzes().find_one_and_update(
            {"_id": ObjectId(quiz_id), "user_id": user_id},
            {
                "$set": {
                    "answers": answers,
                    "score": int(score),
                    "status": "completed",
                    "completed_at": datetime.utcnow(),
                }
            },
            return_document=True,
        )
    except Exception:
        return None


def get_attempts(user_id: str, video_id: str = None, limit: int = 50):
    """Completed quiz attempts, newest first (optionally for one video)."""
    query = {"user_id": user_id, "status": "completed"}
    if video_id:
        query["video_id"] = video_id
    cursor = _quizzes().find(query).sort("completed_at", -1).limit(limit)
    return list(cursor)


def serialize_quiz(quiz: dict, include_answers: bool = False) -> dict:
    """
    Serialize a quiz. correct_index / explanation are stripped unless
    include_answers=True (i.e. only after the quiz was submitted).
    """
    if not quiz:
        return {}
    questions = []
    for q in quiz.get("questions", []):
        item = {"question": q.get("question"), "options": q.get("options", [])}
        if include_answers:
            item["correct_index"] = q.get("correct_index")
            item["explanation"] = q.get("explanation", "")
        questions.append(item)
    return {
        "id": str(quiz["_id"]),
        "video_id": quiz.get("video_id"),
        "video_title": quiz.get("video_title"),
        "language": quiz.get("language", "en"),
        "difficulty": quiz.get("difficulty", "medium"),
        "questions": questions,
        "total": len(questions),
        "answers": quiz.get("answers"),
        "score": quiz.get("score", 0),
        "status": quiz.get("status", "pending"),
        "created_at": quiz["created_at"].isoformat() if quiz.get("created_at") else None,
        "completed_at": quiz["completed_at"].isoformat() if quiz.get("completed_at") else None,
    }

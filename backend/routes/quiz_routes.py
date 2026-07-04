"""
routes/quiz_routes.py
---------------------
AI Quiz feature: generate multiple-choice questions from a processed video's
transcript, grade submissions server-side (the correct answers never leave the
backend before submission), and list past attempts.
"""

import time

from flask import Blueprint, request, jsonify, g

from models import quiz as quiz_model
from models import video as video_model
from models import analytics as analytics_model
from services import llm_service
from utils.auth import token_required

quiz_bp = Blueprint("quiz", __name__)


@quiz_bp.route("/quiz/generate", methods=["POST"])
@token_required
def generate_quiz():
    """
    Generate a quiz for a processed video.
    Body: { "video_id": "...", "language": "en"|"hi",
            "num_questions": 5|8|10, "difficulty": "easy"|"medium"|"hard" }
    Returns the quiz WITHOUT correct answers; grading happens on /quiz/submit.
    """
    data = request.get_json(silent=True) or {}
    video_id = (data.get("video_id") or "").strip()
    language = (data.get("language") or "en").lower()
    num_questions = data.get("num_questions", 8)
    difficulty = (data.get("difficulty") or "medium").lower()

    if not video_id:
        return jsonify({"error": "video_id is required"}), 400

    video = video_model.find_by_video_id(video_id)
    if not video:
        return jsonify({"error": "Video not found. Process it first."}), 404

    try:
        started = time.time()
        questions, usage = llm_service.generate_quiz(
            video["transcript"],
            language=language,
            num_questions=num_questions,
            difficulty=difficulty,
        )
        response_time_ms = int((time.time() - started) * 1000)

        if not questions:
            return (
                jsonify({"error": "Could not generate questions for this video. Try again."}),
                502,
            )

        quiz_doc = quiz_model.create_quiz(
            user_id=g.user_id,
            video_id=video_id,
            video_title=video.get("title", ""),
            questions=questions,
            language=language,
            difficulty=difficulty,
        )

        analytics_model.record_event(
            g.user_id,
            "quiz",
            tokens=usage.get("total_tokens", 0),
            response_time_ms=response_time_ms,
            video_id=video_id,
        )

        return jsonify({"quiz": quiz_model.serialize_quiz(quiz_doc)})
    except Exception as exc:
        return jsonify({"error": f"Failed to generate quiz: {exc}"}), 500


@quiz_bp.route("/quiz/submit", methods=["POST"])
@token_required
def submit_quiz():
    """
    Grade a quiz server-side.
    Body: { "quiz_id": "...", "answers": [0, 2, null, ...] }
    Returns the score plus per-question results (correct answer + explanation).
    """
    data = request.get_json(silent=True) or {}
    quiz_id = (data.get("quiz_id") or "").strip()
    answers = data.get("answers")

    if not quiz_id or not isinstance(answers, list):
        return jsonify({"error": "quiz_id and answers are required"}), 400

    quiz = quiz_model.find_by_id(g.user_id, quiz_id)
    if not quiz:
        return jsonify({"error": "Quiz not found"}), 404

    questions = quiz.get("questions", [])
    if len(answers) != len(questions):
        return (
            jsonify({"error": f"Expected {len(questions)} answers, got {len(answers)}"}),
            400,
        )

    # Normalise answers to int or None, then grade
    normalised = []
    for a in answers:
        try:
            normalised.append(int(a) if a is not None else None)
        except (TypeError, ValueError):
            normalised.append(None)

    results = []
    score = 0
    for q, picked in zip(questions, normalised):
        correct = q.get("correct_index", 0)
        is_correct = picked == correct
        if is_correct:
            score += 1
        results.append(
            {
                "question": q.get("question"),
                "options": q.get("options", []),
                "your_answer": picked,
                "correct_index": correct,
                "is_correct": is_correct,
                "explanation": q.get("explanation", ""),
            }
        )

    try:
        quiz_model.save_result(g.user_id, quiz_id, normalised, score)
    except Exception:
        pass  # grading result is still returned even if persistence fails

    total = len(questions)
    return jsonify(
        {
            "score": score,
            "total": total,
            "percentage": round(score * 100 / total) if total else 0,
            "results": results,
        }
    )


@quiz_bp.route("/quiz/attempts", methods=["GET"])
@token_required
def quiz_attempts():
    """Past completed attempts for the user, optionally filtered by ?video_id=."""
    video_id = request.args.get("video_id")
    try:
        attempts = quiz_model.get_attempts(g.user_id, video_id)
        return jsonify(
            {
                "attempts": [
                    quiz_model.serialize_quiz(a, include_answers=True)
                    for a in attempts
                ]
            }
        )
    except Exception as exc:
        return jsonify({"error": f"Failed to load attempts: {exc}"}), 500

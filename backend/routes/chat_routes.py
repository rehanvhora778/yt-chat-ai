"""
routes/chat_routes.py
---------------------
The RAG question/answer endpoint plus chat-history management.
"""

import time

from flask import Blueprint, request, jsonify, g

from models import chat as chat_model
from models import video as video_model
from models import analytics as analytics_model
from services import vector_service, llm_service
from utils.auth import token_required

chat_bp = Blueprint("chat", __name__)


@chat_bp.route("/ask", methods=["POST"])
@token_required
def ask():
    """
    Answer a question about a processed video using semantic retrieval + the
    configured LLM (Groq when GROQ_API_KEY is set, else Gemini).
    Body: { "video_id": "...", "question": "...", "language": "en"|"hi" }
    """
    data = request.get_json(silent=True) or {}
    video_id = (data.get("video_id") or "").strip()
    question = (data.get("question") or "").strip()
    language = (data.get("language") or "en").lower()

    if not video_id or not question:
        return jsonify({"error": "video_id and question are required"}), 400

    video = video_model.find_by_video_id(video_id)
    if not video:
        return jsonify({"error": "Video not found. Process it first."}), 404

    if not vector_service.index_exists(video_id):
        return jsonify({"error": "This video has no search index yet. Reprocess it."}), 409

    try:
        # 1) Retrieve the most relevant transcript chunks to ground the answer.
        chunks = vector_service.similarity_search(video_id, question, k=6)

        # 2) Pull recent conversation memory for this video
        recent = chat_model.get_recent_turns(g.user_id, video_id, limit=4)
        history = [
            {"question": c["question"], "answer": c["answer"]} for c in recent
        ]

        # 3) Generate the grounded answer (returns answer text + token usage)
        started = time.time()
        answer, usage = llm_service.answer_question(
            question, chunks, history=history, language=language
        )
        response_time_ms = int((time.time() - started) * 1000)

        # 4) Persist the turn
        chat_doc = chat_model.add_chat(
            user_id=g.user_id,
            video_id=video_id,
            video_title=video.get("title", ""),
            question=question,
            answer=answer,
            language=language,
        )

        # 5) Record an analytics event (tokens + latency)
        analytics_model.record_event(
            g.user_id,
            "ask",
            tokens=usage.get("total_tokens", 0),
            response_time_ms=response_time_ms,
            video_id=video_id,
        )

        return jsonify(
            {
                "answer": answer,
                "chat": chat_model.serialize_chat(chat_doc),
            }
        )
    except Exception as exc:
        return jsonify({"error": f"Failed to answer question: {exc}"}), 500


@chat_bp.route("/history", methods=["GET"])
@token_required
def history():
    """Return the user's chat history, optionally filtered by ?video_id=."""
    video_id = request.args.get("video_id")
    try:
        chats = chat_model.get_history(g.user_id, video_id)
        return jsonify(
            {"history": [chat_model.serialize_chat(c) for c in chats]}
        )
    except Exception as exc:
        return jsonify({"error": f"Failed to load history: {exc}"}), 500


@chat_bp.route("/history", methods=["DELETE"])
@token_required
def clear_history():
    """
    Delete chat history for the user.
    Optional body/query: video_id (only that video) or chat_id (single turn).
    """
    data = request.get_json(silent=True) or {}
    video_id = data.get("video_id") or request.args.get("video_id")
    chat_id = data.get("chat_id") or request.args.get("chat_id")

    try:
        if chat_id:
            deleted = chat_model.delete_one(g.user_id, chat_id)
        else:
            deleted = chat_model.delete_history(g.user_id, video_id)
        return jsonify({"message": "History cleared", "deleted": deleted})
    except Exception as exc:
        return jsonify({"error": f"Failed to clear history: {exc}"}), 500

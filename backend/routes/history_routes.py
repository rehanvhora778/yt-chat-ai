"""
routes/history_routes.py
------------------------
Advanced History (FEATURE 5) — the list of processed videos for a user, with
chat counts. Merges the `history` collection with any videos that only exist in
the chat log (e.g. processed before this feature was added).
"""

from collections import Counter

from flask import Blueprint, request, jsonify, g

from models import history as history_model, chat as chat_model
from utils.auth import token_required

history_bp = Blueprint("history_adv", __name__)


@history_bp.route("/processed", methods=["GET"])
@token_required
def processed():
    user_id = g.user_id

    # Start from the history collection
    items = {}
    for h in history_model.list_history(user_id):
        items[h["video_id"]] = history_model.serialize(h)

    # Merge in any videos that only appear in the chat log, and count chats
    chats = chat_model.get_history(user_id)
    counts = Counter()
    last_question = {}
    for c in chats:
        vid = c.get("video_id")
        counts[vid] += 1
        last_question[vid] = c.get("question", "")
        if vid not in items:
            ts = c.get("timestamp")
            items[vid] = {
                "video_id": vid,
                "title": c.get("video_title", ""),
                "thumbnail": f"https://img.youtube.com/vi/{vid}/hqdefault.jpg",
                "url": f"https://www.youtube.com/watch?v={vid}",
                "source": "captions",
                "processed_at": ts.isoformat() if ts else None,
            }

    result = []
    for vid, s in items.items():
        s["chat_count"] = counts.get(vid, 0)
        s["questions_asked"] = counts.get(vid, 0)
        s["last_question"] = last_question.get(vid, "")
        result.append(s)

    # Newest first
    result.sort(key=lambda x: x.get("processed_at") or "", reverse=True)
    return jsonify({"history": result})


@history_bp.route("/processed", methods=["DELETE"])
@token_required
def delete_processed():
    data = request.get_json(silent=True) or {}
    video_id = data.get("video_id") or request.args.get("video_id")

    history_model.delete_history(g.user_id, video_id)
    # Also remove the related chats so the card fully disappears
    chat_model.delete_history(g.user_id, video_id)
    return jsonify({"message": "Removed from history"})

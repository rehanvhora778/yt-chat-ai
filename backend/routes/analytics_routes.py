"""
routes/analytics_routes.py
--------------------------
AI Analytics Dashboard (FEATURE 6). Aggregates usage data for the signed-in
user from the chats, history and analytics collections.
"""

import datetime as dt
import re
from collections import Counter

from flask import Blueprint, jsonify, g

from models import (
    chat as chat_model,
    history as history_model,
    analytics as analytics_model,
)
from utils.auth import token_required

analytics_bp = Blueprint("analytics", __name__)

_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "what", "how", "why", "when",
    "where", "who", "which", "this", "that", "these", "those", "of", "to", "in",
    "on", "for", "and", "or", "with", "about", "does", "do", "did", "can", "you",
    "your", "it", "its", "i", "me", "my", "we", "us", "explain", "tell", "give",
    "please", "video", "from", "into", "as", "at", "by", "be", "has", "have",
    "all", "any", "some", "main", "key", "points", "point", "summarize", "list",
}


def _top_keywords(texts, n=8):
    counter = Counter()
    for text in texts:
        for word in re.findall(r"[a-zA-Z]{4,}", (text or "").lower()):
            if word not in _STOPWORDS:
                counter[word] += 1
    return [
        {"topic": w.capitalize(), "count": c} for w, c in counter.most_common(n)
    ]


@analytics_bp.route("/analytics", methods=["GET"])
@token_required
def analytics():
    user_id = g.user_id

    chats = chat_model.get_history(user_id)
    events = analytics_model.events_for(user_id)
    videos_processed = history_model.count_videos(user_id)

    total_chats = len(chats)
    questions_asked = total_chats

    # Average response time (from "ask" events)
    ask_events = [e for e in events if e.get("type") == "ask" and e.get("response_time_ms")]
    avg_response_time = (
        round(sum(e["response_time_ms"] for e in ask_events) / len(ask_events))
        if ask_events
        else 0
    )

    total_tokens = sum(int(e.get("tokens", 0) or 0) for e in events)

    # Daily usage over the last 14 days (from chat timestamps)
    daily = Counter()
    for c in chats:
        ts = c.get("timestamp")
        if ts:
            daily[ts.strftime("%Y-%m-%d")] += 1
    today = dt.datetime.utcnow().date()
    daily_usage = []
    for i in range(13, -1, -1):
        day = today - dt.timedelta(days=i)
        daily_usage.append(
            {
                "date": day.strftime("%b %d"),
                "chats": daily.get(day.strftime("%Y-%m-%d"), 0),
            }
        )

    # Questions per video (top 6)
    per_video = Counter()
    titles = {}
    for c in chats:
        vid = c.get("video_id")
        per_video[vid] += 1
        titles[vid] = c.get("video_title", "") or vid
    questions_per_video = [
        {
            "video": (titles[v][:22] + "…") if len(titles[v]) > 22 else titles[v],
            "questions": n,
        }
        for v, n in per_video.most_common(6)
    ]

    # Most discussed topics (keyword frequency from questions)
    top_topics = _top_keywords([c.get("question", "") for c in chats], n=8)

    # Videos processed if the history collection is empty (older accounts)
    if videos_processed == 0:
        videos_processed = len(per_video)

    return jsonify(
        {
            "totals": {
                "videos_processed": videos_processed,
                "total_chats": total_chats,
                "questions_asked": questions_asked,
                "avg_response_time_ms": avg_response_time,
                "total_tokens": total_tokens,
            },
            "daily_usage": daily_usage,
            "questions_per_video": questions_per_video,
            "top_topics": top_topics,
        }
    )

"""
utils/helpers.py
----------------
Small reusable helpers: extracting a YouTube video id from many URL formats,
fetching public video metadata (title / thumbnail / author) via the oEmbed
endpoint, and formatting seconds into a mm:ss timestamp.
"""

import logging
import re

import requests

# Matches the 11 character video id in the common YouTube URL variants
_YOUTUBE_ID_RE = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|v/|shorts/)|youtube\.com/.*[?&]v=)"
    r"([A-Za-z0-9_-]{11})"
)


def extract_video_id(url: str):
    """
    Return the 11 character YouTube video id from a URL, or None.
    Also accepts a bare video id passed directly.
    """
    if not url:
        return None

    url = url.strip()

    # A bare id was passed
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", url):
        return url

    match = _YOUTUBE_ID_RE.search(url)
    return match.group(1) if match else None


def fetch_video_metadata(video_id: str) -> dict:
    """
    Fetch public metadata (title, author, thumbnail) using YouTube's oEmbed
    endpoint. No API key required. Falls back to sensible defaults on error.
    """
    watch_url = f"https://www.youtube.com/watch?v={video_id}"
    oembed_url = "https://www.youtube.com/oembed"

    meta = {
        "title": "Untitled video",
        "author": "Unknown",
        "thumbnail": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        "url": watch_url,
    }

    try:
        resp = requests.get(
            oembed_url,
            params={"url": watch_url, "format": "json"},
            timeout=10,
        )
        if resp.ok:
            data = resp.json()
            meta["title"] = data.get("title", meta["title"])
            meta["author"] = data.get("author_name", meta["author"])
            meta["thumbnail"] = data.get("thumbnail_url", meta["thumbnail"])
    except requests.RequestException:
        # Keep the defaults; the high quality thumbnail almost always exists
        pass

    return meta


def format_timestamp(seconds: float) -> str:
    """Convert a number of seconds into a H:MM:SS / M:SS timestamp string."""
    seconds = int(seconds or 0)
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def error_response(action: str, exc: Exception, status: int = 500):
    """
    JSON error for a failed request, without leaking internals.

    The full exception and traceback go to the log (call this inside the
    `except` block). The client gets a plain message: our own RuntimeErrors
    (rate limits, quota, configuration) are already written for users, a
    database outage gets the standard 503 text, and anything else becomes
    "<action>. Please try again." instead of a Python exception string.
    """
    from flask import jsonify
    from pymongo.errors import PyMongoError

    from extensions import DB_UNAVAILABLE_MESSAGE, DatabaseUnavailable

    logging.getLogger("api").exception("%s", action)
    if isinstance(exc, (DatabaseUnavailable, PyMongoError)):
        return jsonify({"error": DB_UNAVAILABLE_MESSAGE}), 503
    if isinstance(exc, RuntimeError):
        return jsonify({"error": str(exc)}), 503
    return jsonify({"error": f"{action}. Please try again."}), status

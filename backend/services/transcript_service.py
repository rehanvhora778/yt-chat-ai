"""
services/transcript_service.py
------------------------------
Wraps `youtube-transcript-api` (v1.x) to fetch a transcript for a video.

Robustness notes:
  * YouTube exposes many regional language variants (en-IN, en-GB, hi, ...).
    We match by language *family* (anything starting with "en" / "hi") and
    prefer manually-created transcripts over auto-generated ones.
  * Individual transcripts can occasionally fail to download, so we try the
    available transcripts in priority order and use the first that succeeds.
  * The chosen transcript language does not have to match the user's chat
    language — Gemini always answers in the requested language regardless.
"""

from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)

from utils.helpers import format_timestamp


class TranscriptError(Exception):
    """Raised when a transcript cannot be retrieved."""


def _priority_key(transcript, preferred, other):
    """
    Sort transcripts so the best candidate comes first:
      1. preferred language family, manually created
      2. preferred language family, auto-generated
      3. other language family, manually created
      4. other language family, auto-generated
      5. anything else
    """
    code = (transcript.language_code or "").lower()
    if code.startswith(preferred):
        family = 0
    elif code.startswith(other):
        family = 1
    else:
        family = 2
    generated = 1 if transcript.is_generated else 0
    return (family, generated)


def _raw_to_segments(raw):
    """Normalise raw transcript data into clean {text, start, duration} dicts."""
    segments = []
    for item in raw:
        # v1.x returns dicts via to_raw_data(); be tolerant of objects too
        if isinstance(item, dict):
            text = item.get("text", "")
            start = item.get("start", 0.0)
            duration = item.get("duration", 0.0)
        else:
            text = getattr(item, "text", "")
            start = getattr(item, "start", 0.0)
            duration = getattr(item, "duration", 0.0)
        text = (text or "").replace("\n", " ").strip()
        if text:
            segments.append(
                {"text": text, "start": float(start), "duration": float(duration)}
            )
    return segments


def fetch_transcript(video_id: str, language: str = "en") -> dict:
    """
    Return a dict:
        {
            "language": "<detected language code>",
            "segments": [ {text, start, duration}, ... ],
            "text": "<full transcript>",
            "timestamped_text": "[m:ss] line\\n..."
        }

    Raises TranscriptError on any failure.
    """
    preferred = "hi" if language == "hi" else "en"
    other = "en" if preferred == "hi" else "hi"

    api = YouTubeTranscriptApi()

    # ---- List available transcripts ----
    try:
        transcript_list = api.list(video_id)
    except TranscriptsDisabled:
        raise TranscriptError(
            "This video has no captions/subtitles, so there is no transcript to "
            "read. Please try a video that has captions enabled — most tutorials, "
            "lectures, talks and news videos do."
        )
    except VideoUnavailable:
        raise TranscriptError("This video is unavailable or private.")
    except Exception as exc:
        raise TranscriptError(
            "Could not access this video's transcripts. It may be private, "
            f"age-restricted, or region-locked. ({exc})"
        )

    available = list(transcript_list)
    if not available:
        raise TranscriptError("No transcript is available for this video.")

    # ---- Try transcripts in priority order ----
    ordered = sorted(
        available, key=lambda t: _priority_key(t, preferred, other)
    )

    last_error = None
    chosen = None
    raw = None

    # 1) Direct download
    for transcript in ordered:
        try:
            fetched = transcript.fetch()
            raw = fetched.to_raw_data() if hasattr(fetched, "to_raw_data") else fetched
            if raw:
                chosen = transcript
                break
        except Exception as exc:
            last_error = exc
            continue

    # 2) Fallback: try translating a translatable transcript to the preferred lang
    if raw is None:
        for transcript in ordered:
            try:
                if getattr(transcript, "is_translatable", False):
                    translated = transcript.translate(preferred).fetch()
                    raw = (
                        translated.to_raw_data()
                        if hasattr(translated, "to_raw_data")
                        else translated
                    )
                    if raw:
                        chosen = transcript
                        break
            except Exception as exc:
                last_error = exc
                continue

    if not raw:
        detail = f" ({last_error})" if last_error else ""
        raise TranscriptError(
            "Could not download the transcript for this video. YouTube may be "
            "temporarily blocking the request — please try again or use a "
            f"different video.{detail}"
        )

    segments = _raw_to_segments(raw)
    if not segments:
        raise TranscriptError("The transcript for this video is empty.")

    detected_language = getattr(chosen, "language_code", language)
    full_text = " ".join(s["text"] for s in segments)
    timestamped_text = "\n".join(
        f"[{format_timestamp(s['start'])}] {s['text']}" for s in segments
    )

    return {
        "language": detected_language,
        "segments": segments,
        "text": full_text,
        "timestamped_text": timestamped_text,
    }

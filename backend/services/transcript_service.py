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

import logging
import re
import time

import requests
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
    RequestBlocked,
    IpBlocked,
)
from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig

from config import Config
from utils.helpers import format_timestamp


logger = logging.getLogger("transcript_service")

# Shown to users when YouTube refuses this server. Says what to do next, not
# which environment variables an operator would set.
BLOCKED_MESSAGE = (
    "YouTube is blocking our server from reading this video right now. "
    "You can paste the video's transcript below to continue."
)


class TranscriptError(Exception):
    """Raised when a transcript cannot be retrieved.

    `blocked` is True when YouTube refused this server (as opposed to the video
    genuinely having no transcript), which is when another route is worth trying.
    """

    def __init__(self, message: str, blocked: bool = False):
        super().__init__(message)
        self.blocked = blocked


def _proxy_config():
    """
    Proxy to route YouTube requests through, or None to connect directly.

    Configured through the environment (see Config) because it is only needed
    when deployed: YouTube serves cloud provider IPs a block page, so the same
    video that works locally can fail on Render.
    """
    if Config.YOUTUBE_PROXY_URL:
        return GenericProxyConfig(
            http_url=Config.YOUTUBE_PROXY_URL,
            https_url=Config.YOUTUBE_PROXY_URL,
        )
    if Config.WEBSHARE_PROXY_USERNAME and Config.WEBSHARE_PROXY_PASSWORD:
        return WebshareProxyConfig(
            proxy_username=Config.WEBSHARE_PROXY_USERNAME,
            proxy_password=Config.WEBSHARE_PROXY_PASSWORD,
        )
    return None


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

    api = YouTubeTranscriptApi(proxy_config=_proxy_config())

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
    except (RequestBlocked, IpBlocked) as exc:
        # Almost always a deployment problem rather than a bad video: the
        # host's IP is in a range YouTube refuses to serve. Fix for operators:
        # SUPADATA_API_KEY, or a residential proxy (WEBSHARE_PROXY_*).
        logger.warning("YouTube blocked the caption request for %s: %s",
                       video_id, exc.__class__.__name__)
        raise TranscriptError(BLOCKED_MESSAGE, blocked=True)
    except Exception as exc:
        logger.warning("Caption listing failed for %s: %s", video_id, exc)
        raise TranscriptError(
            "Could not access this video's transcripts. It may be private, "
            "age-restricted, or region-locked.",
            # An unexpected failure from a cloud host is most often a block
            # YouTube did not label as one.
            blocked=True,
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
        logger.warning("Caption download failed for %s: %s", video_id, last_error)
        raise TranscriptError(BLOCKED_MESSAGE, blocked=True)

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


# ---------------------------------------------------------------------------
# Pasted transcripts
# ---------------------------------------------------------------------------
# The fallback for when YouTube blocks the server outright. Captions and audio
# both come from YouTube, so a blocked datacenter IP loses both at once; the
# viewer's own browser is not blocked, and YouTube's "Show transcript" panel
# lets them copy the text. These parse what that copy produces.

MIN_PASTED_CHARS = 200
MAX_PASTED_CHARS = 400_000
# Speaking rate used to estimate timestamps for text pasted without any.
_WORDS_PER_SECOND = 2.5

_TS = r"(?:\d{1,2}:)?\d{1,2}:\d{2}"
_TS_ONLY = re.compile(rf"^\[?({_TS})\]?$")
_TS_PREFIX = re.compile(rf"^\[?({_TS})\]?\s*[-–:]?\s+(.+)$")
# The transcript panel also carries screen-reader labels such as
# "1 minute, 5 seconds" under each timestamp; they are not speech.
_DURATION_LABEL = re.compile(
    r"^(\d+\s+(hours?|minutes?|seconds?),?\s*)+$", re.IGNORECASE
)


def _ts_to_seconds(stamp: str) -> float:
    total = 0
    for part in stamp.split(":"):
        total = total * 60 + int(part)
    return float(total)


def parse_pasted_transcript(text: str, language: str = "en") -> dict:
    """
    Turn a pasted transcript into the same shape fetch_transcript returns.

    Accepts YouTube's panel copy (timestamp on its own line, text below),
    "0:42 text" / "[0:42] text" lines, or plain text with no timestamps at
    all, in which case start times are estimated from word count.
    Raises TranscriptError if the text is too short or too long to be one.
    """
    text = (text or "").strip()
    if len(text) < MIN_PASTED_CHARS:
        raise TranscriptError(
            "That transcript is too short. Paste the full transcript from "
            "YouTube's \"Show transcript\" panel."
        )
    if len(text) > MAX_PASTED_CHARS:
        raise TranscriptError("That transcript is too long (over 400,000 characters).")

    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln and not _DURATION_LABEL.match(ln)]

    segments = []
    pending_start = None
    for line in lines:
        only = _TS_ONLY.match(line)
        if only:
            pending_start = _ts_to_seconds(only.group(1))
            continue
        prefixed = _TS_PREFIX.match(line)
        if prefixed:
            segments.append(
                {"text": prefixed.group(2).strip(),
                 "start": _ts_to_seconds(prefixed.group(1)), "duration": 0.0}
            )
            pending_start = None
        elif pending_start is not None:
            segments.append({"text": line, "start": pending_start, "duration": 0.0})
            pending_start = None
        elif segments:
            # A continuation line with no timestamp of its own.
            segments[-1]["text"] += " " + line
        else:
            segments.append({"text": line, "start": None, "duration": 0.0})

    if not any(seg["start"] is not None for seg in segments):
        # No timestamps anywhere: split into sentences and estimate.
        words_so_far = 0
        sentences = re.split(r"(?<=[.!?])\s+", " ".join(lines))
        segments = []
        for sentence in sentences:
            if sentence.strip():
                segments.append(
                    {"text": sentence.strip(),
                     "start": round(words_so_far / _WORDS_PER_SECOND, 1),
                     "duration": 0.0}
                )
                words_so_far += len(sentence.split())
    else:
        # Leading untimed lines start at zero; durations run to the next start.
        for seg in segments:
            if seg["start"] is None:
                seg["start"] = 0.0
        for current, following in zip(segments, segments[1:]):
            current["duration"] = max(following["start"] - current["start"], 0.0)

    segments = [seg for seg in segments if seg["text"]]
    full_text = " ".join(s["text"] for s in segments)
    return {
        "language": language,
        "segments": segments,
        "text": full_text,
        "timestamped_text": "\n".join(
            f"[{format_timestamp(s['start'])}] {s['text']}" for s in segments
        ),
    }


# ---------------------------------------------------------------------------
# Supadata fallback
# ---------------------------------------------------------------------------
_SUPADATA_URL = "https://api.supadata.ai/v1/transcript"
_SUPADATA_POLL_SECONDS = 90


def supadata_configured() -> bool:
    return bool(Config.SUPADATA_API_KEY)


def fetch_transcript_supadata(video_id: str, language: str = "en") -> dict:
    """
    Fetch existing captions through Supadata, whose requests YouTube does not
    block. `mode=native` only reads captions (1 credit); it never pays for AI
    transcription. Long videos come back as a job id, polled until done.
    Raises TranscriptError.
    """
    headers = {"x-api-key": Config.SUPADATA_API_KEY}
    params = {
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "lang": "hi" if language == "hi" else "en",
        "mode": "native",
        "text": "false",
    }
    try:
        resp = requests.get(_SUPADATA_URL, headers=headers, params=params, timeout=60)
        if resp.status_code == 202:
            job_id = (resp.json() or {}).get("jobId")
            resp = _poll_supadata_job(job_id, headers)
    except (requests.RequestException, ValueError) as exc:
        logger.warning("Supadata request failed for %s: %s", video_id, exc)
        raise TranscriptError(BLOCKED_MESSAGE, blocked=True)

    if resp.status_code == 206:
        raise TranscriptError("This video has no captions to read.")
    if resp.status_code in (403, 404):
        raise TranscriptError("This video is unavailable, private or restricted.")
    if resp.status_code != 200:
        # 401 = bad key, 429 = monthly quota or rate limit, 5xx = their outage.
        # None of it is the user's to fix, so it reads as a block to them.
        logger.warning("Supadata returned %s for %s: %s",
                       resp.status_code, video_id, resp.text[:300])
        raise TranscriptError(BLOCKED_MESSAGE, blocked=True)

    try:
        data = resp.json() or {}
    except ValueError:
        logger.warning("Supadata returned non-JSON for %s", video_id)
        raise TranscriptError(BLOCKED_MESSAGE, blocked=True)
    if data.get("status") == "failed":
        logger.warning("Supadata job failed for %s: %s", video_id, data.get("error"))
        raise TranscriptError(BLOCKED_MESSAGE, blocked=True)

    content = data.get("content") or []
    segments = _raw_to_segments(
        {
            "text": item.get("text", ""),
            # Supadata reports milliseconds; the rest of the app uses seconds.
            "start": (item.get("offset") or 0) / 1000.0,
            "duration": (item.get("duration") or 0) / 1000.0,
        }
        for item in content
        if isinstance(item, dict)
    )
    if not segments:
        raise TranscriptError("This video has no captions to read.")

    return {
        "language": data.get("lang") or language,
        "segments": segments,
        "text": " ".join(s["text"] for s in segments),
        "timestamped_text": "\n".join(
            f"[{format_timestamp(s['start'])}] {s['text']}" for s in segments
        ),
    }


def _poll_supadata_job(job_id, headers):
    """Wait for an async Supadata job and return its final response."""
    if not job_id:
        raise requests.RequestException("Supadata returned 202 without a jobId")
    deadline = time.monotonic() + _SUPADATA_POLL_SECONDS
    while time.monotonic() < deadline:
        time.sleep(1.5)
        resp = requests.get(f"{_SUPADATA_URL}/{job_id}", headers=headers, timeout=30)
        if resp.status_code != 200:
            return resp
        if (resp.json() or {}).get("status") in ("completed", "failed"):
            return resp
    raise requests.RequestException("Supadata job did not finish in time")

"""
services/audio_service.py
-------------------------
Fallback transcription for videos that have NO captions/subtitles.

Pipeline:
    1. Download the audio track with yt-dlp.
    2. Compress it to a small mono mp3 with ffmpeg (adaptive bitrate) so it
       fits inside Gemini's ~20MB inline-request limit.
    3. Send the audio INLINE to gemini generateContent (the File API is not
       used, because some API keys are not authorised for it).
    4. Ask Gemini to transcribe WITH [m:ss] timestamps and parse the result
       into {text, start, duration} segments so the rest of the RAG pipeline
       (chunking / FAISS / retrieval) works unchanged.

Requires: yt-dlp, ffmpeg (system ffmpeg if on PATH, else the bundled
imageio-ffmpeg binary) and a valid GOOGLE_API_KEY.
"""

import os
import re
import shutil
import subprocess
import tempfile
import time

import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted

from config import Config
from utils.helpers import format_timestamp


class AudioTranscriptionError(Exception):
    """Raised when audio download or transcription fails."""


# Don't try to transcribe absurdly long videos (keeps cost/latency sane and
# the compressed audio under the inline-request size limit).
_MAX_DURATION_SECONDS = 60 * 60  # 1 hour
# Target compressed size (raw bytes); base64 inflates this by ~33% and must
# stay comfortably below Gemini's ~20MB inline request limit.
_TARGET_AUDIO_BYTES = 9 * 1024 * 1024
_MAX_AUDIO_BYTES = 16 * 1024 * 1024


def _ffmpeg_path():
    """Return a usable ffmpeg path: system ffmpeg if present, else bundled."""
    system = shutil.which("ffmpeg")
    if system:
        return system
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def _adaptive_bitrate(duration_seconds: float) -> int:
    """Pick an mp3 bitrate (kbps) so the file stays near the target size."""
    if not duration_seconds or duration_seconds <= 0:
        return 48
    kbps = int(_TARGET_AUDIO_BYTES * 8 / duration_seconds / 1000)
    return max(24, min(kbps, 96))


def _download_and_compress(video_id: str, work_dir: str) -> str:
    """
    Download the best audio track, then re-encode to a small mono mp3.
    Returns the path to the compressed mp3.
    """
    import yt_dlp

    url = f"https://www.youtube.com/watch?v={video_id}"
    raw_template = os.path.join(work_dir, "raw.%(ext)s")

    # 1) Probe duration first (so we can reject very long videos early)
    try:
        with yt_dlp.YoutubeDL(
            {"quiet": True, "no_warnings": True, "skip_download": True}
        ) as ydl:
            info = ydl.extract_info(url, download=False)
        duration = info.get("duration") or 0
    except Exception as exc:
        raise AudioTranscriptionError(f"Could not read the video: {exc}")

    if duration and duration > _MAX_DURATION_SECONDS:
        raise AudioTranscriptionError(
            "This video is too long to transcribe from audio "
            f"({int(duration // 60)} min). Try a video under 60 minutes or one "
            "that has captions."
        )

    # 2) Download the raw best audio stream
    try:
        with yt_dlp.YoutubeDL(
            {
                "format": "bestaudio/best",
                "outtmpl": raw_template,
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
            }
        ) as ydl:
            ydl.download([url])
    except Exception as exc:
        raise AudioTranscriptionError(
            f"Could not download the video's audio: {exc}"
        )

    raw_files = [f for f in os.listdir(work_dir) if f.startswith("raw.")]
    if not raw_files:
        raise AudioTranscriptionError("Audio download produced no file.")
    raw_path = os.path.join(work_dir, raw_files[0])

    # 3) Compress to mono mp3 at an adaptive bitrate
    ffmpeg = _ffmpeg_path()
    if not ffmpeg:
        raise AudioTranscriptionError(
            "ffmpeg is required to process audio but was not found."
        )
    out_path = os.path.join(work_dir, "audio.mp3")
    bitrate = _adaptive_bitrate(duration)
    result = subprocess.run(
        [ffmpeg, "-y", "-i", raw_path, "-ac", "1", "-b:a", f"{bitrate}k",
         "-vn", out_path],
        capture_output=True,
    )
    if result.returncode != 0 or not os.path.exists(out_path):
        raise AudioTranscriptionError("Failed to convert the audio with ffmpeg.")

    if os.path.getsize(out_path) > _MAX_AUDIO_BYTES:
        raise AudioTranscriptionError(
            "The video's audio is too large to transcribe. Try a shorter video."
        )

    return out_path


_TRANSCRIBE_PROMPT = (
    "You are a precise speech-to-text transcriber. Transcribe ALL spoken "
    "content in this audio accurately, in the original spoken language. "
    "Split the transcript into short segments (roughly one sentence each). "
    "Prefix EVERY segment with its start time in [m:ss] (or [h:mm:ss]) format "
    "on its own line, for example:\n"
    "[0:00] first sentence\n"
    "[0:06] next sentence\n"
    "Do not add any commentary, headings or summary — output ONLY the "
    "timestamped transcript lines."
)

# Matches "[0:00] text", "[1:02:03] text", "0:00 text"
_LINE_RE = re.compile(r"^\s*\[?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]?\s*(.+?)\s*$")


def _parse_segments(raw: str):
    """Parse Gemini's timestamped transcript into {text, start, duration}."""
    segments = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        m = _LINE_RE.match(line)
        if not m:
            if segments and len(line) > 1:
                segments[-1]["text"] += " " + line
            continue
        hours = int(m.group(1)) if m.group(1) else 0
        minutes = int(m.group(2))
        seconds = int(m.group(3))
        text = m.group(4).strip()
        if not text:
            continue
        start = hours * 3600 + minutes * 60 + seconds
        segments.append({"text": text, "start": float(start), "duration": 0.0})

    for i in range(len(segments) - 1):
        segments[i]["duration"] = max(
            0.0, segments[i + 1]["start"] - segments[i]["start"]
        )
    if segments:
        segments[-1]["duration"] = 3.0
    return segments


def _generate_with_retry(model, parts, generation_config, retries=1):
    """Call generate_content, retrying once if the free-tier rate limit hits."""
    for attempt in range(retries + 1):
        try:
            return model.generate_content(
                parts,
                generation_config=generation_config,
                # Transcribing long audio can take minutes — allow plenty of time
                request_options={"timeout": 600},
            )
        except ResourceExhausted:
            if attempt >= retries:
                raise AudioTranscriptionError(
                    "Gemini's free-tier rate limit was reached. Please wait a "
                    "minute and try again."
                )
            time.sleep(20)


def _transcribe_with_groq(audio_path: str, language: str):
    """
    Transcribe with Groq Whisper (free, high limits). Returns a list of
    {text, start, duration} segments using Whisper's real timestamps.
    """
    from groq import Groq

    client = Groq(api_key=Config.GROQ_API_KEY)
    kwargs = {
        "model": Config.GROQ_WHISPER_MODEL,
        "response_format": "verbose_json",
    }
    if language in ("en", "hi"):
        kwargs["language"] = language

    try:
        with open(audio_path, "rb") as fh:
            result = client.audio.transcriptions.create(
                file=(os.path.basename(audio_path), fh.read()),
                **kwargs,
            )
    except Exception as exc:
        msg = str(exc).lower()
        if any(k in msg for k in ("rate", "quota", "429", "exceeded")):
            raise AudioTranscriptionError(
                "Groq's free-tier rate limit was reached for audio "
                "transcription. Please wait a minute and try again."
            )
        raise AudioTranscriptionError(f"Groq transcription failed: {exc}")

    raw_segments = getattr(result, "segments", None) or []
    segments = []
    for s in raw_segments:
        get = (lambda k, d=None: s.get(k, d)) if isinstance(s, dict) else (
            lambda k, d=None: getattr(s, k, d)
        )
        text = (get("text") or "").strip()
        if not text:
            continue
        start = float(get("start", 0.0) or 0.0)
        end = float(get("end", start) or start)
        segments.append(
            {"text": text, "start": start, "duration": max(0.0, end - start)}
        )

    if not segments:
        full = (getattr(result, "text", "") or "").strip()
        if not full:
            raise AudioTranscriptionError("Groq returned an empty transcription.")
        segments = [{"text": full, "start": 0.0, "duration": 0.0}]
    return segments


def _transcribe_with_gemini(audio_path: str, language: str):
    """Transcribe with Gemini (inline audio). Returns {text,start,duration} segments."""
    with open(audio_path, "rb") as fh:
        audio_bytes = fh.read()

    genai.configure(api_key=Config.GOOGLE_API_KEY)
    model = genai.GenerativeModel(Config.GEMINI_MODEL)

    response = _generate_with_retry(
        model,
        [_TRANSCRIBE_PROMPT, {"mime_type": "audio/mp3", "data": audio_bytes}],
        {"temperature": 0.0, "max_output_tokens": 8192},
    )

    raw_text = (getattr(response, "text", "") or "").strip()
    if not raw_text:
        raise AudioTranscriptionError("Gemini returned an empty transcription.")

    segments = _parse_segments(raw_text)
    if not segments:
        segments = [{"text": raw_text, "start": 0.0, "duration": 0.0}]
    return segments


def transcribe_audio(video_id: str, language: str = "en") -> dict:
    """
    Transcribe a video's audio. Prefers Groq Whisper (free, high limits) when
    GROQ_API_KEY is set; otherwise uses Gemini. Returns the same dict shape as
    transcript_service.fetch_transcript. Raises AudioTranscriptionError.
    """
    if not Config.GROQ_API_KEY and not Config.GOOGLE_API_KEY:
        raise AudioTranscriptionError(
            "No transcription provider configured (set GROQ_API_KEY or "
            "GOOGLE_API_KEY)."
        )

    work_dir = tempfile.mkdtemp(prefix="ytaudio_")
    try:
        audio_path = _download_and_compress(video_id, work_dir)

        if Config.GROQ_API_KEY:
            segments = _transcribe_with_groq(audio_path, language)
        else:
            segments = _transcribe_with_gemini(audio_path, language)

        full_text = " ".join(s["text"] for s in segments)
        timestamped_text = "\n".join(
            f"[{format_timestamp(s['start'])}] {s['text']}" for s in segments
        )

        return {
            "language": language,
            "segments": segments,
            "text": full_text,
            "timestamped_text": timestamped_text,
            "source": "audio",
        }
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

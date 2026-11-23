"""
routes/video_routes.py
-----------------------
Endpoints that process a YouTube video and generate AI artefacts
(summary / key points).
"""

import logging
import threading
import time
import uuid

from flask import Blueprint, request, jsonify, g

from config import Config
from models import video as video_model
from models import history as history_model
from services import transcript_service, vector_service, llm_service, audio_service
from services.transcript_service import TranscriptError
from services.audio_service import AudioTranscriptionError
from utils.auth import token_required
from utils.helpers import error_response, extract_video_id, fetch_video_metadata

video_bp = Blueprint("video", __name__)
logger = logging.getLogger("video_routes")

# ---------------------------------------------------------------------------
# Step-by-step processing jobs
# ---------------------------------------------------------------------------
# /process-video/start runs the pipeline in a background thread and records
# which stage it is on, so the frontend can poll /process-video/status/<id>
# and show real progress instead of an animated guess. Jobs live in memory
# (single-process server), pruned after _JOB_TTL_SECONDS.

_jobs = {}
_jobs_lock = threading.Lock()
_JOB_TTL_SECONDS = 1800


def _job_update(job_id, **fields):
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is not None:
            job.update(fields)


def _prune_jobs():
    cutoff = time.time() - _JOB_TTL_SECONDS
    with _jobs_lock:
        for key in [k for k, j in _jobs.items() if j["created"] < cutoff]:
            del _jobs[key]


def _noop_report(step, message):
    pass


def _acquire_transcript(video_id, language, report=_noop_report):
    """
    Get a transcript by the first route that works. Returns (transcript, source).

        1. YouTube captions, fetched directly.
        2. The same captions through Supadata, if YouTube blocked us and a
           SUPADATA_API_KEY is set. Supadata's requests are not blocked.
        3. The audio, downloaded and transcribed - only when that can work.
           The download goes to YouTube too, so if YouTube already refused this
           server it would be refused again; without a proxy it is skipped
           rather than costing the user another long wait for the same answer.

    Raises TranscriptError carrying the most useful message of the attempts.
    """
    try:
        return transcript_service.fetch_transcript(video_id, language), "captions"
    except TranscriptError as err:
        failure = err
    blocked = failure.blocked

    if blocked and transcript_service.supadata_configured():
        report("captions", "Reading captions through the transcript service")
        try:
            return transcript_service.fetch_transcript_supadata(video_id, language), "captions"
        except TranscriptError as err:
            failure = err

    if blocked and not Config.youtube_proxy_configured():
        raise failure

    report("audio", "No captions found — transcribing the audio")
    try:
        return audio_service.transcribe_audio(video_id, language), "audio"
    except AudioTranscriptionError as audio_err:
        raise TranscriptError(
            f"{failure} The audio could not be transcribed either: {audio_err}",
            blocked=blocked,
        )


def _run_processing_job(job_id, video_id, language, user_id, pasted=None):
    """Worker thread: same pipeline as /process-video, reporting each stage.

    `pasted` is a transcript the user copied from YouTube themselves, used
    when YouTube blocks this server from fetching one.
    """
    try:
        _job_update(job_id, step="metadata", message="Fetching video details")
        meta = fetch_video_metadata(video_id)

        _job_update(job_id, step="captions", message="Extracting transcript")
        if pasted:
            source = "manual"
            transcript = transcript_service.parse_pasted_transcript(pasted, language)
        else:
            transcript, source = _acquire_transcript(
                video_id,
                language,
                lambda step, message: _job_update(job_id, step=step, message=message),
            )

        _job_update(job_id, step="index", message="Building vector database")
        chunk_count = vector_service.build_index(video_id, transcript["segments"])

        _job_update(job_id, step="save", message="Saving the processed video")
        video_doc = video_model.upsert_video(
            {
                "video_id": video_id,
                "title": meta["title"],
                "url": meta["url"],
                "author": meta["author"],
                "thumbnail": meta["thumbnail"],
                "language": transcript["language"],
                "transcript": transcript["text"],
                "segments": transcript["segments"],
                "transcript_source": source,
            }
        )
        history_model.record_processed(user_id, video_doc, source)

        _job_update(
            job_id,
            done=True,
            step="done",
            message="Ready",
            result={
                "video": video_model.serialize_video(video_doc),
                "chunks": chunk_count,
                "transcript_source": source,
            },
        )
    except TranscriptError as exc:
        # Every transcript failure offers the paste box: the user's browser can
        # always reach YouTube even when this server cannot.
        _job_update(job_id, done=True, error=str(exc), can_paste_transcript=True)
    except RuntimeError as exc:
        # Our own messages (LLM / embedding quota and configuration problems).
        logger.exception("process-video job failed for %s", video_id)
        _job_update(job_id, done=True, error=str(exc))
    except Exception:
        logger.exception("process-video job failed for %s", video_id)
        _job_update(job_id, done=True,
                    error="Something went wrong while processing this video. Please try again.")


@video_bp.route("/process-video/start", methods=["POST"])
@token_required
def process_video_start():
    """
    Kick off processing in the background and return a job id to poll.
    Already-processed videos short-circuit with {done: true} immediately.
    """
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    language = (data.get("language") or "en").lower()

    pasted = (data.get("transcript") or "").strip() or None

    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({"error": "Please provide a valid YouTube URL"}), 400
    if pasted:
        # Fail fast on an obviously wrong paste instead of after a job starts.
        try:
            transcript_service.parse_pasted_transcript(pasted, language)
        except TranscriptError as exc:
            return jsonify({"error": str(exc), "can_paste_transcript": True}), 422

    existing = video_model.find_by_video_id(video_id)
    if existing and existing.get("segments"):
        if not vector_service.index_exists(video_id):
            vector_service.build_index(video_id, existing["segments"])
        history_model.record_processed(
            g.user_id, existing, existing.get("transcript_source", "captions")
        )
        return jsonify(
            {
                "done": True,
                "video": video_model.serialize_video(existing),
                "cached": True,
            }
        )

    _prune_jobs()
    job_id = uuid.uuid4().hex
    with _jobs_lock:
        _jobs[job_id] = {
            "user_id": g.user_id,
            "created": time.time(),
            "step": "queued",
            "message": "Starting",
            "done": False,
            "error": None,
            "can_paste_transcript": False,
            "result": None,
        }
    threading.Thread(
        target=_run_processing_job,
        args=(job_id, video_id, language, g.user_id, pasted),
        daemon=True,
    ).start()
    return jsonify({"job_id": job_id})


@video_bp.route("/process-video/status/<job_id>", methods=["GET"])
@token_required
def process_video_status(job_id):
    """Return the live state of a processing job started by this user."""
    with _jobs_lock:
        job = _jobs.get(job_id)
        snapshot = dict(job) if job else None
    if not snapshot or snapshot["user_id"] != g.user_id:
        return jsonify({"error": "Job not found"}), 404

    payload = {
        "step": snapshot["step"],
        "message": snapshot["message"],
        "done": snapshot["done"],
        "error": snapshot["error"],
        "can_paste_transcript": snapshot.get("can_paste_transcript", False),
    }
    if snapshot["result"]:
        payload.update(snapshot["result"])
        payload["cached"] = False
    return jsonify(payload)


@video_bp.route("/process-video", methods=["POST"])
@token_required
def process_video():
    """
    Fetch metadata + transcript, build the FAISS index and store the video.
    Body: { "url": "<youtube url>", "language": "en" | "hi" }
    """
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    language = (data.get("language") or "en").lower()

    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({"error": "Please provide a valid YouTube URL"}), 400

    try:
        # Reuse an already processed video. If we already have its transcript
        # stored, don't re-fetch / re-transcribe (that would burn the caption/
        # audio-LLM quota again) — just rebuild the FAISS index from the stored
        # segments when it's missing from disk.
        existing = video_model.find_by_video_id(video_id)
        if existing and existing.get("segments"):
            if not vector_service.index_exists(video_id):
                vector_service.build_index(video_id, existing["segments"])
            history_model.record_processed(
                g.user_id, existing, existing.get("transcript_source", "captions")
            )
            return jsonify(
                {
                    "message": "Video already processed",
                    "video": video_model.serialize_video(existing),
                    "cached": True,
                }
            )

        # 1) Metadata (title / thumbnail / author)
        meta = fetch_video_metadata(video_id)

        # 2) Transcript — prefer the video's captions; if none exist, fall back
        #    to transcribing the audio with Groq Whisper (or Gemini if no Groq key).
        transcript, source = _acquire_transcript(video_id, language)

        # 3) Build + persist FAISS index
        chunk_count = vector_service.build_index(
            video_id, transcript["segments"]
        )

        # 4) Persist the video document
        video_doc = video_model.upsert_video(
            {
                "video_id": video_id,
                "title": meta["title"],
                "url": meta["url"],
                "author": meta["author"],
                "thumbnail": meta["thumbnail"],
                "language": transcript["language"],
                "transcript": transcript["text"],
                "segments": transcript["segments"],
                "transcript_source": source,
            }
        )

        # Log this processing event for the user's History + analytics
        history_model.record_processed(g.user_id, video_doc, source)

        return jsonify(
            {
                "message": "Video processed successfully",
                "video": video_model.serialize_video(video_doc),
                "chunks": chunk_count,
                "transcript_source": source,
                "cached": False,
            }
        )
    except TranscriptError as exc:
        return jsonify({"error": str(exc), "can_paste_transcript": True}), 422
    except RuntimeError as exc:
        # Quota exhaustion / config problems surface here — log the real cause
        # so a 503 is diagnosable from the server console.
        logger.exception("process-video failed (503) for %s", video_id)
        return jsonify({"error": str(exc)}), 503
    except Exception:
        logger.exception("process-video failed (500) for %s", video_id)
        return jsonify({"error": "Something went wrong while processing this video. Please try again."}), 500


@video_bp.route("/video/<video_id>", methods=["GET"])
@token_required
def get_video(video_id):
    video = video_model.find_by_video_id(video_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404
    return jsonify({"video": video_model.serialize_video(video)})


@video_bp.route("/summary", methods=["POST"])
@token_required
def summary():
    data = request.get_json(silent=True) or {}
    video_id = (data.get("video_id") or "").strip()
    language = (data.get("language") or "en").lower()

    video = video_model.find_by_video_id(video_id)
    if not video:
        return jsonify({"error": "Video not found. Process it first."}), 404

    try:
        text = llm_service.generate_summary(video["transcript"], language)
        return jsonify({"summary": text})
    except Exception as exc:
        return error_response("Failed to generate summary", exc)


@video_bp.route("/key-points", methods=["POST"])
@token_required
def key_points():
    data = request.get_json(silent=True) or {}
    video_id = (data.get("video_id") or "").strip()
    language = (data.get("language") or "en").lower()

    video = video_model.find_by_video_id(video_id)
    if not video:
        return jsonify({"error": "Video not found. Process it first."}), 404

    # Rebuild the timestamped transcript from stored segments
    from utils.helpers import format_timestamp

    timestamped = "\n".join(
        f"[{format_timestamp(s['start'])}] {s['text']}"
        for s in video.get("segments", [])
    )

    try:
        points = llm_service.generate_key_points(timestamped, language)
        return jsonify({"key_points": points})
    except Exception as exc:
        return error_response("Failed to extract key points", exc)

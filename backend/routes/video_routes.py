"""
routes/video_routes.py
-----------------------
Endpoints that process a YouTube video and generate AI artefacts
(summary / key points).
"""

import logging

from flask import Blueprint, request, jsonify, g

from models import video as video_model
from models import history as history_model
from services import transcript_service, vector_service, llm_service, audio_service
from services.transcript_service import TranscriptError
from services.audio_service import AudioTranscriptionError
from utils.auth import token_required
from utils.helpers import extract_video_id, fetch_video_metadata

video_bp = Blueprint("video", __name__)
logger = logging.getLogger("video_routes")


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
        source = "captions"
        try:
            transcript = transcript_service.fetch_transcript(video_id, language)
        except TranscriptError as caption_err:
            try:
                transcript = audio_service.transcribe_audio(video_id, language)
                source = "audio"
            except AudioTranscriptionError as audio_err:
                # Surface the most helpful message of the two
                return (
                    jsonify(
                        {
                            "error": f"{caption_err} Audio transcription also "
                            f"failed: {audio_err}"
                        }
                    ),
                    422,
                )

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
        return jsonify({"error": str(exc)}), 422
    except RuntimeError as exc:
        # Quota exhaustion / config problems surface here — log the real cause
        # so a 503 is diagnosable from the server console.
        logger.exception("process-video failed (503) for %s", video_id)
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        logger.exception("process-video failed (500) for %s", video_id)
        return jsonify({"error": f"Failed to process video: {exc}"}), 500


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
        return jsonify({"error": f"Failed to generate summary: {exc}"}), 500


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
        return jsonify({"error": f"Failed to extract key points: {exc}"}), 500

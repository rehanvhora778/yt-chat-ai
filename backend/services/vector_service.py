"""
services/vector_service.py
--------------------------
Builds and queries a FAISS vector store per video using LangChain.

Pipeline:
    1. Split the transcript into overlapping chunks (RecursiveCharacterTextSplitter)
       while preserving the start timestamp of each chunk as metadata.
    2. Embed the chunks with Google Generative AI embeddings.
    3. Persist the FAISS index to disk under FAISS_STORE_PATH/<video_id>, and
       back it up to MongoDB (GridFS) so it survives the host's disk being wiped.
    4. On query, load the index and run a semantic similarity search. If the
       local copy is gone, restore it from MongoDB first.

Why the MongoDB copy: Render's free filesystem is ephemeral. Every redeploy,
restart and wake from sleep wipes FAISS_STORE_PATH, which used to leave every
processed video unusable until someone processed it again. MongoDB is the one
store that persists, so it keeps the authoritative copy; the disk is a cache.
"""

import io
import logging
import os
import shutil
import tempfile
import threading
import time
import zipfile

import gridfs
from pymongo.errors import PyMongoError

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from config import Config
from extensions import get_db
from utils.helpers import format_timestamp
# Reuse the same 429/quota detection + suggested-delay parsing the chat path uses.
from services.llm_service import _is_rate_limit, _retry_delay_seconds

# An index built with Gemini embeddings (e.g. 3072-dim) is NOT compatible with
# one built by the local model (384-dim), so we record which provider built each
# index and must reuse the SAME provider when loading/querying it.
_PROVIDER_FILE = "embedding_provider.txt"
_RATE_LIMIT_RETRIES = 2
_MAX_RETRY_WAIT = 30  # seconds

logger = logging.getLogger("vector_service")

# GridFS bucket holding one zip per video: index.faiss + index.pkl + provider.
_BUCKET = "faiss_indexes"
# Only these names are ever written back to disk from a stored archive, so a
# tampered archive cannot drop files anywhere else.
_INDEX_FILES = ("index.faiss", "index.pkl", _PROVIDER_FILE)
# Serialises restores of the same video across request threads.
_restore_lock = threading.Lock()


def _get_gemini_embeddings():
    """Create the Google embeddings client (one per call is fine - it is light)."""
    if not Config.GOOGLE_API_KEY:
        raise RuntimeError("GOOGLE_API_KEY is not configured.")
    return GoogleGenerativeAIEmbeddings(
        model=Config.EMBEDDING_MODEL,
        google_api_key=Config.GOOGLE_API_KEY,
    )


def _get_local_embeddings():
    """
    Lightweight, offline embeddings used when the Gemini quota is exhausted.
    Imported lazily so the dependency is only required when actually used.
    """
    try:
        from langchain_community.embeddings import FastEmbedEmbeddings
    except ImportError as exc:  # pragma: no cover - depends on optional dep
        raise RuntimeError(
            "The local embedding fallback needs the 'fastembed' package. "
            "Install it with `pip install fastembed`."
        ) from exc
    return FastEmbedEmbeddings(model_name=Config.LOCAL_EMBEDDING_MODEL)


def _embeddings_for_provider(provider: str):
    return _get_local_embeddings() if provider == "local" else _get_gemini_embeddings()


def _index_path(video_id: str) -> str:
    return os.path.join(Config.FAISS_STORE_PATH, video_id)


def _write_provider(path: str, provider: str) -> None:
    try:
        with open(os.path.join(path, _PROVIDER_FILE), "w", encoding="utf-8") as fh:
            fh.write(provider)
    except OSError:
        pass


def _read_provider(path: str) -> str:
    """Which provider built this index. Legacy indexes (no marker) used Gemini."""
    try:
        with open(os.path.join(path, _PROVIDER_FILE), "r", encoding="utf-8") as fh:
            return fh.read().strip() or "gemini"
    except OSError:
        return "gemini"


def _local_index_exists(video_id: str) -> bool:
    return os.path.exists(os.path.join(_index_path(video_id), "index.faiss"))


def _bucket():
    db = get_db()
    return gridfs.GridFSBucket(db, bucket_name=_BUCKET) if db is not None else None


def _backup_index(video_id: str, path: str, provider: str) -> None:
    """Store the on-disk index in MongoDB, replacing any older copy.

    Failure is logged, not raised: the index on disk still works for now, and
    if it is later lost the chat path rebuilds it from the stored transcript.
    """
    try:
        bucket = _bucket()
        if bucket is None:
            return
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for name in _INDEX_FILES:
                full = os.path.join(path, name)
                if os.path.exists(full):
                    zf.write(full, arcname=name)
        buf.seek(0)
        new_id = bucket.upload_from_stream(
            video_id, buf, metadata={"provider": provider}
        )
        # Drop older versions only after the new one is safely stored.
        for old in bucket.find({"filename": video_id, "_id": {"$ne": new_id}}):
            bucket.delete(old._id)
    except PyMongoError as exc:
        logger.warning("Could not back up FAISS index for %s: %s", video_id, exc)


def _restore_index(video_id: str) -> bool:
    """Copy a video's index from MongoDB to disk. True if it is now on disk."""
    with _restore_lock:
        if _local_index_exists(video_id):
            return True  # another thread restored it while this one waited
        try:
            bucket = _bucket()
            if bucket is None:
                return False
            latest = next(
                iter(bucket.find({"filename": video_id}).sort("uploadDate", -1).limit(1)),
                None,
            )
            if latest is None:
                return False
            data = bucket.open_download_stream(latest._id).read()
        except PyMongoError as exc:
            logger.warning("Could not restore FAISS index for %s: %s", video_id, exc)
            return False

        os.makedirs(Config.FAISS_STORE_PATH, exist_ok=True)
        # Unpack into a temp dir and rename into place, so a reader never sees
        # a half-written index.
        tmp = tempfile.mkdtemp(dir=Config.FAISS_STORE_PATH, prefix=".restore-")
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                for name in _INDEX_FILES:
                    if name in zf.namelist():
                        with open(os.path.join(tmp, name), "wb") as fh:
                            fh.write(zf.read(name))
            if not os.path.exists(os.path.join(tmp, "index.faiss")):
                return False
            # A leftover folder without index.faiss would block the rename.
            shutil.rmtree(_index_path(video_id), ignore_errors=True)
            os.replace(tmp, _index_path(video_id))
            tmp = None
            logger.info("Restored FAISS index for %s from MongoDB", video_id)
            return True
        except (OSError, zipfile.BadZipFile) as exc:
            logger.warning("Stored FAISS index for %s is unusable: %s", video_id, exc)
            return False
        finally:
            if tmp:
                shutil.rmtree(tmp, ignore_errors=True)


def index_exists(video_id: str) -> bool:
    """True if the index is on disk, restoring it from MongoDB if needed."""
    return _local_index_exists(video_id) or _restore_index(video_id)


def _build_documents(segments, chunk_size=1000, chunk_overlap=150):
    """
    Convert timestamped transcript segments into LangChain `Document`s.

    We first build a continuous text where each segment is annotated with its
    start time, then let the splitter chunk it. Each resulting chunk keeps the
    timestamp of the segment it begins with as metadata, so retrieved context
    can be cited with a clickable timestamp.
    """
    # Join segments, remembering the char offset -> start-time mapping
    offsets = []  # list of (char_index, start_seconds)
    pieces = []
    cursor = 0
    for seg in segments:
        offsets.append((cursor, seg["start"]))
        piece = seg["text"] + " "
        pieces.append(piece)
        cursor += len(piece)
    full_text = "".join(pieces)

    def start_time_for_offset(char_index):
        # Find the latest segment that begins at or before char_index
        best = 0.0
        for idx, start in offsets:
            if idx <= char_index:
                best = start
            else:
                break
        return best

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    documents = []
    search_from = 0
    for chunk in splitter.split_text(full_text):
        # Locate where this chunk starts in the original text for the timestamp
        loc = full_text.find(chunk[:40], search_from)
        if loc == -1:
            loc = search_from
        search_from = loc + 1
        start = start_time_for_offset(loc)
        documents.append(
            Document(
                page_content=chunk,
                metadata={
                    "start": start,
                    "timestamp": format_timestamp(start),
                },
            )
        )
    return documents


def _build_with_gemini(documents):
    """Embed with Gemini, retrying transient per-minute 429s with backoff."""
    embeddings = _get_gemini_embeddings()
    for attempt in range(_RATE_LIMIT_RETRIES + 1):
        try:
            return FAISS.from_documents(documents, embeddings)
        except Exception as exc:
            # Only retry rate-limit/quota errors; anything else is a real failure.
            if not _is_rate_limit(exc):
                raise
            if attempt >= _RATE_LIMIT_RETRIES:
                raise  # exhausted retries -> caller falls back to local
            time.sleep(min(_retry_delay_seconds(exc), _MAX_RETRY_WAIT) + 1)


def _build_local(documents):
    """Embed locally, raising a friendly error if fastembed isn't available."""
    try:
        return FAISS.from_documents(documents, _get_local_embeddings())
    except Exception as local_exc:
        raise RuntimeError(
            f"Local embedding failed: {local_exc}. Run `pip install fastembed` "
            "in the interpreter that runs the app, or configure a working "
            "GOOGLE_API_KEY."
        ) from local_exc


def build_index(video_id: str, segments) -> int:
    """
    Build (or rebuild) the FAISS index for a video and persist it to disk.

    Uses Gemini embeddings when a Google key is configured (falling back to a
    local model if Gemini's quota is exhausted); with no Google key it embeds
    locally from the start. Returns the chunk count.
    """
    documents = _build_documents(segments)
    if not documents:
        raise RuntimeError("No content to index.")

    if Config.GOOGLE_API_KEY:
        provider = "gemini"
        try:
            store = _build_with_gemini(documents)
        except Exception as exc:
            if not _is_rate_limit(exc):
                raise
            # Gemini embedding quota is exhausted (won't recover until billing
            # or the next day) — fall back to a local embedding model.
            provider = "local"
            store = _build_local(documents)
    else:
        # No Gemini key — embed locally (free, unlimited) from the start.
        provider = "local"
        store = _build_local(documents)

    os.makedirs(Config.FAISS_STORE_PATH, exist_ok=True)
    path = _index_path(video_id)
    store.save_local(path)
    _write_provider(path, provider)
    _backup_index(video_id, path, provider)
    return len(documents)


def load_index(video_id: str):
    """Load a previously persisted FAISS index for a video, using the same
    embedding provider that built it (Gemini vs. local are not interchangeable)."""
    if not index_exists(video_id):
        return None
    path = _index_path(video_id)
    embeddings = _embeddings_for_provider(_read_provider(path))
    return FAISS.load_local(
        path,
        embeddings,
        allow_dangerous_deserialization=True,
    )


def similarity_search(video_id: str, query: str, k: int = 4):
    """
    Return the top-k relevant chunks as a list of dicts:
        [ {"text": ..., "timestamp": ..., "start": ...}, ... ]
    """
    store = load_index(video_id)
    if store is None:
        return []

    docs = store.similarity_search(query, k=k)
    return [
        {
            "text": d.page_content,
            "timestamp": d.metadata.get("timestamp", "0:00"),
            "start": d.metadata.get("start", 0.0),
        }
        for d in docs
    ]

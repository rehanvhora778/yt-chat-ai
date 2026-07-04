"""
services/vector_service.py
--------------------------
Builds and queries a FAISS vector store per video using LangChain.

Pipeline:
    1. Split the transcript into overlapping chunks (RecursiveCharacterTextSplitter)
       while preserving the start timestamp of each chunk as metadata.
    2. Embed the chunks with Google Generative AI embeddings.
    3. Persist the FAISS index to disk under FAISS_STORE_PATH/<video_id>.
    4. On query, load the index and run a semantic similarity search.
"""

import os
import time

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from config import Config
from utils.helpers import format_timestamp
# Reuse the same 429/quota detection + suggested-delay parsing the chat path uses.
from services.llm_service import _is_rate_limit, _retry_delay_seconds

# An index built with Gemini embeddings (e.g. 3072-dim) is NOT compatible with
# one built by the local model (384-dim), so we record which provider built each
# index and must reuse the SAME provider when loading/querying it.
_PROVIDER_FILE = "embedding_provider.txt"
_RATE_LIMIT_RETRIES = 2
_MAX_RETRY_WAIT = 30  # seconds


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


def index_exists(video_id: str) -> bool:
    return os.path.exists(os.path.join(_index_path(video_id), "index.faiss"))


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

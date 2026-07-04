"""
services/llm_service.py
-----------------------
All Google Gemini interactions go through here via LangChain's
`ChatGoogleGenerativeAI`. Provides:
    - answer_question : RAG answer grounded in retrieved transcript chunks
    - generate_summary
    - generate_key_points (with timestamps)

Every function accepts a `language` ("en" or "hi") so the assistant replies in
English or Hindi as required.
"""

import json
import re
import time

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, SystemMessage

from config import Config

# Transient (per-minute) rate limits are worth retrying; per-day (TPD/RPD) caps
# are NOT — for those we fall back to a higher-quota model instead (_invoke_full).
_RATE_LIMIT_RETRIES = 1
_MAX_RETRY_WAIT = 20  # seconds


class _RateLimited(Exception):
    """Internal: a model exhausted its rate/quota limit (so try the next model)."""

    def __init__(self, original):
        super().__init__(str(original))
        self.original = original


def _is_rate_limit(exc) -> bool:
    s = str(exc).lower()
    return any(
        k in s
        for k in ("429", "resourceexhausted", "quota", "rate limit", "rate_limit", "exceeded")
    )


def _is_hard_limit(exc) -> bool:
    """
    True when retrying THIS model soon is pointless, so the caller should move on
    to the next (higher-capacity) model: a per-day cap (TPD/RPD), a 413
    "request too large for this model's per-minute limit", or any limit whose
    suggested retry delay is longer than we're willing to wait.
    """
    s = str(exc).lower()
    if any(
        k in s
        for k in (
            "per day", "tpd", "rpd", "per-day", "requests per day",
            "request too large", "reduce your message size", "413",
        )
    ):
        return True
    return _retry_delay_seconds(exc, default=0) > _MAX_RETRY_WAIT


def _retry_delay_seconds(exc, default=18) -> int:
    """Pull the suggested retry delay out of a 429 error message."""
    s = str(exc)
    for pattern in (r"retry[_ ]?delay\D+(\d+)", r"retry in ([\d.]+)", r"seconds:\s*(\d+)"):
        m = re.search(pattern, s)
        if m:
            try:
                return int(float(m.group(1)))
            except (TypeError, ValueError):
                pass
    return default

# Cap transcript size per call. Kept modest because Groq's free tier limits both
# per-MINUTE and per-DAY tokens: a 60k-char (~15k token) call blew past the daily
# budget, and fallback models have low per-minute caps. 24k chars (~6k tokens)
# covers ~30 min of speech, fits the fallback model's TPM, and ~quadruples how
# many summaries/key-points the daily budget allows.
_MAX_TRANSCRIPT_CHARS = 24000

_LANGUAGE_NAMES = {"en": "English", "hi": "Hindi"}


def _make_model(provider: str, name: str, temperature: float):
    """Build a chat client for one (provider, model)."""
    if provider == "groq":
        # Imported lazily so the dependency is only needed when Groq is used.
        from langchain_groq import ChatGroq

        return ChatGroq(
            model=name,
            groq_api_key=Config.GROQ_API_KEY,
            temperature=temperature,
            max_tokens=Config.GROQ_MAX_OUTPUT_TOKENS,
        )
    return ChatGoogleGenerativeAI(
        model=name,
        google_api_key=Config.GOOGLE_API_KEY,
        temperature=temperature,
        # Gemini has no real system role; Groq does, so this is Gemini-only.
        convert_system_message_to_human=True,
    )


def _candidate_models():
    """
    Ordered list of (provider, model) to try. Prefers Groq (free tier with high
    limits); the primary Groq model falls back to a higher-DAILY-quota Groq model
    when its per-day token cap is hit, then to Gemini if a key is configured.
    """
    candidates = []
    if Config.GROQ_API_KEY:
        names = [Config.GROQ_MODEL]
        fb = Config.GROQ_FALLBACK_MODEL
        if fb and fb not in names:
            names.append(fb)
        candidates.extend(("groq", n) for n in names)
    if Config.GOOGLE_API_KEY:
        # Last-resort fallback (tiny free tier) so generation still works if all
        # Groq models are daily-capped.
        candidates.append(("gemini", Config.GEMINI_MODEL))
    if not candidates:
        raise RuntimeError(
            "No LLM configured. Set GROQ_API_KEY (recommended) or GOOGLE_API_KEY."
        )
    return candidates


def _language_name(language: str) -> str:
    return _LANGUAGE_NAMES.get(language, "English")


def _truncate(text: str) -> str:
    return text[:_MAX_TRANSCRIPT_CHARS]


def _invoke(messages, temperature=0.3) -> str:
    text, _ = _invoke_full(messages, temperature)
    return text


def _invoke_full(messages, temperature=0.3):
    """
    Invoke the LLM and return (text, usage_dict).

    Tries each candidate model in order. A transient (per-minute) rate limit is
    retried briefly on the same model; a per-day cap (or any long limit) makes us
    move on to the next, higher-quota model rather than wait pointlessly. This is
    what keeps full-transcript features (summary/key-points/...) working after the
    primary model's small daily token budget is used up.
    """
    last_exc = None
    for provider, name in _candidate_models():
        model = _make_model(provider, name, temperature)
        try:
            return _invoke_once(model, messages)
        except _RateLimited as rl:
            last_exc = rl.original
            continue  # this model is rate/quota limited — try the next one
    # Every candidate model was rate/quota limited.
    raise RuntimeError(_friendly_rate_limit_message(last_exc))


def _invoke_once(model, messages):
    """Invoke one model, retrying only short/transient rate limits."""
    for attempt in range(_RATE_LIMIT_RETRIES + 1):
        try:
            response = model.invoke(messages)
            text = (response.content or "").strip()
            return text, _extract_usage(response, messages, text)
        except Exception as exc:
            if not _is_rate_limit(exc):
                raise
            # Hard limit (or last attempt): give up on THIS model so the caller
            # can fall back to the next, higher-capacity one.
            if _is_hard_limit(exc) or attempt >= _RATE_LIMIT_RETRIES:
                raise _RateLimited(exc)
            time.sleep(min(_retry_delay_seconds(exc), _MAX_RETRY_WAIT) + 1)


def _friendly_rate_limit_message(exc) -> str:
    base = (
        "The AI hit its free-tier limit on every available model. Please wait a "
        "minute and try again, or add billing for higher limits."
    )
    if exc is not None:
        m = re.search(r"try again in ([0-9hms.]+)", str(exc), re.IGNORECASE)
        if m:
            base = (
                "The AI's free-tier daily token limit is exhausted (resets in "
                f"~{m.group(1)}). Try again later, set a different GROQ_MODEL, or "
                "add billing for higher limits."
            )
    return base


def _extract_usage(response, messages=None, text=""):
    """Best-effort token usage; falls back to a char-based (~4 chars/token) estimate."""
    um = getattr(response, "usage_metadata", None)
    if isinstance(um, dict) and um.get("total_tokens"):
        return {
            "input_tokens": int(um.get("input_tokens", 0) or 0),
            "output_tokens": int(um.get("output_tokens", 0) or 0),
            "total_tokens": int(um.get("total_tokens", 0) or 0),
        }
    rm = getattr(response, "response_metadata", {}) or {}
    um2 = rm.get("usage_metadata") or rm.get("token_usage") or {}
    if isinstance(um2, dict) and (um2.get("total_tokens") or um2.get("total_token_count")):
        return {
            "input_tokens": int(um2.get("input_tokens") or um2.get("prompt_token_count") or 0),
            "output_tokens": int(um2.get("output_tokens") or um2.get("candidates_token_count") or 0),
            "total_tokens": int(um2.get("total_tokens") or um2.get("total_token_count") or 0),
        }
    prompt_chars = sum(len(getattr(m, "content", "") or "") for m in (messages or []))
    est_in = prompt_chars // 4
    est_out = len(text) // 4
    return {
        "input_tokens": est_in,
        "output_tokens": est_out,
        "total_tokens": est_in + est_out,
        "estimated": True,
    }


# --------------------------------------------------------------------------- #
# Question answering (RAG)
# --------------------------------------------------------------------------- #
def answer_question(question, context_chunks, history=None, language="en"):
    """
    Answer a question grounded ONLY in the provided transcript context.
    `context_chunks` is a list of dicts with text + timestamp.
    `history` is a list of {question, answer} dicts (recent memory).
    """
    lang = _language_name(language)

    context = "\n\n".join(
        c.get("text", "") for c in context_chunks
    ) or "No transcript context was retrieved."

    history_text = ""
    if history:
        history_text = "\n".join(
            f"User: {h['question']}\nAssistant: {h['answer']}" for h in history
        )

    system = (
        f"You are YT Chat GenAI, a premium AI assistant answering questions "
        f"about a YouTube video using ONLY the transcript context provided. "
        f"Always answer in {lang}. If the answer is not in the context, say so "
        f"honestly instead of inventing facts.\n\n"
        f"FORMAT every answer as clean, beautiful GitHub-Flavored Markdown — "
        f"never a plain wall of text. Adaptively pick the best structure:\n"
        f"- Open with a short '## ' heading when the answer has multiple parts.\n"
        f"- Bullet lists for features/points; numbered lists for steps/processes.\n"
        f"- A Markdown TABLE for comparisons or structured data.\n"
        f"- Fenced code blocks with a language tag (```python) for any code.\n"
        f"- Callouts for emphasis, each on its own lines using EXACTLY:\n"
        f"  > [!NOTE] ...   > [!TIP] ...   > [!WARNING] ...   > [!SUCCESS] ...\n"
        f"  > [!DANGER] ...   > [!INFO] ...   > [!SUMMARY] key takeaways\n"
        f"- '**bold**' for key terms, '`inline code`' for identifiers, '---' "
        f"dividers between major sections, and $inline$/$$block$$ LaTeX for math.\n"
        f"- End a multi-part answer with a '> [!SUMMARY]' callout of key points.\n"
        f"Be concise and skimmable — rich formatting, no padding. NEVER wrap the "
        f"whole answer in a single code block."
    )

    user = (
        (f"Previous conversation:\n{history_text}\n\n" if history_text else "")
        + f"Transcript context:\n{context}\n\n"
        + f"Question: {question}\n\nAnswer in {lang}:"
    )

    # Returns (answer_text, usage_dict)
    return _invoke_full(
        [SystemMessage(content=system), HumanMessage(content=user)],
        temperature=0.3,
    )


# --------------------------------------------------------------------------- #
# Summary
# --------------------------------------------------------------------------- #
def generate_summary(transcript, language="en"):
    lang = _language_name(language)
    prompt = (
        f"Summarize the following YouTube video transcript in {lang} as clean, "
        f"beautiful GitHub-Flavored Markdown. Structure it as:\n"
        f"- A '## Overview' heading with a 3-5 sentence paragraph of the main idea.\n"
        f"- A '## Key Points' section with 4-6 bullet points (**bold** key terms).\n"
        f"- End with a '> [!SUMMARY]' callout holding the single biggest takeaway.\n"
        f"Do not invent facts not in the transcript.\n\n"
        f"Transcript:\n{_truncate(transcript)}"
    )
    return _invoke([HumanMessage(content=prompt)], temperature=0.4)


# --------------------------------------------------------------------------- #
# Key points + timestamps
# --------------------------------------------------------------------------- #
def generate_key_points(timestamped_transcript, language="en"):
    """
    Return a list of {timestamp, point} dicts extracted from the transcript.
    """
    lang = _language_name(language)
    prompt = (
        f"From the timestamped transcript below, extract the 6-10 most "
        f"important key points, in chronological order. For each point, use the "
        f"timestamp where that topic is actually explained in the transcript. "
        f"The timestamps must be spread across the whole video — do NOT cluster "
        f"them at 0:00 or reuse the same timestamp; each point should have a "
        f"distinct, increasing timestamp. Respond in {lang}.\n\n"
        f"Return ONLY valid JSON in this exact shape:\n"
        f'{{"key_points": [{{"timestamp": "m:ss", "point": "..."}}]}}\n\n'
        f"Transcript:\n{_truncate(timestamped_transcript)}"
    )
    raw = _invoke([HumanMessage(content=prompt)], temperature=0.3)
    data = _safe_json(raw)
    points = data.get("key_points", []) if isinstance(data, dict) else []
    # Normalise
    cleaned = []
    for p in points:
        if isinstance(p, dict) and p.get("point"):
            cleaned.append(
                {
                    "timestamp": str(p.get("timestamp", "0:00")),
                    "point": str(p.get("point")),
                }
            )
    return cleaned


# --------------------------------------------------------------------------- #
# Quiz generation (MCQs from the transcript)
# --------------------------------------------------------------------------- #
def generate_quiz(transcript, language="en", num_questions=8, difficulty="medium"):
    """
    Generate multiple-choice questions from the transcript.
    Returns (questions, usage) where each question is
    {question, options: [4 strings], correct_index, explanation}.
    """
    lang = _language_name(language)
    num_questions = max(3, min(int(num_questions or 8), 15))
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"

    prompt = (
        f"You are a quiz generator. From the YouTube video transcript below, "
        f"create exactly {num_questions} {difficulty}-difficulty multiple-choice "
        f"questions in {lang} that test understanding of the video's actual "
        f"content. Rules:\n"
        f"- Every question must be answerable from the transcript alone — do "
        f"not invent facts.\n"
        f"- Each question has exactly 4 options with ONE correct answer.\n"
        f"- Wrong options must be plausible (same topic), not obviously silly.\n"
        f"- Vary what is tested: facts, concepts, reasons, examples.\n"
        f"- 'explanation' briefly says why the correct answer is right, citing "
        f"the transcript.\n\n"
        f"Return ONLY valid JSON in this exact shape:\n"
        f'{{"questions": [{{"question": "...", "options": ["...", "...", "...", '
        f'"..."], "correct_index": 0, "explanation": "..."}}]}}\n\n'
        f"Transcript:\n{_truncate(transcript)}"
    )

    raw, usage = _invoke_full([HumanMessage(content=prompt)], temperature=0.4)
    data = _safe_json(raw)
    questions = data.get("questions", []) if isinstance(data, dict) else []

    cleaned = []
    for q in questions:
        if not isinstance(q, dict) or not q.get("question"):
            continue
        options = [str(o) for o in (q.get("options") or []) if str(o).strip()]
        try:
            correct = int(q.get("correct_index", 0))
        except (TypeError, ValueError):
            correct = 0
        if len(options) != 4 or not (0 <= correct < 4):
            continue
        cleaned.append(
            {
                "question": str(q["question"]),
                "options": options,
                "correct_index": correct,
                "explanation": str(q.get("explanation", "")),
            }
        )
    return cleaned, usage


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _safe_json(raw: str):
    """
    Parse JSON from an LLM response, tolerating ```json fences and extra prose.
    """
    if not raw:
        return {}
    # Strip code fences
    cleaned = re.sub(r"```(?:json)?", "", raw).strip("` \n")
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Fall back to the first {...} block
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}
    return {}

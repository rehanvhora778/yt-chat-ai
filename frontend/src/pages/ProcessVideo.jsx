/**
 * pages/ProcessVideo.jsx
 * ----------------------
 * Starts a new conversation. Reached either with a URL already in hand (from
 * the dashboard) or empty from the sidebar, in which case it asks for one.
 *
 * While the backend runs the pipeline as a background job, this page polls the
 * job status — so every step shown is real execution, not an animation.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  CheckCircle2,
  Database,
  FileText,
  Languages,
  Loader2,
  Sparkles,
  Youtube,
} from "lucide-react";

import { SegmentedControl } from "../components/ui";
import { videoApi, getErrorMessage } from "../api/client";
import { usePreferences } from "../context/PreferencesContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useNotify } from "../lib/notify";

const STEPS = [
  { icon: Youtube, label: "Fetching video details" },
  { icon: FileText, label: "Extracting transcript" },
  { icon: Database, label: "Building vector database" },
  { icon: Sparkles, label: "Saving & getting AI ready" },
];

// Maps the backend's reported stage to an index in STEPS
const STEP_INDEX = {
  queued: 0,
  metadata: 0,
  captions: 1,
  audio: 1,
  index: 2,
  save: 3,
  done: STEPS.length,
};

const POLL_INTERVAL_MS = 1000;

const TIPS = [
  "Videos with captions are ready in about 10 seconds.",
  "No captions? The audio is transcribed automatically — that takes a little longer.",
  "Ask follow-up questions: the conversation keeps its context.",
  "Summaries and key points are cached, so reopening them is instant.",
];

const ProcessVideo = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useNotify();
  const { preferences, setPreference } = usePreferences();
  const { refresh } = useWorkspace();

  const [target, setTarget] = useState(
    location.state?.url
      ? {
          url: location.state.url,
          language: location.state.language || preferences.language,
        }
      : null
  );
  const [draftUrl, setDraftUrl] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [audioFallback, setAudioFallback] = useState(false);
  const [error, setError] = useState("");

  // The start request must fire exactly once, but under React StrictMode the
  // effect runs twice (run → cleanup → run). Sharing the promise in a ref lets
  // every effect run subscribe to the same request, while each run owns its
  // own poll timer so cleanup on real unmount stops the polling.
  const startPromiseRef = useRef(null);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!target?.url) return undefined;

    let cancelled = false;
    let pollTimer = null;

    const fail = (message) => {
      if (pollTimer) clearInterval(pollTimer);
      setError(message);
      notifyRef.current.error(message);
    };

    const succeed = (video, message) => {
      if (pollTimer) clearInterval(pollTimer);
      setActiveStep(STEPS.length);
      notifyRef.current.done(message, "Your video is ready");
      refreshRef.current({ silent: true });
      setTimeout(
        () => navigate(`/chat/${video.video_id}`, { state: { video } }),
        700
      );
    };

    const poll = (jobId) => {
      pollTimer = setInterval(async () => {
        try {
          const res = await videoApi.processStatus(jobId);
          if (cancelled) return;
          const { step, done, error: jobError, video, transcript_source } = res.data;

          if (jobError) {
            fail(jobError);
            return;
          }
          if (step === "audio") setAudioFallback(true);
          setActiveStep(STEP_INDEX[step] ?? 0);

          if (done && video) {
            succeed(
              video,
              transcript_source === "audio"
                ? "No captions found — transcribed the audio with AI!"
                : "Video processed!"
            );
          }
        } catch (err) {
          if (cancelled) return;
          fail(getErrorMessage(err));
        }
      }, POLL_INTERVAL_MS);
    };

    if (!startPromiseRef.current) {
      startPromiseRef.current = videoApi.processStart(target.url, target.language);
    }
    startPromiseRef.current
      .then((res) => {
        if (cancelled) return;
        if (res.data.done) {
          // Already processed earlier — nothing to run
          succeed(res.data.video, "Loaded processed video");
        } else {
          poll(res.data.job_id);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        fail(getErrorMessage(err));
      });

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [target, navigate]);

  const start = (event) => {
    event.preventDefault();
    if (!draftUrl.trim()) {
      notify.error("Paste a YouTube link first");
      return;
    }
    startPromiseRef.current = null;
    setError("");
    setActiveStep(0);
    setAudioFallback(false);
    setTarget({ url: draftUrl.trim(), language: preferences.language });
  };

  const retry = () => {
    startPromiseRef.current = null;
    setError("");
    setActiveStep(0);
    setAudioFallback(false);
    setTarget(null);
    setDraftUrl(target?.url || "");
  };

  /* ---------------- URL entry ---------------- */

  if (!target) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto flex min-h-[75vh] w-full max-w-2xl items-center px-4 sm:px-6"
      >
        <div className="w-full">
          <div className="mb-6 text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-glow">
              <Youtube size={26} />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Start a new chat
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              Paste any YouTube link — the transcript is read, indexed and ready to
              answer questions in seconds.
            </p>
          </div>

          <form onSubmit={start} className="card gradient-border">
            <label htmlFor="video-url" className="mb-1.5 block text-xs font-semibold text-muted">
              YouTube URL
            </label>
            <div className="relative">
              <Youtube
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-accent"
              />
              <input
                id="video-url"
                value={draftUrl}
                onChange={(event) => setDraftUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                autoFocus
                className="input-field h-12 pl-10"
              />
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Languages size={15} className="text-muted" />
                <SegmentedControl
                  size="sm"
                  value={preferences.language}
                  onChange={(value) => setPreference("language", value)}
                  options={[
                    { id: "en", label: "English" },
                    { id: "hi", label: "हिंदी" },
                  ]}
                />
              </div>
              <button type="submit" className="btn-primary h-11">
                <Sparkles size={16} /> Process video <ArrowRight size={15} />
              </button>
            </div>
          </form>

          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {TIPS.map((tip) => (
              <li
                key={tip}
                className="rounded-xl border border-line bg-card2/50 p-3 text-xs leading-relaxed text-muted"
              >
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    );
  }

  /* ---------------- Progress ---------------- */

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex min-h-[75vh] w-full max-w-xl items-center px-4 sm:px-6"
    >
      <div className="card gradient-border w-full">
        {!error ? (
          <>
            <div className="mb-6 text-center">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-glow"
              >
                <Loader2 size={26} />
              </motion.span>
              <h1 className="text-xl font-bold tracking-tight text-ink">
                {activeStep >= STEPS.length ? "Ready!" : "Processing your video"}
              </h1>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
                {activeStep >= STEPS.length
                  ? "Opening the conversation..."
                  : "This usually takes 10–30 seconds — a little longer for videos without captions, since the audio is transcribed."}
              </p>
            </div>

            <ul className="space-y-2.5">
              {STEPS.map((step, index) => {
                const done = index < activeStep || activeStep >= STEPS.length;
                const active = index === activeStep && activeStep < STEPS.length;
                // The transcript step switches to the audio-fallback label
                // when the backend reports it is transcribing audio.
                const isTranscriptStep = index === 1;
                const Icon = isTranscriptStep && audioFallback ? AudioLines : step.icon;
                const label =
                  isTranscriptStep && audioFallback
                    ? "Transcribing audio (no captions found)"
                    : step.label;

                return (
                  <li
                    key={step.label}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                      active
                        ? "border-accent/40 bg-accent/8"
                        : "border-line bg-card2/40"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        done
                          ? "bg-emerald-500/12 text-emerald-400"
                          : active
                          ? "bg-accent text-white"
                          : "bg-card3 text-faint"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 size={17} />
                      ) : active ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <Icon size={17} />
                      )}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        done || active ? "text-ink" : "text-faint"
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="mt-5 text-center text-[11px] text-faint">
              You can leave this tab open — we'll take you to the chat automatically.
            </p>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent">
              <Youtube size={26} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-ink">
              Couldn't process this video
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
              {error}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button onClick={retry} className="btn-primary">
                Try another video
              </button>
              <button onClick={() => navigate("/dashboard")} className="btn-ghost">
                <ArrowLeft size={15} /> Back to dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProcessVideo;

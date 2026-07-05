/**
 * pages/ProcessVideo.jsx
 * ----------------------
 * Shows live step-by-step progress while the backend processes the video.
 * The backend runs the pipeline as a background job and reports which stage
 * it is on; this page polls that status, so every step shown here reflects
 * real execution — not an animation. On success it redirects to the chat.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Youtube,
  FileText,
  AudioLines,
  Database,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

import { videoApi, getErrorMessage } from "../api/client";

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

const ProcessVideo = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { url, language } = location.state || {};

  const [activeStep, setActiveStep] = useState(0);
  const [audioFallback, setAudioFallback] = useState(false);
  const [error, setError] = useState("");
  // The start request must fire exactly once, but under React StrictMode the
  // effect runs twice (run → cleanup → run). Sharing the promise in a ref lets
  // every effect run subscribe to the same request, while each run owns its
  // own poll timer so cleanup on real unmount stops the polling.
  const startPromiseRef = useRef(null);

  useEffect(() => {
    // Guard: no URL means the user came here directly
    if (!url) {
      navigate("/dashboard", { replace: true });
      return;
    }

    let cancelled = false;
    let pollTimer = null;

    const fail = (msg) => {
      if (pollTimer) clearInterval(pollTimer);
      setError(msg);
      toast.error(msg);
    };

    const succeed = (video, message) => {
      if (pollTimer) clearInterval(pollTimer);
      setActiveStep(STEPS.length);
      toast.success(message);
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
          const { step, done, error: jobError, video, transcript_source } =
            res.data;

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
      startPromiseRef.current = videoApi.processStart(url, language);
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
  }, [url, language, navigate]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mx-auto flex min-h-[75vh] max-w-xl items-center px-4"
    >
      <div className="glass w-full rounded-3xl p-8">
        {!error ? (
          <>
            <div className="mb-8 text-center">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-purple-600 text-white"
              >
                <Loader2 size={30} />
              </motion.span>
              <h1 className="text-2xl font-bold">Processing your video</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                This usually takes 10–30 seconds — a little longer for videos
                without captions, since we transcribe the audio.
              </p>
            </div>

            <ul className="space-y-3">
              {STEPS.map((step, i) => {
                const done = i < activeStep || activeStep >= STEPS.length;
                const active = i === activeStep && activeStep < STEPS.length;
                // The transcript step switches to the audio-fallback label
                // when the backend reports it is transcribing audio.
                const isTranscriptStep = i === 1;
                const Icon =
                  isTranscriptStep && audioFallback ? AudioLines : step.icon;
                const label =
                  isTranscriptStep && audioFallback
                    ? "Transcribing audio (no captions found)"
                    : step.label;
                return (
                  <li
                    key={step.label}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                      active
                        ? "border-brand-300 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        done
                          ? "bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400"
                          : active
                          ? "bg-brand-600 text-white"
                          : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 size={18} />
                      ) : active ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Icon size={18} />
                      )}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        done || active
                          ? "text-slate-800 dark:text-slate-100"
                          : "text-slate-400"
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-500/15">
              <Youtube size={30} />
            </div>
            <h1 className="text-xl font-bold">Couldn't process this video</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {error}
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="btn-primary mx-auto mt-6"
            >
              <ArrowLeft size={18} /> Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProcessVideo;

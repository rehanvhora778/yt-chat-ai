/**
 * pages/ProcessVideo.jsx
 * ----------------------
 * Shows an animated multi-step progress UI while the backend fetches the
 * transcript, builds embeddings and stores them in FAISS. On success it
 * redirects to the chat page for that video.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Youtube,
  FileText,
  Layers,
  Database,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

import { videoApi, getErrorMessage } from "../api/client";

const STEPS = [
  { icon: FileText, label: "Extracting transcript" },
  { icon: Layers, label: "Creating chunks" },
  { icon: Database, label: "Building vector database" },
  { icon: Sparkles, label: "AI ready" },
];

const ProcessVideo = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { url, language } = location.state || {};

  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    // Guard: no URL means the user came here directly
    if (!url) {
      navigate("/dashboard", { replace: true });
      return;
    }
    // Prevent double-invocation under React StrictMode
    if (startedRef.current) return;
    startedRef.current = true;

    // Drive the visual step animation while the request is in-flight
    const stepTimer = setInterval(() => {
      setActiveStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, 1400);

    videoApi
      .process(url, language)
      .then((res) => {
        clearInterval(stepTimer);
        setActiveStep(STEPS.length); // all done
        const video = res.data.video;
        if (res.data.cached) {
          toast.success("Loaded processed video");
        } else if (res.data.transcript_source === "audio") {
          toast.success("No captions found — transcribed the audio with AI!");
        } else {
          toast.success("Video processed!");
        }
        setTimeout(
          () => navigate(`/chat/${video.video_id}`, { state: { video } }),
          700
        );
      })
      .catch((err) => {
        clearInterval(stepTimer);
        const msg = getErrorMessage(err);
        setError(msg);
        toast.error(msg);
      });

    return () => clearInterval(stepTimer);
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
                        <step.icon size={18} />
                      )}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        done || active
                          ? "text-slate-800 dark:text-slate-100"
                          : "text-slate-400"
                      }`}
                    >
                      {step.label}
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

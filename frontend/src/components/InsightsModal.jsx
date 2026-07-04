/**
 * components/InsightsModal.jsx
 * ----------------------------
 * A slide-over modal that lazily fetches and displays one of two AI insights
 * for a video: a summary or key points (with timestamps). Re-fetches whenever
 * the selected type or language changes.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { X, FileText, ListChecks, Download } from "lucide-react";

import Loader from "./Loader";
import MarkdownRenderer from "./MarkdownRenderer";
import { videoApi, getErrorMessage } from "../api/client";
import { exportSummaryToPdf, exportKeyPointsToPdf } from "../utils/exportPdf";

const TITLES = {
  summary: { label: "Summary", icon: FileText },
  keypoints: { label: "Key Points", icon: ListChecks },
};

const InsightsModal = ({ type, videoId, videoTitle, language, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const [keyPoints, setKeyPoints] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fetcher =
      type === "summary"
        ? videoApi.summary(videoId, language)
        : videoApi.keyPoints(videoId, language);

    fetcher
      .then((res) => {
        if (cancelled) return;
        if (type === "summary") setSummary(res.data.summary || "");
        else setKeyPoints(res.data.key_points || []);
      })
      .catch((err) => !cancelled && toast.error(getErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [type, videoId, language]);

  const meta = TITLES[type] || TITLES.summary;
  const Icon = meta.icon;

  // Whether there is data ready to export for the current insight
  const hasData = type === "summary" ? !!summary : keyPoints.length > 0;

  const handleDownload = () => {
    if (!hasData) {
      toast.error("Nothing to download yet");
      return;
    }
    if (type === "summary") exportSummaryToPdf(videoTitle, summary);
    else exportKeyPointsToPdf(videoTitle, keyPoints);
    toast.success("PDF downloaded");
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-purple-600 text-white">
              <Icon size={18} />
            </span>
            <h2 className="text-lg font-bold">{meta.label}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownload}
              disabled={loading || !hasData}
              title="Download as PDF"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              <Download size={17} />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader label={`Generating ${meta.label.toLowerCase()}...`} />
            </div>
          ) : type === "summary" ? (
            <MarkdownRenderer>{summary || "No summary available."}</MarkdownRenderer>
          ) : (
            <ul className="space-y-3">
              {keyPoints.length === 0 && (
                <p className="text-sm text-slate-500">No key points found.</p>
              )}
              {keyPoints.map((kp, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  <span className="h-fit shrink-0 rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                    {kp.timestamp}
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {kp.point}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};

export default InsightsModal;

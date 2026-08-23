/**
 * components/InsightsModal.jsx
 * ----------------------------
 * Slide-over panel showing one of two AI insights for a video: a summary or
 * key points with timestamps.
 *
 * Results are cached per video + type + language (LibraryContext) so reopening
 * a summary is instant and doesn't spend another API call — "Regenerate"
 * forces a fresh request.
 */

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileText, ListChecks, RefreshCw, X } from "lucide-react";

import Loader from "./Loader";
import MarkdownRenderer from "./MarkdownRenderer";
import InsightsPrintDocument from "./InsightsPrintDocument";
import { videoApi, getErrorMessage } from "../api/client";
import { summaryKey, useLibrary } from "../context/LibraryContext";
import { usePrintExport, suggestPdfName } from "../lib/printExport";
import PdfNameModal from "./PdfNameModal";
import PdfExportOverlay from "./PdfExportOverlay";
import { timeAgo } from "../lib/format";
import { useNotify } from "../lib/notify";

const TITLES = {
  summary: { label: "Summary", icon: FileText },
  keypoints: { label: "Key Points", icon: ListChecks },
};

const InsightsModal = ({ type, videoId, videoTitle, language, onClose }) => {
  const notify = useNotify();
  const { summaries, saveSummary } = useLibrary();
  const { printing, startPrint } = usePrintExport();
  const [pdfNameOpen, setPdfNameOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const [keyPoints, setKeyPoints] = useState([]);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState(null);

  const meta = TITLES[type] || TITLES.summary;
  const Icon = meta.icon;

  const load = useCallback(
    async ({ force = false } = {}) => {
      setError("");
      const key = summaryKey(videoId, type, language);
      const cached = summaries.find((item) => item.key === key);

      if (cached && !force) {
        setSummary(cached.content || "");
        setKeyPoints(cached.points || []);
        setCachedAt(cached.created_at);
        setLoading(false);
        return;
      }

      setLoading(true);
      setCachedAt(null);
      try {
        const res =
          type === "summary"
            ? await videoApi.summary(videoId, language)
            : await videoApi.keyPoints(videoId, language);

        const content = type === "summary" ? res.data.summary || "" : "";
        const points = type === "summary" ? [] : res.data.key_points || [];

        setSummary(content);
        setKeyPoints(points);
        saveSummary({ videoId, videoTitle, type, language, content, points });
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        notify.error(message);
      } finally {
        setLoading(false);
      }
    },
    // `summaries` is intentionally read at call time only — including it here
    // would re-run the effect the moment a result is cached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [videoId, type, language, videoTitle]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, videoId, language]);

  const hasData = type === "summary" ? !!summary : keyPoints.length > 0;

  const handleDownload = () => {
    if (!hasData) {
      notify.error("Nothing to download yet");
      return;
    }
    // Ask for the filename first so Chrome's save dialog opens pre-filled.
    setPdfNameOpen(true);
  };

  return (
    <>
      <PdfNameModal
        open={pdfNameOpen}
        onClose={() => setPdfNameOpen(false)}
        defaultName={suggestPdfName(
          videoTitle,
          type === "summary" ? "Summary" : "Key Points"
        )}
        onConfirm={startPrint}
      />

      {printing && <PdfExportOverlay />}
      {printing && (
        <InsightsPrintDocument
          kind={type}
          videoTitle={videoTitle}
          summary={summary}
          keyPoints={keyPoints}
        />
      )}

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm"
        />

        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="fixed right-0 top-0 z-[95] flex h-full w-full max-w-lg flex-col border-l border-line bg-card shadow-lift"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-line p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="icon-tile">
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight text-ink">
                  {meta.label}
                </h2>
                <p className="truncate text-xs text-muted">{videoTitle}</p>
                {cachedAt && (
                  <p className="mt-0.5 text-[11px] text-faint">
                    Saved {timeAgo(cachedAt)} · {(language || "en").toUpperCase()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => load({ force: true })}
                disabled={loading}
                title="Regenerate"
                aria-label="Regenerate"
                className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-ink disabled:opacity-40"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={handleDownload}
                disabled={loading || !hasData}
                title="Download as PDF"
                aria-label="Download as PDF"
                className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-ink disabled:opacity-40"
              >
                <Download size={16} />
              </button>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <Loader label={`Generating ${meta.label.toLowerCase()}...`} />
                <p className="text-xs text-faint">This usually takes a few seconds</p>
              </div>
            ) : error ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-muted">{error}</p>
                <button onClick={() => load({ force: true })} className="btn-secondary h-9 text-xs">
                  <RefreshCw size={14} /> Try again
                </button>
              </div>
            ) : type === "summary" ? (
              <MarkdownRenderer>{summary || "No summary available."}</MarkdownRenderer>
            ) : (
              <ul className="space-y-2.5">
                {keyPoints.length === 0 && (
                  <p className="text-sm text-muted">No key points found.</p>
                )}
                {keyPoints.map((point, index) => (
                  <li
                    key={index}
                    className="flex gap-3 rounded-xl border border-line bg-card2/50 p-3"
                  >
                    <span className="badge badge-accent h-fit shrink-0">
                      {point.timestamp}
                    </span>
                    <p className="text-sm leading-relaxed text-ink">{point.point}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.aside>
      </AnimatePresence>
    </>
  );
};

export default InsightsModal;

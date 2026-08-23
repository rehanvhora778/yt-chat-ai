/**
 * pages/Summaries.jsx
 * -------------------
 * Every AI summary and key-point list you've generated, cached locally so you
 * can reread, export or regenerate them without spending another API call.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Download,
  FileText,
  Languages,
  ListChecks,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

import MarkdownRenderer from "../components/MarkdownRenderer";
import InsightsPrintDocument from "../components/InsightsPrintDocument";
import Modal, { ConfirmDialog } from "../components/ui/Modal";
import { EmptyState, PageHeader, SegmentedControl } from "../components/ui";
import { useLibrary } from "../context/LibraryContext";
import { usePrintExport } from "../lib/printExport";
import { formatDate, plainSnippet, timeAgo, youtubeThumb } from "../lib/format";
import { useNotify } from "../lib/notify";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "summary", label: "Summaries" },
  { id: "keypoints", label: "Key points" },
];

const Summaries = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  const { summaries, removeSummary } = useLibrary();
  const { printing, startPrint } = usePrintExport();

  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return summaries.filter((item) => {
      if (filter !== "all" && item.type !== filter) return false;
      if (!needle) return true;
      const haystack = `${item.video_title || ""} ${item.content || ""} ${(item.points || [])
        .map((point) => point.point)
        .join(" ")}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [summaries, filter, query]);

  const snippetOf = (item) =>
    item.type === "keypoints"
      ? plainSnippet((item.points || []).map((point) => point.point).join(" · "), 150)
      : plainSnippet(item.content, 150);

  const download = () => {
    if (!active) return;
    startPrint();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6"
    >
      <PageHeader
        title="AI summaries"
        icon={Sparkles}
        subtitle="Summaries and key points you've generated, saved on this device."
      >
        <SegmentedControl value={filter} onChange={setFilter} options={FILTERS} />
      </PageHeader>

      {summaries.length > 0 && (
        <div className="relative mb-5 max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search summaries..."
            className="input-field h-11 pl-10"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            summaries.length === 0
              ? "No summaries yet"
              : "Nothing matches those filters"
          }
          description={
            summaries.length === 0
              ? "Open any processed video and choose Summary or Key Points — the result is saved here automatically."
              : "Try a different keyword or switch the filter."
          }
          action={
            summaries.length === 0 && (
              <button onClick={() => navigate("/history")} className="btn-primary">
                <Sparkles size={15} /> Pick a video
              </button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((item) => (
              <motion.article
                key={item.key}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.22 }}
                onClick={() => setActive(item)}
                className="card card-interactive cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={youtubeThumb(item.video_id)}
                    alt=""
                    loading="lazy"
                    className="h-11 w-20 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
                      {item.video_title || item.video_id}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`badge ${
                          item.type === "keypoints" ? "badge-gold" : "badge-accent"
                        }`}
                      >
                        {item.type === "keypoints" ? (
                          <ListChecks size={9} />
                        ) : (
                          <FileText size={9} />
                        )}
                        {item.type === "keypoints" ? "Key points" : "Summary"}
                      </span>
                      <span className="badge bg-card3 text-muted">
                        <Languages size={9} /> {(item.language || "en").toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted">
                  {snippetOf(item)}
                </p>

                <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11px] text-faint">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} /> {timeAgo(item.created_at)}
                  </span>
                  <span className="link-quiet">Read</span>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Reader */}
      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title={active?.video_title || "Summary"}
        description={
          active
            ? `${active.type === "keypoints" ? "Key points" : "Summary"} · generated ${formatDate(
                active.created_at
              )}`
            : ""
        }
        icon={active?.type === "keypoints" ? ListChecks : FileText}
        size="lg"
        footer={
          <>
            <button
              onClick={() => {
                setPendingDelete(active);
              }}
              className="btn-ghost mr-auto"
            >
              <Trash2 size={14} /> Delete
            </button>
            <button
              onClick={() =>
                navigate(`/chat/${active.video_id}?insight=${active.type}`)
              }
              className="btn-ghost"
            >
              <RefreshCw size={14} /> Regenerate
            </button>
            <button onClick={() => navigate(`/chat/${active.video_id}`)} className="btn-ghost">
              <Play size={14} /> Open chat
            </button>
            <button onClick={download} className="btn-primary">
              <Download size={14} /> PDF
            </button>
          </>
        }
      >
        {active?.type === "keypoints" ? (
          <ul className="space-y-2.5">
            {(active.points || []).map((point, index) => (
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
            {(active.points || []).length === 0 && (
              <p className="text-sm text-muted">No key points saved.</p>
            )}
          </ul>
        ) : (
          <MarkdownRenderer>{active?.content || ""}</MarkdownRenderer>
        )}
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this summary?"
        message="It will be removed from this device. You can always regenerate it from the video."
        confirmLabel="Delete"
        onConfirm={() => {
          removeSummary(pendingDelete.key);
          setActive(null);
          notify.success("Summary deleted");
        }}
        onClose={() => setPendingDelete(null)}
      />

      {printing && active && (
        <InsightsPrintDocument
          kind={active.type}
          videoTitle={active.video_title}
          summary={active.content}
          keyPoints={active.points || []}
        />
      )}
    </motion.div>
  );
};

export default Summaries;

/**
 * pages/Bookmarks.jsx
 * -------------------
 * Everything you've starred: videos saved for later, and individual AI answers
 * bookmarked from a conversation. Stored per user in the browser.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  BookmarkX,
  Copy,
  ExternalLink,
  MessagesSquare,
  Play,
  Search,
  Trash2,
  Video,
} from "lucide-react";

import MarkdownRenderer from "../components/MarkdownRenderer";
import { ConfirmDialog } from "../components/ui/Modal";
import { EmptyState, PageHeader, Tab } from "../components/ui";
import { useLibrary } from "../context/LibraryContext";
import { formatDate, plainSnippet, timeAgo, youtubeThumb } from "../lib/format";
import { useNotify } from "../lib/notify";

const Bookmarks = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  const { bookmarks, removeBookmark } = useLibrary();

  const [tab, setTab] = useState("videos");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const videos = useMemo(
    () => bookmarks.filter((item) => item.type === "video"),
    [bookmarks]
  );
  const answers = useMemo(
    () => bookmarks.filter((item) => item.type === "answer"),
    [bookmarks]
  );

  const filtered = useMemo(() => {
    const list = tab === "videos" ? videos : answers;
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((item) =>
      `${item.video_title || ""} ${item.question || ""} ${item.answer || ""}`
        .toLowerCase()
        .includes(needle)
    );
  }, [tab, videos, answers, query]);

  const copyAnswer = async (item) => {
    try {
      await navigator.clipboard.writeText(item.answer || "");
      notify.success("Answer copied");
    } catch {
      notify.error("Your browser blocked the clipboard");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6"
    >
      <PageHeader
        title="Bookmarks"
        icon={Bookmark}
        subtitle="Videos and answers you've saved for later."
      />

      {/* Tabs + search */}
      <div className="mb-5 flex flex-col gap-4 border-b border-line sm:flex-row sm:items-end sm:justify-between">
        <div role="tablist" className="flex items-center gap-5">
          <Tab
            active={tab === "videos"}
            onClick={() => setTab("videos")}
            icon={Video}
            count={videos.length}
          >
            Videos
          </Tab>
          <Tab
            active={tab === "answers"}
            onClick={() => setTab("answers")}
            icon={MessagesSquare}
            count={answers.length}
          >
            Saved answers
          </Tab>
        </div>

        {bookmarks.length > 0 && (
          <div className="relative mb-3 sm:w-72">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search bookmarks..."
              className="input-field h-10 pl-9 text-xs"
            />
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title={
            query
              ? "Nothing matches that search"
              : tab === "videos"
              ? "No bookmarked videos"
              : "No saved answers"
          }
          description={
            query
              ? "Try a different keyword."
              : tab === "videos"
              ? "Bookmark a video from your history to pin it here."
              : "In any conversation, hover an AI answer and hit the bookmark icon to save it."
          }
          action={
            !query && (
              <button onClick={() => navigate("/history")} className="btn-secondary">
                Go to history
              </button>
            )
          }
        />
      ) : tab === "videos" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((item) => (
              <motion.article
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.22 }}
                className="card-flush card-interactive group cursor-pointer overflow-hidden"
                onClick={() => navigate(`/chat/${item.video_id}`)}
              >
                <div className="relative">
                  <img
                    src={item.thumbnail || youtubeThumb(item.video_id)}
                    alt=""
                    loading="lazy"
                    className="aspect-video w-full object-cover"
                  />
                  <span className="absolute bottom-2 right-2 flex h-9 w-9 scale-90 items-center justify-center rounded-full bg-accent text-white opacity-0 shadow-glow transition-all group-hover:scale-100 group-hover:opacity-100">
                    <Play size={15} className="ml-0.5" />
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-ink">
                    {item.video_title || item.video_id}
                  </h3>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11px] text-muted">
                    <span>Saved {timeAgo(item.created_at)}</span>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        removeBookmark(item.id);
                        notify.success("Bookmark removed");
                      }}
                      aria-label="Remove bookmark"
                      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card3 hover:text-accent"
                    >
                      <BookmarkX size={15} />
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((item) => {
              const open = expanded === item.id;
              return (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="card-flush overflow-hidden"
                >
                  <div className="flex items-start gap-3 border-b border-line px-4 py-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card2 text-accent">
                      <MessagesSquare size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-ink">
                        {item.question || "Saved answer"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {item.video_title} · {formatDate(item.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => copyAnswer(item)}
                        aria-label="Copy answer"
                        title="Copy answer"
                        className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-ink"
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        onClick={() => navigate(`/chat/${item.video_id}`)}
                        aria-label="Open conversation"
                        title="Open conversation"
                        className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-ink"
                      >
                        <ExternalLink size={15} />
                      </button>
                      <button
                        onClick={() => setPendingDelete(item)}
                        aria-label="Delete bookmark"
                        title="Delete bookmark"
                        className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-accent"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-3">
                    {open ? (
                      <MarkdownRenderer>{item.answer}</MarkdownRenderer>
                    ) : (
                      <p className="text-sm leading-relaxed text-muted">
                        {plainSnippet(item.answer, 260)}
                      </p>
                    )}
                    {(item.answer || "").length > 260 && (
                      <button
                        onClick={() => setExpanded(open ? null : item.id)}
                        className="link-quiet mt-2"
                      >
                        {open ? "Show less" : "Show full answer"}
                      </button>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this bookmark?"
        message="The saved answer will be removed from your bookmarks. The conversation itself stays intact."
        confirmLabel="Delete"
        onConfirm={() => {
          removeBookmark(pendingDelete.id);
          notify.success("Bookmark deleted");
        }}
        onClose={() => setPendingDelete(null)}
      />
    </motion.div>
  );
};

export default Bookmarks;

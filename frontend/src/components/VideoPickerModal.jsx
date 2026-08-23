/**
 * components/VideoPickerModal.jsx
 * -------------------------------
 * Choose one of your processed videos. Used by the dashboard quick actions
 * (Summarize video, Export chat) and when adding videos to a collection.
 */

import { useMemo, useState } from "react";

import Modal from "./ui/Modal";
import { EmptyState } from "./ui";
import { timeAgo } from "../lib/format";
import { useWorkspace } from "../context/WorkspaceContext";
import { Search, Video } from "lucide-react";

const VideoPickerModal = ({
  open,
  onClose,
  onSelect,
  title = "Choose a video",
  description,
  icon,
  selectedIds = [],
  multiple = false,
  emptyHint = "Process a video first — then it will show up here.",
}) => {
  const { processed } = useWorkspace();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return processed;
    return processed.filter((v) => (v.title || "").toLowerCase().includes(q));
  }, [processed, query]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={icon || Video}
      size="lg"
    >
      <div className="relative mb-3">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your videos..."
          className="input-field pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Video}
          title={processed.length ? "No videos match that search" : "No processed videos yet"}
          description={processed.length ? "Try a different keyword." : emptyHint}
          compact
        />
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((video) => {
            const selected = selectedIds.includes(video.video_id);
            return (
              <li key={video.video_id}>
                <button
                  onClick={() => {
                    onSelect(video);
                    if (!multiple) onClose();
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors ${
                    selected
                      ? "border-accent/50 bg-accent/10"
                      : "border-transparent hover:border-line hover:bg-card2"
                  }`}
                >
                  <img
                    src={video.thumbnail}
                    alt=""
                    loading="lazy"
                    className="h-11 w-20 shrink-0 rounded-lg object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-sm font-medium text-ink">
                      {video.title || video.video_id}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {video.chat_count || 0} chats · {timeAgo(video.processed_at)}
                    </span>
                  </span>
                  {multiple && (
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold ${
                        selected
                          ? "border-accent bg-accent text-white"
                          : "border-line2 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
};

export default VideoPickerModal;

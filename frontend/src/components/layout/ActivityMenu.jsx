/**
 * components/layout/ActivityMenu.jsx
 * ----------------------------------
 * The bell in the top bar. Builds a live activity feed out of what actually
 * happened in the workspace — videos processed, questions asked, summaries
 * generated — and marks everything read once the panel is opened.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, MessagesSquare, Sparkles, Video } from "lucide-react";

import { parseDate, plainSnippet, timeAgo } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import { useLibrary } from "../../context/LibraryContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useStored } from "../../lib/store";

const ICONS = {
  processed: Video,
  chat: MessagesSquare,
  summary: Sparkles,
};

const ActivityMenu = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { processed, recentChats } = useWorkspace();
  const { summaries } = useLibrary();
  const { preferences } = usePreferences();
  const [lastSeen, setLastSeen] = useStored(user?.id || "guest", "activity_seen", 0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const items = useMemo(() => {
    const feed = [];

    processed.slice(0, 8).forEach((video) => {
      const at = parseDate(video.processed_at)?.getTime();
      if (!at) return;
      feed.push({
        id: `processed-${video.video_id}`,
        type: "processed",
        at,
        title: "Video ready to chat",
        detail: video.title || video.video_id,
        to: `/chat/${video.video_id}`,
      });
    });

    recentChats.slice(0, 8).forEach((chat) => {
      const at = parseDate(chat.timestamp)?.getTime();
      if (!at) return;
      feed.push({
        id: `chat-${chat.id}`,
        type: "chat",
        at,
        title: "Answer delivered",
        detail: plainSnippet(chat.question, 64),
        to: `/chat/${chat.video_id}`,
      });
    });

    summaries.slice(0, 6).forEach((summary) => {
      const at = parseDate(summary.created_at)?.getTime();
      if (!at) return;
      feed.push({
        id: `summary-${summary.key}`,
        type: "summary",
        at,
        title: summary.type === "keypoints" ? "Key points generated" : "Summary generated",
        detail: summary.video_title,
        to: "/summaries",
      });
    });

    return feed.sort((a, b) => b.at - a.at).slice(0, 12);
  }, [processed, recentChats, summaries]);

  const unread = preferences.activityBadge
    ? items.filter((item) => item.at > (lastSeen || 0)).length
    : 0;

  const toggle = () => {
    setOpen((value) => {
      if (!value && items.length) setLastSeen(Date.now());
      return !value;
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={unread ? `Activity, ${unread} new` : "Activity"}
        className="relative rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-ink"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="glass absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">Activity</p>
              <span className="text-[11px] text-faint">Last 12 events</span>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-10 text-center text-xs text-muted">
                  Nothing yet. Process a video to get started.
                </p>
              ) : (
                items.map((item) => {
                  const Icon = ICONS[item.type];
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setOpen(false);
                        navigate(item.to);
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-card2"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card2 text-accent">
                        <Icon size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-ink">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {item.detail}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] text-faint">
                        {timeAgo(item.at)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActivityMenu;

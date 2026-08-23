/**
 * components/layout/CommandPalette.jsx
 * ------------------------------------
 * Global search (⌘K / Ctrl+K). Searches the videos you've processed, the
 * questions you've asked and your collections, and doubles as a keyboard
 * launcher for the main screens. Everything is matched against data already
 * loaded by WorkspaceContext, so results appear as you type.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CornerDownLeft,
  FolderOpen,
  MessagesSquare,
  Search,
  Video,
} from "lucide-react";

import { ALL_NAV_ITEMS } from "../../lib/nav";
import { plainSnippet, timeAgo } from "../../lib/format";
import { useLibrary } from "../../context/LibraryContext";
import { useWorkspace } from "../../context/WorkspaceContext";

const MAX_PER_GROUP = 5;

const CommandPalette = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { processed, recentChats } = useWorkspace();
  const { collections } = useLibrary();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = [];

    const videos = (q
      ? processed.filter((v) => (v.title || "").toLowerCase().includes(q))
      : processed
    ).slice(0, MAX_PER_GROUP);
    if (videos.length) {
      groups.push({
        title: q ? "Videos" : "Recent videos",
        items: videos.map((v) => ({
          id: `video-${v.video_id}`,
          icon: Video,
          label: v.title || v.video_id,
          hint: `${v.chat_count || 0} chats · ${timeAgo(v.processed_at)}`,
          thumbnail: v.thumbnail,
          run: () => navigate(`/chat/${v.video_id}`),
        })),
      });
    }

    if (q) {
      const chats = recentChats
        .filter((c) => (c.question || "").toLowerCase().includes(q))
        .slice(0, MAX_PER_GROUP);
      if (chats.length) {
        groups.push({
          title: "Questions you asked",
          items: chats.map((c) => ({
            id: `chat-${c.id}`,
            icon: MessagesSquare,
            label: c.question,
            hint: plainSnippet(c.video_title, 48),
            run: () => navigate(`/chat/${c.video_id}`),
          })),
        });
      }

      const matchedCollections = collections
        .filter((c) => c.name.toLowerCase().includes(q))
        .slice(0, MAX_PER_GROUP);
      if (matchedCollections.length) {
        groups.push({
          title: "Collections",
          items: matchedCollections.map((c) => ({
            id: `collection-${c.id}`,
            icon: FolderOpen,
            label: c.name,
            hint: `${c.video_ids.length} videos`,
            run: () => navigate(`/collections?open=${c.id}`),
          })),
        });
      }
    }

    const pages = ALL_NAV_ITEMS.filter((item) =>
      q ? item.label.toLowerCase().includes(q) : true
    ).slice(0, q ? MAX_PER_GROUP : ALL_NAV_ITEMS.length);
    if (pages.length) {
      groups.push({
        title: "Go to",
        items: pages.map((item) => ({
          id: `nav-${item.to}`,
          icon: item.icon,
          label: item.label,
          run: () => navigate(item.to),
        })),
      });
    }

    return groups;
  }, [query, processed, recentChats, collections, navigate]);

  const flat = useMemo(() => results.flatMap((group) => group.items), [results]);

  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((c) => (flat.length ? (c + 1) % flat.length : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((c) => (flat.length ? (c - 1 + flat.length) % flat.length : 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = flat[cursor];
        if (item) {
          item.run();
          onClose();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, flat, cursor, onClose]);

  // Keep the highlighted row in view while arrowing through results
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (typeof document === "undefined") return null;

  let index = -1;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-[10vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-card shadow-lift"
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Search size={17} className="shrink-0 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search videos, questions, collections..."
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
              />
              <kbd className="hidden rounded-md border border-line bg-card2 px-1.5 py-0.5 text-[10px] font-semibold text-faint sm:block">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {flat.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-muted">
                  No matches for “{query}”.
                </p>
              ) : (
                results.map((group) => (
                  <div key={group.title} className="mb-1.5">
                    <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-faint">
                      {group.title}
                    </p>
                    {group.items.map((item) => {
                      index += 1;
                      const active = index === cursor;
                      const rowIndex = index;
                      return (
                        <button
                          key={item.id}
                          data-index={rowIndex}
                          onMouseEnter={() => setCursor(rowIndex)}
                          onClick={() => {
                            item.run();
                            onClose();
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                            active ? "bg-card2" : ""
                          }`}
                        >
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="h-8 w-14 shrink-0 rounded-md object-cover"
                            />
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card2 text-muted">
                              <item.icon size={15} />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {item.label}
                            </span>
                            {item.hint && (
                              <span className="block truncate text-xs text-muted">
                                {item.hint}
                              </span>
                            )}
                          </span>
                          {active && (
                            <CornerDownLeft size={14} className="shrink-0 text-faint" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-line bg-card2/60 px-4 py-2 text-[11px] text-faint">
              <span>↑↓ to navigate · ↵ to open</span>
              <span>{flat.length} results</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CommandPalette;

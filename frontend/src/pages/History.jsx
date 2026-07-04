/**
 * pages/History.jsx
 * -----------------
 * FEATURE 5 — Advanced history. Glass cards per processed video showing
 * thumbnail, title, date, questions asked and chat count, with view/delete
 * actions, a search box, a date filter and a "recent videos" strip.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  History as HistoryIcon,
  Search,
  Trash2,
  ArrowRight,
  MessageSquare,
  Calendar,
  Clock,
  Mic,
} from "lucide-react";

import Skeleton from "../components/Skeleton";
import { processedApi, getErrorMessage } from "../api/client";

const DATE_FILTERS = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
];

const History = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");

  const load = () => {
    setLoading(true);
    processedApi
      .list()
      .then((res) => setItems(res.data.history || []))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    return items.filter((it) => {
      if (query && !(it.title || "").toLowerCase().includes(query.toLowerCase()))
        return false;
      if (dateFilter !== "all" && it.processed_at) {
        const ts = new Date(it.processed_at).getTime();
        if (dateFilter === "today") {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          if (ts < d.getTime()) return false;
        } else {
          const days = Number(dateFilter);
          if (ts < now - days * 86400000) return false;
        }
      }
      return true;
    });
  }, [items, query, dateFilter]);

  const recent = items.slice(0, 6);

  const remove = async (videoId, e) => {
    e.stopPropagation();
    if (!window.confirm("Remove this video and its chats from history?")) return;
    try {
      await processedApi.remove(videoId);
      setItems((list) => list.filter((i) => i.video_id !== videoId));
      toast.success("Removed");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const fmtDate = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mx-auto max-w-6xl px-4 py-10"
    >
      <div className="mb-6 flex items-center gap-2">
        <HistoryIcon className="text-brand-500" size={26} />
        <h1 className="text-3xl font-bold">History</h1>
      </div>

      {/* Controls */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your videos..."
            className="input-field pl-10"
          />
        </div>
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-300 p-1 dark:border-slate-700">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                dateFilter === f.id
                  ? "accent-grad text-white"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center text-slate-500 dark:text-slate-400">
          <MessageSquare className="mx-auto mb-3 text-slate-400" size={32} />
          <p>No videos yet.</p>
          <button onClick={() => navigate("/dashboard")} className="btn-primary mx-auto mt-4">
            Process a video <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <>
          {/* Recent strip */}
          {!query && dateFilter === "all" && recent.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <Clock size={18} className="text-brand-500" /> Recent
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {recent.map((it) => (
                  <button
                    key={`recent-${it.video_id}`}
                    onClick={() => navigate(`/chat/${it.video_id}`)}
                    className="group w-44 shrink-0 text-left"
                  >
                    <img
                      src={it.thumbnail}
                      alt={it.title}
                      className="h-24 w-44 rounded-xl object-cover transition-transform group-hover:scale-[1.03]"
                    />
                    <p className="mt-2 line-clamp-2 text-sm font-medium">{it.title}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Grid */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {filtered.map((it) => (
                <motion.div
                  key={it.video_id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={{ y: -5 }}
                  onClick={() => navigate(`/chat/${it.video_id}`)}
                  className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white/70 shadow-sm transition-shadow hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="relative">
                    <img
                      src={it.thumbnail}
                      alt={it.title}
                      className="aspect-video w-full object-cover"
                    />
                    {it.source === "audio" && (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        <Mic size={10} /> AI transcribed
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="line-clamp-2 min-h-[2.5rem] font-semibold">{it.title}</h3>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={12} /> {fmtDate(it.processed_at)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare size={12} /> {it.chat_count} chats
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/chat/${it.video_id}`);
                        }}
                        className="btn-primary flex-1 py-2 text-sm"
                      >
                        View <ArrowRight size={14} />
                      </button>
                      <button
                        onClick={(e) => remove(it.video_id, e)}
                        className="rounded-xl border border-red-200 p-2.5 text-red-500 transition-colors hover:bg-red-50 dark:border-red-500/20 dark:hover:bg-red-500/10"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {filtered.length === 0 && (
            <p className="py-10 text-center text-slate-400">No videos match your filters.</p>
          )}
        </>
      )}
    </motion.div>
  );
};

export default History;

/**
 * pages/History.jsx
 * -----------------
 * The full library of processed videos: search, date / source filters,
 * sorting, grid or list layout, and per-video actions (open, bookmark, add to
 * a collection, remove). Cards surface the numbers that matter — chats,
 * questions, the last thing you asked and any summary already generated.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Calendar,
  Clock,
  FileText,
  FolderPlus,
  History as HistoryIcon,
  LayoutGrid,
  List,
  MessagesSquare,
  Mic,
  MoreVertical,
  Play,
  Search,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";

import Skeleton from "../components/Skeleton";
import { ConfirmDialog } from "../components/ui/Modal";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "../components/ui/Menu";
import {
  EmptyState,
  PageHeader,
  SegmentedControl,
} from "../components/ui";
import CollectionFormModal from "../components/CollectionFormModal";
import { processedApi, getErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLibrary } from "../context/LibraryContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useStored } from "../lib/store";
import { formatDate, parseDate, plainSnippet, timeAgo } from "../lib/format";
import { useNotify } from "../lib/notify";

const DATE_FILTERS = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
];

const SORTS = [
  { id: "recent", label: "Most recent" },
  { id: "popular", label: "Most chats" },
  { id: "title", label: "Title A–Z" },
];

const SOURCES = [
  { id: "all", label: "All sources" },
  { id: "captions", label: "Captions" },
  { id: "audio", label: "AI transcribed" },
];

const History = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { processed, loading, refresh, removeVideoLocally } = useWorkspace();
  const {
    summaries,
    collections,
    isVideoBookmarked,
    toggleVideoBookmark,
    toggleVideoInCollection,
    purgeVideo,
  } = useLibrary();

  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState(searchParams.get("sort") || "recent");
  const [layout, setLayout] = useStored(user?.id || "guest", "history_layout", "grid");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [newCollectionFor, setNewCollectionFor] = useState(null);
  const [recentViews] = useStored(user?.id || "guest", "recent_views", []);

  // Keep ?sort= in the URL so the dashboard can deep-link to "most chats"
  useEffect(() => {
    const current = searchParams.get("sort") || "recent";
    if (current !== sort) {
      const next = new URLSearchParams(searchParams);
      if (sort === "recent") next.delete("sort");
      else next.set("sort", sort);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const summaryByVideo = useMemo(() => {
    const map = new Map();
    summaries.forEach((summary) => {
      if (!map.has(summary.video_id)) map.set(summary.video_id, summary);
    });
    return map;
  }, [summaries]);

  const recentlyViewed = useMemo(() => {
    const byId = new Map(processed.map((video) => [video.video_id, video]));
    return (recentViews || [])
      .map((id) => byId.get(id))
      .filter(Boolean)
      .slice(0, 8);
  }, [recentViews, processed]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const needle = query.trim().toLowerCase();

    const rows = processed.filter((item) => {
      if (needle) {
        const haystack = `${item.title || ""} ${item.last_question || ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (source !== "all" && (item.source || "captions") !== source) return false;
      if (dateFilter !== "all" && item.processed_at) {
        const ts = parseDate(item.processed_at)?.getTime() || 0;
        if (dateFilter === "today") {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          if (ts < start.getTime()) return false;
        } else if (ts < now - Number(dateFilter) * 86_400_000) {
          return false;
        }
      }
      return true;
    });

    return rows.sort((a, b) => {
      if (sort === "popular") return (b.chat_count || 0) - (a.chat_count || 0);
      if (sort === "title") return (a.title || "").localeCompare(b.title || "");
      return 0; // API already returns newest first
    });
  }, [processed, query, dateFilter, source, sort]);

  const filtersActive = query || dateFilter !== "all" || source !== "all";

  const remove = async (video) => {
    try {
      await processedApi.remove(video.video_id);
      removeVideoLocally(video.video_id);
      purgeVideo(video.video_id);
      notify.success("Removed from history");
      refresh({ silent: true });
    } catch (error) {
      notify.error(getErrorMessage(error));
    }
  };

  const addToCollection = (collectionId, video) => {
    const added = toggleVideoInCollection(collectionId, video.video_id);
    const name = collections.find((c) => c.id === collectionId)?.name || "collection";
    notify.success(added ? `Added to ${name}` : `Removed from ${name}`);
  };

  const cardActions = (video) => (
    <Menu
      width="w-60"
      trigger={
        <button
          onClick={(event) => event.stopPropagation()}
          aria-label="Video actions"
          className="rounded-lg border border-line bg-card/90 p-1.5 text-muted backdrop-blur transition-colors hover:text-ink"
        >
          <MoreVertical size={15} />
        </button>
      }
    >
      <MenuItem icon={Play} onClick={() => navigate(`/chat/${video.video_id}`)}>
        Open chat
      </MenuItem>
      <MenuItem
        icon={Sparkles}
        onClick={() => navigate(`/chat/${video.video_id}?insight=summary`)}
      >
        Generate summary
      </MenuItem>
      <MenuItem
        icon={isVideoBookmarked(video.video_id) ? BookmarkCheck : Bookmark}
        onClick={() => {
          const added = toggleVideoBookmark(video);
          notify.success(added ? "Bookmarked" : "Bookmark removed");
        }}
      >
        {isVideoBookmarked(video.video_id) ? "Remove bookmark" : "Bookmark video"}
      </MenuItem>

      <MenuDivider />
      <MenuLabel>Add to collection</MenuLabel>
      {collections.length === 0 ? (
        <MenuItem icon={FolderPlus} onClick={() => setNewCollectionFor(video)}>
          New collection
        </MenuItem>
      ) : (
        <>
          {collections.slice(0, 5).map((collection) => (
            <MenuItem
              key={collection.id}
              icon={collection.video_ids.includes(video.video_id) ? BookmarkCheck : FolderPlus}
              onClick={() => addToCollection(collection.id, video)}
            >
              {collection.name}
            </MenuItem>
          ))}
          <MenuItem icon={FolderPlus} onClick={() => setNewCollectionFor(video)}>
            New collection…
          </MenuItem>
        </>
      )}

      <MenuDivider />
      <MenuItem icon={Trash2} danger onClick={() => setPendingDelete(video)}>
        Remove from history
      </MenuItem>
    </Menu>
  );

  const renderGridCard = (video) => {
    const summary = summaryByVideo.get(video.video_id);
    return (
      <motion.article
        key={video.video_id}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.22 }}
        onClick={() => navigate(`/chat/${video.video_id}`)}
        className="card-flush card-interactive group cursor-pointer overflow-hidden"
      >
        <div className="relative">
          <img
            src={video.thumbnail}
            alt=""
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-70" />

          <div className="absolute left-2 top-2 flex gap-1.5">
            {video.source === "audio" && (
              <span className="badge bg-black/70 text-white backdrop-blur">
                <Mic size={9} /> AI transcribed
              </span>
            )}
            {summary && (
              <span className="badge badge-gold backdrop-blur">
                <FileText size={9} /> Summary
              </span>
            )}
          </div>

          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {cardActions(video)}
          </div>

          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            <MessagesSquare size={10} /> {video.chat_count || 0} chats
          </span>

          <span className="absolute bottom-2 right-2 flex h-9 w-9 scale-90 items-center justify-center rounded-full bg-accent text-white opacity-0 shadow-glow transition-all group-hover:scale-100 group-hover:opacity-100">
            <Play size={15} className="ml-0.5" />
          </span>
        </div>

        <div className="p-4">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-ink">
            {video.title || video.video_id}
          </h3>

          {video.last_question && (
            <p className="mt-2 line-clamp-1 text-xs text-muted">
              <span className="text-faint">Last asked:</span>{" "}
              {plainSnippet(video.last_question, 70)}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1">
              <Calendar size={11} /> {formatDate(video.processed_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              {isVideoBookmarked(video.video_id) && (
                <BookmarkCheck size={12} className="text-gold" />
              )}
              {video.questions_asked || 0} questions
            </span>
          </div>
        </div>
      </motion.article>
    );
  };

  const renderListRow = (video) => {
    const summary = summaryByVideo.get(video.video_id);
    return (
      <motion.article
        key={video.video_id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        onClick={() => navigate(`/chat/${video.video_id}`)}
        className="card-flush card-interactive group flex cursor-pointer items-center gap-4 p-3"
      >
        <div className="relative shrink-0">
          <img
            src={video.thumbnail}
            alt=""
            loading="lazy"
            className="h-[68px] w-[120px] rounded-lg object-cover"
          />
          {video.source === "audio" && (
            <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold text-white">
              <Mic size={8} className="inline" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-sm font-semibold text-ink">
            {video.title || video.video_id}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs text-muted">
            {video.last_question
              ? plainSnippet(video.last_question, 110)
              : summary
              ? plainSnippet(summary.content || summary.points?.[0]?.point, 110)
              : "No questions asked yet."}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
            <span className="inline-flex items-center gap-1">
              <Calendar size={11} /> {formatDate(video.processed_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessagesSquare size={11} /> {video.chat_count || 0} chats
            </span>
            {summary && (
              <span className="inline-flex items-center gap-1 text-gold">
                <FileText size={11} /> Summary saved
              </span>
            )}
            {isVideoBookmarked(video.video_id) && (
              <span className="inline-flex items-center gap-1 text-gold">
                <BookmarkCheck size={11} /> Bookmarked
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/chat/${video.video_id}`);
            }}
            className="btn-secondary hidden h-9 text-xs sm:inline-flex"
          >
            Open <ArrowRight size={13} />
          </button>
          {cardActions(video)}
        </div>
      </motion.article>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6"
    >
      <PageHeader
        title="History"
        icon={HistoryIcon}
        subtitle={
          loading
            ? "Loading your library..."
            : `${processed.length} ${processed.length === 1 ? "video" : "videos"} processed · ${processed.reduce(
                (total, video) => total + (video.chat_count || 0),
                0
              )} conversations`
        }
      >
        <SegmentedControl
          value={layout}
          onChange={setLayout}
          options={[
            { id: "grid", label: "Grid", icon: LayoutGrid },
            { id: "list", label: "List", icon: List },
          ]}
        />
      </PageHeader>

      {/* Recently viewed */}
      {!loading && recentlyViewed.length > 0 && !filtersActive && (
        <section className="mb-6">
          <h2 className="section-title mb-3">
            <Clock size={15} className="text-accent" /> Recently viewed
          </h2>
          <div className="rail no-scrollbar">
            {recentlyViewed.map((video) => (
              <button
                key={`recent-${video.video_id}`}
                onClick={() => navigate(`/chat/${video.video_id}`)}
                className="group w-[168px] shrink-0 text-left"
              >
                <div className="overflow-hidden rounded-xl border border-line">
                  <img
                    src={video.thumbnail}
                    alt=""
                    loading="lazy"
                    className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-medium leading-snug text-ink">
                  {video.title || video.video_id}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Controls */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search videos and questions..."
            className="input-field h-11 pl-10 pr-9"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-faint transition-colors hover:text-ink"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            aria-label="Filter by transcript source"
            className="select-field h-11 w-auto"
          >
            {SOURCES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Sort videos"
            className="select-field h-11 w-auto"
          >
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {DATE_FILTERS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setDateFilter(filter.id)}
            className={`chip ${dateFilter === filter.id ? "chip-active" : ""}`}
          >
            {filter.label}
          </button>
        ))}
        {filtersActive && (
          <button
            onClick={() => {
              setQuery("");
              setDateFilter("all");
              setSource("all");
            }}
            className="link-quiet ml-1"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-faint">
          {filtered.length} of {processed.length} shown
        </span>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-[260px]" />
          ))}
        </div>
      ) : processed.length === 0 ? (
        <EmptyState
          icon={Video}
          title="Your history is empty"
          description="Process your first YouTube video and it will appear here with its chats, summaries and quizzes."
          action={
            <button onClick={() => navigate("/process")} className="btn-primary">
              Process a video <ArrowRight size={15} />
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No videos match your filters"
          description="Try a different search term, or widen the date range."
          action={
            <button
              onClick={() => {
                setQuery("");
                setDateFilter("all");
                setSource("all");
              }}
              className="btn-secondary"
            >
              Clear filters
            </button>
          }
        />
      ) : layout === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">{filtered.map(renderGridCard)}</AnimatePresence>
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">{filtered.map(renderListRow)}</AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remove this video?"
        message={`“${pendingDelete?.title || "This video"}” and all of its saved chats will be deleted. This can't be undone.`}
        confirmLabel="Remove"
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        onClose={() => setPendingDelete(null)}
      />

      <CollectionFormModal
        open={!!newCollectionFor}
        onClose={() => setNewCollectionFor(null)}
        onSaved={(collectionId) => {
          if (newCollectionFor) {
            toggleVideoInCollection(collectionId, newCollectionFor.video_id);
            notify.success(`Added “${newCollectionFor.title}” to the collection`);
          }
        }}
      />
    </motion.div>
  );
};

export default History;

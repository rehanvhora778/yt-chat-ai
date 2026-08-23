/**
 * pages/Collections.jsx
 * ---------------------
 * Collections group processed videos — a course, a research topic, a playlist
 * you're working through. Opening one shows its videos plus aggregate insights
 * (chats, questions and the words that come up most across those videos),
 * computed from data already loaded by WorkspaceContext.
 *
 * Collections live in the browser under the signed-in user (see lib/store.js);
 * no backend route was added for them.
 */

import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  FolderOpen,
  FolderPlus,
  Hash,
  HelpCircle,
  MessagesSquare,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Trash2,
  Video,
  X,
} from "lucide-react";

import CollectionFormModal from "../components/CollectionFormModal";
import VideoPickerModal from "../components/VideoPickerModal";
import { ConfirmDialog } from "../components/ui/Modal";
import { Menu, MenuItem } from "../components/ui/Menu";
import { EmptyState, PageHeader, SectionCard } from "../components/ui";
import { collectionColorValue, useLibrary } from "../context/LibraryContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { formatDate, plainSnippet, timeAgo } from "../lib/format";
import { useNotify } from "../lib/notify";

const STOPWORDS = new Set([
  "this", "that", "with", "what", "when", "where", "which", "about", "from",
  "have", "does", "your", "video", "explain", "into", "there", "their", "them",
  "would", "could", "should", "than", "then", "these", "those", "tell", "give",
  "main", "does", "summarize", "please",
]);

/** Words that come up most across the questions asked in a collection. */
const topKeywords = (chats, limit = 8) => {
  const counts = new Map();
  chats.forEach((chat) => {
    (chat.question || "")
      .toLowerCase()
      .match(/[a-z]{4,}/g)
      ?.forEach((word) => {
        if (STOPWORDS.has(word)) return;
        counts.set(word, (counts.get(word) || 0) + 1);
      });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
};

/* ------------------------------------------------------------------ */

const CollectionCard = ({ collection, videos, chats, onOpen, onEdit, onDelete }) => {
  const color = collectionColorValue(collection.color);
  const thumbnails = videos.slice(0, 3);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.22 }}
      onClick={onOpen}
      className="card card-interactive cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `rgb(${color} / 0.14)`,
            color: `rgb(${color})`,
          }}
        >
          <FolderOpen size={18} />
        </span>

        <Menu
          trigger={
            <button
              onClick={(event) => event.stopPropagation()}
              aria-label="Collection actions"
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card2 hover:text-ink"
            >
              <MoreVertical size={15} />
            </button>
          }
        >
          <MenuItem icon={FolderOpen} onClick={onOpen}>
            Open
          </MenuItem>
          <MenuItem icon={Pencil} onClick={onEdit}>
            Edit details
          </MenuItem>
          <MenuItem icon={Trash2} danger onClick={onDelete}>
            Delete collection
          </MenuItem>
        </Menu>
      </div>

      <h3 className="mt-3 line-clamp-1 text-sm font-semibold text-ink">
        {collection.name}
      </h3>
      <p className="mt-1 line-clamp-2 min-h-[2rem] text-xs text-muted">
        {collection.description || "No description"}
      </p>

      {thumbnails.length > 0 && (
        <div className="mt-3 flex -space-x-3">
          {thumbnails.map((video) => (
            <img
              key={video.video_id}
              src={video.thumbnail}
              alt=""
              loading="lazy"
              className="h-9 w-16 rounded-md border border-line object-cover"
            />
          ))}
          {videos.length > 3 && (
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-card2 text-[10px] font-bold text-muted">
              +{videos.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 border-t border-line pt-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <Video size={11} /> {collection.video_ids.length} videos
        </span>
        <span className="inline-flex items-center gap-1">
          <MessagesSquare size={11} /> {chats} chats
        </span>
        <span className="ml-auto text-faint">{timeAgo(collection.updated_at)}</span>
      </div>
    </motion.article>
  );
};

/* ------------------------------------------------------------------ */

const CollectionDetail = ({ collection, onBack, onEdit, onDelete }) => {
  const navigate = useNavigate();
  const notify = useNotify();
  const { videosById, chats } = useWorkspace();
  const { toggleVideoInCollection } = useLibrary();
  const [addOpen, setAddOpen] = useState(false);

  const color = collectionColorValue(collection.color);

  const videos = useMemo(
    () => collection.video_ids.map((id) => videosById.get(id)).filter(Boolean),
    [collection.video_ids, videosById]
  );

  const collectionChats = useMemo(
    () => chats.filter((chat) => collection.video_ids.includes(chat.video_id)),
    [chats, collection.video_ids]
  );

  const keywords = useMemo(() => topKeywords(collectionChats), [collectionChats]);
  const totalChats = collectionChats.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <button onClick={onBack} className="link-quiet mb-4 inline-flex items-center gap-1.5">
        <ArrowLeft size={13} /> All collections
      </button>

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: `rgb(${color} / 0.14)`,
              color: `rgb(${color})`,
            }}
          >
            <FolderOpen size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              {collection.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {collection.description || "No description"}
            </p>
            <p className="mt-1 text-xs text-faint">
              Created {formatDate(collection.created_at)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => setAddOpen(true)} className="btn-primary h-10">
            <Plus size={15} /> Add videos
          </button>
          <button onClick={onEdit} className="btn-ghost h-10">
            <Pencil size={14} /> Edit
          </button>
          <button onClick={onDelete} className="btn-danger h-10">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Aggregate insights */}
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icon: Video, label: "Videos", value: videos.length },
          { icon: MessagesSquare, label: "Chats", value: totalChats },
          {
            icon: HelpCircle,
            label: "Questions",
            value: totalChats,
          },
          {
            icon: Hash,
            label: "Recurring topics",
            value: keywords.length,
          },
        ].map((stat) => (
          <div key={stat.label} className="card">
            <span className="icon-tile">
              <stat.icon size={17} />
            </span>
            <p className="mt-3 text-xl font-bold text-ink">{stat.value}</p>
            <p className="text-xs text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Videos in this collection" icon={Video} className="lg:col-span-2">
          {videos.length === 0 ? (
            <EmptyState
              icon={Video}
              title="No videos yet"
              description="Add processed videos to build this collection."
              compact
              action={
                <button onClick={() => setAddOpen(true)} className="btn-secondary h-9 text-xs">
                  <Plus size={14} /> Add videos
                </button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {videos.map((video) => (
                <li
                  key={video.video_id}
                  className="group flex items-center gap-3 rounded-xl border border-line p-2 transition-colors hover:border-line2 hover:bg-card2"
                >
                  <img
                    src={video.thumbnail}
                    alt=""
                    loading="lazy"
                    className="h-12 w-[86px] shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-ink">
                      {video.title || video.video_id}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {video.chat_count || 0} chats · {timeAgo(video.processed_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/chat/${video.video_id}`)}
                    className="btn-secondary h-9 text-xs"
                  >
                    <Play size={13} /> Open
                  </button>
                  <button
                    onClick={() => {
                      toggleVideoInCollection(collection.id, video.video_id);
                      notify.success("Removed from collection");
                    }}
                    aria-label="Remove from collection"
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-card3 hover:text-ink"
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="What you ask about" icon={Hash}>
          {keywords.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No questions yet"
              description="Ask questions in these videos and the recurring themes will show up here."
              compact
            />
          ) : (
            <ul className="space-y-2.5">
              {keywords.map((keyword) => {
                const width = Math.round((keyword.count / keywords[0].count) * 100);
                return (
                  <li key={keyword.word}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium capitalize text-ink">{keyword.word}</span>
                      <span className="text-faint">{keyword.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-card3">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {collectionChats.length > 0 && (
            <>
              <div className="divider my-4" />
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-faint">
                Latest question
              </p>
              <p className="text-xs leading-relaxed text-muted">
                {plainSnippet(collectionChats[collectionChats.length - 1].question, 160)}
              </p>
            </>
          )}
        </SectionCard>
      </div>

      <VideoPickerModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={`Add videos to ${collection.name}`}
        description="Tap a video to add or remove it. Close when you're done."
        icon={FolderPlus}
        multiple
        selectedIds={collection.video_ids}
        onSelect={(video) => toggleVideoInCollection(collection.id, video.video_id)}
      />
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */

const Collections = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const notify = useNotify();
  const { collections, deleteCollection } = useLibrary();
  const { videosById } = useWorkspace();

  const [formFor, setFormFor] = useState(null); // collection being edited
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const openId = searchParams.get("open");
  const active = collections.find((collection) => collection.id === openId) || null;

  const openCollection = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set("open", id);
    setSearchParams(next);
  };

  const closeCollection = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next, { replace: true });
  };

  const videosFor = (collection) =>
    collection.video_ids.map((id) => videosById.get(id)).filter(Boolean);

  const chatsFor = (collection) =>
    collection.video_ids.reduce(
      (total, id) => total + (videosById.get(id)?.chat_count || 0),
      0
    );

  const handleDelete = (collection) => {
    deleteCollection(collection.id);
    notify.success("Collection deleted");
    if (openId === collection.id) closeCollection();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6"
    >
      {active ? (
        <CollectionDetail
          collection={active}
          onBack={closeCollection}
          onEdit={() => setFormFor(active)}
          onDelete={() => setPendingDelete(active)}
        />
      ) : (
        <>
          <PageHeader
            title="Collections"
            icon={FolderOpen}
            subtitle="Group related videos so you can review a course or topic in one place."
          >
            <button onClick={() => setCreateOpen(true)} className="btn-primary h-10">
              <Plus size={15} /> New collection
            </button>
          </PageHeader>

          {collections.length === 0 ? (
            <EmptyState
              icon={FolderPlus}
              title="No collections yet"
              description="Collections keep your library organised — one per course, project or research topic."
              action={
                <button onClick={() => setCreateOpen(true)} className="btn-primary">
                  <Plus size={15} /> Create your first collection
                </button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {collections.map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    videos={videosFor(collection)}
                    chats={chatsFor(collection)}
                    onOpen={() => openCollection(collection.id)}
                    onEdit={() => setFormFor(collection)}
                    onDelete={() => setPendingDelete(collection)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      <CollectionFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={openCollection}
      />

      <CollectionFormModal
        open={!!formFor}
        collection={formFor}
        onClose={() => setFormFor(null)}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this collection?"
        message={`“${pendingDelete?.name}” will be removed. The videos themselves and their chats stay in your history.`}
        confirmLabel="Delete"
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
        onClose={() => setPendingDelete(null)}
      />
    </motion.div>
  );
};

export default Collections;

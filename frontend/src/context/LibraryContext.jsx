/**
 * context/LibraryContext.jsx
 * --------------------------
 * The parts of the workspace the API doesn't store: collections, bookmarks and
 * the cache of AI summaries / key points that have already been generated.
 *
 * All of it is kept in the browser under the signed-in user's namespace (see
 * lib/store.js) — the backend, its routes and its data model are untouched.
 * Settings → Data lets the user export or clear everything.
 */

import { createContext, useCallback, useContext, useMemo } from "react";

import { useStored } from "../lib/store";
import { useAuth } from "./AuthContext";

const LibraryContext = createContext();

const EMPTY = [];

export const COLLECTION_COLORS = [
  { id: "red", label: "Red", value: "244 33 46" },
  { id: "gold", label: "Gold", value: "232 184 75" },
  { id: "violet", label: "Violet", value: "167 139 250" },
  { id: "cyan", label: "Cyan", value: "34 211 238" },
  { id: "emerald", label: "Emerald", value: "52 211 153" },
  { id: "slate", label: "Slate", value: "148 163 184" },
];

/** RGB triplet for a collection colour id, for use in inline styles. */
export const collectionColorValue = (id) =>
  (COLLECTION_COLORS.find((color) => color.id === id) || COLLECTION_COLORS[0]).value;

const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const summaryKey = (videoId, type, language = "en") =>
  `${videoId}:${type}:${language}`;

export const LibraryProvider = ({ children }) => {
  const { user } = useAuth();
  const scope = user?.id || "guest";

  const [collections, setCollections] = useStored(scope, "collections", EMPTY);
  const [bookmarks, setBookmarks] = useStored(scope, "bookmarks", EMPTY);
  const [summaries, setSummaries] = useStored(scope, "summaries", EMPTY);

  /* ---------------- collections ---------------- */

  const createCollection = useCallback(
    ({ name, description = "", color = "red", videoIds = [] }) => {
      const collection = {
        id: uid(),
        name: name.trim(),
        description: description.trim(),
        color,
        video_ids: [...videoIds],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setCollections((list) => [collection, ...(list || [])]);
      return collection;
    },
    [setCollections]
  );

  const updateCollection = useCallback(
    (id, patch) =>
      setCollections((list) =>
        (list || []).map((c) =>
          c.id === id ? { ...c, ...patch, updated_at: new Date().toISOString() } : c
        )
      ),
    [setCollections]
  );

  const deleteCollection = useCallback(
    (id) => setCollections((list) => (list || []).filter((c) => c.id !== id)),
    [setCollections]
  );

  const toggleVideoInCollection = useCallback(
    (collectionId, videoId) => {
      let added = false;
      setCollections((list) =>
        (list || []).map((c) => {
          if (c.id !== collectionId) return c;
          const has = c.video_ids.includes(videoId);
          added = !has;
          return {
            ...c,
            video_ids: has
              ? c.video_ids.filter((v) => v !== videoId)
              : [...c.video_ids, videoId],
            updated_at: new Date().toISOString(),
          };
        })
      );
      return added;
    },
    [setCollections]
  );

  /** Drop a video from every collection (used when history is deleted). */
  const purgeVideo = useCallback(
    (videoId) => {
      setCollections((list) =>
        (list || []).map((c) =>
          c.video_ids.includes(videoId)
            ? { ...c, video_ids: c.video_ids.filter((v) => v !== videoId) }
            : c
        )
      );
      setBookmarks((list) => (list || []).filter((b) => b.video_id !== videoId));
      setSummaries((list) => (list || []).filter((s) => s.video_id !== videoId));
    },
    [setCollections, setBookmarks, setSummaries]
  );

  /* ---------------- bookmarks ---------------- */

  const isVideoBookmarked = useCallback(
    (videoId) =>
      (bookmarks || []).some((b) => b.type === "video" && b.video_id === videoId),
    [bookmarks]
  );

  const toggleVideoBookmark = useCallback(
    (video) => {
      const exists = (bookmarks || []).some(
        (b) => b.type === "video" && b.video_id === video.video_id
      );
      if (exists) {
        setBookmarks((list) =>
          (list || []).filter(
            (b) => !(b.type === "video" && b.video_id === video.video_id)
          )
        );
        return false;
      }
      setBookmarks((list) => [
        {
          id: uid(),
          type: "video",
          video_id: video.video_id,
          video_title: video.title || video.video_title || "",
          thumbnail: video.thumbnail || "",
          created_at: new Date().toISOString(),
        },
        ...(list || []),
      ]);
      return true;
    },
    [bookmarks, setBookmarks]
  );

  const addAnswerBookmark = useCallback(
    ({ videoId, videoTitle, question, answer }) => {
      setBookmarks((list) => [
        {
          id: uid(),
          type: "answer",
          video_id: videoId,
          video_title: videoTitle || "",
          question: question || "",
          answer: answer || "",
          created_at: new Date().toISOString(),
        },
        ...(list || []),
      ]);
    },
    [setBookmarks]
  );

  const removeBookmark = useCallback(
    (id) => setBookmarks((list) => (list || []).filter((b) => b.id !== id)),
    [setBookmarks]
  );

  /* ---------------- cached AI insights ---------------- */

  const saveSummary = useCallback(
    ({ videoId, videoTitle, type, language, content, points }) => {
      const entry = {
        key: summaryKey(videoId, type, language),
        video_id: videoId,
        video_title: videoTitle || "",
        type,
        language: language || "en",
        content: content || "",
        points: points || [],
        created_at: new Date().toISOString(),
      };
      setSummaries((list) => [
        entry,
        ...(list || []).filter((s) => s.key !== entry.key),
      ]);
      return entry;
    },
    [setSummaries]
  );

  const removeSummary = useCallback(
    (key) => setSummaries((list) => (list || []).filter((s) => s.key !== key)),
    [setSummaries]
  );

  const value = useMemo(
    () => ({
      collections: collections || EMPTY,
      bookmarks: bookmarks || EMPTY,
      summaries: summaries || EMPTY,
      createCollection,
      updateCollection,
      deleteCollection,
      toggleVideoInCollection,
      purgeVideo,
      isVideoBookmarked,
      toggleVideoBookmark,
      addAnswerBookmark,
      removeBookmark,
      saveSummary,
      removeSummary,
    }),
    [
      collections,
      bookmarks,
      summaries,
      createCollection,
      updateCollection,
      deleteCollection,
      toggleVideoInCollection,
      purgeVideo,
      isVideoBookmarked,
      toggleVideoBookmark,
      addAnswerBookmark,
      removeBookmark,
      saveSummary,
      removeSummary,
    ]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};

export const useLibrary = () => useContext(LibraryContext);

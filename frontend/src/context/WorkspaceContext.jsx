/**
 * context/WorkspaceContext.jsx
 * ----------------------------
 * One shared load of the three read endpoints the signed-in app is built on
 * (/analytics, /processed, /history) plus the values derived from them.
 *
 * Fetching once and sharing the result keeps navigation instant — the
 * dashboard, history, analytics and search all read from the same snapshot —
 * and gives every screen a single `refresh()` to call after a mutation.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { analyticsApi, chatApi, processedApi } from "../api/client";
import { parseDate, percentChange } from "../lib/format";

const WorkspaceContext = createContext();

const DAY = 86_400_000;

const sumRange = (rows, from, to) =>
  (rows || []).slice(from, to).reduce((total, row) => total + (row.chats || 0), 0);

export const WorkspaceProvider = ({ children }) => {
  const [analytics, setAnalytics] = useState(null);
  const [processed, setProcessed] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const [analyticsRes, processedRes, chatsRes] = await Promise.allSettled([
      analyticsApi.get(),
      processedApi.list(),
      chatApi.history(),
    ]);
    if (!mounted.current) return;

    if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value.data);
    if (processedRes.status === "fulfilled")
      setProcessed(processedRes.value.data.history || []);
    if (chatsRes.status === "fulfilled") setChats(chatsRes.value.data.history || []);

    const failed = [analyticsRes, processedRes, chatsRes].every(
      (r) => r.status === "rejected"
    );
    setError(failed ? "We couldn't reach the server. Check your connection and try again." : "");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Optimistic local removal so cards disappear instantly after a delete. */
  const removeVideoLocally = useCallback((videoId) => {
    setProcessed((list) => list.filter((v) => v.video_id !== videoId));
    setChats((list) => list.filter((c) => c.video_id !== videoId));
  }, []);

  /* ---------------- derived views ---------------- */

  // Newest chats first (the API returns them oldest first)
  const recentChats = useMemo(() => [...chats].reverse(), [chats]);

  const videosById = useMemo(() => {
    const map = new Map();
    processed.forEach((video) => map.set(video.video_id, video));
    return map;
  }, [processed]);

  const popularVideos = useMemo(
    () =>
      [...processed].sort(
        (a, b) =>
          (b.chat_count || 0) - (a.chat_count || 0) ||
          (parseDate(b.processed_at)?.getTime() || 0) -
            (parseDate(a.processed_at)?.getTime() || 0)
      ),
    [processed]
  );

  const totals = analytics?.totals || {};
  const dailyUsage = analytics?.daily_usage || [];

  const trends = useMemo(() => {
    const now = Date.now();
    const inWindow = (video, fromDays, toDays) => {
      const ts = parseDate(video.processed_at)?.getTime();
      if (!ts) return false;
      return ts >= now - fromDays * DAY && ts < now - toDays * DAY;
    };

    const videosThisWeek = processed.filter((v) => inWindow(v, 7, 0)).length;
    const videosLastWeek = processed.filter((v) => inWindow(v, 14, 7)).length;

    const chatsThisWeek = sumRange(dailyUsage, 7, 14);
    const chatsLastWeek = sumRange(dailyUsage, 0, 7);

    return {
      videosThisWeek,
      videosDelta: videosThisWeek - videosLastWeek,
      chatsThisWeek,
      chatsDelta: percentChange(chatsThisWeek, chatsLastWeek),
      avgTokensPerChat: totals.total_chats
        ? Math.round((totals.total_tokens || 0) / totals.total_chats)
        : 0,
    };
  }, [processed, dailyUsage, totals.total_chats, totals.total_tokens]);

  /** Chats grouped per day for the sidebar's daily goal. */
  const chatsToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return chats.filter((c) => {
      const ts = parseDate(c.timestamp);
      return ts && ts.getTime() >= start.getTime();
    }).length;
  }, [chats]);

  const value = useMemo(
    () => ({
      loading,
      error,
      analytics,
      totals,
      dailyUsage,
      topTopics: analytics?.top_topics || [],
      questionsPerVideo: analytics?.questions_per_video || [],
      processed,
      chats,
      recentChats,
      popularVideos,
      videosById,
      trends,
      chatsToday,
      refresh: load,
      removeVideoLocally,
    }),
    [
      loading,
      error,
      analytics,
      totals,
      dailyUsage,
      processed,
      chats,
      recentChats,
      popularVideos,
      videosById,
      trends,
      chatsToday,
      load,
      removeVideoLocally,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => useContext(WorkspaceContext);

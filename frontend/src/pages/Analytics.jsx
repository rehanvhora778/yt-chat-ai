/**
 * pages/Analytics.jsx
 * -------------------
 * FEATURE 6 — AI Analytics dashboard. Animated stat counters plus Recharts
 * visualisations (daily usage, questions per video, most discussed topics).
 *
 * Route: /analytics
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import {
  Video,
  MessagesSquare,
  HelpCircle,
  Timer,
  Coins,
  TrendingUp,
  BarChart3,
  Hash,
} from "lucide-react";

import AnimatedCounter from "../components/AnimatedCounter";
import Skeleton from "../components/Skeleton";
import { analyticsApi, getErrorMessage } from "../api/client";
import { useTheme } from "../context/ThemeContext";

const Analytics = () => {
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Resolve the theme accent into a concrete color for Recharts
  const [accent, setAccent] = useState("#6366f1");
  useEffect(() => {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim();
    if (v) setAccent(`rgb(${v})`);
  }, [theme]);

  useEffect(() => {
    analyticsApi
      .get()
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const totals = data?.totals || {};

  const cards = useMemo(
    () => [
      { icon: Video, label: "Videos Processed", value: totals.videos_processed || 0 },
      { icon: MessagesSquare, label: "Total Chats", value: totals.total_chats || 0 },
      { icon: HelpCircle, label: "Questions Asked", value: totals.questions_asked || 0 },
      {
        icon: Timer,
        label: "Avg Response Time",
        value: (totals.avg_response_time_ms || 0) / 1000,
        decimals: 2,
        suffix: "s",
      },
      { icon: Coins, label: "Total Tokens Used", value: totals.total_tokens || 0 },
    ],
    [totals]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Skeleton className="mb-8 h-9 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center text-slate-500">
        {error}
      </div>
    );
  }

  const tooltipStyle = {
    borderRadius: 12,
    border: "none",
    background: "rgba(15,23,42,0.92)",
    color: "#fff",
    fontSize: 12,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mx-auto max-w-6xl px-4 py-10"
    >
      <div className="mb-8 flex items-center gap-2">
        <BarChart3 className="text-brand-500" size={26} />
        <h1 className="text-3xl font-bold">Analytics</h1>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="card gradient-border"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl accent-grad text-white">
                <Icon size={19} />
              </span>
              <p className="mt-3 text-2xl font-extrabold">
                <AnimatedCounter
                  value={c.value}
                  decimals={c.decimals || 0}
                  suffix={c.suffix || ""}
                />
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Daily usage */}
        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <TrendingUp size={18} className="text-brand-500" /> Daily Usage (14 days)
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.daily_usage}>
              <defs>
                <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} interval={1} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="chats"
                stroke={accent}
                strokeWidth={2.5}
                fill="url(#usageFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Questions per video */}
        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <BarChart3 size={18} className="text-brand-500" /> Questions per Video
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.questions_per_video} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.18)" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis
                type="category"
                dataKey="video"
                width={120}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.1)" }} />
              <Bar dataKey="questions" radius={[0, 6, 6, 0]} fill={accent} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
          {(!data.questions_per_video || data.questions_per_video.length === 0) && (
            <p className="text-center text-sm text-slate-400">No data yet.</p>
          )}
        </div>
      </div>

      {/* Most discussed topics */}
      <div className="card mt-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Hash size={18} className="text-brand-500" /> Most Discussed Topics
        </h3>
        {data.top_topics && data.top_topics.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {data.top_topics.map((t, i) => (
              <motion.span
                key={t.topic}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium dark:border-slate-800 dark:bg-slate-800/60"
              >
                {t.topic}
                <span className="rounded-full accent-grad px-2 py-0.5 text-xs font-bold text-white">
                  {t.count}
                </span>
              </motion.span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Ask some questions to see your most discussed topics.
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default Analytics;

/**
 * pages/Analytics.jsx
 * -------------------
 * Usage analytics for the signed-in account: headline totals, daily activity,
 * questions per video, recurring topics and how transcripts were sourced.
 * All figures come from /analytics and /processed via WorkspaceContext.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Coins,
  Hash,
  HelpCircle,
  MessagesSquare,
  Mic,
  Subtitles,
  Timer,
  TrendingUp,
  Video,
} from "lucide-react";

import Skeleton from "../components/Skeleton";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  SegmentedControl,
  StatCard,
  Trend,
} from "../components/ui";
import { useWorkspace } from "../context/WorkspaceContext";
import { useChartTheme } from "../lib/chartTheme";
import { compactNumber } from "../lib/format";

const RANGES = [
  { id: "7", label: "7 days" },
  { id: "14", label: "14 days" },
];

const Analytics = () => {
  const chart = useChartTheme();
  const {
    loading,
    error,
    totals,
    dailyUsage,
    topTopics,
    questionsPerVideo,
    processed,
    trends,
    refresh,
  } = useWorkspace();

  const [range, setRange] = useState("14");

  const usageRows = useMemo(
    () => (range === "7" ? dailyUsage.slice(-7) : dailyUsage),
    [dailyUsage, range]
  );

  const sourceSplit = useMemo(() => {
    const counts = processed.reduce(
      (acc, video) => {
        if ((video.source || "captions") === "audio") acc.audio += 1;
        else acc.captions += 1;
        return acc;
      },
      { captions: 0, audio: 0 }
    );
    return [
      { name: "Captions", value: counts.captions, icon: Subtitles },
      { name: "AI transcribed", value: counts.audio, icon: Mic },
    ].filter((row) => row.value > 0);
  }, [processed]);

  const busiestDay = useMemo(() => {
    if (!dailyUsage.length) return null;
    return dailyUsage.reduce((best, row) => (row.chats > (best?.chats || 0) ? row : best), null);
  }, [dailyUsage]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
        <Skeleton className="mb-6 h-9 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[136px]" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
        <EmptyState
          icon={BarChart3}
          title="Couldn't load your analytics"
          description={error}
          action={
            <button onClick={() => refresh()} className="btn-primary">
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const statCards = [
    {
      icon: Video,
      label: "Videos processed",
      value: totals.videos_processed || 0,
      footer: <Trend value={trends.videosDelta} label="vs last week" />,
    },
    {
      icon: MessagesSquare,
      label: "Total chats",
      value: totals.total_chats || 0,
      footer: <Trend
          value={trends.chatsDelta}
          suffix="%"
          label="vs last week"
          emptyLabel="No prior week to compare"
        />,
    },
    {
      icon: HelpCircle,
      label: "Questions asked",
      value: totals.questions_asked || 0,
      footer: (
        <span className="text-[11px] text-faint">
          {processed.length ? `${(totals.questions_asked / processed.length).toFixed(1)} per video` : "—"}
        </span>
      ),
    },
    {
      icon: Timer,
      label: "Avg response time",
      value: (totals.avg_response_time_ms || 0) / 1000,
      decimals: 2,
      suffix: "s",
      footer: <span className="text-[11px] text-faint">per AI answer</span>,
    },
    {
      icon: Coins,
      label: "Total tokens used",
      value: totals.total_tokens || 0,
      accentGold: true,
      footer: (
        <span className="text-[11px] text-faint">
          ~{compactNumber(trends.avgTokensPerChat)} per chat
        </span>
      ),
    },
  ];

  const hasActivity = usageRows.some((row) => row.chats > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6"
    >
      <PageHeader
        title="Analytics"
        icon={BarChart3}
        subtitle="How you've been using your AI workspace."
      >
        <SegmentedControl value={range} onChange={setRange} options={RANGES} />
      </PageHeader>

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card, index) => (
          <StatCard key={card.label} {...card} delay={index * 0.05} />
        ))}
      </div>

      {/* Activity + topics */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard
          title={`Daily activity — last ${range} days`}
          icon={TrendingUp}
          className="lg:col-span-2"
          action={
            busiestDay?.chats > 0 && (
              <span className="text-[11px] text-faint">
                Busiest: {busiestDay.date} ({busiestDay.chats})
              </span>
            )
          }
        >
          {!hasActivity ? (
            <EmptyState
              icon={MessagesSquare}
              title="No activity in this period"
              description="Ask a question about any processed video to start building your history."
              compact
            />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={usageRows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chart.accent} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={chart.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: chart.faint }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={14}
                />
                <YAxis
                  allowDecimals={false}
                  width={38}
                  tick={{ fontSize: 11, fill: chart.faint }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={chart.tooltip}
                  cursor={{ stroke: chart.accent, strokeOpacity: 0.35 }}
                />
                <Area
                  type="monotone"
                  dataKey="chats"
                  name="Chats"
                  stroke={chart.accent}
                  strokeWidth={2}
                  fill="url(#analyticsFill)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Transcript sources" icon={Subtitles}>
          {sourceSplit.length === 0 ? (
            <EmptyState
              icon={Video}
              title="No videos yet"
              description="Process a video to see whether it used captions or AI transcription."
              compact
            />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={sourceSplit}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {sourceSplit.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={index === 0 ? chart.accent : chart.gold}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chart.tooltip} />
                </PieChart>
              </ResponsiveContainer>

              <ul className="mt-2 space-y-2">
                {sourceSplit.map((entry, index) => (
                  <li key={entry.name} className="flex items-center gap-2.5 text-xs">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: index === 0 ? chart.accent : chart.gold }}
                    />
                    <span className="flex-1 text-muted">{entry.name}</span>
                    <span className="font-semibold text-ink">{entry.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </SectionCard>
      </div>

      {/* Per-video + topics */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Questions per video" icon={BarChart3}>
          {questionsPerVideo.length === 0 ? (
            <EmptyState
              icon={HelpCircle}
              title="No questions yet"
              description="Once you start asking, you'll see which videos you dig into most."
              compact
            />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, questionsPerVideo.length * 42)}>
              <BarChart
                data={questionsPerVideo}
                layout="vertical"
                margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chart.grid} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: chart.faint }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="video"
                  width={130}
                  tick={{ fontSize: 11, fill: chart.muted }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={chart.tooltip}
                  cursor={{ fill: chart.accent, fillOpacity: 0.08 }}
                />
                <Bar
                  dataKey="questions"
                  name="Questions"
                  radius={[0, 6, 6, 0]}
                  fill={chart.accent}
                  barSize={14}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Most discussed topics" icon={Hash}>
          {topTopics.length === 0 ? (
            <EmptyState
              icon={Hash}
              title="No topics yet"
              description="Topics are pulled from the words you use most in your questions."
              compact
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {topTopics.map((topic, index) => (
                <motion.span
                  key={topic.topic}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.035 }}
                  className="chip cursor-default"
                >
                  {topic.topic}
                  <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                    {topic.count}
                  </span>
                </motion.span>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </motion.div>
  );
};

export default Analytics;

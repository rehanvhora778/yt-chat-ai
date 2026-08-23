/**
 * pages/Dashboard.jsx
 * -------------------
 * The signed-in home screen. Everything on it is built from the user's own
 * data: /analytics for the headline numbers and the activity chart,
 * /processed for the video library, /history for recent questions, plus the
 * locally-stored collections and cached AI summaries.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  ChevronRight,
  Coins,
  Download,
  FileText,
  Flame,
  FolderOpen,
  FolderPlus,
  HelpCircle,
  MessagesSquare,
  Plus,
  Sparkles,
  Timer,
  TrendingUp,
  Video,
  Youtube,
} from "lucide-react";

import CollectionFormModal from "../components/CollectionFormModal";
import VideoPickerModal from "../components/VideoPickerModal";
import Skeleton from "../components/Skeleton";
import {
  EmptyState,
  SectionCard,
  SegmentedControl,
  StatCard,
  Trend,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { collectionColorValue, useLibrary } from "../context/LibraryContext";
import { usePreferences } from "../context/PreferencesContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useChartTheme } from "../lib/chartTheme";
import {
  compactNumber,
  parseDate,
  plainSnippet,
  timeAgo,
} from "../lib/format";
import { useNotify } from "../lib/notify";

const RANGES = [
  { id: "7", label: "7 days" },
  { id: "14", label: "14 days" },
];

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

/* ------------------------------------------------------------------ */
/* Hero — the app's primary action                                     */
/* ------------------------------------------------------------------ */

const ProcessForm = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  const { preferences, setPreference } = usePreferences();
  const [url, setUrl] = useState("");

  const submit = (event) => {
    event.preventDefault();
    if (!url.trim()) {
      notify.error("Paste a YouTube link to get started");
      return;
    }
    navigate("/process", {
      state: { url: url.trim(), language: preferences.language },
    });
  };

  return (
    <form
      onSubmit={submit}
      className="card gradient-border flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      <div className="relative flex-1">
        <Youtube
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-accent"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube link to chat with it..."
          aria-label="YouTube URL"
          className="input-field h-11 pl-10"
        />
      </div>

      <div className="flex items-center gap-2">
        <SegmentedControl
          value={preferences.language}
          onChange={(id) => setPreference("language", id)}
          options={[
            { id: "en", label: "EN", title: "English" },
            { id: "hi", label: "हिं", title: "Hindi" },
          ]}
        />
        <button type="submit" className="btn-primary h-11 whitespace-nowrap">
          <Sparkles size={16} /> Process
          <ArrowRight size={16} className="hidden sm:block" />
        </button>
      </div>
    </form>
  );
};

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

const ActivityChart = ({ data, range, onRangeChange, loading }) => {
  const chart = useChartTheme();
  const rows = useMemo(
    () => (range === "7" ? data.slice(-7) : data),
    [data, range]
  );
  const total = rows.reduce((sum, row) => sum + (row.chats || 0), 0);

  return (
    <SectionCard
      title="Chat activity"
      icon={TrendingUp}
      className="xl:col-span-5"
      action={
        <SegmentedControl
          size="sm"
          value={range}
          onChange={onRangeChange}
          options={RANGES}
        />
      }
    >
      {loading ? (
        <Skeleton className="h-[212px] w-full" />
      ) : total === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No conversations in this period"
          description="Ask a question about any processed video and your activity will show up here."
          compact
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">
            <span className="text-base font-bold text-ink">{total}</span> chats in the
            last {range} days
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={rows} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chart.accent} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={chart.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: chart.faint }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                allowDecimals={false}
                width={38}
                tick={{ fontSize: 10, fill: chart.faint }}
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
                fill="url(#activityFill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
    </SectionCard>
  );
};

const PopularVideos = ({ videos, loading, onOpen, onBrowse }) => (
  <SectionCard
    title="Popular videos"
    icon={Flame}
    className="xl:col-span-4"
    action={
      <button onClick={onBrowse} className="link-quiet">
        View all
      </button>
    }
  >
    {loading ? (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    ) : videos.length === 0 ? (
      <EmptyState
        icon={Video}
        title="No videos yet"
        description="Process your first YouTube video to see which ones you talk to the most."
        compact
      />
    ) : (
      <ul className="space-y-1">
        {videos.slice(0, 5).map((video) => (
          <li key={video.video_id}>
            <button
              onClick={() => onOpen(video.video_id)}
              className="group flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-card2"
            >
              <img
                src={video.thumbnail}
                alt=""
                loading="lazy"
                className="h-10 w-[70px] shrink-0 rounded-lg object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-[13px] font-medium text-ink">
                  {video.title || video.video_id}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted">
                  {video.chat_count || 0} chats · {timeAgo(video.processed_at)}
                </span>
              </span>
              <span className="badge badge-accent shrink-0">
                <Flame size={10} /> {compactNumber(video.chat_count || 0)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    )}
  </SectionCard>
);

const RecentSummaries = ({ summaries, onOpen, onViewAll, onGenerate }) => (
  <SectionCard
    title="Recent AI summaries"
    icon={Sparkles}
    className="xl:col-span-3"
    action={
      summaries.length > 0 && (
        <button onClick={onViewAll} className="link-quiet">
          View all
        </button>
      )
    }
  >
    {summaries.length === 0 ? (
      <EmptyState
        icon={FileText}
        title="No summaries yet"
        description="Generate a summary or key points from any video and it will be saved here."
        compact
        action={
          <button onClick={onGenerate} className="btn-secondary h-9 text-xs">
            <Sparkles size={14} /> Summarize a video
          </button>
        }
      />
    ) : (
      <ul className="space-y-1">
        {summaries.slice(0, 5).map((summary) => (
          <li key={summary.key}>
            <button
              onClick={() => onOpen(summary)}
              className="group flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-card2"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card2 text-accent">
                <FileText size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-[13px] font-medium text-ink">
                  {summary.video_title || "Untitled video"}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted">
                  {summary.type === "keypoints" ? "Key points" : "Summary"} ·{" "}
                  {timeAgo(summary.created_at)}
                </span>
              </span>
              <ChevronRight
                size={15}
                className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
              />
            </button>
          </li>
        ))}
      </ul>
    )}
  </SectionCard>
);

const RecentChats = ({ chats, loading, onOpen, onViewAll, videosById }) => (
  <SectionCard
    title="Recent chats"
    icon={MessagesSquare}
    className="xl:col-span-5"
    action={
      chats.length > 0 && (
        <button onClick={onViewAll} className="link-quiet">
          View all
        </button>
      )
    }
  >
    {loading ? (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    ) : chats.length === 0 ? (
      <EmptyState
        icon={MessagesSquare}
        title="No questions yet"
        description="Open a processed video and ask anything about it — your conversations land here."
        compact
      />
    ) : (
      <ul className="divide-y divide-line">
        {chats.slice(0, 5).map((chat) => (
          <li key={chat.id}>
            <button
              onClick={() => onOpen(chat.video_id)}
              className="flex w-full items-start gap-3 py-2.5 text-left transition-colors hover:bg-card2/60"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card2 text-accent">
                <MessagesSquare size={13} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-[13px] font-medium text-ink">
                  {chat.video_title || "Untitled video"}
                </span>
                <span className="mt-0.5 line-clamp-1 block text-xs text-muted">
                  {plainSnippet(chat.question, 90)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[11px] text-faint">
                  {timeAgo(chat.timestamp)}
                </span>
                <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted">
                  <MessagesSquare size={10} />
                  {videosById.get(chat.video_id)?.chat_count || 1}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    )}
  </SectionCard>
);

const CollectionsCard = ({ collections, videosById, onOpen, onCreate }) => (
  <SectionCard
    title="Saved collections"
    icon={FolderOpen}
    className="xl:col-span-4"
    action={
      <button onClick={onCreate} className="link-quiet inline-flex items-center gap-1">
        <Plus size={12} /> New
      </button>
    }
  >
    {collections.length === 0 ? (
      <EmptyState
        icon={FolderPlus}
        title="No collections yet"
        description="Group videos by course, topic or project to keep your library tidy."
        compact
        action={
          <button onClick={onCreate} className="btn-secondary h-9 text-xs">
            <Plus size={14} /> Create collection
          </button>
        }
      />
    ) : (
      <ul className="space-y-1">
        {collections.slice(0, 4).map((collection) => {
          const chats = collection.video_ids.reduce(
            (total, id) => total + (videosById.get(id)?.chat_count || 0),
            0
          );
          return (
            <li key={collection.id}>
              <button
                onClick={() => onOpen(collection.id)}
                className="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-card2"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `rgb(${collectionColorValue(collection.color)} / 0.14)`,
                    color: `rgb(${collectionColorValue(collection.color)})`,
                  }}
                >
                  <FolderOpen size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-[13px] font-medium text-ink">
                    {collection.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {collection.video_ids.length} videos · {chats} chats
                  </span>
                </span>
                <ChevronRight
                  size={15}
                  className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
                />
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </SectionCard>
);

const QuickActions = ({ actions }) => (
  <SectionCard title="Quick actions" icon={Sparkles} className="xl:col-span-3">
    <div className="grid grid-cols-2 gap-2">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          className="group flex flex-col gap-2 rounded-xl border border-line bg-card2/60 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:bg-card2"
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
              action.gold
                ? "border-gold/20 bg-gold/10 text-gold"
                : "border-accent/20 bg-accent/10 text-accent"
            }`}
          >
            <action.icon size={15} />
          </span>
          <span>
            <span className="block text-[12px] font-semibold text-ink">
              {action.label}
            </span>
            <span className="mt-0.5 block text-[11px] leading-tight text-muted">
              {action.hint}
            </span>
          </span>
        </button>
      ))}
    </div>
  </SectionCard>
);

const Recommended = ({ videos, topics, topic, onTopic, onOpen }) => (
  <SectionCard
    title="Recommended for you"
    icon={Bookmark}
    action={<span className="text-[11px] text-faint">From your library</span>}
  >
    {topics.length > 0 && (
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => onTopic(null)}
          className={`chip ${topic === null ? "chip-active" : ""}`}
        >
          All topics
        </button>
        {topics.slice(0, 6).map((item) => (
          <button
            key={item.topic}
            onClick={() => onTopic(item.topic)}
            className={`chip ${topic === item.topic ? "chip-active" : ""}`}
          >
            {item.topic}
            <span className="text-[10px] opacity-70">{item.count}</span>
          </button>
        ))}
      </div>
    )}

    {videos.length === 0 ? (
      <EmptyState
        icon={Video}
        title={topic ? `Nothing in your library about “${topic}”` : "Nothing to revisit yet"}
        description={
          topic
            ? "Try another topic, or process a video on this subject."
            : "Once you've processed a few videos, the ones worth a second look appear here."
        }
        compact
      />
    ) : (
      <div className="rail no-scrollbar">
        {videos.map((video) => (
          <button
            key={video.video_id}
            onClick={() => onOpen(video.video_id)}
            className="group w-[188px] shrink-0 text-left"
          >
            <div className="relative overflow-hidden rounded-xl border border-line">
              <img
                src={video.thumbnail}
                alt=""
                loading="lazy"
                className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
              <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {video.chat_count || 0} chats
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug text-ink">
              {video.title || video.video_id}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              {video.author || "Unknown channel"}
            </p>
          </button>
        ))}
      </div>
    )}
  </SectionCard>
);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const { collections, summaries } = useLibrary();
  const {
    loading,
    error,
    totals,
    dailyUsage,
    topTopics,
    processed,
    recentChats,
    popularVideos,
    videosById,
    trends,
    refresh,
  } = useWorkspace();

  const [range, setRange] = useState("14");
  const [topic, setTopic] = useState(null);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [picker, setPicker] = useState(null); // 'summary' | 'export'

  const recommended = useMemo(() => {
    if (topic) {
      const needle = topic.toLowerCase();
      return processed
        .filter((video) => (video.title || "").toLowerCase().includes(needle))
        .slice(0, 10);
    }
    // Least-revisited first: the videos most worth going back to
    return [...processed]
      .sort(
        (a, b) =>
          (a.chat_count || 0) - (b.chat_count || 0) ||
          (parseDate(a.processed_at)?.getTime() || 0) -
            (parseDate(b.processed_at)?.getTime() || 0)
      )
      .slice(0, 10);
  }, [processed, topic]);

  const quickActions = [
    {
      icon: MessagesSquare,
      label: "Start new chat",
      hint: "Process a video",
      onClick: () => navigate("/process"),
    },
    {
      icon: FileText,
      label: "Summarize video",
      hint: "AI summary",
      onClick: () => setPicker("summary"),
    },
    {
      icon: FolderPlus,
      label: "Create collection",
      hint: "Group videos",
      onClick: () => setCollectionOpen(true),
    },
    {
      icon: BarChart3,
      label: "Library insights",
      hint: "Usage analytics",
      onClick: () => navigate("/analytics"),
    },
    {
      icon: Flame,
      label: "Top videos",
      hint: "Most discussed",
      gold: true,
      onClick: () => navigate("/history?sort=popular"),
    },
    {
      icon: Download,
      label: "Export chat",
      hint: preferences.defaultExport.toUpperCase(),
      onClick: () => setPicker("export"),
    },
  ];

  const statCards = [
    {
      icon: Video,
      label: "Videos processed",
      value: totals.videos_processed || 0,
      footer: (
        <Trend
          value={trends.videosDelta}
          label="vs last week"
        />
      ),
    },
    {
      icon: MessagesSquare,
      label: "Total chats",
      value: totals.total_chats || 0,
      footer: (
        <Trend
          value={trends.chatsDelta}
          suffix="%"
          label="vs last week"
          emptyLabel="No prior week to compare"
        />
      ),
    },
    {
      icon: HelpCircle,
      label: "Questions asked",
      value: totals.questions_asked || 0,
      footer: (
        <span className="text-[11px] text-faint">
          across {processed.length} {processed.length === 1 ? "video" : "videos"}
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6"
    >
      {/* Greeting */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {greeting()}, {user?.name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="mt-1 text-sm text-muted">
            Here's what's happening across your YouTube AI workspace.
          </p>
        </div>
      </div>

      <ProcessForm />

      {error && (
        <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3">
          <p className="text-sm text-ink">{error}</p>
          <button onClick={() => refresh()} className="btn-secondary h-9 text-xs">
            Retry
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[136px]" />
            ))
          : statCards.map((card, index) => (
              <StatCard key={card.label} {...card} delay={index * 0.05} />
            ))}
      </div>

      {/* Row: activity · popular · summaries */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <ActivityChart
          data={dailyUsage}
          range={range}
          onRangeChange={setRange}
          loading={loading}
        />
        <PopularVideos
          videos={popularVideos}
          loading={loading}
          onOpen={(id) => navigate(`/chat/${id}`)}
          onBrowse={() => navigate("/history?sort=popular")}
        />
        <RecentSummaries
          summaries={summaries}
          onOpen={() => navigate("/summaries")}
          onViewAll={() => navigate("/summaries")}
          onGenerate={() => setPicker("summary")}
        />
      </div>

      {/* Row: recent chats · collections · quick actions */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <RecentChats
          chats={recentChats}
          loading={loading}
          videosById={videosById}
          onOpen={(id) => navigate(`/chat/${id}`)}
          onViewAll={() => navigate("/history")}
        />
        <CollectionsCard
          collections={collections}
          videosById={videosById}
          onOpen={(id) => navigate(`/collections?open=${id}`)}
          onCreate={() => setCollectionOpen(true)}
        />
        <QuickActions actions={quickActions} />
      </div>

      {/* Recommended */}
      <div className="mt-4">
        <Recommended
          videos={recommended}
          topics={topTopics}
          topic={topic}
          onTopic={setTopic}
          onOpen={(id) => navigate(`/chat/${id}`)}
        />
      </div>

      {/* Modals */}
      <CollectionFormModal
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        onSaved={(id) => navigate(`/collections?open=${id}`)}
      />

      <VideoPickerModal
        open={picker === "summary"}
        onClose={() => setPicker(null)}
        icon={FileText}
        title="Summarize a video"
        description="Pick a processed video — the AI summary opens straight away."
        onSelect={(video) => navigate(`/chat/${video.video_id}?insight=summary`)}
      />

      <VideoPickerModal
        open={picker === "export"}
        onClose={() => setPicker(null)}
        icon={Download}
        title="Export a conversation"
        description={`Choose a video to download its chat as ${preferences.defaultExport.toUpperCase()}.`}
        onSelect={(video) =>
          navigate(`/chat/${video.video_id}?export=${preferences.defaultExport}`)
        }
      />
    </motion.div>
  );
};

export default Dashboard;

/**
 * lib/format.js
 * -------------
 * Small formatting helpers shared by the dashboard, history and settings
 * screens: timestamp parsing, relative times and compact number display.
 */

/**
 * Parse a timestamp coming from the API.
 *
 * The backend stores UTC (`datetime.utcnow()`) and serialises with
 * `.isoformat()`, which produces no timezone suffix — so `new Date(iso)` would
 * read it as *local* time and skew every "x minutes ago" label by the user's
 * offset. Appending "Z" when no zone is present keeps relative times honest.
 */
export const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  let iso = String(value);
  if (!/[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso)) iso += "Z";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

const UNITS = [
  { limit: 60, div: 1, label: "s" },
  { limit: 3600, div: 60, label: "m" },
  { limit: 86400, div: 3600, label: "h" },
  { limit: 604800, div: 86400, label: "d" },
];

/** "just now" · "5m ago" · "3h ago" · "2d ago" · "12 Mar" */
export const timeAgo = (value) => {
  const date = parseDate(value);
  if (!date) return "—";
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  for (const unit of UNITS) {
    if (seconds < unit.limit) {
      return `${Math.floor(seconds / unit.div)}${unit.label} ago`;
    }
  }
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/** "12 Mar 2026" */
export const formatDate = (value, opts) => {
  const date = parseDate(value);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  });
};

/** "14:05" */
export const formatTime = (value) => {
  const date = parseDate(value);
  if (!date) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** 12450 → "12.4K", 1_800_000 → "1.8M" */
export const compactNumber = (value) => {
  const n = Number(value) || 0;
  if (Math.abs(n) < 1000) return String(Math.round(n));
  if (Math.abs(n) < 1_000_000) {
    return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`.replace(".0K", "K");
  }
  return `${(n / 1_000_000).toFixed(1)}M`.replace(".0M", "M");
};

/** 4532 ms → "4.5s" · 950 ms → "950ms" */
export const formatDuration = (ms) => {
  const value = Number(ms) || 0;
  if (value < 1000) return `${Math.round(value)}ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(1)}s`;
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.round((value % 60_000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
};

/** "Rayhan Vora" → "RV" */
export const initialsOf = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

export const pluralize = (count, singular, plural) =>
  `${count} ${count === 1 ? singular : plural || `${singular}s`}`;

/** Percentage change between two periods, or null when there's no baseline. */
export const percentChange = (current, previous) => {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
};

export const youtubeThumb = (videoId, quality = "hqdefault") =>
  videoId ? `https://img.youtube.com/vi/${videoId}/${quality}.jpg` : "";

/** Strip markdown so a snippet can sit inline in a list row. */
export const plainSnippet = (markdown = "", max = 140) => {
  const text = String(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
};

/**
 * components/VideoCard.jsx
 * ------------------------
 * Displays a processed video's thumbnail + metadata. Used on the dashboard and
 * as a header on the chat page.
 */

import { motion } from "framer-motion";
import { Play, User } from "lucide-react";

const VideoCard = ({ video, onClick, compact = false }) => {
  if (!video) return null;

  return (
    <motion.div
      whileHover={onClick ? { y: -4 } : undefined}
      onClick={onClick}
      className={`group overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-sm transition-shadow dark:border-slate-800 dark:bg-slate-900/60 ${
        onClick ? "cursor-pointer hover:shadow-lg" : ""
      } ${compact ? "flex items-center gap-3 p-3" : ""}`}
    >
      <div className={`relative ${compact ? "h-16 w-28 shrink-0" : "aspect-video"}`}>
        <img
          src={video.thumbnail}
          alt={video.title}
          loading="lazy"
          className="h-full w-full rounded-xl object-cover"
        />
        {!compact && (
          <div className="absolute inset-0 flex items-center justify-center rounded-t-2xl bg-black/0 transition-colors group-hover:bg-black/30">
            <span className="flex h-12 w-12 scale-0 items-center justify-center rounded-full bg-white/90 text-brand-600 transition-transform group-hover:scale-100">
              <Play size={22} className="ml-0.5" />
            </span>
          </div>
        )}
      </div>

      <div className={compact ? "min-w-0 flex-1" : "p-4"}>
        <h3 className="line-clamp-2 font-semibold text-slate-800 dark:text-slate-100">
          {video.title}
        </h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <User size={12} /> {video.author || "Unknown"}
        </p>
      </div>
    </motion.div>
  );
};

export default VideoCard;

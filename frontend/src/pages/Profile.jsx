/**
 * pages/Profile.jsx
 * -----------------
 * Displays the signed-in user's details, some usage stats and account actions
 * (theme toggle + logout).
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Calendar,
  MessageSquare,
  Video,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";

import { chatApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const Profile = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ chats: 0, videos: 0 });

  useEffect(() => {
    chatApi
      .history()
      .then((res) => {
        const hist = res.data.history || [];
        const videos = new Set(hist.map((c) => c.video_id));
        setStats({ chats: hist.length, videos: videos.size });
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mx-auto max-w-3xl px-4 py-10"
    >
      <h1 className="mb-8 text-3xl font-bold">Profile</h1>

      {/* Identity card */}
      <div className="glass rounded-3xl p-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-purple-600 text-2xl font-bold text-white">
            {initials}
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold">{user?.name}</h2>
            <p className="text-slate-500 dark:text-slate-400">{user?.email}</p>
          </div>
        </div>

        {/* Details */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Detail icon={User} label="Name" value={user?.name} />
          <Detail icon={Mail} label="Email" value={user?.email} />
          <Detail icon={Calendar} label="Member since" value={joined} />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Stat icon={MessageSquare} label="Total messages" value={stats.chats} />
        <Stat icon={Video} label="Videos chatted with" value={stats.videos} />
      </div>

      {/* Settings */}
      <div className="card mt-6">
        <h3 className="mb-4 font-semibold">Appearance</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all ${
                theme === t.id
                  ? "border-transparent accent-ring"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
              }`}
            >
              <span
                className="h-6 w-6 shrink-0 rounded-full ring-1 ring-black/10"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})`,
                }}
              />
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleLogout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 font-semibold text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
        >
          <LogOut size={18} /> Log out
        </button>
      </div>
    </motion.div>
  );
};

const Detail = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
      <Icon size={17} />
    </span>
    <div className="min-w-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="truncate text-sm font-medium">{value || "—"}</p>
    </div>
  </div>
);

const Stat = ({ icon: Icon, label, value }) => (
  <div className="card flex items-center gap-4">
    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-purple-600 text-white">
      <Icon size={22} />
    </span>
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  </div>
);

export default Profile;

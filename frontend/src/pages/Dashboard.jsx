/**
 * pages/Dashboard.jsx
 * -------------------
 * The signed-in home screen: paste a YouTube URL (with a language toggle) to
 * process a new video, and browse recently processed videos pulled from the
 * user's chat history.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Youtube, Sparkles, ArrowRight, Clock } from "lucide-react";

import VideoCard from "../components/VideoCard";
import Loader from "../components/Loader";
import { chatApi, getErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("en");
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Load history once to derive the list of recently processed videos
  useEffect(() => {
    chatApi
      .history()
      .then((res) => setHistory(res.data.history || []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, []);

  // De-duplicate history into unique videos (most recent first)
  const recentVideos = useMemo(() => {
    const map = new Map();
    [...history].reverse().forEach((c) => {
      if (!map.has(c.video_id)) {
        map.set(c.video_id, {
          video_id: c.video_id,
          title: c.video_title,
          thumbnail: `https://img.youtube.com/vi/${c.video_id}/hqdefault.jpg`,
          author: "",
        });
      }
    });
    return Array.from(map.values()).slice(0, 8);
  }, [history]);

  const handleProcess = (e) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("Please paste a YouTube URL");
      return;
    }
    // Hand off to the processing page which performs the heavy lifting
    navigate("/process", { state: { url: url.trim(), language } });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mx-auto max-w-6xl px-4 py-10"
    >
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Hello, {user?.name?.split(" ")[0] || "there"} 👋
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Paste a YouTube link to start a new conversation.
        </p>
      </div>

      {/* URL input card */}
      <div className="glass rounded-3xl p-6 sm:p-8">
        <form onSubmit={handleProcess} className="space-y-4">
          <div className="relative">
            <Youtube
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500"
            />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="input-field py-4 pl-12 text-base"
            />
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Language toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Language:
              </span>
              <div className="inline-flex rounded-xl border border-slate-300 p-1 dark:border-slate-700">
                {[
                  { code: "en", label: "English" },
                  { code: "hi", label: "हिंदी" },
                ].map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLanguage(l.code)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      language === l.code
                        ? "bg-brand-600 text-white"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary py-3">
              <Sparkles size={18} /> Process Video <ArrowRight size={18} />
            </button>
          </div>
        </form>
      </div>

      {/* Recent videos */}
      <section className="mt-12">
        <div className="mb-5 flex items-center gap-2">
          <Clock size={18} className="text-brand-500" />
          <h2 className="text-xl font-semibold">Recent videos</h2>
        </div>

        {loadingHistory ? (
          <div className="py-12">
            <Loader label="Loading your videos..." />
          </div>
        ) : recentVideos.length === 0 ? (
          <div className="card text-center text-slate-500 dark:text-slate-400">
            <p>You haven't processed any videos yet.</p>
            <p className="text-sm">Paste a link above to get started!</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recentVideos.map((v) => (
              <VideoCard
                key={v.video_id}
                video={v}
                onClick={() =>
                  navigate(`/chat/${v.video_id}`, { state: { video: v } })
                }
              />
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
};

export default Dashboard;

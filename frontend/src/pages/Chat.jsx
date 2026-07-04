/**
 * pages/Chat.jsx
 * --------------
 * ChatGPT-style interface for talking to a processed video. Loads existing
 * history, sends questions to the RAG backend, shows a typing indicator and
 * auto-scrolls. Provides quick actions for Summary / Key Points and a
 * "Download PDF" export of the conversation.
 */

import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Send,
  FileText,
  ListChecks,
  Download,
  ArrowLeft,
  ExternalLink,
  ChevronDown,
  GraduationCap,
} from "lucide-react";

import ChatBubble from "../components/ChatBubble";
import TypingIndicator from "../components/TypingIndicator";
import Loader from "../components/Loader";
import InsightsModal from "../components/InsightsModal";
import QuizModal from "../components/QuizModal";
import { chatApi, videoApi, getErrorMessage } from "../api/client";
import { exportChatToTxt, exportChatToDocx } from "../utils/exportText";
import PrintDocument from "../components/PrintDocument";
import { usePrintExport } from "../lib/printExport";

const SUGGESTIONS = [
  "Summarize this video in 3 points",
  "What are the main takeaways?",
  "Explain the most important concept",
];

const Chat = () => {
  const { videoId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [video, setVideo] = useState(location.state?.video || null);
  const [messages, setMessages] = useState([]); // {role, content}
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);
  const [language, setLanguage] = useState("en");
  const [insight, setInsight] = useState(null); // 'summary' | 'keypoints'
  const [quizOpen, setQuizOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const { printing, startPrint } = usePrintExport();

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // ---- Initial load: video meta (if missing) + chat history ----
  useEffect(() => {
    let cancelled = false;

    const loadVideo = video
      ? Promise.resolve(video)
      : videoApi
          .get(videoId)
          .then((res) => res.data.video)
          .catch(() => ({
            video_id: videoId,
            title: "Video",
            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${videoId}`,
          }));

    Promise.all([loadVideo, chatApi.history(videoId)])
      .then(([vid, histRes]) => {
        if (cancelled) return;
        setVideo(vid);
        const hist = histRes.data.history || [];
        const msgs = [];
        hist.forEach((c) => {
          msgs.push({ role: "user", content: c.question });
          msgs.push({ role: "ai", content: c.answer });
        });
        setMessages(msgs);
        if (hist.length) setLanguage(hist[hist.length - 1].language || "en");
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => !cancelled && setLoadingPage(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // ---- Auto-scroll to newest message ----
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const sendQuestion = async (question) => {
    const text = (question ?? input).trim();
    if (!text || sending) return;

    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    try {
      const res = await chatApi.ask(videoId, text, language);
      setMessages((m) => [
        ...m,
        { role: "ai", content: res.data.answer },
      ]);
    } catch (err) {
      const msg = getErrorMessage(err);
      setMessages((m) => [
        ...m,
        { role: "ai", content: `⚠️ ${msg}` },
      ]);
      toast.error(msg);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendQuestion();
  };

  const handleExport = (fmt) => {
    setExportOpen(false);
    if (messages.length === 0) {
      toast.error("No conversation to export yet");
      return;
    }
    if (fmt === "pdf") {
      // Browser "Save as PDF": premium layout + full Unicode (Hindi/CJK/emoji).
      startPrint();
      return;
    }
    if (fmt === "docx") exportChatToDocx(video?.title, messages);
    else exportChatToTxt(video?.title, messages);
    toast.success(`Exported ${fmt.toUpperCase()}`);
  };

  if (loadingPage) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader label="Loading conversation..." />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mx-auto flex h-[calc(100vh-5.5rem)] max-w-5xl flex-col px-4 py-4"
    >
      {/* ---- Video header ---- */}
      <div className="glass mb-4 flex items-center gap-3 rounded-2xl p-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Back to dashboard"
        >
          <ArrowLeft size={18} />
        </button>
        <img
          src={video?.thumbnail}
          alt={video?.title}
          className="h-12 w-20 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-1 font-semibold">{video?.title}</h1>
          <a
            href={video?.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600 dark:text-slate-400"
          >
            Open on YouTube <ExternalLink size={11} />
          </a>
        </div>

        {/* Language toggle */}
        <div className="hidden items-center rounded-xl border border-slate-300 p-1 dark:border-slate-700 sm:inline-flex">
          {[
            { code: "en", label: "EN" },
            { code: "hi", label: "हि" },
          ].map((l) => (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
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

      {/* ---- Quick actions ---- */}
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => setInsight("summary")} className="btn-ghost px-3 py-1.5 text-xs">
          <FileText size={14} /> Summary
        </button>
        <button onClick={() => setInsight("keypoints")} className="btn-ghost px-3 py-1.5 text-xs">
          <ListChecks size={14} /> Key Points
        </button>
        <button onClick={() => setQuizOpen(true)} className="btn-ghost px-3 py-1.5 text-xs">
          <GraduationCap size={14} /> Quiz
        </button>

        {/* Export dropdown (PDF / DOCX / TXT) */}
        <div className="relative">
          <button
            onClick={() => setExportOpen((v) => !v)}
            className="btn-ghost px-3 py-1.5 text-xs"
          >
            <Download size={14} /> Export <ChevronDown size={12} />
          </button>
          {exportOpen && (
            <div className="glass absolute right-0 z-30 mt-1.5 w-32 rounded-xl p-1.5">
              {["pdf", "docx", "txt"].map((f) => (
                <button
                  key={f}
                  onClick={() => handleExport(f)}
                  className="block w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- Messages ---- */}
      <div className="flex-1 space-y-5 overflow-y-auto rounded-2xl bg-slate-100/50 p-4 dark:bg-slate-900/40">
        {messages.length === 0 && !sending && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <h2 className="text-xl font-semibold">Ask anything about this video</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              I've read the whole transcript — try one of these:
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendQuestion(s)}
                  className="rounded-full border border-slate-300 bg-white/70 px-4 py-2 text-sm text-slate-600 transition-colors hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} content={m.content} />
        ))}

        {sending && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ---- Input ---- */}
      <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendQuestion();
            }
          }}
          rows={1}
          placeholder="Ask a question about the video..."
          className="input-field max-h-32 flex-1 resize-none py-3"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="btn-primary h-[50px] w-[50px] !px-0"
          aria-label="Send"
        >
          <Send size={18} />
        </button>
      </form>

      {/* ---- Insights modal ---- */}
      {insight && (
        <InsightsModal
          type={insight}
          videoId={videoId}
          videoTitle={video?.title}
          language={language}
          onClose={() => setInsight(null)}
        />
      )}

      {/* ---- Quiz modal ---- */}
      {quizOpen && (
        <QuizModal
          videoId={videoId}
          videoTitle={video?.title}
          language={language}
          onClose={() => setQuizOpen(false)}
        />
      )}

      {printing && <PrintDocument video={video} messages={messages} />}
    </motion.div>
  );
};

export default Chat;

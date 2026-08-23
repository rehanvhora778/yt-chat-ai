/**
 * pages/Chat.jsx
 * --------------
 * The conversation view for a processed video: loads existing history, sends
 * questions to the RAG backend and offers Summary / Key Points / Quiz plus
 * PDF, DOCX and TXT exports.
 *
 * It also honours the Settings → Preferences options (send key, starter
 * prompts, follow-new-answers) and supports deep links used elsewhere in the
 * app: ?insight=summary|keypoints and ?export=pdf|docx|txt.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Download,
  ExternalLink,
  FileText,
  FolderPlus,
  GraduationCap,
  ListChecks,
  MoreVertical,
  Send,
  Sparkles,
} from "lucide-react";

import ChatBubble from "../components/ChatBubble";
import TypingIndicator from "../components/TypingIndicator";
import Loader from "../components/Loader";
import InsightsModal from "../components/InsightsModal";
import QuizModal from "../components/QuizModal";
import PrintDocument from "../components/PrintDocument";
import CollectionFormModal from "../components/CollectionFormModal";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "../components/ui/Menu";
import { SegmentedControl } from "../components/ui";
import { chatApi, videoApi, getErrorMessage } from "../api/client";
import { exportChatToTxt, exportChatToDocx } from "../utils/exportText";
import { usePrintExport, suggestPdfName } from "../lib/printExport";
import PdfNameModal from "../components/PdfNameModal";
import PdfExportOverlay from "../components/PdfExportOverlay";
import { useAuth } from "../context/AuthContext";
import { useLibrary } from "../context/LibraryContext";
import { usePreferences } from "../context/PreferencesContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useStored } from "../lib/store";
import { useNotify } from "../lib/notify";

const SUGGESTIONS = [
  "Summarize this video in 3 points",
  "What are the main takeaways?",
  "Explain the most important concept",
  "What should I remember from this?",
];

const Chat = () => {
  const { videoId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useNotify();
  const [searchParams, setSearchParams] = useSearchParams();

  const { user } = useAuth();
  const { preferences } = usePreferences();
  const { refresh } = useWorkspace();
  const {
    collections,
    isVideoBookmarked,
    toggleVideoBookmark,
    toggleVideoInCollection,
    addAnswerBookmark,
  } = useLibrary();

  const [video, setVideo] = useState(location.state?.video || null);
  const [messages, setMessages] = useState([]); // {role, content}
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);
  const [language, setLanguage] = useState(preferences.language);
  const [insight, setInsight] = useState(null); // 'summary' | 'keypoints'
  const [quizOpen, setQuizOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const { printing, startPrint } = usePrintExport();
  const [pdfNameOpen, setPdfNameOpen] = useState(false);

  const [, setRecentViews] = useStored(user?.id || "guest", "recent_views", []);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const exportHandled = useRef(false);

  /* ---- Initial load: video meta (if missing) + chat history ---- */
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
          msgs.push({ role: "ai", content: c.answer, question: c.question });
        });
        setMessages(msgs);
        if (hist.length) setLanguage(hist[hist.length - 1].language || preferences.language);
      })
      .catch((err) => notify.error(getErrorMessage(err)))
      .finally(() => !cancelled && setLoadingPage(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  /* ---- Remember this video in "recently viewed" ---- */
  useEffect(() => {
    if (!videoId) return;
    setRecentViews((list) => [videoId, ...(list || []).filter((id) => id !== videoId)].slice(0, 12));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  /* ---- Auto-scroll to newest message (preference-controlled) ---- */
  useEffect(() => {
    if (!preferences.autoScroll) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, preferences.autoScroll]);

  const handleExport = useCallback(
    (fmt) => {
      if (messages.length === 0) {
        notify.error("No conversation to export yet");
        return;
      }
      if (fmt === "pdf") {
        // Browser "Save as PDF": premium layout + full Unicode (Hindi/CJK/emoji).
        // Ask for the filename first so Chrome's dialog opens pre-filled.
        setPdfNameOpen(true);
        return;
      }
      if (fmt === "docx") exportChatToDocx(video?.title, messages);
      else exportChatToTxt(video?.title, messages);
      notify.success(`Exported ${fmt.toUpperCase()}`);
    },
    [messages, video?.title, notify]
  );

  /* ---- Deep links: ?insight=... and ?export=... ---- */
  useEffect(() => {
    if (loadingPage) return;

    const insightParam = searchParams.get("insight");
    const exportParam = searchParams.get("export");
    if (!insightParam && !exportParam) return;

    if (insightParam === "summary" || insightParam === "keypoints") {
      setInsight(insightParam);
    }
    if (exportParam && !exportHandled.current) {
      exportHandled.current = true;
      handleExport(exportParam);
    }

    const next = new URLSearchParams(searchParams);
    next.delete("insight");
    next.delete("export");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingPage, searchParams]);

  const sendQuestion = async (question) => {
    const text = (question ?? input).trim();
    if (!text || sending) return;

    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    try {
      const res = await chatApi.ask(videoId, text, language);
      setMessages((m) => [...m, { role: "ai", content: res.data.answer, question: text }]);
      refresh({ silent: true });
    } catch (err) {
      const msg = getErrorMessage(err);
      setMessages((m) => [...m, { role: "ai", content: `⚠️ ${msg}`, question: text }]);
      notify.error(msg);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendQuestion();
  };

  const onKeyDown = (event) => {
    if (event.key !== "Enter") return;
    const wantsSend = preferences.sendOnEnter
      ? !event.shiftKey
      : event.ctrlKey || event.metaKey;
    if (wantsSend) {
      event.preventDefault();
      sendQuestion();
    }
  };

  const bookmarked = isVideoBookmarked(videoId);

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
      transition={{ duration: 0.25 }}
      className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-5xl flex-col px-4 py-4 sm:px-6"
    >
      {/* ---- Video header ---- */}
      <div className="card-flush mb-3 flex items-center gap-3 p-2.5">
        <button
          onClick={() => navigate("/dashboard")}
          aria-label="Back to dashboard"
          className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-ink"
        >
          <ArrowLeft size={18} />
        </button>

        <img
          src={video?.thumbnail}
          alt=""
          className="hidden h-11 w-[76px] shrink-0 rounded-lg object-cover sm:block"
        />

        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-1 text-sm font-semibold text-ink">{video?.title}</h1>
          <a
            href={video?.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-accent"
          >
            {video?.author ? `${video.author} · ` : ""}Watch on YouTube
            <ExternalLink size={10} />
          </a>
        </div>

        <div className="hidden sm:block">
          <SegmentedControl
            size="sm"
            value={language}
            onChange={setLanguage}
            options={[
              { id: "en", label: "EN", title: "Answer in English" },
              { id: "hi", label: "हिं", title: "Answer in Hindi" },
            ]}
          />
        </div>

        <button
          onClick={() => {
            const added = toggleVideoBookmark({ ...video, video_id: videoId });
            notify.success(added ? "Bookmarked" : "Bookmark removed");
          }}
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark this video"}
          title={bookmarked ? "Remove bookmark" : "Bookmark this video"}
          className={`rounded-lg p-2 transition-colors hover:bg-card2 ${
            bookmarked ? "text-gold" : "text-muted hover:text-ink"
          }`}
        >
          {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </button>

        <Menu
          width="w-56"
          trigger={
            <button
              aria-label="Conversation actions"
              className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-ink"
            >
              <MoreVertical size={18} />
            </button>
          }
        >
          <MenuLabel>AI insights</MenuLabel>
          <MenuItem icon={FileText} onClick={() => setInsight("summary")}>
            Summary
          </MenuItem>
          <MenuItem icon={ListChecks} onClick={() => setInsight("keypoints")}>
            Key points
          </MenuItem>
          <MenuItem icon={GraduationCap} onClick={() => setQuizOpen(true)}>
            Quiz me
          </MenuItem>

          <MenuDivider />
          <MenuLabel>Export conversation</MenuLabel>
          {["pdf", "docx", "txt"].map((format) => (
            <MenuItem key={format} icon={Download} onClick={() => handleExport(format)}>
              Download {format.toUpperCase()}
            </MenuItem>
          ))}

          <MenuDivider />
          <MenuLabel>Organise</MenuLabel>
          {collections.slice(0, 4).map((collection) => (
            <MenuItem
              key={collection.id}
              icon={collection.video_ids.includes(videoId) ? BookmarkCheck : FolderPlus}
              onClick={() => {
                const added = toggleVideoInCollection(collection.id, videoId);
                notify.success(
                  added ? `Added to ${collection.name}` : `Removed from ${collection.name}`
                );
              }}
            >
              {collection.name}
            </MenuItem>
          ))}
          <MenuItem icon={FolderPlus} onClick={() => setCollectionOpen(true)}>
            New collection…
          </MenuItem>
        </Menu>
      </div>

      {/* ---- Quick actions ---- */}
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => setInsight("summary")} className="btn-ghost h-9 px-3 text-xs">
          <FileText size={14} /> Summary
        </button>
        <button onClick={() => setInsight("keypoints")} className="btn-ghost h-9 px-3 text-xs">
          <ListChecks size={14} /> Key points
        </button>
        <button onClick={() => setQuizOpen(true)} className="btn-ghost h-9 px-3 text-xs">
          <GraduationCap size={14} /> Quiz
        </button>
        <button
          onClick={() => handleExport(preferences.defaultExport)}
          className="btn-ghost h-9 px-3 text-xs"
        >
          <Download size={14} /> Export {preferences.defaultExport.toUpperCase()}
        </button>
      </div>

      {/* ---- Messages ---- */}
      <div className="card-flush flex-1 space-y-5 overflow-y-auto p-4">
        {messages.length === 0 && !sending && (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Sparkles size={22} />
            </span>
            <h2 className="text-lg font-semibold text-ink">
              Ask anything about this video
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted">
              The full transcript has been read and indexed — answers come back with
              timestamps.
            </p>

            {preferences.showSuggestions && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendQuestion(suggestion)}
                    className="chip hover:border-accent/50 hover:text-accent"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((message, index) => (
          <ChatBubble
            key={index}
            role={message.role}
            content={message.content}
            onBookmark={
              message.role === "ai"
                ? () => {
                    addAnswerBookmark({
                      videoId,
                      videoTitle: video?.title,
                      question:
                        message.question || messages[index - 1]?.content || "",
                      answer: message.content,
                    });
                    notify.success("Answer saved to bookmarks");
                  }
                : undefined
            }
          />
        ))}

        {sending && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ---- Composer ---- */}
      <form onSubmit={handleSubmit} className="mt-3">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-card p-2 transition-colors focus-within:border-accent/50">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask a question about the video..."
            aria-label="Your question"
            className="max-h-32 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-ink outline-none placeholder:text-faint"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="btn-primary h-10 w-10 !px-0"
            aria-label="Send question"
          >
            <Send size={17} />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-faint">
          {preferences.sendOnEnter
            ? "Enter to send · Shift + Enter for a new line"
            : "Ctrl + Enter to send · Enter for a new line"}
        </p>
      </form>

      {/* ---- Modals ---- */}
      {insight && (
        <InsightsModal
          type={insight}
          videoId={videoId}
          videoTitle={video?.title}
          language={language}
          onClose={() => setInsight(null)}
        />
      )}

      {quizOpen && (
        <QuizModal
          videoId={videoId}
          videoTitle={video?.title}
          language={language}
          onClose={() => setQuizOpen(false)}
        />
      )}

      <CollectionFormModal
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        onSaved={(collectionId) => {
          toggleVideoInCollection(collectionId, videoId);
          notify.success("Added to your new collection");
        }}
      />

      <PdfNameModal
        open={pdfNameOpen}
        onClose={() => setPdfNameOpen(false)}
        defaultName={suggestPdfName(video?.title, "Conversation")}
        onConfirm={startPrint}
      />

      {printing && <PdfExportOverlay />}
      {printing && <PrintDocument video={video} messages={messages} />}
    </motion.div>
  );
};

export default Chat;

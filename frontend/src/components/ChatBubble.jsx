/**
 * components/ChatBubble.jsx
 * -------------------------
 * A single chat message. User messages sit right in a red-tinted bubble; AI
 * messages render markdown and expose copy / bookmark actions on hover.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, Check, Copy, Sparkles, User } from "lucide-react";

import MarkdownRenderer from "./MarkdownRenderer";

const ChatBubble = ({ role, content, onBookmark }) => {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — nothing useful to do */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`group flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {/* Avatar */}
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isUser
            ? "bg-card3 text-muted"
            : "bg-accent/12 text-accent ring-1 ring-accent/20"
        }`}
      >
        {isUser ? <User size={15} /> : <Sparkles size={15} />}
      </span>

      {/* Bubble */}
      <div className={`min-w-0 ${isUser ? "max-w-[85%] sm:max-w-[72%]" : "flex-1"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "rounded-tr-sm border border-accent/25 bg-accent/12 text-ink"
              : "rounded-tl-sm border border-line bg-card2 text-ink"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <MarkdownRenderer>{content}</MarkdownRenderer>
          )}
        </div>

        {/* AI actions */}
        {!isUser && (
          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button
              onClick={copy}
              aria-label="Copy answer"
              title="Copy answer"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-card2 hover:text-ink"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
            {onBookmark && (
              <button
                onClick={onBookmark}
                aria-label="Save this answer"
                title="Save this answer"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-card2 hover:text-gold"
              >
                <Bookmark size={12} /> Save
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ChatBubble;

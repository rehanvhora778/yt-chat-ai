/**
 * components/ChatBubble.jsx
 * -------------------------
 * Renders a single chat message. User messages align right with a gradient
 * background; AI messages align left and render markdown.
 */

import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";

import MarkdownRenderer from "./MarkdownRenderer";

const ChatBubble = ({ role, content }) => {
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {/* Avatar */}
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${
          isUser
            ? "bg-gradient-to-br from-slate-600 to-slate-800"
            : "bg-gradient-to-br from-brand-600 to-purple-600"
        }`}
      >
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </span>

      {/* Bubble */}
      <div
        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "max-w-[85%] rounded-tr-sm bg-gradient-to-br from-brand-600 to-purple-600 text-white sm:max-w-[75%]"
            : "w-full min-w-0 max-w-full rounded-tl-sm bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100 sm:max-w-[88%]"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <MarkdownRenderer>{content}</MarkdownRenderer>
        )}
      </div>
    </motion.div>
  );
};

export default ChatBubble;

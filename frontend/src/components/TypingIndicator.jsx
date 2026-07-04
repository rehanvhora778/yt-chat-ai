/**
 * components/TypingIndicator.jsx
 * ------------------------------
 * Three bouncing dots shown while the AI is generating an answer.
 */

import { Bot } from "lucide-react";

const TypingIndicator = () => (
  <div className="flex items-start gap-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-purple-600 text-white">
      <Bot size={18} />
    </span>
    <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white px-4 py-3.5 shadow-sm dark:bg-slate-800">
      <span className="typing-dot h-2 w-2 rounded-full bg-brand-500" />
      <span className="typing-dot h-2 w-2 rounded-full bg-brand-500 [animation-delay:0.2s]" />
      <span className="typing-dot h-2 w-2 rounded-full bg-brand-500 [animation-delay:0.4s]" />
    </div>
  </div>
);

export default TypingIndicator;

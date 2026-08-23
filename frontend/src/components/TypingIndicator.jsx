/**
 * components/TypingIndicator.jsx
 * ------------------------------
 * Three bouncing dots shown while the AI is generating an answer.
 */

import { Sparkles } from "lucide-react";

const TypingIndicator = () => (
  <div className="flex items-start gap-3">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent ring-1 ring-accent/20">
      <Sparkles size={15} />
    </span>
    <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-line bg-card2 px-4 py-3.5">
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent [animation-delay:0.2s]" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent [animation-delay:0.4s]" />
      <span className="ml-1.5 text-[11px] text-faint">Reading the transcript…</span>
    </div>
  </div>
);

export default TypingIndicator;

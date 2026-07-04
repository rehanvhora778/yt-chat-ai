/**
 * components/markdown/Callout.jsx
 * -------------------------------
 * Coloured callout/admonition box (note, info, tip, success, warning, danger,
 * key-takeaways). Produced from `> [!TYPE]` blockquotes via remarkAdmonitions.
 */
import {
  Info,
  Lightbulb,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

const STYLES = {
  note: {
    icon: Info,
    title: "Note",
    box: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-50",
    accent: "border-l-blue-500",
    icch: "text-blue-600 dark:text-blue-400",
  },
  info: {
    icon: Info,
    title: "Info",
    box: "border-purple-200 bg-purple-50 text-purple-900 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-50",
    accent: "border-l-purple-500",
    icch: "text-purple-600 dark:text-purple-400",
  },
  tip: {
    icon: Lightbulb,
    title: "Tip",
    box: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-50",
    accent: "border-l-emerald-500",
    icch: "text-emerald-600 dark:text-emerald-400",
  },
  success: {
    icon: CheckCircle2,
    title: "Success",
    box: "border-green-200 bg-green-50 text-green-900 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-50",
    accent: "border-l-green-500",
    icch: "text-green-600 dark:text-green-400",
  },
  warning: {
    icon: AlertTriangle,
    title: "Warning",
    box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-50",
    accent: "border-l-amber-500",
    icch: "text-amber-600 dark:text-amber-400",
  },
  danger: {
    icon: ShieldAlert,
    title: "Danger",
    box: "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-50",
    accent: "border-l-red-500",
    icch: "text-red-600 dark:text-red-400",
  },
  summary: {
    icon: Sparkles,
    title: "Key Takeaways",
    box: "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-50",
    accent: "border-l-brand-500",
    icch: "text-brand-600 dark:text-brand-300",
  },
};

const Callout = ({ type = "note", calltitle, children }) => {
  const s = STYLES[type] || STYLES.note;
  const Icon = s.icon;
  return (
    <div
      className={`callout-box my-4 flex gap-3 rounded-xl border border-l-4 p-4 ${s.box} ${s.accent}`}
    >
      <Icon size={20} className={`mt-0.5 shrink-0 ${s.icch}`} />
      <div className="callout-content min-w-0 flex-1">
        <p className="mb-1 font-bold leading-tight">{calltitle || s.title}</p>
        {children}
      </div>
    </div>
  );
};

export default Callout;

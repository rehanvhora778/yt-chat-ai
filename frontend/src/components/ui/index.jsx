/**
 * components/ui/index.jsx
 * -----------------------
 * The small set of building blocks the redesigned screens share: section
 * cards, stat tiles, empty states, toggles and segmented controls. Keeping
 * them in one place is what makes spacing, radii and hover behaviour
 * consistent across the app.
 */

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import AnimatedCounter from "../AnimatedCounter";

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export const SectionCard = ({
  title,
  icon: Icon,
  action,
  children,
  className = "",
  bodyClassName = "",
}) => (
  <section className={`card-flush flex flex-col ${className}`}>
    {(title || action) && (
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 className="section-title">
          {Icon && <Icon size={16} className="text-accent" />}
          {title}
        </h2>
        {action}
      </header>
    )}
    <div className={`flex-1 px-5 py-4 ${bodyClassName}`}>{children}</div>
  </section>
);

export const PageHeader = ({ title, subtitle, icon: Icon, children }) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-ink">
        {Icon && <Icon size={24} className="text-accent" />}
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
    {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
  </div>
);

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}) => (
  <div
    className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-line text-center ${
      compact ? "px-4 py-8" : "px-6 py-14"
    }`}
  >
    {Icon && (
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-card2 text-muted">
        <Icon size={20} />
      </span>
    )}
    <p className="text-sm font-semibold text-ink">{title}</p>
    {description && (
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
        {description}
      </p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* ------------------------------------------------------------------ */
/* Data display                                                        */
/* ------------------------------------------------------------------ */

/** Coloured delta pill. `invert` treats a decrease as the good direction. */
export const Trend = ({ value, suffix = "", invert = false, label, emptyLabel }) => {
  if (value === null || value === undefined) {
    return (
      <span className="text-[11px] font-medium text-faint">
        {emptyLabel || "Not enough history yet"}
      </span>
    );
  }
  const flat = value === 0;
  const positive = invert ? value < 0 : value > 0;
  const Icon = flat ? Minus : positive ? ArrowUpRight : ArrowDownRight;
  const tone = flat
    ? "text-faint"
    : positive
    ? "text-emerald-400"
    : "text-accent";

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${tone}`}>
      <Icon size={12} />
      {`${value > 0 ? "+" : ""}${value}${suffix}`}
      {label && <span className="font-medium text-faint">{label}</span>}
    </span>
  );
};

export const StatCard = ({
  icon: Icon,
  label,
  value,
  decimals = 0,
  suffix = "",
  footer,
  accentGold = false,
  delay = 0,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    className="card gradient-border card-interactive"
  >
    <div className="flex items-start justify-between gap-2">
      <span className={`icon-tile ${accentGold ? "icon-tile-gold" : ""}`}>
        <Icon size={18} />
      </span>
    </div>
    <p className="mt-3.5 text-2xl font-bold tracking-tight text-ink">
      <AnimatedCounter value={value} decimals={decimals} suffix={suffix} />
    </p>
    <p className="mt-0.5 text-xs font-medium text-muted">{label}</p>
    {footer && <div className="mt-2.5">{footer}</div>}
  </motion.div>
);

export const ProgressBar = ({ value, max = 100, tone = "accent" }) => {
  const pct = Math.min(100, Math.max(0, max ? (value / max) * 100 : 0));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-card3">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{
          backgroundColor: tone === "gold" ? "rgb(var(--gold))" : "rgb(var(--accent))",
        }}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

export const IconButton = ({ icon: Icon, label, size = 17, active, ...props }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    {...props}
    className={`inline-flex items-center justify-center rounded-lg p-2 transition-colors ${
      active ? "bg-card2 text-accent" : "text-muted hover:bg-card2 hover:text-ink"
    } ${props.className || ""}`}
  >
    <Icon size={size} />
  </button>
);

export const Toggle = ({ checked, onChange, label, id }) => (
  <button
    type="button"
    id={id}
    role="switch"
    aria-checked={!!checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 ${
      checked ? "border-transparent bg-accent" : "border-line bg-card3"
    }`}
  >
    <span
      className={`absolute top-1/2 block h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-white shadow transition-all duration-200 ${
        checked ? "left-[23px]" : "left-[3px]"
      }`}
    />
  </button>
);

export const SettingRow = ({ title, description, children, htmlFor }) => (
  <div className="flex items-center justify-between gap-6 py-3.5">
    <div className="min-w-0">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-ink"
      >
        {title}
      </label>
      {description && (
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
      )}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

export const SegmentedControl = ({ options, value, onChange, size = "md" }) => (
  <div
    role="tablist"
    className="inline-flex items-center gap-1 rounded-xl border border-line bg-card2 p-1"
  >
    {options.map((option) => {
      const Icon = option.icon;
      const active = value === option.id;
      return (
        <button
          key={option.id}
          role="tab"
          aria-selected={active}
          onClick={() => onChange(option.id)}
          title={option.title || option.label}
          className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all duration-150 ${
            size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
          } ${
            active
              ? "bg-accent text-white shadow-glow"
              : "text-muted hover:text-ink"
          }`}
        >
          {Icon && <Icon size={size === "sm" ? 12 : 14} />}
          {option.label}
        </button>
      );
    })}
  </div>
);

export const Tab = ({ active, onClick, icon: Icon, children, count }) => (
  <button
    onClick={onClick}
    role="tab"
    aria-selected={active}
    className={`relative flex items-center gap-2 whitespace-nowrap px-1 pb-3 text-sm font-medium transition-colors ${
      active ? "text-ink" : "text-muted hover:text-ink"
    }`}
  >
    {Icon && <Icon size={15} />}
    {children}
    {count !== undefined && (
      <span className="rounded-full bg-card3 px-1.5 py-0.5 text-[10px] font-bold text-muted">
        {count}
      </span>
    )}
    {active && (
      <motion.span
        layoutId="tab-underline"
        className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent"
      />
    )}
  </button>
);

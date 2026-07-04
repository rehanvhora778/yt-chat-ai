/**
 * components/ThemeSwitcher.jsx
 * ----------------------------
 * Popover that lets the user pick one of the five themes (FEATURE 4). Each
 * option shows a gradient swatch; the active theme is checked.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, Check } from "lucide-react";

import { useTheme } from "../context/ThemeContext";

const ThemeSwitcher = () => {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change theme"
        className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Palette size={18} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="glass absolute right-0 z-50 mt-2 w-52 rounded-2xl p-2"
          >
            <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Theme
            </p>
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm font-medium transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="h-5 w-5 rounded-full ring-1 ring-black/10"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})`,
                    }}
                  />
                  {t.label}
                </span>
                {theme === t.id && (
                  <Check size={15} className="text-brand-500" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ThemeSwitcher;

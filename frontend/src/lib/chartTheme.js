/**
 * lib/chartTheme.js
 * -----------------
 * Resolves the CSS design tokens into concrete colours for Recharts, which
 * needs real values rather than `var(--token)`. Re-reads whenever the theme
 * changes so charts follow the dark/light switch.
 */

import { useEffect, useState } from "react";

import { useTheme } from "../context/ThemeContext";

const readToken = (name, fallback) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value ? `rgb(${value})` : fallback;
};

const readTokenAlpha = (name, alpha, fallback) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value ? `rgb(${value} / ${alpha})` : fallback;
};

export const useChartTheme = () => {
  const { resolved } = useTheme();

  const compute = () => ({
    accent: readToken("--accent", "#f4212e"),
    gold: readToken("--gold", "#e8b84b"),
    muted: readToken("--muted", "#a1a1ac"),
    faint: readToken("--faint", "#71717d"),
    grid: readTokenAlpha("--border", 0.9, "rgba(120,120,130,0.3)"),
    surface: readToken("--surface", "#151519"),
    text: readToken("--text", "#f4f4f6"),
  });

  const [theme, setTheme] = useState(compute);

  useEffect(() => {
    setTheme(compute());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);

  return {
    ...theme,
    tooltip: {
      borderRadius: 12,
      border: `1px solid ${theme.grid}`,
      background: theme.surface,
      color: theme.text,
      fontSize: 12,
      boxShadow: "0 12px 40px -18px rgb(0 0 0 / 0.7)",
    },
  };
};

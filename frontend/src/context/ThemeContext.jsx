/**
 * context/ThemeContext.jsx
 * ------------------------
 * Multi-theme support (FEATURE 4). Five themes share the same layout but swap
 * accent colors, background gradients and glow colors via CSS variables driven
 * by a `data-theme` attribute on <html>. The `dark` class is toggled too so
 * Tailwind's dark: variants keep working. The choice is persisted to
 * localStorage and transitions are smooth (see index.css).
 */

import { createContext, useContext, useEffect, useState } from "react";

// id must match the [data-theme="..."] blocks in index.css
export const THEMES = [
  { id: "default", label: "Dark Purple", dark: true, swatch: ["#6366f1", "#a855f7"] },
  { id: "cyber-purple", label: "Cyber Purple", dark: true, swatch: ["#d946ef", "#8b5cf6"] },
  { id: "glass-dark", label: "Glass Dark", dark: true, swatch: ["#64748b", "#94a3b8"] },
  { id: "neon-blue", label: "Neon Blue", dark: true, swatch: ["#38bdf8", "#2563eb"] },
  { id: "light-ai", label: "Light AI", dark: false, swatch: ["#7c3aed", "#6366f1"] },
];

const DEFAULT_THEME = "default";
const ThemeContext = createContext();

const resolve = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    const stored = localStorage.getItem("theme");
    return resolve(stored).id;
  });

  useEffect(() => {
    const t = resolve(theme);
    const root = document.documentElement;
    root.setAttribute("data-theme", t.id);
    root.classList.toggle("dark", t.dark);
    localStorage.setItem("theme", t.id);
  }, [theme]);

  const setTheme = (id) => setThemeState(resolve(id).id);

  const current = resolve(theme);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, themes: THEMES, isDark: current.dark, current }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

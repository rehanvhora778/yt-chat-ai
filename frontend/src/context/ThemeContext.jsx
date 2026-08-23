/**
 * context/ThemeContext.jsx
 * ------------------------
 * Appearance control for the YouTube-inspired palette. Three choices —
 * Dark (default), Light and System — are written to `data-theme` on <html>,
 * where the CSS variables in index.css pick them up. The `dark` class is kept
 * in sync so Tailwind's dark: variants (and the PDF print flow) keep working.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export const THEMES = [
  { id: "dark", label: "Dark", hint: "Charcoal + red, easiest on the eyes" },
  { id: "light", label: "Light", hint: "Bright surfaces for daylight" },
  { id: "system", label: "System", hint: "Follow your device setting" },
];

const DEFAULT_THEME = "dark";
const STORAGE_KEY = "theme";
const ThemeContext = createContext();

const isValid = (id) => THEMES.some((t) => t.id === id);

const prefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isValid(stored) ? stored : DEFAULT_THEME;
  });

  // "system" resolves to a concrete palette and follows OS changes live
  const [systemDark, setSystemDark] = useState(prefersDark);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.classList.toggle("dark", resolved === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, resolved]);

  const setTheme = useCallback((id) => {
    setThemeState(isValid(id) ? id : DEFAULT_THEME);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const active = current === "system" ? (prefersDark() ? "dark" : "light") : current;
      return active === "dark" ? "light" : "dark";
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolved,
        setTheme,
        toggleTheme,
        themes: THEMES,
        isDark: resolved === "dark",
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

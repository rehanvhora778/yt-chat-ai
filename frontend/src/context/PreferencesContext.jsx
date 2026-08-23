/**
 * context/PreferencesContext.jsx
 * ------------------------------
 * User preferences that shape the interface (see Settings → Preferences).
 * They live in localStorage under the signed-in user's namespace, so they are
 * per-account and never touch the API. Every option here changes real
 * behaviour somewhere in the app — nothing is decorative.
 */

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";

import { useStored } from "../lib/store";
import { useAuth } from "./AuthContext";

export const DEFAULT_PREFERENCES = {
  language: "en", // default language for processing + chat
  density: "comfortable", // comfortable | compact
  reduceMotion: false, // disables animations app-wide
  sendOnEnter: true, // Enter sends, Shift+Enter newline (or the reverse)
  showSuggestions: true, // starter questions on an empty chat
  autoScroll: true, // follow the conversation as answers stream in
  defaultExport: "pdf", // pdf | docx | txt
  desktopNotifications: false, // notify when a video finishes processing
  toastAlerts: true, // in-app toast messages
  activityBadge: true, // unread dot on the top-bar activity bell
  dailyGoal: 5, // chats per day target shown in the sidebar
};

const PreferencesContext = createContext();

export const PreferencesProvider = ({ children }) => {
  const { user } = useAuth();
  const scope = user?.id || "guest";
  const [stored, setStored] = useStored(scope, "preferences", DEFAULT_PREFERENCES);

  const preferences = useMemo(
    () => ({ ...DEFAULT_PREFERENCES, ...(stored || {}) }),
    [stored]
  );

  const setPreference = useCallback(
    (key, value) => setStored((current) => ({ ...DEFAULT_PREFERENCES, ...current, [key]: value })),
    [setStored]
  );

  const resetPreferences = useCallback(
    () => setStored({ ...DEFAULT_PREFERENCES }),
    [setStored]
  );

  // Density + reduced motion are global, so they are applied to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-density", preferences.density);
    root.classList.toggle("reduce-motion", !!preferences.reduceMotion);
  }, [preferences.density, preferences.reduceMotion]);

  return (
    <PreferencesContext.Provider
      value={{ preferences, setPreference, resetPreferences }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => useContext(PreferencesContext);

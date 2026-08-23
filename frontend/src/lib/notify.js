/**
 * lib/notify.js
 * -------------
 * Feedback helpers that respect the user's notification preferences
 * (Settings → Notifications): in-app toasts can be muted, and processing
 * updates can additionally be pushed as a desktop notification.
 */

import { useMemo } from "react";
import toast from "react-hot-toast";

import { usePreferences } from "../context/PreferencesContext";

/** Ask the browser for permission — called from the Settings toggle. */
export const requestDesktopPermission = async () => {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
};

export const desktopPermission = () =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;

/** Fire a desktop notification if the user enabled and granted them. */
export const pushDesktopNotification = (title, body, enabled) => {
  if (!enabled || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    // The user is looking at the app — the in-app toast is enough.
    return;
  }
  try {
    new Notification(title, { body, icon: "/favicon.svg" });
  } catch {
    /* some browsers require a service worker — silently skip */
  }
};

/**
 * Toast helpers bound to the user's preferences. Errors are always shown:
 * silently swallowing a failure would leave the user stuck.
 */
export const useNotify = () => {
  const { preferences } = usePreferences();
  const muted = !preferences.toastAlerts;

  return useMemo(
    () => ({
      success: (message) => {
        if (!muted) toast.success(message);
      },
      info: (message) => {
        if (!muted) toast(message);
      },
      error: (message) => toast.error(message),
      /** Success toast + optional desktop notification for long jobs. */
      done: (message, desktopTitle) => {
        if (!muted) toast.success(message);
        pushDesktopNotification(
          desktopTitle || "YT Chat GenAI",
          message,
          preferences.desktopNotifications
        );
      },
    }),
    [muted, preferences.desktopNotifications]
  );
};

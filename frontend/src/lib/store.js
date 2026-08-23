/**
 * lib/store.js
 * ------------
 * A tiny reactive wrapper around localStorage.
 *
 * Everything the backend doesn't persist (collections, bookmarks, cached AI
 * summaries, UI preferences) lives here, namespaced per signed-in user so two
 * accounts on the same browser never see each other's data. Values are cached
 * in memory and published to subscribers, so every screen updates the moment
 * something changes — including in another tab.
 */

import { useCallback, useSyncExternalStore } from "react";

const PREFIX = "ytc";

const cache = new Map();
const listeners = new Map(); // fullKey -> Set<fn>

export const storageKey = (scope, key) => `${PREFIX}:${scope || "guest"}:${key}`;

const notify = (fullKey) => {
  listeners.get(fullKey)?.forEach((fn) => fn());
};

const subscribe = (fullKey, fn) => {
  if (!listeners.has(fullKey)) listeners.set(fullKey, new Set());
  listeners.get(fullKey).add(fn);
  return () => {
    const set = listeners.get(fullKey);
    set?.delete(fn);
    if (set && set.size === 0) listeners.delete(fullKey);
  };
};

/** Read a value, falling back (and caching the fallback) when unset. */
export const readValue = (fullKey, fallback) => {
  if (cache.has(fullKey)) return cache.get(fullKey);
  let value = fallback;
  try {
    const raw = localStorage.getItem(fullKey);
    if (raw != null) value = JSON.parse(raw);
  } catch {
    value = fallback;
  }
  cache.set(fullKey, value);
  return value;
};

export const writeValue = (fullKey, value) => {
  cache.set(fullKey, value);
  try {
    localStorage.setItem(fullKey, JSON.stringify(value));
  } catch {
    // Quota exceeded / private mode — keep the in-memory value so the UI still
    // reflects the change for this session.
  }
  notify(fullKey);
};

export const removeValue = (fullKey) => {
  cache.delete(fullKey);
  try {
    localStorage.removeItem(fullKey);
  } catch {
    /* ignore */
  }
  notify(fullKey);
};

/** Remove every key belonging to one user scope. Returns how many were removed. */
export const clearScope = (scope) => {
  const prefix = `${PREFIX}:${scope || "guest"}:`;
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
  } catch {
    return 0;
  }
  keys.forEach(removeValue);
  return keys.length;
};

/** Snapshot every stored value for a user scope (used by "export my data"). */
export const exportScope = (scope) => {
  const prefix = `${PREFIX}:${scope || "guest"}:`;
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      try {
        out[key.slice(prefix.length)] = JSON.parse(localStorage.getItem(key));
      } catch {
        /* skip unreadable entry */
      }
    }
  } catch {
    /* ignore */
  }
  return out;
};

// Keep tabs in sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (!event.key || !event.key.startsWith(`${PREFIX}:`)) return;
    cache.delete(event.key);
    notify(event.key);
  });
}

/**
 * React binding: `const [items, setItems] = useStored(userId, "collections", [])`
 * `setItems` accepts a value or an updater function, like useState.
 */
export const useStored = (scope, key, fallback) => {
  const fullKey = storageKey(scope, key);

  const value = useSyncExternalStore(
    useCallback((fn) => subscribe(fullKey, fn), [fullKey]),
    () => readValue(fullKey, fallback)
  );

  const setValue = useCallback(
    (next) => {
      const current = readValue(fullKey, fallback);
      writeValue(fullKey, typeof next === "function" ? next(current) : next);
    },
    [fullKey, fallback]
  );

  return [value, setValue];
};

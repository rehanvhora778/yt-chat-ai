/**
 * lib/googleAuth.js
 * -----------------
 * Loads Google Identity Services on demand and exposes the client id.
 *
 * The script is fetched the first time a sign-in button mounts rather than
 * from index.html, so visitors who never reach Login or Register do not pay
 * for it. Concurrent callers share one in-flight promise — Login and Register
 * both mounting would otherwise race two <script> tags into the document.
 */

const GSI_SRC = "https://accounts.google.com/gsi/client";

// Public by design: an OAuth client id identifies the app, it does not
// authorise anything. The backend still verifies every token against it.
export const GOOGLE_CLIENT_ID = (
  import.meta.env.VITE_GOOGLE_CLIENT_ID || ""
).trim();

/** Whether the build was given a client id at all. */
export const googleAuthConfigured = () => GOOGLE_CLIENT_ID.length > 0;

let loader = null;

/**
 * Resolve with `window.google.accounts.id`, loading the SDK if needed.
 * Rejects when the script cannot be fetched — offline, or blocked by an
 * extension or content blocker, which is common enough to handle explicitly
 * rather than leaving the button silently absent.
 */
export const loadGoogleIdentity = () => {
  if (!googleAuthConfigured()) {
    return Promise.reject(new Error("Google sign-in is not configured."));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id);
  }
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    const script = existing || document.createElement("script");

    const onLoad = () => {
      if (window.google?.accounts?.id) {
        resolve(window.google.accounts.id);
      } else {
        loader = null;
        reject(new Error("Google sign-in loaded but did not initialise."));
      }
    };
    const onError = () => {
      loader = null;
      // Let a later attempt retry from scratch.
      script.remove();
      reject(new Error("Could not load Google sign-in."));
    };

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });

    if (!existing) {
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return loader;
};

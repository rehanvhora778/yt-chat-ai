/**
 * components/GoogleButton.jsx
 * --------------------------
 * "Continue with Google" for the Login and Register pages.
 *
 * Renders Google's own button rather than a lookalike: their branding terms
 * require it, and it carries the account-chooser behaviour. The catch is that
 * it is an iframe Google draws at a fixed PIXEL width — it does not stretch,
 * and CSS cannot reach inside it. So the width is measured from the container
 * and the button is re-rendered whenever that changes, and the wrapper clips
 * the corners to the app's radius so it sits with the other buttons instead of
 * looking pasted on.
 *
 * Nothing renders when VITE_GOOGLE_CLIENT_ID is unset, so a build without
 * Google configured just shows the password form on its own.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";

import { useTheme } from "../context/ThemeContext";
import {
  GOOGLE_CLIENT_ID,
  googleAuthConfigured,
  loadGoogleIdentity,
} from "../lib/googleAuth";

// Google refuses to render wider than this and ignores percentages.
const MAX_WIDTH = 400;
const MIN_WIDTH = 200;

const GoogleButton = ({ onCredential, disabled = false, text = "continue_with" }) => {
  const shell = useRef(null); // measured — full width, laid out by us
  const slot = useRef(null); // Google's iframe lands here
  const { isDark } = useTheme();

  const [error, setError] = useState("");
  const [width, setWidth] = useState(0);
  const [ready, setReady] = useState(false);

  // Keep the newest callback reachable from Google's own callback without
  // re-initialising the SDK on every parent render.
  const latest = useRef(onCredential);
  useEffect(() => {
    latest.current = onCredential;
  }, [onCredential]);

  // Track the real available width. offsetWidth is 0 on the first paint, which
  // is why an eager read here would silently fall back to a wrong default.
  useEffect(() => {
    const node = shell.current;
    if (!node) return undefined;

    const measure = () => {
      const next = Math.round(node.getBoundingClientRect().width);
      if (next > 0) setWidth(Math.min(Math.max(next, MIN_WIDTH), MAX_WIDTH));
    };
    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const render = useCallback(
    (googleId) => {
      if (!slot.current || !width) return;
      googleId.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => latest.current?.(response.credential),
        // One Tap stays off: an auto-prompt competes with the form the person
        // is already filling in.
        cancel_on_tap_outside: true,
      });
      slot.current.innerHTML = "";
      googleId.renderButton(slot.current, {
        type: "standard",
        // filled_black would be a near-invisible slab on the charcoal card,
        // and outline reads as a light chip on it. filled_blue is the one
        // Google variant with enough contrast on both grounds.
        theme: isDark ? "filled_blue" : "outline",
        size: "large",
        shape: "rectangular",
        text,
        logo_alignment: "left",
        width,
      });
      setReady(true);
    },
    [isDark, text, width]
  );

  useEffect(() => {
    if (!googleAuthConfigured() || !width) return undefined;
    let cancelled = false;

    loadGoogleIdentity()
      .then((googleId) => {
        if (!cancelled) render(googleId);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load Google sign-in.");
      });

    return () => {
      cancelled = true;
    };
  }, [render, width]);

  if (!googleAuthConfigured()) return null;

  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-xl border border-line bg-card px-3.5 py-3 text-sm text-muted"
      >
        <AlertCircle size={15} className="mt-0.5 shrink-0 text-accent" />
        <span>{error} You can still sign in with your email and password.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
          or
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div
        ref={shell}
        className={`flex w-full justify-center ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {/* Reserves the button's height so the card does not jump when Google
            finishes rendering, and rounds off the iframe's square corners. */}
        <div
          className="h-10 overflow-hidden rounded-xl"
          style={{ width: width || "100%" }}
        >
          <div
            ref={slot}
            className={ready ? "" : "invisible"}
            style={{ colorScheme: "light" }}
          />
        </div>
      </div>
    </div>
  );
};

export default GoogleButton;

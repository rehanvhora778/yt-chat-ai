/**
 * components/GoogleButton.jsx
 * --------------------------
 * "Continue with Google" for the Login and Register pages.
 *
 * Renders Google's own button rather than a lookalike: Google's branding terms
 * require it, and it is what carries the One Tap / account-chooser behaviour.
 * That button is an iframe Google draws into a div we provide, so it cannot be
 * styled with our classes — the surrounding layout does the matching instead.
 *
 * Nothing renders at all when VITE_GOOGLE_CLIENT_ID is unset, so a build
 * without Google configured simply shows the password form on its own.
 */

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";

import { useTheme } from "../context/ThemeContext";
import {
  GOOGLE_CLIENT_ID,
  googleAuthConfigured,
  loadGoogleIdentity,
} from "../lib/googleAuth";

const GoogleButton = ({ onCredential, disabled = false, text = "continue_with" }) => {
  const holder = useRef(null);
  const { isDark } = useTheme();
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  // Keep the newest callback reachable from Google's own callback without
  // re-initialising the SDK on every parent render.
  const latest = useRef(onCredential);
  useEffect(() => {
    latest.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!googleAuthConfigured()) return undefined;
    let cancelled = false;

    loadGoogleIdentity()
      .then((googleId) => {
        if (cancelled || !holder.current) return;

        googleId.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => latest.current?.(response.credential),
          // One Tap is deliberately off: an auto-prompt on a login screen
          // competes with the form the person is already filling in.
          cancel_on_tap_outside: true,
        });

        holder.current.innerHTML = "";
        googleId.renderButton(holder.current, {
          type: "standard",
          theme: isDark ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text,
          logo_alignment: "center",
          // Google caps this at 400 and ignores percentages, so the width is
          // measured from the card the button sits in.
          width: Math.min(holder.current.offsetWidth || 360, 400),
        });
        setReady(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load Google sign-in.");
      });

    return () => {
      cancelled = true;
    };
    // Re-render the button when the palette flips so it never sits as a white
    // block on the dark card.
  }, [isDark, text]);

  if (!googleAuthConfigured()) return null;

  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-3 text-sm text-ink"
      >
        <AlertCircle size={15} className="mt-0.5 shrink-0 text-accent" />
        <span>{error} You can still sign in with your email and password.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-white/10 dark:bg-white/10" />
        <span className="text-xs font-medium uppercase tracking-wider text-faint">
          or
        </span>
        <span className="h-px flex-1 bg-white/10 dark:bg-white/10" />
      </div>

      <div
        className={`flex justify-center transition-opacity ${
          disabled ? "pointer-events-none opacity-50" : ""
        } ${ready ? "opacity-100" : "opacity-0"}`}
      >
        {/* Google draws its iframe in here. */}
        <div ref={holder} className="w-full [&>div]:!mx-auto" />
      </div>
    </div>
  );
};

export default GoogleButton;

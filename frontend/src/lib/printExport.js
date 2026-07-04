/**
 * lib/printExport.js
 * ------------------
 * Hook that drives the browser's native "Save as PDF". It hides the live app,
 * forces light mode for the print, renders the print-only document, then calls
 * window.print() and restores everything afterwards. Because the browser shapes
 * the text itself, every script (Hindi, Arabic, CJK, emoji, ...) exports
 * correctly — unlike client-side PDF libraries.
 */
import { useEffect, useState } from "react";

export function usePrintExport() {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return undefined;

    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    if (wasDark) html.classList.remove("dark");
    document.body.classList.add("is-printing");

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      document.body.classList.remove("is-printing");
      if (wasDark) html.classList.add("dark");
      window.removeEventListener("afterprint", finish);
      setPrinting(false);
    };

    window.addEventListener("afterprint", finish);
    // Give the portal (and the cover thumbnail) a moment to render/paint.
    const timer = setTimeout(() => window.print(), 250);

    return () => {
      clearTimeout(timer);
      finish();
    };
  }, [printing]);

  return { printing, startPrint: () => setPrinting(true) };
}

/**
 * lib/printExport.js
 * ------------------
 * PDF export. `startPrint(name)` renders the print-only document off-screen,
 * rasterises it with html2pdf (html2canvas + jsPDF) and saves `<name>.pdf`
 * straight to the browser's Downloads folder — no Chrome print dialog.
 *
 * Why rasterised: a page cannot save a PDF silently through window.print() —
 * there is no such API — so the file has to be built in the page. Drawing text
 * with jsPDF directly cannot shape Devanagari/Arabic/CJK correctly, whereas
 * html2canvas paints whatever the browser already rendered, so every script
 * still looks right. The trade-off is that the text is an image: not selectable
 * or searchable, and the file is larger.
 *
 * If html2pdf fails for any reason we fall back to the browser's own
 * "Save as PDF" (a dialog, but a working export) rather than losing the action.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** Characters Windows/Chrome reject in a filename, plus tidy-up. */
export function sanitizePdfName(name, fallback = "Export") {
  const cleaned = String(name || "")
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

/** Default filename suggestion, e.g. "Intro to Python - Conversation". */
export function suggestPdfName(videoTitle, kind) {
  const base = sanitizePdfName(videoTitle, "YT Chat GenAI");
  return sanitizePdfName(kind ? `${base} - ${kind}` : base);
}

const html2pdfOptions = (fileName) => ({
  margin: [16, 14, 16, 14], // mm — matches the print stylesheet
  filename: `${fileName}.pdf`,
  // q0.92 at scale 2 measured 3.9 MB for an 11-page Hindi export vs 5.7 MB at
  // q0.98 — a third smaller with no visible difference on white-background text.
  image: { type: "jpeg", quality: 0.92 },
  html2canvas: {
    scale: 2, // 2x so text stays crisp instead of looking fuzzy
    useCORS: true, // lets the YouTube cover thumbnail be captured
    backgroundColor: "#ffffff",
    logging: false,
    // No scrollX/scrollY override: html2canvas derives the capture region from
    // the element's own position, and forcing 0,0 made it shoot past the
    // document and emit blank pages.
  },
  jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  // Honour the break-inside/break-after rules already in the print stylesheet
  // so cards and the cover page split exactly where they do when printing.
  pagebreak: {
    mode: ["css", "legacy"],
    avoid: [".print-msg", ".print-keypoint", ".print-quiz-q", ".callout-box"],
  },
});

export function usePrintExport() {
  // Mounts the print-only document; also true while the PDF is being built.
  const [printing, setPrinting] = useState(false);
  const fileNameRef = useRef("Export");

  useEffect(() => {
    if (!printing) return undefined;

    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    const previousTheme = html.getAttribute("data-theme");
    const previousTitle = document.title;
    const fileName = fileNameRef.current;

    // The document is authored against the light palette.
    if (wasDark) html.classList.remove("dark");
    html.setAttribute("data-theme", "light");
    document.body.classList.add("is-exporting");

    let cancelled = false;
    let finished = false;
    const restore = () => {
      if (finished) return;
      finished = true;
      document.body.classList.remove("is-exporting");
      document.body.classList.remove("is-printing");
      document.title = previousTitle;
      if (wasDark) html.classList.add("dark");
      if (previousTheme) html.setAttribute("data-theme", previousTheme);
      else html.removeAttribute("data-theme");
      window.removeEventListener("afterprint", restore);
      setPrinting(false);
    };

    const run = async () => {
      // Capture from the top of the document, and let React paint the portal
      // (plus webfonts and the cover thumbnail) before rasterising — capturing
      // too early is the other way to end up with blank pages.
      window.scrollTo(0, 0);
      try {
        await document.fonts?.ready;
      } catch {
        /* fonts API unavailable — the delay below still covers it */
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (cancelled) return;

      const element = document.querySelector(".print-root");
      if (!element) {
        restore();
        return;
      }

      try {
        // Loaded on demand — html2pdf is ~500 kB and only needed on export.
        const mod = await import("html2pdf.js");
        // html2pdf ships UMD: depending on how the bundler interops it, the
        // callable lands on .default or on the namespace itself.
        const html2pdf = typeof mod.default === "function" ? mod.default : mod;
        if (typeof html2pdf !== "function") throw new Error("html2pdf unavailable");
        if (cancelled) return;
        await html2pdf().set(html2pdfOptions(fileName)).from(element).save();
        restore();
      } catch (error) {
        if (cancelled) return;
        // Fall back to the browser's own Save-as-PDF so the export still works.
        console.error("[pdf] direct download failed, using browser print", error);
        document.body.classList.remove("is-exporting");
        document.body.classList.add("is-printing");
        document.title = fileName;
        window.addEventListener("afterprint", restore);
        setTimeout(() => window.print(), 150);
      }
    };

    run();

    return () => {
      cancelled = true;
      restore();
    };
  }, [printing]);

  const startPrint = useCallback((fileName) => {
    fileNameRef.current = sanitizePdfName(fileName);
    setPrinting(true);
  }, []);

  return { printing, startPrint };
}

/**
 * components/PdfExportOverlay.jsx
 * -------------------------------
 * Shown while `usePrintExport` rasterises the document. Building a long export
 * takes a few seconds, and without this the app looks frozen — the click
 * appears to do nothing until the download lands.
 */

import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { FileDown } from "lucide-react";

const PdfExportOverlay = () => {
  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-card px-8 py-7 shadow-lift">
        <span className="icon-tile">
          <FileDown size={18} />
        </span>
        <p className="text-sm font-semibold text-ink">Preparing your PDF…</p>
        <p className="max-w-[15rem] text-center text-xs text-muted">
          The download starts automatically when it&apos;s ready.
        </p>
      </div>
    </motion.div>,
    document.body
  );
};

export default PdfExportOverlay;

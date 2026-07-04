/**
 * utils/exportPdf.js
 * ------------------
 * Generates nicely formatted PDFs (chat, summary, key points) using jsPDF.
 *
 * Note: jsPDF's built-in fonts only render Latin (WinAnsi) characters, so
 * non-Latin scripts such as Hindi/Devanagari will not display correctly in the
 * exported PDF. English content exports cleanly.
 */

import { jsPDF } from "jspdf";

const MARGIN = 48;
const BRAND = [79, 70, 229];
const INK = [30, 41, 59];
const MUTED = [100, 116, 139];

/** A flowing text writer that handles wrapping and automatic page breaks. */
const makeWriter = (doc) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN * 2;
  const state = { y: MARGIN };

  const ensure = (h) => {
    if (state.y + h > pageHeight - MARGIN) {
      doc.addPage();
      state.y = MARGIN;
    }
  };

  const write = (str, opts = {}) => {
    const {
      font = "normal",
      size = 10.5,
      color = INK,
      gap = 14,
      indent = 0,
    } = opts;
    doc.setFont("helvetica", font);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(String(str ?? ""), maxWidth - indent);
    lines.forEach((ln) => {
      ensure(gap);
      doc.text(ln, MARGIN + indent, state.y);
      state.y += gap;
    });
  };

  const space = (h = 8) => {
    state.y += h;
  };

  return {
    write,
    space,
    get y() {
      return state.y;
    },
    set y(v) {
      state.y = v;
    },
  };
};

/** Create a new A4 doc with the branded header band + title/date block. */
const startDoc = (headerTitle, videoTitle) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(headerTitle, MARGIN, 44);

  const w = makeWriter(doc);
  w.y = 96;
  w.write(videoTitle || "Untitled video", { font: "bold", size: 13, gap: 18 });
  w.write(`Exported on ${new Date().toLocaleString()}`, {
    size: 9,
    color: MUTED,
    gap: 22,
  });
  return { doc, w };
};

/** Remove light markdown markers so text reads cleanly in the PDF. */
const stripMd = (s) =>
  String(s ?? "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^#{1,6}\s/, "")
    .trim();

/** Render a markdown-ish block (paragraphs, bullets, headings). */
const writeMarkdown = (w, raw) => {
  String(raw ?? "")
    .split("\n")
    .forEach((line) => {
      const t = line.trim();
      if (!t) {
        w.space(6);
        return;
      }
      if (/^#{1,6}\s/.test(t)) {
        w.write(stripMd(t), { font: "bold", size: 12, gap: 16 });
        return;
      }
      if (/^[-*•]\s/.test(t)) {
        w.write("•  " + stripMd(t.replace(/^[-*•]\s/, "")), {
          gap: 14,
          indent: 10,
        });
        return;
      }
      w.write(stripMd(t), { gap: 14 });
    });
};

const fileName = (videoTitle, kind) => {
  const safe = (videoTitle || "video")
    .replace(/[^a-z0-9]+/gi, "-")
    .slice(0, 40)
    .toLowerCase();
  return `yt-${kind}-${safe}.pdf`;
};

// --------------------------------------------------------------------------- //
// Exports
// --------------------------------------------------------------------------- //

/** Export a full chat conversation. `messages` = [{ role, content }]. */
export const exportChatToPdf = (videoTitle, messages) => {
  const { doc, w } = startDoc("YT Chat GenAI — Conversation", videoTitle);
  messages.forEach((m) => {
    const isUser = m.role === "user";
    w.write(isUser ? "You" : "AI Assistant", {
      font: "bold",
      size: 10,
      color: isUser ? BRAND : [147, 51, 234],
      gap: 15,
    });
    writeMarkdown(w, m.content);
    w.space(10);
  });
  doc.save(fileName(videoTitle, "chat"));
};

/** Export the AI summary. */
export const exportSummaryToPdf = (videoTitle, summary) => {
  const { doc, w } = startDoc("YT Chat GenAI — Summary", videoTitle);
  writeMarkdown(w, summary || "No summary available.");
  doc.save(fileName(videoTitle, "summary"));
};

/** Export key points. `keyPoints` = [{ timestamp, point }]. */
export const exportKeyPointsToPdf = (videoTitle, keyPoints) => {
  const { doc, w } = startDoc("YT Chat GenAI — Key Points", videoTitle);
  if (!keyPoints || keyPoints.length === 0) {
    w.write("No key points available.");
  } else {
    keyPoints.forEach((kp, i) => {
      w.write(`${i + 1}.  [${kp.timestamp}]`, {
        font: "bold",
        size: 10.5,
        color: BRAND,
        gap: 14,
      });
      w.write(stripMd(kp.point), { gap: 14, indent: 14 });
      w.space(6);
    });
  }
  doc.save(fileName(videoTitle, "key-points"));
};

/**
 * utils/exportText.js
 * -------------------
 * TXT and DOCX exporters for chat conversations.
 * Uses the `docx` package + `file-saver`.
 */

import { saveAs } from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";

const fileBase = (title, kind) =>
  `yt-${kind}-${(title || "video")
    .replace(/[^a-z0-9]+/gi, "-")
    .slice(0, 40)
    .toLowerCase()}`;

/** Strip light markdown so plain text / docx reads cleanly. */
const strip = (s) =>
  String(s ?? "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^#{1,6}\s/gm, "");

// --------------------------------------------------------------------------- //
// Chat
// --------------------------------------------------------------------------- //
export const exportChatToTxt = (videoTitle, messages) => {
  let out = `YT Chat GenAI — Conversation\n${videoTitle || ""}\n`;
  out += `Exported ${new Date().toLocaleString()}\n${"=".repeat(50)}\n\n`;
  messages.forEach((m) => {
    out += `${m.role === "user" ? "YOU" : "AI ASSISTANT"}:\n`;
    out += `${strip(m.content)}\n\n`;
  });
  saveAs(
    new Blob([out], { type: "text/plain;charset=utf-8" }),
    `${fileBase(videoTitle, "chat")}.txt`
  );
};

export const exportChatToDocx = (videoTitle, messages) => {
  const children = [
    new Paragraph({ text: "YT Chat GenAI — Conversation", heading: HeadingLevel.TITLE }),
    new Paragraph({ text: videoTitle || "", heading: HeadingLevel.HEADING_2 }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Exported ${new Date().toLocaleString()}`,
          italics: true,
          color: "888888",
        }),
      ],
    }),
    new Paragraph({ text: "" }),
  ];

  messages.forEach((m) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: m.role === "user" ? "You" : "AI Assistant",
            bold: true,
            color: m.role === "user" ? "4F46E5" : "9333EA",
          }),
        ],
        spacing: { before: 160 },
      })
    );
    strip(m.content)
      .split("\n")
      .forEach((line) => children.push(new Paragraph({ text: line })));
  });

  const doc = new Document({ sections: [{ children }] });
  Packer.toBlob(doc).then((blob) =>
    saveAs(blob, `${fileBase(videoTitle, "chat")}.docx`)
  );
};


/**
 * components/InsightsPrintDocument.jsx
 * ------------------------------------
 * Print-only rendering of a video insight (summary or key points): a compact
 * document header with the video title, followed by the content rendered with
 * the shared MarkdownRenderer — no cover page, export dates or footer chrome.
 * Portaled to <body> and shown only while printing (see `.print-root` CSS).
 */
import { createPortal } from "react-dom";
import MarkdownRenderer from "./MarkdownRenderer";

const InsightsPrintDocument = ({ kind, videoTitle, summary, keyPoints = [] }) => {
  const isSummary = kind === "summary";

  return createPortal(
    <div className="print-root">
      <header className="print-doc-header">
        <div className="print-doc-kicker">
          {isSummary ? "Video Summary" : "Key Points"}
        </div>
        <h1 className="print-doc-title">{videoTitle || "Untitled video"}</h1>
      </header>

      {isSummary ? (
        <MarkdownRenderer className="print-doc-body">
          {summary || "No summary available."}
        </MarkdownRenderer>
      ) : (
        <ol className="print-keypoints">
          {keyPoints.map((kp, i) => (
            <li key={i} className="print-keypoint">
              {kp.timestamp ? (
                <span className="print-keypoint-time">{kp.timestamp}</span>
              ) : null}
              <p>{kp.point}</p>
            </li>
          ))}
        </ol>
      )}
    </div>,
    document.body
  );
};

export default InsightsPrintDocument;

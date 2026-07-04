/**
 * lib/remarkAdmonitions.js
 * ------------------------
 * remark plugin that turns GitHub-style admonition blockquotes into a custom
 * <callout> node so MarkdownRenderer can render a styled box:
 *
 *   > [!TIP] Optional title
 *   > body text...
 *
 * Supported (with aliases): NOTE, INFO/IMPORTANT, TIP/HINT, SUCCESS/CHECK,
 * WARNING/CAUTION, DANGER/ERROR, SUMMARY/KEY/TAKEAWAYS.
 */
import { visit } from "unist-util-visit";

const ALIASES = {
  note: "note",
  info: "info",
  important: "info",
  tip: "tip",
  hint: "tip",
  success: "success",
  check: "success",
  warning: "warning",
  caution: "warning",
  danger: "danger",
  error: "danger",
  summary: "summary",
  key: "summary",
  takeaway: "summary",
  takeaways: "summary",
};

export default function remarkAdmonitions() {
  return (tree) => {
    visit(tree, "blockquote", (node) => {
      const para = node.children && node.children[0];
      if (!para || para.type !== "paragraph") return;
      const textNode = para.children && para.children[0];
      if (!textNode || textNode.type !== "text") return;

      const match = /^\[!(\w+)\][ \t]*([^\n]*)(?:\n|$)/.exec(textNode.value);
      if (!match) return;

      const kind = ALIASES[match[1].toLowerCase()];
      if (!kind) return;

      const title = (match[2] || "").trim();

      // Drop the "[!TYPE] title" marker line from the body.
      textNode.value = textNode.value.slice(match[0].length);
      if (textNode.value === "") para.children.shift();
      if (para.children.length === 0) node.children.shift();

      node.data = {
        ...(node.data || {}),
        hName: "callout",
        hProperties: { type: kind, ...(title ? { calltitle: title } : {}) },
      };
    });
  };
}

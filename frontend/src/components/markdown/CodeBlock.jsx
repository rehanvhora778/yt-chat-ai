/**
 * components/markdown/CodeBlock.jsx
 * ---------------------------------
 * ChatGPT-style fenced code block: language badge, copy button, syntax
 * highlighting (dark theme), line numbers and long-line wrapping.
 */
import { useState } from "react";
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";

const LABELS = {
  js: "JavaScript",
  javascript: "JavaScript",
  jsx: "JSX",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  py: "Python",
  python: "Python",
  sh: "Shell",
  bash: "Bash",
  shell: "Shell",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  sql: "SQL",
  java: "Java",
  kotlin: "Kotlin",
  cpp: "C++",
  c: "C",
  cs: "C#",
  go: "Go",
  rust: "Rust",
  rb: "Ruby",
  php: "PHP",
  yaml: "YAML",
  yml: "YAML",
  md: "Markdown",
  text: "Text",
  plaintext: "Text",
};

const CodeBlock = ({ language = "text", value = "" }) => {
  const [copied, setCopied] = useState(false);
  const lang = (language || "text").toLowerCase();
  const label = LABELS[lang] || lang.toUpperCase();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="code-block my-4 overflow-hidden rounded-xl border border-slate-700/60 shadow-md">
      <div className="flex items-center justify-between bg-slate-800 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white print:hidden"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={lang}
        style={oneDark}
        showLineNumbers
        wrapLongLines
        customStyle={{
          margin: 0,
          padding: "1rem",
          fontSize: "0.8rem",
          background: "#282c34",
        }}
        codeTagProps={{
          style: {
            fontFamily:
              "'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,monospace",
          },
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeBlock;

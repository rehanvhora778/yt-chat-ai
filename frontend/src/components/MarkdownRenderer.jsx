/**
 * components/MarkdownRenderer.jsx
 * -------------------------------
 * The single rich-text renderer used by chat answers, insight panels and the
 * PDF/print view. Full GitHub-flavoured Markdown + math (KaTeX) + callouts +
 * ChatGPT-style code blocks, tables, images and dividers.
 */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import CodeBlock from "./markdown/CodeBlock";
import Callout from "./markdown/Callout";
import remarkAdmonitions from "../lib/remarkAdmonitions";

const components = {
  // Custom <callout> nodes emitted by remarkAdmonitions
  callout: ({ type, calltitle, children }) => (
    <Callout type={type} calltitle={calltitle}>
      {children}
    </Callout>
  ),

  // Code: ChatGPT-style block, or a styled inline pill
  code({ node, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const text = String(children ?? "");
    if (match || text.includes("\n")) {
      return (
        <CodeBlock
          language={match ? match[1] : "text"}
          value={text.replace(/\n$/, "")}
        />
      );
    }
    return (
      <code className="md-inline-code" {...props}>
        {children}
      </code>
    );
  },
  // CodeBlock renders its own container, so flatten <pre>
  pre: ({ children }) => <>{children}</>,

  table: ({ children }) => (
    <div className="md-table-wrap my-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="md-table w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),

  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700 dark:text-brand-300"
    >
      {children}
    </a>
  ),

  img: ({ src, alt }) => (
    <figure className="my-4">
      <img
        src={src}
        alt={alt || ""}
        loading="lazy"
        className="mx-auto max-h-[28rem] rounded-xl border border-slate-200 object-contain shadow-md dark:border-slate-700"
      />
      {alt ? (
        <figcaption className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
          {alt}
        </figcaption>
      ) : null}
    </figure>
  ),

  hr: () => <hr className="md-divider my-6" />,
};

const MarkdownRenderer = ({ children, className = "" }) => (
  <div className={`md-body prose prose-slate max-w-none dark:prose-invert ${className}`}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, remarkAdmonitions]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {children || ""}
    </ReactMarkdown>
  </div>
);

export default MarkdownRenderer;

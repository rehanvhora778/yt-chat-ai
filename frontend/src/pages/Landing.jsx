/**
 * pages/Landing.jsx
 * -----------------
 * Public home page: hero with a live-looking chat preview, the RAG
 * pipeline explained in four stages, the feature set, and the tech stack.
 */

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MessageSquareText,
  Sparkles,
  ListChecks,
  Languages,
  Download,
  ArrowRight,
  ArrowDown,
  GraduationCap,
  Lightbulb,
  BarChart3,
  Subtitles,
  Database,
  Search,
  Bot,
  Layers,
  Server,
  BrainCircuit,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

/* ---------- content ---------- */

const pipeline = [
  {
    icon: Subtitles,
    title: "Extract",
    desc: "Captions are retrieved directly from the video. For videos without captions, the audio is transcribed automatically.",
    tag: "youtube-transcript-api · Whisper",
  },
  {
    icon: Database,
    title: "Embed",
    desc: "The transcript is segmented and converted into vector embeddings that capture semantic meaning.",
    tag: "Gemini embeddings · FAISS",
  },
  {
    icon: Search,
    title: "Retrieve",
    desc: "Each question is matched against the transcript using semantic search to find the most relevant passages.",
    tag: "semantic search",
  },
  {
    icon: Bot,
    title: "Generate",
    desc: "A large language model composes the answer from the retrieved passages, cited with precise timestamps.",
    tag: "Llama · Groq",
  },
];

const features = [
  {
    icon: MessageSquareText,
    title: "Context-aware chat",
    desc: "Ask questions in natural language and receive accurate answers grounded in the transcript, with timestamp citations.",
  },
  {
    icon: Lightbulb,
    title: "Summaries & insights",
    desc: "Generate concise summaries and key takeaways from long-form videos in seconds.",
  },
  {
    icon: GraduationCap,
    title: "Interactive quizzes",
    desc: "Assess your understanding with automatically generated quizzes, complete with scoring and answer review.",
  },
  {
    icon: Languages,
    title: "Bilingual support",
    desc: "Ask questions in English or Hindi and receive responses in the same language, seamlessly.",
  },
  {
    icon: BarChart3,
    title: "Learning analytics",
    desc: "Track processed videos, conversations and quiz performance from a personal analytics dashboard.",
  },
  {
    icon: Download,
    title: "Document export",
    desc: "Download conversations and summaries as professionally formatted PDF or Word documents.",
  },
];

const stack = [
  {
    icon: Layers,
    group: "Frontend",
    items: ["React 18", "Vite", "Tailwind CSS", "Framer Motion", "Recharts"],
  },
  {
    icon: Server,
    group: "Backend",
    items: ["Flask", "REST API", "MongoDB", "JWT auth", "yt-dlp"],
  },
  {
    icon: BrainCircuit,
    group: "AI / RAG",
    items: ["LangChain", "Groq · Llama", "Gemini embeddings", "FAISS", "Whisper"],
  },
];

/* ---------- animation variants ---------- */

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

/* ---------- small building blocks ---------- */

const SectionHeading = ({ eyebrow, title, sub }) => (
  <div className="mb-12 text-center">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
      {eyebrow}
    </p>
    <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h2>
    {sub && (
      <p className="mx-auto mt-3 max-w-xl text-muted">
        {sub}
      </p>
    )}
  </div>
);

/* ---------- page ---------- */

const Landing = () => {
  const { isAuthenticated } = useAuth();
  const ctaTarget = isAuthenticated ? "/dashboard" : "/register";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* ---------- Hero ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-4 py-1.5 text-xs font-semibold text-accent"
        >
          <Sparkles size={15} /> Powered by Retrieval-Augmented Generation
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-6xl"
        >
          Turn any <span className="gradient-text">YouTube video</span> into a
          conversation
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted"
        >
          Paste a link and ask questions in natural language. Get accurate,
          timestamp-cited answers, concise summaries, interactive quizzes and
          exportable notes — all grounded in the video itself.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link to={ctaTarget} className="btn-primary h-12 px-7 text-[15px]">
            Get Started <ArrowRight size={18} />
          </Link>
          <a href="#pipeline" className="btn-ghost h-12 px-7 text-[15px]">
            How It Works <ArrowDown size={16} />
          </a>
        </motion.div>

        {/* Floating mock chat preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative mx-auto mt-16 max-w-3xl"
        >
          {/* soft glow behind the window */}
          <div className="accent-grad absolute inset-x-10 -bottom-4 -z-10 h-28 rounded-full opacity-20 blur-3xl" />

          <div className="card-flush gradient-border rounded-2xl p-6 text-left shadow-lift">
            {/* window bar with a lecture title */}
            <div className="flex items-center gap-2 border-b border-line pb-4">
              <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-gold/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-card3" />
              <span className="ml-3 truncate text-xs font-medium text-muted">
                Operating Systems — Lecture 12: Deadlocks (1:47:32)
              </span>
            </div>

            <div className="space-y-3 pt-4">
              <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-tr-sm border border-accent/25 bg-accent/12 px-4 py-2.5 text-sm text-ink">
                What are the four conditions required for a deadlock?
              </div>

              <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm border border-line bg-card2 px-4 py-2.5 text-sm leading-relaxed text-ink">
                From the lecture: <b>mutual exclusion</b>,{" "}
                <b>hold &amp; wait</b>, <b>no preemption</b> and{" "}
                <b>circular wait</b>. All four conditions must hold
                simultaneously — preventing any one of them prevents deadlock.
                Would you like a quiz on this topic?
              </div>

              {/* suggestion chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { icon: GraduationCap, label: "Quiz me" },
                  { icon: Lightbulb, label: "Summarize the lecture" },
                  { icon: ListChecks, label: "Key moments" },
                ].map((chip) => (
                  <span
                    key={chip.label}
                    className="chip"
                  >
                    <chip.icon size={12} className="text-accent" />
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ---------- RAG pipeline ---------- */}
      <section id="pipeline" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              From video link to{" "}
              <span className="gradient-text">grounded answers</span>
            </>
          }
          sub="Every video is processed through a four-stage Retrieval-Augmented Generation pipeline for accurate, verifiable responses."
        />

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {pipeline.map((step, i) => (
            <motion.div key={step.title} variants={item} className="relative">
              <div className="card h-full">
                <div className="flex items-center justify-between">
                  <span className="icon-tile h-11 w-11">
                    <step.icon size={20} />
                  </span>
                  <span className="text-4xl font-extrabold text-card3">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {step.desc}
                </p>
                <p className="mt-3 font-mono text-[11px] text-accent">
                  {step.tag}
                </p>
              </div>

              {/* connector arrow between cards on desktop */}
              {i < pipeline.length - 1 && (
                <ArrowRight
                  size={18}
                  className="absolute -right-[21px] top-1/2 hidden -translate-y-1/2 text-faint lg:block"
                />
              )}
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ---------- Features ---------- */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeading
          eyebrow="Features"
          title={
            <>
              Everything you need to{" "}
              <span className="gradient-text">learn from videos</span>
            </>
          }
          sub="A complete toolkit for understanding, revising and organising video content."
        />

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((f) => (
            <motion.div key={f.title} variants={item} className="card card-interactive group">
              <span className="icon-tile h-12 w-12 transition-transform group-hover:scale-105">
                <f.icon size={22} />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ---------- Tech stack ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeading
          eyebrow="Technology"
          title="Built on a modern stack"
          sub="A full-stack application combining a React frontend, a Flask REST API and a Retrieval-Augmented Generation pipeline."
        />

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-6 sm:grid-cols-3"
        >
          {stack.map((s) => (
            <motion.div key={s.group} variants={item} className="card">
              <div className="flex items-center gap-3">
                <span className="icon-tile">
                  <s.icon size={20} />
                </span>
                <h3 className="font-semibold text-ink">{s.group}</h3>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {s.items.map((t) => (
                  <span
                    key={t}
                    className="chip"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

    </motion.div>
  );
};

export default Landing;

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

import Footer from "../components/Footer";
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
    items: ["Flask", "REST API", "MongoDB Atlas", "JWT auth", "yt-dlp"],
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

const Timestamp = ({ children }) => (
  <span className="inline-flex items-center rounded-md bg-brand-500/10 px-1.5 py-0.5 text-xs font-semibold text-brand-600 dark:bg-brand-400/15 dark:text-brand-300">
    {children}
  </span>
);

const SectionHeading = ({ eyebrow, title, sub }) => (
  <div className="mb-12 text-center">
    <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300">
      {eyebrow}
    </p>
    <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h2>
    {sub && (
      <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">
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
      <section className="mx-auto max-w-6xl px-4 pt-20 pb-16 text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300"
        >
          <Sparkles size={15} /> Powered by Retrieval-Augmented Generation
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl"
        >
          Turn any <span className="gradient-text">YouTube video</span> into a
          conversation
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300"
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
          <Link to={ctaTarget} className="btn-primary px-7 py-3 text-base">
            Get Started <ArrowRight size={18} />
          </Link>
          <a href="#pipeline" className="btn-ghost px-7 py-3 text-base">
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
          <div className="accent-grad absolute inset-x-10 -bottom-4 -z-10 h-28 rounded-full opacity-25 blur-3xl" />

          <div className="glass rounded-3xl p-6 text-left">
            {/* window bar with a lecture title */}
            <div className="flex items-center gap-2 border-b border-slate-200/60 pb-4 dark:border-white/10">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-yellow-400" />
              <span className="h-3 w-3 rounded-full bg-green-400" />
              <span className="ml-3 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                Operating Systems — Lecture 12: Deadlocks (1:47:32)
              </span>
            </div>

            <div className="space-y-3 pt-4">
              <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-brand-600 to-purple-600 px-4 py-2.5 text-sm text-white">
                What are the four conditions required for a deadlock?
              </div>

              <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                From the lecture: <b>mutual exclusion</b>{" "}
                <Timestamp>32:10</Timestamp>, <b>hold &amp; wait</b>{" "}
                <Timestamp>35:42</Timestamp>, <b>no preemption</b>{" "}
                <Timestamp>39:05</Timestamp> and <b>circular wait</b>{" "}
                <Timestamp>41:56</Timestamp>. All four conditions must hold
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
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300/70 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-300"
                  >
                    <chip.icon size={13} className="text-brand-500" />
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
                  <span className="accent-grad inline-flex h-11 w-11 items-center justify-center rounded-xl text-white">
                    <step.icon size={20} />
                  </span>
                  <span className="text-4xl font-extrabold text-slate-200 dark:text-slate-700">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {step.desc}
                </p>
                <p className="mt-3 font-mono text-[11px] text-brand-600 dark:text-brand-300">
                  {step.tag}
                </p>
              </div>

              {/* connector arrow between cards on desktop */}
              {i < pipeline.length - 1 && (
                <ArrowRight
                  size={18}
                  className="absolute -right-[21px] top-1/2 hidden -translate-y-1/2 text-slate-400 dark:text-slate-500 lg:block"
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
            <motion.div key={f.title} variants={item} className="card group">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-purple-600 text-white transition-transform group-hover:scale-110">
                <f.icon size={22} />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
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
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  <s.icon size={20} />
                </span>
                <h3 className="font-semibold">{s.group}</h3>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {s.items.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-slate-300/70 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <Footer />
    </motion.div>
  );
};

export default Landing;

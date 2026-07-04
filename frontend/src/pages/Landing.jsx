/**
 * pages/Landing.jsx
 * -----------------
 * Animated hero, feature grid and call-to-action. The main public entry point.
 */

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MessageSquareText,
  Sparkles,
  FileText,
  ListChecks,
  Languages,
  Clock,
  Download,
  ArrowRight,
} from "lucide-react";

import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";

const features = [
  {
    icon: MessageSquareText,
    title: "Chat with any video",
    desc: "Ask questions and get instant, grounded answers from the transcript.",
  },
  {
    icon: FileText,
    title: "Smart summaries",
    desc: "Condense long videos into a clear paragraph and key takeaways.",
  },
  {
    icon: ListChecks,
    title: "Key points & timestamps",
    desc: "Jump straight to the important moments with cited timestamps.",
  },
  {
    icon: Languages,
    title: "English & Hindi",
    desc: "Converse and get answers in English or Hindi seamlessly.",
  },
  {
    icon: Download,
    title: "Export to PDF",
    desc: "Download your full chat history as a polished PDF document.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

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
          <Sparkles size={15} /> Powered by Groq + LangChain
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl"
        >
          Turn any{" "}
          <span className="gradient-text">YouTube video</span> into a
          conversation
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300"
        >
          Paste a link and chat with the video. Get instant summaries, key
          points and timestamps — all powered by Generative AI and semantic
          search.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link to={ctaTarget} className="btn-primary px-7 py-3 text-base">
            Get Started Free <ArrowRight size={18} />
          </Link>
          <a href="#features" className="btn-ghost px-7 py-3 text-base">
            Explore Features
          </a>
        </motion.div>

        {/* Floating mock chat preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mx-auto mt-16 max-w-3xl"
        >
          <div className="glass rounded-3xl p-6 text-left">
            <div className="flex items-center gap-2 pb-4">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-yellow-400" />
              <span className="h-3 w-3 rounded-full bg-green-400" />
            </div>
            <div className="space-y-3">
              <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-brand-600 to-purple-600 px-4 py-2.5 text-sm text-white">
                What are the 3 main takeaways from this video?
              </div>
              <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                Great question! The video covers: 1) the core concept at{" "}
                <span className="font-semibold text-brand-600 dark:text-brand-300">
                  2:14
                </span>
                , 2) a practical demo at{" "}
                <span className="font-semibold text-brand-600 dark:text-brand-300">
                  6:48
                </span>
                , and 3) key best-practices near the end. Want me to expand on
                any of them?
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ---------- Features ---------- */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Everything you need to{" "}
            <span className="gradient-text">learn faster</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">
            A complete AI toolkit built around your videos.
          </p>
        </div>

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

      {/* ---------- How it works ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { step: "1", title: "Paste a URL", icon: MessageSquareText },
            { step: "2", title: "We process it", icon: Clock },
            { step: "3", title: "Chat & learn", icon: Sparkles },
          ].map((s) => (
            <div key={s.step} className="card text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {s.step}
              </div>
              <s.icon className="mx-auto text-brand-500" size={24} />
              <h3 className="mt-3 font-semibold">{s.title}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-purple-600 px-8 py-14 text-center text-white shadow-2xl">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <h2 className="text-3xl font-bold sm:text-4xl">
            Ready to chat with your first video?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-white/80">
            Create a free account and start learning smarter in seconds.
          </p>
          <Link
            to={ctaTarget}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3 font-semibold text-brand-700 transition-transform hover:-translate-y-0.5"
          >
            Get Started <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <Footer />
    </motion.div>
  );
};

export default Landing;

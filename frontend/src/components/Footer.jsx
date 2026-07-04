/**
 * components/Footer.jsx
 * ---------------------
 * Simple footer used across public pages.
 */

import { Youtube, Github, Heart } from "lucide-react";

const Footer = () => (
  <footer className="mt-20 border-t border-slate-200 py-8 dark:border-slate-800">
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 dark:text-slate-400 sm:flex-row">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-purple-600 text-white">
          <Youtube size={15} />
        </span>
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          YT Chat GenAI
        </span>
      </div>

      <p className="flex items-center gap-1">
        Built with <Heart size={14} className="text-pink-500" /> for an AI/ML
        final-year project.
      </p>

      <a
        href="https://github.com"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 transition-colors hover:text-brand-600 dark:hover:text-brand-300"
      >
        <Github size={16} /> Source
      </a>
    </div>
  </footer>
);

export default Footer;

/**
 * components/Footer.jsx
 * ---------------------
 * Footer for the public pages.
 */

import { Link } from "react-router-dom";
import { Github, Heart, Youtube } from "lucide-react";

const Footer = () => (
  <footer className="border-t border-line">
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-7 text-sm text-muted sm:flex-row sm:px-6">
      <Link to="/" className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
          <Youtube size={14} />
        </span>
        <span className="font-semibold text-ink">YT Chat GenAI</span>
      </Link>

      <p className="flex items-center gap-1.5 text-xs">
        Built with <Heart size={13} className="text-accent" /> by Rayhan Vora
      </p>

      <a
        href="https://github.com"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 text-xs transition-colors hover:text-accent"
      >
        <Github size={15} /> Source
      </a>
    </div>
  </footer>
);

export default Footer;

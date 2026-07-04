/**
 * components/Loader.jsx
 * ---------------------
 * Animated gradient spinner with an optional label, used for loading states.
 */

import { motion } from "framer-motion";

const Loader = ({ label = "", size = 40 }) => (
  <div className="flex flex-col items-center justify-center gap-3">
    <motion.span
      className="inline-block rounded-full border-4 border-brand-500/30 border-t-brand-600"
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
    />
    {label && (
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    )}
  </div>
);

export default Loader;

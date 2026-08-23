/**
 * components/Loader.jsx
 * ---------------------
 * Spinner with an optional label, used for page and route loading states.
 */

import { motion } from "framer-motion";

const Loader = ({ label = "", size = 34 }) => (
  <div className="flex flex-col items-center justify-center gap-3">
    <motion.span
      className="inline-block rounded-full border-2 border-line2 border-t-accent"
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.85, ease: "linear" }}
    />
    {label && <p className="text-sm text-muted">{label}</p>}
  </div>
);

export default Loader;

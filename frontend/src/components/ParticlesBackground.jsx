/**
 * components/ParticlesBackground.jsx
 * ----------------------------------
 * Lightweight animated floating particles + gradient blobs rendered behind the
 * page content. Pure CSS/Framer Motion (no heavy particle library).
 */

import { useMemo } from "react";
import { motion } from "framer-motion";

const ParticlesBackground = () => {
  // Generate a stable set of particles once
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => ({
        id: i,
        size: Math.random() * 8 + 4,
        left: Math.random() * 100,
        top: Math.random() * 100,
        duration: Math.random() * 8 + 6,
        delay: Math.random() * 5,
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Gradient blobs — colored by the active theme's glow variables */}
      <div
        className="absolute -left-32 top-0 h-96 w-96 rounded-full blur-3xl animate-blob"
        style={{ backgroundColor: "rgb(var(--glow-1) / 0.30)" }}
      />
      <div
        className="absolute right-0 top-1/3 h-96 w-96 rounded-full blur-3xl animate-blob [animation-delay:3s]"
        style={{ backgroundColor: "rgb(var(--glow-2) / 0.28)" }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full blur-3xl animate-blob [animation-delay:6s]"
        style={{ backgroundColor: "rgb(var(--glow-1) / 0.20)" }}
      />

      {/* Floating particles */}
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            top: `${p.top}%`,
            backgroundColor: "rgb(var(--accent) / 0.40)",
          }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

export default ParticlesBackground;

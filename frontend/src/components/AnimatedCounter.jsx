/**
 * components/AnimatedCounter.jsx
 * ------------------------------
 * Counts up from 0 to `value` with an ease-out curve when it mounts/updates.
 */

import { useEffect, useRef, useState } from "react";

const AnimatedCounter = ({ value = 0, duration = 1200, decimals = 0, suffix = "" }) => {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    let raf;
    startRef.current = null;
    const target = Number(value) || 0;
    const animate = (t) => {
      if (startRef.current == null) startRef.current = t;
      const progress = Math.min((t - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <>
      {display.toLocaleString(undefined, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      })}
      {suffix}
    </>
  );
};

export default AnimatedCounter;

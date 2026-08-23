/**
 * components/ui/Menu.jsx
 * ----------------------
 * Lightweight dropdown: a trigger you render yourself plus a panel that closes
 * on outside click, Escape or after an item is chosen.
 */

import { cloneElement, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const Menu = ({ trigger, children, align = "right", width = "w-52" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {cloneElement(trigger, {
        onClick: (event) => {
          event.stopPropagation();
          trigger.props.onClick?.(event);
          setOpen((value) => !value);
        },
        "aria-expanded": open,
        "aria-haspopup": "menu",
      })}

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            // Menus often live inside clickable cards — keep item clicks from
            // bubbling up and triggering the card's own navigation.
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
            }}
            className={`glass absolute z-50 mt-2 ${width} overflow-hidden rounded-xl p-1.5 shadow-lift ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const MenuItem = ({ icon: Icon, children, danger, ...props }) => (
  <button
    role="menuitem"
    {...props}
    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-card2 ${
      danger ? "text-accent" : "text-ink"
    } ${props.className || ""}`}
  >
    {Icon && <Icon size={15} className={danger ? "" : "text-muted"} />}
    <span className="truncate">{children}</span>
  </button>
);

export const MenuLabel = ({ children }) => (
  <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">
    {children}
  </p>
);

export const MenuDivider = () => <div className="my-1.5 h-px bg-line" />;

export default Menu;

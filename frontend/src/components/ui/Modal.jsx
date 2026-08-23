/**
 * components/ui/Modal.jsx
 * -----------------------
 * Accessible dialog used for collection editing, export pickers and
 * confirmations. Closes on Escape or backdrop click, locks background scroll
 * and moves focus into the panel when it opens.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export const Modal = ({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  size = "md",
  footer,
  children,
}) => {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => {
      const focusable = panelRef.current?.querySelector(
        "input, textarea, select, button:not([data-autofocus-skip])"
      );
      focusable?.focus();
    }, 60);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className={`relative w-full ${SIZES[size]} max-h-[92vh] overflow-hidden rounded-t-3xl border border-line bg-card shadow-lift sm:rounded-2xl`}
          >
            {(title || onClose) && (
              <div className="flex items-start gap-3 border-b border-line px-5 py-4">
                {Icon && (
                  <span className="icon-tile">
                    <Icon size={18} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold tracking-tight text-ink">
                    {title}
                  </h2>
                  {description && (
                    <p className="mt-0.5 text-xs text-muted">{description}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  data-autofocus-skip
                  aria-label="Close dialog"
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card2 hover:text-ink"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <div className="max-h-[68vh] overflow-y-auto px-5 py-4">{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-line bg-card2/60 px-5 py-3.5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export const ConfirmDialog = ({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onClose,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    icon={AlertTriangle}
    size="sm"
    footer={
      <>
        <button onClick={onClose} className="btn-ghost">
          {cancelLabel}
        </button>
        <button
          onClick={() => {
            onConfirm?.();
            onClose?.();
          }}
          className={destructive ? "btn-danger" : "btn-primary"}
        >
          {confirmLabel}
        </button>
      </>
    }
  >
    <p className="text-sm leading-relaxed text-muted">{message}</p>
  </Modal>
);

export default Modal;

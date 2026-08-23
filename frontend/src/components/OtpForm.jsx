/**
 * components/OtpForm.jsx
 * ----------------------
 * Second step of signup: enter the code emailed by the backend. Shared so a
 * login-time OTP (OTP_ON_LOGIN in backend/.env) can reuse it unchanged.
 *
 * The six cells are presentation only — a single transparent input sits over
 * them and holds the real value. That is what keeps native behaviour working:
 * paste, password managers, and the iOS/Android "from Messages" autofill that
 * `autocomplete="one-time-code"` triggers. Six separate inputs look the same
 * and quietly break all three.
 *
 * Motion is used to answer the questions someone actually has at this screen —
 * which box am I in, did that digit register, was the code wrong, did it work
 * — so every effect here is tied to a state change rather than decoration.
 * All of it is skipped when the OS asks for reduced motion.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  MailCheck,
  RotateCcw,
  Terminal,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

const CODE_LENGTH = 6;
const SUCCESS_HOLD_MS = 900; // long enough to read the tick, short enough not to wait

const OtpForm = ({
  email,
  purpose = "register",
  devEcho = false,
  resendCooldown = 60,
  onVerified,
  onBack,
}) => {
  const { verifyOtp, resendOtp } = useAuth();
  const inputRef = useRef(null);
  const reduce = useReducedMotion();

  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(true);
  const [status, setStatus] = useState("idle"); // idle | verifying | success | error
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(resendCooldown);

  const digits = useMemo(
    () => Array.from({ length: CODE_LENGTH }, (_, i) => code[i] ?? ""),
    [code]
  );
  // The cell the next keystroke lands in; clamped so the last cell stays lit
  // on a full code rather than the highlight vanishing off the end.
  const activeIndex = Math.min(code.length, CODE_LENGTH - 1);
  const locked = status === "verifying" || status === "success";

  const focusInput = () => inputRef.current?.focus();
  useEffect(focusInput, []);

  // Countdown gating the resend button; the backend enforces this too.
  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const submit = async (event, submittedCode) => {
    event?.preventDefault();
    const value = (submittedCode ?? code).trim();
    setNotice("");

    if (value.length !== CODE_LENGTH) {
      setStatus("error");
      setError(`Enter the ${CODE_LENGTH}-digit code from your email.`);
      return;
    }

    setStatus("verifying");
    setError("");
    const result = await verifyOtp(email, value, purpose);

    if (result.success) {
      setStatus("success");
      // Let the tick land before the page changes under them.
      setTimeout(() => onVerified?.(), reduce ? 0 : SUCCESS_HOLD_MS);
      return;
    }

    setStatus("error");
    setError(result.error || "That code could not be verified.");
    setCode("");
    focusInput();
  };

  const handleChange = (event) => {
    if (locked) return;
    // Digits only — this also turns a pasted "123 456" or "code: 123456"
    // into something usable instead of rejecting it.
    const next = event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(next);
    if (status === "error") {
      setStatus("idle");
      setError("");
    }
    if (next.length === CODE_LENGTH) submit(null, next);
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || resending || locked) return;
    setResending(true);
    setError("");
    setNotice("");
    const result = await resendOtp(email, purpose);
    setResending(false);

    if (result.success) {
      setNotice(result.message || "A new code is on its way.");
      setSecondsLeft(resendCooldown);
      setCode("");
      setStatus("idle");
      focusInput();
    } else {
      setStatus("error");
      setError(result.error || "Could not resend the code.");
    }
  };

  // ---- motion ----
  const cellsVariants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.055 } },
  };
  const cellVariants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 14, scale: 0.86 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { type: "spring", stiffness: 420, damping: 26 },
        },
      };

  // Wrong code: a shake reads as "no" before the message has been read.
  const shake = reduce
    ? {}
    : { x: [0, -11, 10, -7, 6, -3, 0], transition: { duration: 0.45 } };

  const cellTone = (index, filled) => {
    if (status === "success") return "border-emerald-400/70 bg-emerald-400/10";
    if (status === "error") return "border-accent/60 bg-accent/10";
    if (filled) return "border-line2 bg-card2";
    if (focused && index === activeIndex) return "border-accent/50 bg-card2";
    return "border-line bg-card2/50";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mb-7 text-center">
        <motion.span
          className="icon-tile relative mx-auto mb-3"
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 20, delay: 0.05 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {status === "success" ? (
              <motion.span
                key="done"
                initial={{ scale: 0, rotate: -35 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
                className="text-emerald-400"
              >
                <Check size={18} />
              </motion.span>
            ) : (
              <motion.span key="mail" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                <MailCheck size={18} />
              </motion.span>
            )}
          </AnimatePresence>
          {/* Quiet halo while waiting for input; stops once the code is in. */}
          {!reduce && status === "idle" && (
            <span className="pointer-events-none absolute inset-0 animate-pulse-ring rounded-[inherit] border border-accent/40" />
          )}
        </motion.span>

        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {status === "success" ? "You're verified" : "Check your email"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {status === "success" ? (
            "Taking you to your workspace..."
          ) : (
            <>
              We sent a {CODE_LENGTH}-digit code to{" "}
              <span className="font-semibold text-ink">{email}</span>
            </>
          )}
        </p>
      </div>

      {devEcho && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3.5 py-3 text-xs text-ink">
          <Terminal size={14} className="mt-0.5 shrink-0 text-gold" />
          <span>
            Email isn&apos;t configured yet, so the code was printed in the{" "}
            <strong>backend console</strong>.
          </span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <motion.div
          className="relative"
          animate={status === "error" ? shake : {}}
          onClick={focusInput}
        >
          {/* The real field. Transparent and stretched across the cells so a
              tap anywhere focuses it and the mobile keyboard opens. */}
          <input
            ref={inputRef}
            value={code}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={locked}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={`${CODE_LENGTH}-digit verification code`}
            maxLength={CODE_LENGTH}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer bg-transparent text-transparent caret-transparent outline-none"
          />

          <motion.div
            className="flex items-center justify-center gap-2 sm:gap-2.5"
            variants={cellsVariants}
            initial="hidden"
            animate="show"
          >
            {digits.map((digit, index) => {
              const isActive = focused && index === activeIndex && !locked;
              return (
                <motion.div
                  key={index}
                  variants={cellVariants}
                  animate={
                    status === "success" && !reduce
                      ? { scale: [1, 1.12, 1], transition: { delay: index * 0.05 } }
                      : {}
                  }
                  className={`relative flex h-14 w-full max-w-[3.25rem] items-center justify-center rounded-xl border text-2xl font-bold text-ink transition-colors duration-200 ${cellTone(
                    index,
                    Boolean(digit)
                  )}`}
                >
                  {/* One highlight that slides between cells, rather than six
                      that fade — the movement is what shows where focus went. */}
                  {isActive && !reduce && (
                    <motion.span
                      layoutId="otp-active-cell"
                      transition={{ type: "spring", stiffness: 520, damping: 34 }}
                      className="pointer-events-none absolute -inset-px rounded-xl border-2 border-accent shadow-glow"
                    />
                  )}

                  <AnimatePresence mode="popLayout" initial={false}>
                    {digit ? (
                      <motion.span
                        key={`d-${index}-${digit}`}
                        initial={reduce ? false : { y: 10, opacity: 0, scale: 0.6 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={reduce ? {} : { y: -8, opacity: 0, scale: 0.7 }}
                        transition={{ type: "spring", stiffness: 500, damping: 24 }}
                        className="relative"
                      >
                        {digit}
                      </motion.span>
                    ) : isActive ? (
                      <motion.span
                        key="caret"
                        className="h-6 w-[2px] rounded-full bg-accent"
                        animate={reduce ? {} : { opacity: [1, 0.15, 1] }}
                        transition={{ duration: 1.05, repeat: Infinity }}
                      />
                    ) : null}
                  </AnimatePresence>

                  {/* Verifying: a light sweeps left to right across the cells. */}
                  {status === "verifying" && !reduce && (
                    <motion.span
                      className="pointer-events-none absolute inset-0 rounded-xl bg-accent/20"
                      animate={{ opacity: [0, 0.9, 0] }}
                      transition={{
                        duration: 0.85,
                        repeat: Infinity,
                        delay: index * 0.09,
                      }}
                    />
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="err"
              role="alert"
              initial={reduce ? false : { opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={reduce ? {} : { opacity: 0, height: 0, y: -6 }}
              className="flex items-start gap-2 overflow-hidden rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-3 text-sm text-ink"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-accent" />
              <span>{error}</span>
            </motion.div>
          )}
          {notice && !error && (
            <motion.p
              key="notice"
              initial={reduce ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs font-medium text-emerald-400"
            >
              {notice}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          type="submit"
          disabled={locked || code.length !== CODE_LENGTH}
          whileTap={reduce || locked ? {} : { scale: 0.98 }}
          className={`h-11 w-full ${
            status === "success"
              ? "flex items-center justify-center gap-2 rounded-xl bg-emerald-500 font-semibold text-white"
              : "btn-primary"
          }`}
        >
          {status === "success" ? (
            <>
              <Check size={16} /> Verified
            </>
          ) : status === "verifying" ? (
            "Verifying..."
          ) : (
            "Verify & continue"
          )}
        </motion.button>
      </form>

      <div className="mt-5 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onBack}
          disabled={locked}
          className="inline-flex items-center gap-1.5 font-semibold text-muted transition-colors hover:text-ink disabled:opacity-40"
        >
          <ArrowLeft size={14} /> Change details
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={secondsLeft > 0 || resending || locked}
          className="group inline-flex items-center gap-1.5 font-semibold text-accent transition-colors hover:underline disabled:cursor-not-allowed disabled:text-faint disabled:no-underline"
        >
          {secondsLeft > 0 ? (
            // The ring drains as the cooldown runs, so the wait is legible at a
            // glance instead of only in the number beside it.
            <span className="relative inline-flex h-4 w-4 items-center justify-center">
              <svg viewBox="0 0 20 20" className="absolute h-4 w-4 -rotate-90">
                <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2.5"
                        className="stroke-line" />
                <motion.circle
                  cx="10" cy="10" r="8" fill="none" strokeWidth="2.5"
                  strokeLinecap="round" className="stroke-faint"
                  pathLength={1}
                  animate={{ pathLength: secondsLeft / resendCooldown }}
                  transition={{ duration: reduce ? 0 : 0.9, ease: "linear" }}
                />
              </svg>
            </span>
          ) : (
            <RotateCcw
              size={14}
              className={`transition-transform duration-300 ${
                resending ? "animate-spin" : "group-hover:-rotate-90"
              }`}
            />
          )}
          {resending
            ? "Sending..."
            : secondsLeft > 0
              ? `Resend in ${secondsLeft}s`
              : "Resend code"}
        </button>
      </div>
    </motion.div>
  );
};

export default OtpForm;

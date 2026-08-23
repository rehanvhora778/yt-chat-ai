/**
 * components/OtpForm.jsx
 * ----------------------
 * Second step of signup: enter the code emailed by the backend. Shared so a
 * login-time OTP (OTP_ON_LOGIN in backend/.env) can reuse it unchanged.
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, AlertCircle, RotateCcw, ArrowLeft, Terminal } from "lucide-react";

import { useAuth } from "../context/AuthContext";

const CODE_LENGTH = 6;

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

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(resendCooldown);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Countdown gating the resend button; the backend enforces this too.
  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const submit = async (event, submittedCode) => {
    event?.preventDefault();
    const value = (submittedCode ?? code).trim();
    setError("");
    setNotice("");

    if (value.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code from your email.`);
      return;
    }

    setLoading(true);
    const result = await verifyOtp(email, value, purpose);
    setLoading(false);

    if (result.success) onVerified?.();
    else {
      setError(result.error || "That code could not be verified.");
      setCode("");
      inputRef.current?.focus();
    }
  };

  const handleChange = (event) => {
    // Digits only, and auto-submit the moment the code is complete.
    const next = event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(next);
    setError("");
    if (next.length === CODE_LENGTH) submit(null, next);
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || resending) return;
    setResending(true);
    setError("");
    setNotice("");
    const result = await resendOtp(email, purpose);
    setResending(false);

    if (result.success) {
      setNotice(result.message || "A new code is on its way.");
      setSecondsLeft(resendCooldown);
      setCode("");
      inputRef.current?.focus();
    } else {
      setError(result.error || "Could not resend the code.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mb-7 text-center">
        <span className="icon-tile mx-auto mb-3">
          <ShieldCheck size={18} />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Check your email</h1>
        <p className="mt-1.5 text-sm text-muted">
          We sent a {CODE_LENGTH}-digit code to{" "}
          <span className="font-semibold text-ink">{email}</span>
        </p>
      </div>

      {devEcho && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3.5 py-3 text-xs text-ink">
          <Terminal size={14} className="mt-0.5 shrink-0 text-gold" />
          <span>
            Email isn&apos;t configured yet, so the code was printed in the{" "}
            <strong>backend console</strong>. Add SMTP_USER and SMTP_PASSWORD to
            backend/.env to receive real emails.
          </span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="otp-code" className="mb-1.5 block text-xs font-semibold text-muted">
            Verification code
          </label>
          <input
            id="otp-code"
            ref={inputRef}
            value={code}
            onChange={handleChange}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={CODE_LENGTH}
            className="input-field h-14 text-center text-2xl font-bold tracking-[0.5em]"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-3 text-sm text-ink"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-accent" />
            <span>{error}</span>
          </div>
        )}

        {notice && !error && (
          <p className="text-center text-xs font-medium text-muted">{notice}</p>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== CODE_LENGTH}
          className="btn-primary h-11 w-full"
        >
          {loading ? "Verifying..." : "Verify & continue"}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={14} /> Change details
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={secondsLeft > 0 || resending}
          className="inline-flex items-center gap-1.5 font-semibold text-accent transition-colors hover:underline disabled:cursor-not-allowed disabled:text-faint disabled:no-underline"
        >
          <RotateCcw size={14} />
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

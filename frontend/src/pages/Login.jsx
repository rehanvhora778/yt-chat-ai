/**
 * pages/Login.jsx
 * ---------------
 * Email/password login form wired to AuthContext.
 */

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { AlertCircle, Eye, EyeOff, Lock, LogIn, Mail } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import OtpForm from "../components/OtpForm";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || "/dashboard";

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Shown inline in the form so failures are always visible, even if the
  // toast layer misbehaves (e.g. stale HMR state in dev).
  const [formError, setFormError] = useState("");
  // Only reached when OTP_ON_LOGIN is enabled in backend/.env; signup-only
  // verification is the default, so login normally skips this entirely.
  const [otpStep, setOtpStep] = useState(null);

  const handleChange = (event) =>
    setForm({ ...form, [event.target.name]: event.target.value });

  const fail = (message) => {
    setFormError(message);
    toast.error(message);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!form.email || !form.password) {
      fail("Please fill in all fields");
      return;
    }
    setLoading(true);
    const result = await login(form.email, form.password);
    setLoading(false);

    if (result.success && result.otpRequired) {
      setOtpStep({ email: result.email, devEcho: result.devEcho });
      toast.success(result.message || "We've emailed you a verification code.");
      return;
    }
    if (result.success) {
      toast.success("Welcome back!");
      navigate(redirectTo, { replace: true });
    } else {
      fail(result.error || "Login failed. Please try again.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-md items-center px-4 sm:px-6"
    >
      <div className="card-flush gradient-border w-full p-7">
        {otpStep ? (
          <OtpForm
            email={otpStep.email}
            purpose="login"
            devEcho={otpStep.devEcho}
            onVerified={() => {
              toast.success("Welcome back!");
              navigate(redirectTo, { replace: true });
            }}
            onBack={() => setOtpStep(null)}
          />
        ) : (
        <>
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted">
            Log in to continue to your workspace
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-muted">
              Email
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                id="email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="input-field h-11 pl-10"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-muted">
              Password
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="input-field h-11 px-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-faint transition-colors hover:text-ink"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-3 text-sm text-ink"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-accent" />
              <span>{formError}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary h-11 w-full">
            {loading ? (
              "Logging in..."
            ) : (
              <>
                <LogIn size={16} /> Log in
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-accent hover:underline">
            Sign up
          </Link>
        </p>
        </>
        )}
      </div>
    </motion.div>
  );
};

export default Login;

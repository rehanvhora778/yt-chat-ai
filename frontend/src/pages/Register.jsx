/**
 * pages/Register.jsx
 * ------------------
 * Account creation form with basic client-side validation.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { User, Mail, Lock, Eye, EyeOff, UserPlus, AlertCircle } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import OtpForm from "../components/OtpForm";

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Shown inline in the form so failures are always visible, even if the
  // toast layer misbehaves (e.g. stale HMR state in dev).
  const [formError, setFormError] = useState("");
  // Set once /register has emailed a code; swaps the form for the OTP step.
  const [otpStep, setOtpStep] = useState(null);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const fail = (message) => {
    setFormError(message);
    toast.error(message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    const { name, email, password, confirm } = form;

    if (!name || !email || !password) {
      fail("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      fail("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      fail("Passwords do not match");
      return;
    }

    setLoading(true);
    const result = await register(name, email, password);
    setLoading(false);

    if (result.success && result.otpRequired) {
      // Account is NOT created yet — it appears once the code is verified.
      setOtpStep({ email: result.email, devEcho: result.devEcho });
      toast.success(result.message || "We've emailed you a verification code.");
      return;
    }
    if (result.success) {
      toast.success("Account created successfully!");
      navigate("/dashboard", { replace: true });
    } else {
      fail(result.error || "Registration failed. Please try again.");
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
            purpose="register"
            devEcho={otpStep.devEcho}
            onVerified={() => {
              toast.success("Account created successfully!");
              navigate("/dashboard", { replace: true });
            }}
            onBack={() => setOtpStep(null)}
          />
        ) : (
        <>
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Create your account</h1>
          <p className="mt-1.5 text-sm text-muted">
            Start chatting with your videos in seconds
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">Full name</label>
            <div className="relative">
              <User
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Jane Doe"
                className="input-field h-11 pl-10"
                autoComplete="name"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">Email</label>
            <div className="relative">
              <Mail
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
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
            <label className="mb-1.5 block text-xs font-semibold text-muted">Password</label>
            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="At least 6 characters"
                className="input-field h-11 px-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-faint transition-colors hover:text-ink"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">
              Confirm password
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                type={showPassword ? "text" : "password"}
                name="confirm"
                value={form.confirm}
                onChange={handleChange}
                placeholder="Re-enter your password"
                className="input-field h-11 pl-10"
                autoComplete="new-password"
              />
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

          <button
            type="submit"
            disabled={loading}
            className="btn-primary h-11 w-full"
          >
            {loading ? (
              "Creating account..."
            ) : (
              <>
                <UserPlus size={16} /> Create account
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-accent hover:underline"
          >
            Log in
          </Link>
        </p>
        </>
        )}
      </div>
    </motion.div>
  );
};

export default Register;

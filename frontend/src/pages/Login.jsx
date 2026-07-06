/**
 * pages/Login.jsx
 * ---------------
 * Email/password login form wired to AuthContext.
 */

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";

import { useAuth } from "../context/AuthContext";

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

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const fail = (message) => {
    setFormError(message);
    toast.error(message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.email || !form.password) {
      fail("Please fill in all fields");
      return;
    }
    setLoading(true);
    const result = await login(form.email, form.password);
    setLoading(false);

    if (result.success) {
      toast.success("Welcome back!");
      navigate(redirectTo, { replace: true });
    } else {
      fail(result.error || "Login failed. Please try again.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mx-auto flex min-h-[80vh] max-w-md items-center px-4"
    >
      <div className="glass w-full rounded-3xl p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Log in to continue to YT Chat GenAI
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="input-field pl-10"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Password</label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="input-field px-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3"
          >
            {loading ? (
              "Logging in..."
            ) : (
              <>
                <LogIn size={18} /> Log In
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="font-semibold text-brand-600 hover:underline dark:text-brand-300"
          >
            Sign up
          </Link>
        </p>
      </div>
    </motion.div>
  );
};

export default Login;

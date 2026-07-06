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

    if (result.success) {
      toast.success("Account created successfully!");
      navigate("/dashboard", { replace: true });
    } else {
      fail(result.error || "Registration failed. Please try again.");
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
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Start chatting with your videos in seconds
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Full name</label>
            <div className="relative">
              <User
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Jane Doe"
                className="input-field pl-10"
                autoComplete="name"
              />
            </div>
          </div>

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
                placeholder="At least 6 characters"
                className="input-field px-10"
                autoComplete="new-password"
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

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Confirm password
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type={showPassword ? "text" : "password"}
                name="confirm"
                value={form.confirm}
                onChange={handleChange}
                placeholder="Re-enter your password"
                className="input-field pl-10"
                autoComplete="new-password"
              />
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
              "Creating account..."
            ) : (
              <>
                <UserPlus size={18} /> Sign Up
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-brand-600 hover:underline dark:text-brand-300"
          >
            Log in
          </Link>
        </p>
      </div>
    </motion.div>
  );
};

export default Register;

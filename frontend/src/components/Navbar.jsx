/**
 * components/Navbar.jsx
 * ---------------------
 * Glassmorphism navbar. Desktop shows a horizontal menu; mobile uses an
 * animated slide-in sidebar. Shows Dashboard / Analytics / History links plus a
 * theme switcher.
 */

import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Youtube,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  History,
  User,
  BarChart3,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import ThemeSwitcher from "./ThemeSwitcher";

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/");
  };

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "text-brand-600 dark:text-brand-300"
        : "text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-300"
    }`;

  const NAV = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/history", label: "History", icon: History },
  ];

  const renderNavButton = (item) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.label}
        to={item.to}
        onClick={() => setOpen(false)}
        className={linkClass}
      >
        <span className="inline-flex items-center gap-1.5">
          <Icon size={16} /> {item.label}
        </span>
      </NavLink>
    );
  };

  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <nav className="glass mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-5 py-3">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl accent-grad text-white">
            <Youtube size={20} />
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            YT Chat <span className="gradient-text">GenAI</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-0.5 lg:flex">
          {isAuthenticated && NAV.map((item) => renderNavButton(item))}

          <ThemeSwitcher />

          {isAuthenticated ? (
            <div className="ml-1 flex items-center gap-2">
              <NavLink to="/profile" className={linkClass}>
                <span className="inline-flex items-center gap-1.5">
                  <User size={16} />
                  <span className="hidden xl:inline">
                    {user?.name?.split(" ")[0]}
                  </span>
                </span>
              </NavLink>
              <button onClick={handleLogout} className="btn-ghost px-3 py-2 text-sm">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="ml-1 flex items-center gap-2">
              <Link to="/login" className="btn-ghost px-4 py-2 text-sm">
                Login
              </Link>
              <Link to="/register" className="btn-primary px-4 py-2 text-sm">
                Get Started
              </Link>
            </div>
          )}
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 lg:hidden">
          <ThemeSwitcher />
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-slate-600 dark:text-slate-300"
          >
            <Menu size={22} />
          </button>
        </div>
      </nav>

      {/* Mobile animated sidebar */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 z-50 flex h-full w-72 flex-col bg-white p-5 shadow-2xl dark:bg-slate-900 lg:hidden"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="text-lg font-extrabold">
                  YT Chat <span className="gradient-text">GenAI</span>
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={20} />
                </button>
              </div>

              {isAuthenticated ? (
                <>
                  <div className="flex flex-col gap-1">
                    {NAV.map((item) => renderNavButton(item))}
                    <NavLink
                      to="/profile"
                      onClick={() => setOpen(false)}
                      className={linkClass}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <User size={16} /> Profile
                      </span>
                    </NavLink>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="btn-ghost mt-auto text-sm"
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    to="/login"
                    className="btn-ghost text-sm"
                    onClick={() => setOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="btn-primary text-sm"
                    onClick={() => setOpen(false)}
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;

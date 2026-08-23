/**
 * components/layout/PublicShell.jsx
 * ---------------------------------
 * Chrome for the signed-out pages (landing, login, register): a slim sticky
 * header and the shared footer.
 */

import { Link, Outlet, useLocation } from "react-router-dom";
import { Moon, Sun } from "lucide-react";

import Footer from "../Footer";
import Brand from "./Brand";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

const PublicShell = () => {
  const { isAuthenticated } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-app/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand to="/" />

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-ink"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {isAuthenticated ? (
              <Link to="/dashboard" className="btn-primary h-10">
                Open dashboard
              </Link>
            ) : (
              <>
                {pathname !== "/login" && (
                  <Link to="/login" className="btn-ghost h-10">
                    Log in
                  </Link>
                )}
                {pathname !== "/register" && (
                  <Link to="/register" className="btn-primary h-10">
                    Get started
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
};

export default PublicShell;

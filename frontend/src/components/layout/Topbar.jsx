/**
 * components/layout/Topbar.jsx
 * ----------------------------
 * Sticky header for the signed-in app: global search (⌘K), the primary
 * "New chat" action, activity feed, theme toggle and the account menu.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  LogOut,
  Menu as MenuIcon,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  UserRound,
} from "lucide-react";

import ActivityMenu from "./ActivityMenu";
import CommandPalette from "./CommandPalette";
import Brand from "./Brand";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "../ui/Menu";
import { initialsOf } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

const Topbar = ({ onOpenSidebar }) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K opens search from anywhere
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const firstName = user?.name?.split(" ")[0] || "Account";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-app/80 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          {/* Mobile: menu + brand */}
          <button
            onClick={onOpenSidebar}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-ink lg:hidden"
          >
            <MenuIcon size={20} />
          </button>
          <div className="lg:hidden">
            <Brand />
          </div>

          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="ml-auto hidden h-10 w-full max-w-md items-center gap-2.5 rounded-xl border border-line bg-card2 px-3.5 text-sm text-faint transition-colors hover:border-line2 hover:text-muted sm:flex lg:ml-0"
          >
            <Search size={16} />
            <span className="flex-1 text-left">Search videos, questions, chats...</span>
            <kbd className="rounded-md border border-line bg-card px-1.5 py-0.5 text-[10px] font-semibold">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-ink sm:hidden"
            >
              <Search size={18} />
            </button>

            <Link to="/process" className="btn-primary hidden h-10 px-3.5 md:inline-flex">
              <Plus size={16} /> New chat
            </Link>

            <ActivityMenu />

            <button
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              title={isDark ? "Light theme" : "Dark theme"}
              className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-ink"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <Menu
              width="w-56"
              trigger={
                <button className="flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-card2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg accent-grad text-xs font-bold text-white">
                    {initialsOf(user?.name)}
                  </span>
                  <span className="hidden text-sm font-medium text-ink sm:block">
                    {firstName}
                  </span>
                </button>
              }
            >
              <MenuLabel>{user?.email}</MenuLabel>
              <MenuItem icon={UserRound} onClick={() => navigate("/profile")}>
                Profile &amp; settings
              </MenuItem>
              <MenuItem icon={BarChart3} onClick={() => navigate("/analytics")}>
                Analytics
              </MenuItem>
              <MenuItem icon={Settings} onClick={() => navigate("/profile?tab=preferences")}>
                Preferences
              </MenuItem>
              <MenuDivider />
              <MenuItem icon={LogOut} danger onClick={handleLogout}>
                Log out
              </MenuItem>
            </Menu>
          </div>
        </div>
      </header>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};

export default Topbar;

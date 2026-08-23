/**
 * components/layout/Sidebar.jsx
 * -----------------------------
 * Fixed navigation rail on large screens, slide-in drawer on mobile. Below the
 * links it summarises the workspace with real numbers from /analytics and
 * /processed, and tracks progress against the daily chat goal from Settings.
 */

import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen,
  HelpCircle,
  MessagesSquare,
  Target,
  Video,
  X,
} from "lucide-react";

import Brand from "./Brand";
import { NAV_SECTIONS } from "../../lib/nav";
import { compactNumber } from "../../lib/format";
import { useLibrary } from "../../context/LibraryContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { ProgressBar } from "../ui";

const WorkspaceStat = ({ icon: Icon, label, value, loading }) => (
  <div className="flex items-center justify-between gap-2 py-[7px]">
    <span className="flex items-center gap-2 text-xs text-muted">
      <Icon size={13} className="text-faint" />
      {label}
    </span>
    {loading ? (
      <span className="skeleton h-3 w-8" />
    ) : (
      <span className="text-xs font-semibold text-ink">{compactNumber(value)}</span>
    )}
  </div>
);

const SidebarContent = ({ onNavigate }) => {
  const { totals, chatsToday, loading } = useWorkspace();
  const { collections } = useLibrary();
  const { preferences } = usePreferences();

  const goal = Math.max(1, Number(preferences.dailyGoal) || 5);
  const goalReached = chatsToday >= goal;

  return (
    <div className="flex h-full flex-col">
      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, index) => (
          <div key={section.title || `section-${index}`}>
            {section.title && (
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-faint">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "nav-item-active" : ""}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={17} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-active"
                          className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Workspace summary */}
      <div className="space-y-3 border-t border-line px-4 py-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-faint">
            Your workspace
          </p>
          <WorkspaceStat
            icon={Video}
            label="Videos processed"
            value={totals.videos_processed || 0}
            loading={loading}
          />
          <WorkspaceStat
            icon={MessagesSquare}
            label="Total chats"
            value={totals.total_chats || 0}
            loading={loading}
          />
          <WorkspaceStat
            icon={HelpCircle}
            label="Questions asked"
            value={totals.questions_asked || 0}
            loading={loading}
          />
          <WorkspaceStat
            icon={FolderOpen}
            label="Collections"
            value={collections.length}
            loading={false}
          />
        </div>

        {/* Daily goal */}
        <div className="rounded-xl border border-line bg-card2 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Target size={13} className={goalReached ? "text-gold" : "text-accent"} />
              Daily goal
            </span>
            <span className="text-[11px] font-semibold text-muted">
              {chatsToday} / {goal}
            </span>
          </div>
          <ProgressBar value={chatsToday} max={goal} tone={goalReached ? "gold" : "accent"} />
          <p className="mt-2 text-[11px] text-faint">
            {goalReached
              ? "Goal reached — nice work."
              : `${goal - chatsToday} more ${goal - chatsToday === 1 ? "chat" : "chats"} to hit today's target.`}
          </p>
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({ open, onClose }) => (
  <>
    {/* Desktop rail */}
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-line bg-card/60 backdrop-blur-xl lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Brand />
      </div>
      <SidebarContent />
    </aside>

    {/* Mobile drawer */}
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-line bg-card lg:hidden"
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Brand onClick={onClose} />
              <button
                onClick={onClose}
                aria-label="Close navigation"
                className="rounded-lg p-2 text-muted transition-colors hover:bg-card2 hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarContent onNavigate={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  </>
);

export default Sidebar;

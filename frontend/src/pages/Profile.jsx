/**
 * pages/Profile.jsx
 * -----------------
 * Account and settings. Four tabs — Profile, Preferences, Notifications and
 * Data — where every control changes something real: the theme and density are
 * applied to <html>, the chat options are read by the chat screen, and the
 * data tools export or clear what this browser has stored for the account.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { saveAs } from "file-saver";
import {
  BellRing,
  Calendar,
  Check,
  Coins,
  Database,
  Download,
  HelpCircle,
  Languages,
  LogOut,
  Mail,
  MessagesSquare,
  Monitor,
  Moon,
  Palette,
  ShieldAlert,
  Sun,
  Trash2,
  User,
  UserRound,
  Video,
} from "lucide-react";

import { ConfirmDialog } from "../components/ui/Modal";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  SegmentedControl,
  SettingRow,
  Tab,
  Toggle,
} from "../components/ui";
import { chatApi, getErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLibrary } from "../context/LibraryContext";
import { usePreferences } from "../context/PreferencesContext";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { clearScope, exportScope } from "../lib/store";
import { compactNumber, formatDate, initialsOf } from "../lib/format";
import {
  desktopPermission,
  requestDesktopPermission,
  useNotify,
} from "../lib/notify";

const TABS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "preferences", label: "Preferences", icon: Palette },
  { id: "notifications", label: "Notifications", icon: BellRing },
  { id: "data", label: "Data", icon: Database },
];

const THEME_OPTIONS = [
  { id: "dark", label: "Dark", icon: Moon, hint: "Charcoal + red" },
  { id: "light", label: "Light", icon: Sun, hint: "Bright surfaces" },
  { id: "system", label: "System", icon: Monitor, hint: "Match device" },
];

const Detail = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-xl border border-line bg-card2/50 p-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card3 text-muted">
      <Icon size={16} />
    </span>
    <div className="min-w-0">
      <p className="text-[11px] text-faint">{label}</p>
      <p className="truncate text-sm font-medium text-ink">{value || "—"}</p>
    </div>
  </div>
);

const Profile = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { preferences, setPreference, resetPreferences } = usePreferences();
  const { totals, refresh } = useWorkspace();
  const { collections, bookmarks, summaries } = useLibrary();

  const [tab, setTab] = useState(searchParams.get("tab") || "profile");
  const [permission, setPermission] = useState(desktopPermission());
  const [confirming, setConfirming] = useState(null); // 'local' | 'chats' | 'reset'
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (tab === "profile") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const scope = user?.id || "guest";

  const stats = useMemo(
    () => [
      { icon: Video, label: "Videos processed", value: totals.videos_processed || 0 },
      { icon: MessagesSquare, label: "Total chats", value: totals.total_chats || 0 },
      { icon: HelpCircle, label: "Questions asked", value: totals.questions_asked || 0 },
      {
        icon: Coins,
        label: "Tokens used",
        value: compactNumber(totals.total_tokens || 0),
      },
    ],
    [totals]
  );

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const toggleDesktop = async (next) => {
    if (!next) {
      setPreference("desktopNotifications", false);
      return;
    }
    const result = await requestDesktopPermission();
    setPermission(result);
    if (result === "granted") {
      setPreference("desktopNotifications", true);
      notify.success("Desktop notifications enabled");
    } else if (result === "unsupported") {
      notify.error("This browser doesn't support desktop notifications");
    } else {
      notify.error("Your browser blocked notifications for this site");
    }
  };

  const exportData = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      account: { name: user?.name, email: user?.email, member_since: user?.created_at },
      local_data: exportScope(scope),
    };
    saveAs(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
      `yt-chat-genai-data-${new Date().toISOString().slice(0, 10)}.json`
    );
    notify.success("Data exported");
  };

  const clearLocalData = () => {
    const removed = clearScope(scope);
    notify.success(
      removed
        ? "Collections, bookmarks and cached summaries cleared"
        : "There was nothing stored on this device"
    );
  };

  const clearChatHistory = async () => {
    setBusy(true);
    try {
      await chatApi.clearHistory({});
      await refresh({ silent: true });
      notify.success("Chat history cleared");
    } catch (error) {
      notify.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------------- */

  const renderProfile = () => (
    <div className="grid gap-4 lg:grid-cols-3">
      <SectionCard title="Account" icon={UserRound} className="lg:col-span-2">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl accent-grad text-2xl font-bold text-white shadow-glow">
            {initialsOf(user?.name)}
          </span>
          <div className="min-w-0 text-center sm:text-left">
            <h2 className="truncate text-xl font-bold tracking-tight text-ink">
              {user?.name}
            </h2>
            <p className="truncate text-sm text-muted">{user?.email}</p>
            <p className="mt-1 text-xs text-faint">
              Member since {formatDate(user?.created_at, { day: undefined })}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Detail icon={User} label="Name" value={user?.name} />
          <Detail icon={Mail} label="Email" value={user?.email} />
          <Detail
            icon={Calendar}
            label="Member since"
            value={formatDate(user?.created_at)}
          />
          <Detail
            icon={Languages}
            label="Default language"
            value={preferences.language === "hi" ? "हिंदी (Hindi)" : "English"}
          />
        </div>
      </SectionCard>

      <div className="space-y-4">
        <SectionCard title="Usage" icon={MessagesSquare}>
          <ul className="space-y-3">
            {stats.map((stat) => (
              <li key={stat.label} className="flex items-center gap-3">
                <span className="icon-tile !h-9 !w-9">
                  <stat.icon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{stat.value}</span>
                  <span className="block text-[11px] text-muted">{stat.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Session" icon={LogOut}>
          <p className="mb-3 text-xs leading-relaxed text-muted">
            Signing out clears your token from this browser. Collections and
            bookmarks stay saved for the next time you log in.
          </p>
          <button onClick={handleLogout} className="btn-danger w-full">
            <LogOut size={15} /> Log out
          </button>
        </SectionCard>
      </div>
    </div>
  );

  const renderPreferences = () => (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Appearance" icon={Palette}>
        <p className="mb-3 text-xs text-muted">Theme</p>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((option) => {
            const active = theme === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setTheme(option.id)}
                className={`relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
                  active
                    ? "border-accent/60 bg-accent/10"
                    : "border-line bg-card2/50 hover:border-line2"
                }`}
              >
                {active && (
                  <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white">
                    <Check size={10} />
                  </span>
                )}
                <option.icon size={18} className={active ? "text-accent" : "text-muted"} />
                <span className="text-xs font-semibold text-ink">{option.label}</span>
                <span className="text-[10px] text-faint">{option.hint}</span>
              </button>
            );
          })}
        </div>

        <div className="divider my-4" />

        <SettingRow
          title="Density"
          description="Compact tightens card padding to fit more on screen."
        >
          <SegmentedControl
            size="sm"
            value={preferences.density}
            onChange={(value) => setPreference("density", value)}
            options={[
              { id: "comfortable", label: "Comfortable" },
              { id: "compact", label: "Compact" },
            ]}
          />
        </SettingRow>

        <SettingRow
          title="Reduce motion"
          description="Turns off animations and transitions across the app."
        >
          <Toggle
            checked={preferences.reduceMotion}
            onChange={(value) => setPreference("reduceMotion", value)}
            label="Reduce motion"
          />
        </SettingRow>
      </SectionCard>

      <SectionCard title="Language" icon={Languages}>
        <SettingRow
          title="Default language"
          description="Used when processing a new video and when asking questions."
        >
          <SegmentedControl
            size="sm"
            value={preferences.language}
            onChange={(value) => setPreference("language", value)}
            options={[
              { id: "en", label: "English" },
              { id: "hi", label: "हिंदी" },
            ]}
          />
        </SettingRow>

        <div className="divider my-1" />

        <SettingRow
          title="Daily goal"
          description="Chats per day, shown as progress in the sidebar."
        >
          <input
            type="number"
            min={1}
            max={99}
            value={preferences.dailyGoal}
            onChange={(event) =>
              setPreference(
                "dailyGoal",
                Math.min(99, Math.max(1, Number(event.target.value) || 1))
              )
            }
            className="input-field h-9 w-20 text-center"
            aria-label="Daily chat goal"
          />
        </SettingRow>
      </SectionCard>

      <SectionCard title="Chat" icon={MessagesSquare} className="lg:col-span-2">
        <div className="grid gap-x-8 md:grid-cols-2">
          <div>
            <SettingRow
              title="Enter sends the message"
              description="When off, Enter adds a newline and Ctrl+Enter sends."
            >
              <Toggle
                checked={preferences.sendOnEnter}
                onChange={(value) => setPreference("sendOnEnter", value)}
                label="Enter sends the message"
              />
            </SettingRow>

            <div className="divider" />

            <SettingRow
              title="Suggested questions"
              description="Show starter prompts when a conversation is empty."
            >
              <Toggle
                checked={preferences.showSuggestions}
                onChange={(value) => setPreference("showSuggestions", value)}
                label="Suggested questions"
              />
            </SettingRow>
          </div>

          <div>
            <SettingRow
              title="Follow new answers"
              description="Scroll to the newest message as it arrives."
            >
              <Toggle
                checked={preferences.autoScroll}
                onChange={(value) => setPreference("autoScroll", value)}
                label="Follow new answers"
              />
            </SettingRow>

            <div className="divider" />

            <SettingRow
              title="Default export format"
              description="Used by the dashboard's Export chat action."
            >
              <SegmentedControl
                size="sm"
                value={preferences.defaultExport}
                onChange={(value) => setPreference("defaultExport", value)}
                options={[
                  { id: "pdf", label: "PDF" },
                  { id: "docx", label: "DOCX" },
                  { id: "txt", label: "TXT" },
                ]}
              />
            </SettingRow>
          </div>
        </div>

        <div className="divider my-3" />
        <button onClick={() => setConfirming("reset")} className="btn-ghost h-9 text-xs">
          Reset preferences to defaults
        </button>
      </SectionCard>
    </div>
  );

  const renderNotifications = () => (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Alerts" icon={BellRing}>
        <SettingRow
          title="In-app messages"
          description="Toast confirmations for actions like exports and deletions. Errors are always shown."
        >
          <Toggle
            checked={preferences.toastAlerts}
            onChange={(value) => setPreference("toastAlerts", value)}
            label="In-app messages"
          />
        </SettingRow>

        <div className="divider" />

        <SettingRow
          title="Activity badge"
          description="Show the unread count on the top-bar bell."
        >
          <Toggle
            checked={preferences.activityBadge}
            onChange={(value) => setPreference("activityBadge", value)}
            label="Activity badge"
          />
        </SettingRow>
      </SectionCard>

      <SectionCard title="Desktop" icon={Monitor}>
        <SettingRow
          title="Notify when processing finishes"
          description="Get a desktop notification when a video finishes processing in a background tab."
        >
          <Toggle
            checked={preferences.desktopNotifications && permission === "granted"}
            onChange={toggleDesktop}
            label="Desktop notifications"
          />
        </SettingRow>

        {permission === "denied" && (
          <p className="mt-2 rounded-xl border border-line bg-card2 p-3 text-xs leading-relaxed text-muted">
            Notifications are blocked for this site in your browser settings. Allow
            them there first, then switch this back on.
          </p>
        )}
        {permission === "unsupported" && (
          <p className="mt-2 rounded-xl border border-line bg-card2 p-3 text-xs leading-relaxed text-muted">
            This browser doesn't support desktop notifications.
          </p>
        )}
      </SectionCard>
    </div>
  );

  const renderData = () => (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Stored on this device" icon={Database}>
        <p className="mb-4 text-xs leading-relaxed text-muted">
          Collections, bookmarks, cached summaries and these preferences are kept in
          your browser under your account. Your videos, chats and analytics live on
          the server.
        </p>

        <ul className="mb-4 space-y-2">
          {[
            { label: "Collections", value: collections.length },
            { label: "Bookmarks", value: bookmarks.length },
            { label: "Cached summaries", value: summaries.length },
          ].map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between rounded-xl border border-line bg-card2/50 px-3 py-2.5"
            >
              <span className="text-sm text-ink">{row.label}</span>
              <span className="text-sm font-bold text-muted">{row.value}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          <button onClick={exportData} className="btn-secondary h-10 text-xs">
            <Download size={14} /> Export my data
          </button>
          <button
            onClick={() => setConfirming("local")}
            className="btn-ghost h-10 text-xs"
          >
            <Trash2 size={14} /> Clear local data
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Danger zone" icon={ShieldAlert}>
        <div className="rounded-xl border border-accent/25 bg-accent/5 p-4">
          <p className="text-sm font-semibold text-ink">Clear all chat history</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Permanently deletes every question and answer stored on the server for
            your account. Processed videos stay in your history, so you can keep
            chatting with them — the conversations just start empty.
          </p>
          <button
            onClick={() => setConfirming("chats")}
            disabled={busy}
            className="btn-danger mt-3 h-10 text-xs"
          >
            <Trash2 size={14} /> {busy ? "Clearing..." : "Clear chat history"}
          </button>
        </div>
      </SectionCard>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6"
    >
      <PageHeader
        title="Settings"
        icon={UserRound}
        subtitle="Your account, how the app behaves and what it stores."
      />

      <div
        role="tablist"
        className="mb-5 flex items-center gap-5 overflow-x-auto border-b border-line"
      >
        {TABS.map((item) => (
          <Tab
            key={item.id}
            active={tab === item.id}
            onClick={() => setTab(item.id)}
            icon={item.icon}
          >
            {item.label}
          </Tab>
        ))}
      </div>

      {!user ? (
        <EmptyState icon={UserRound} title="Not signed in" />
      ) : tab === "profile" ? (
        renderProfile()
      ) : tab === "preferences" ? (
        renderPreferences()
      ) : tab === "notifications" ? (
        renderNotifications()
      ) : (
        renderData()
      )}

      <ConfirmDialog
        open={confirming === "local"}
        title="Clear local data?"
        message="Collections, bookmarks, cached summaries and preferences stored in this browser will be deleted. Your videos and chats on the server are untouched."
        confirmLabel="Clear"
        onConfirm={clearLocalData}
        onClose={() => setConfirming(null)}
      />

      <ConfirmDialog
        open={confirming === "chats"}
        title="Delete all chat history?"
        message="Every question and answer saved for your account will be permanently removed from the server. This can't be undone."
        confirmLabel="Delete everything"
        onConfirm={clearChatHistory}
        onClose={() => setConfirming(null)}
      />

      <ConfirmDialog
        open={confirming === "reset"}
        title="Reset preferences?"
        message="Theme, density, chat behaviour and notification settings go back to their defaults."
        confirmLabel="Reset"
        destructive={false}
        onConfirm={() => {
          resetPreferences();
          notify.success("Preferences reset");
        }}
        onClose={() => setConfirming(null)}
      />
    </motion.div>
  );
};

export default Profile;

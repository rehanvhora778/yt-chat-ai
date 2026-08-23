/**
 * App.jsx
 * -------
 * Route table. Public pages render inside <PublicShell>; everything behind
 * authentication renders inside <AppShell> (sidebar + top bar + shared
 * workspace data). Route paths are unchanged from before the redesign.
 */

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import AppShell from "./components/layout/AppShell";
import PublicShell from "./components/layout/PublicShell";
import ProtectedRoute from "./components/ProtectedRoute";
import Loader from "./components/Loader";

// Lightweight public pages load eagerly
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";

// Heavier authenticated pages are code-split (Recharts, docx)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProcessVideo = lazy(() => import("./pages/ProcessVideo"));
const Chat = lazy(() => import("./pages/Chat"));
const History = lazy(() => import("./pages/History"));
const Profile = lazy(() => import("./pages/Profile"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Collections = lazy(() => import("./pages/Collections"));
const Bookmarks = lazy(() => import("./pages/Bookmarks"));
const Summaries = lazy(() => import("./pages/Summaries"));

const App = () => (
  <Suspense
    fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader label="Loading..." />
      </div>
    }
  >
    {/* NOTE: no AnimatePresence around Routes on purpose. Wrapping Routes in
        AnimatePresence mode="wait" deadlocks when two navigations race
        (e.g. logout = ProtectedRoute redirect + navigate("/")), leaving every
        page after that blank. Pages animate themselves in. */}
    <Routes>
      {/* Public */}
      <Route element={<PublicShell />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Fallback */}
        <Route path="*" element={<Landing />} />
      </Route>

      {/* Authenticated */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/process" element={<ProcessVideo />} />
        <Route path="/chat/:videoId" element={<Chat />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/history" element={<History />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/summaries" element={<Summaries />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
  </Suspense>
);

export default App;

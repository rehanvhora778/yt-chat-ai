/**
 * App.jsx
 * -------
 * Top-level layout + route table. Public routes (landing/login/register) are
 * open; the rest are wrapped in <ProtectedRoute>.
 */

import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import Navbar from "./components/Navbar";
import ParticlesBackground from "./components/ParticlesBackground";
import ProtectedRoute from "./components/ProtectedRoute";
import Loader from "./components/Loader";

// Lightweight public pages load eagerly
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";

// Heavier authenticated pages are code-split (Recharts, docx, jsPDF)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProcessVideo = lazy(() => import("./pages/ProcessVideo"));
const Chat = lazy(() => import("./pages/Chat"));
const History = lazy(() => import("./pages/History"));
const Profile = lazy(() => import("./pages/Profile"));
const Analytics = lazy(() => import("./pages/Analytics"));

const App = () => {
  const location = useLocation();

  return (
    <div className="relative flex min-h-screen flex-col">
      <ParticlesBackground />
      <Navbar />

      <main className="flex-1">
        <Suspense
          fallback={
            <div className="flex min-h-[70vh] items-center justify-center">
              <Loader label="Loading..." />
            </div>
          }
        >
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/process"
              element={
                <ProtectedRoute>
                  <ProcessVideo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:videoId"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <History />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Landing />} />
          </Routes>
        </AnimatePresence>
        </Suspense>
      </main>
    </div>
  );
};

export default App;

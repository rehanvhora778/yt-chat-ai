/**
 * api/client.js
 * -------------
 * Pre-configured axios instance plus typed helper functions for every backend
 * endpoint. The JWT token is attached automatically via a request interceptor,
 * and a response interceptor handles expired-session redirects globally.
 */

import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "";

// Generous enough for a slow LLM answer (model fallback + a rate-limit retry can
// legitimately take ~a minute) but bounded, so a wedged backend or a stopped
// MongoDB surfaces as an error instead of an indicator that spins forever.
const REQUEST_TIMEOUT_MS = 120000;

const api = axios.create({
  baseURL: `${baseURL}/api`,
  headers: { "Content-Type": "application/json" },
  timeout: REQUEST_TIMEOUT_MS,
});

// Attach the bearer token to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 responses, clear the session so the app redirects to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || "";
      // Don't nuke the session for failed login/register attempts
      if (!url.includes("/auth/login") && !url.includes("/auth/register")) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

/** Extract a human friendly message from an axios error. */
export const getErrorMessage = (error) => {
  // The server answered with its own message — always the most useful.
  const serverMessage = error?.response?.data?.error;
  if (serverMessage) {
    // Backend surfaces raw pymongo text when MongoDB is down; translate it.
    if (/27017|ServerSelectionTimeout|No connection could be made/i.test(serverMessage)) {
      return "Can't reach the database. Make sure the MongoDB service is running, then try again.";
    }
    return serverMessage;
  }
  // No response at all: timed out, backend down, or network dropped.
  if (error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "")) {
    return "The server took too long to respond. It may be busy — please try again.";
  }
  if (error?.request && !error?.response) {
    return "Can't reach the server. Check that the backend is running on port 5000.";
  }
  return error?.message || "Something went wrong. Please try again.";
};

// ---- Auth ----
export const authApi = {
  register: (payload) => api.post("/auth/register", payload),
  login: (payload) => api.post("/auth/login", payload),
  // Two-step signup: /register emails a code, these finish or re-send it.
  verifyOtp: (payload) => api.post("/auth/verify-otp", payload),
  resendOtp: (payload) => api.post("/auth/resend-otp", payload),
  me: () => api.get("/auth/me"),
};

// ---- Video ----
export const videoApi = {
  process: (url, language) => api.post("/process-video", { url, language }),
  processStart: (url, language) =>
    api.post("/process-video/start", { url, language }),
  processStatus: (job_id) => api.get(`/process-video/status/${job_id}`),
  get: (video_id) => api.get(`/video/${video_id}`),
  summary: (video_id, language) => api.post("/summary", { video_id, language }),
  keyPoints: (video_id, language) =>
    api.post("/key-points", { video_id, language }),
};

// ---- Chat ----
export const chatApi = {
  ask: (video_id, question, language) =>
    api.post("/ask", { video_id, question, language }),
  history: (video_id) =>
    api.get("/history", { params: video_id ? { video_id } : {} }),
  clearHistory: (params = {}) => api.delete("/history", { data: params }),
};

// ---- Quiz ----
export const quizApi = {
  generate: (video_id, language, num_questions, difficulty) =>
    api.post("/quiz/generate", { video_id, language, num_questions, difficulty }),
  submit: (quiz_id, answers) => api.post("/quiz/submit", { quiz_id, answers }),
  attempts: (video_id) =>
    api.get("/quiz/attempts", { params: video_id ? { video_id } : {} }),
};

// ---- Analytics (FEATURE 6) ----
export const analyticsApi = {
  get: () => api.get("/analytics"),
};

// ---- Processed-video history (FEATURE 5) ----
export const processedApi = {
  list: () => api.get("/processed"),
  remove: (video_id) => api.delete("/processed", { data: { video_id } }),
};

export default api;

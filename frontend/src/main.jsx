import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import { LibraryProvider } from "./context/LibraryContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PreferencesProvider>
            <LibraryProvider>
              <App />
              {/* Global toast notifications — themed with the app tokens */}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3500,
                  style: {
                    borderRadius: "12px",
                    background: "rgb(var(--surface))",
                    color: "rgb(var(--text))",
                    border: "1px solid rgb(var(--border))",
                    boxShadow: "0 12px 40px -18px rgb(0 0 0 / 0.65)",
                    fontSize: "14px",
                  },
                  success: { iconTheme: { primary: "rgb(52 211 153)", secondary: "rgb(var(--surface))" } },
                  error: { iconTheme: { primary: "rgb(var(--accent))", secondary: "rgb(var(--surface))" } },
                }}
              />
            </LibraryProvider>
          </PreferencesProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

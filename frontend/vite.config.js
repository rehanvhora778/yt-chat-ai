import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite configuration. The dev server proxies /api calls to the Flask backend
// so the frontend can use relative URLs in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        // Audio transcription for caption-less videos can take a few minutes
        timeout: 600000,
        proxyTimeout: 600000,
      },
    },
  },
});

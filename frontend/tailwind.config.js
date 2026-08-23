import typography from "@tailwindcss/typography";

/**
 * Tailwind config — YouTube-inspired dark theme.
 *
 * Colours are exposed as CSS variables (see index.css) so a single set of
 * utilities (bg-card, border-line, text-muted, ...) renders correctly in both
 * the dark and light palettes without sprinkling dark: variants everywhere.
 */

const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  // Dark mode toggled by adding the "dark" class to <html>
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic, theme-aware tokens
        app: token("bg"),
        card: token("surface"),
        card2: token("surface-2"),
        card3: token("surface-3"),
        line: token("border"),
        line2: token("border-strong"),
        ink: token("text"),
        muted: token("muted"),
        faint: token("faint"),
        accent: token("accent"),
        "accent-strong": token("accent-strong"),
        gold: token("gold"),

        // Legacy alias kept so older markup stays on-brand (now red, not indigo)
        brand: {
          50: "#fff1f2",
          100: "#ffe0e3",
          200: "#ffc6cc",
          300: "#ff9ba6",
          400: "#ff6070",
          500: "#f4212e",
          600: "#dc1424",
          700: "#b8101d",
          800: "#98111c",
          900: "#7e141c",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "1.75rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(0 0 0 / 0.16), 0 8px 24px -16px rgb(0 0 0 / 0.5)",
        lift: "0 12px 40px -18px rgb(0 0 0 / 0.65)",
        glow: "0 12px 40px -14px rgb(var(--accent) / 0.45)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        blob: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "gradient-x": "gradient-x 8s ease infinite",
        blob: "blob 14s infinite",
        "fade-up": "fade-up 0.35s ease-out both",
        "pulse-ring": "pulse-ring 2s ease-out infinite",
      },
      backgroundSize: {
        "300%": "300%",
      },
    },
  },
  plugins: [typography],
};

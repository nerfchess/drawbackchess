import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        // ink = deep cool navy (background tones)
        ink: {
          950: "#0a111e",
          900: "#111a2b",
          800: "#1a253b",
          700: "#26334d",
          600: "#384664",
          500: "#566687",
          400: "#7d8cab",
        },
        // parchment = warm off-white (foreground text)
        parchment: {
          DEFAULT: "#ece7d6",
          50: "#f4f0e3",
          100: "#ece7d6",
          200: "#ddd5bf",
          300: "#bdb39a",
          400: "#8e8775",
          500: "#5f5b50",
        },
        // gold = aged brass (primary accent)
        gold: {
          DEFAULT: "#c89b4a",
          leaf: "#d8b56e",
          dim: "#9a7634",
        },
        // oxblood = deep brick (alert / danger)
        oxblood: {
          DEFAULT: "#b54641",
          glow: "#c66860",
          deep: "#7e2c28",
        },
        // verdigris = aged copper green (cool accent)
        verdigris: {
          DEFAULT: "#5a9b7a",
          glow: "#7eb59a",
        },
        // bruise = dusty slate violet (secondary accent)
        bruise: {
          DEFAULT: "#7c7aa3",
          glow: "#9d9bc0",
        },
      },
      boxShadow: {
        leaf: "0 0 24px -10px rgba(216,181,110,0.35)",
        oxblood: "0 0 32px -14px rgba(181,70,65,0.4)",
        plate:
          "0 14px 50px -22px rgba(0,0,0,0.55), 0 1px 0 0 rgba(255,255,255,0.04) inset",
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
        sigil: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(180deg)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        seal: {
          "0%": { transform: "scale(0.6) rotate(-6deg)", opacity: "0" },
          "70%": { transform: "scale(1.06) rotate(2deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        flicker: "flicker 4.5s ease-in-out infinite",
        sigil: "sigil 60s linear infinite",
        rise: "rise 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        seal: "seal 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both",
        bob: "bob 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;

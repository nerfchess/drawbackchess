import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        // ink = soft dark blues (background tones)
        ink: {
          950: "#0e1726",
          900: "#162236",
          800: "#1f2e47",
          700: "#2a3c5b",
          600: "#3a4e72",
          500: "#516a92",
          400: "#7a8eb3",
        },
        // parchment = bright cream / off-white (foreground text)
        parchment: {
          DEFAULT: "#f7f4ea",
          50: "#fbf9f3",
          100: "#f7f4ea",
          200: "#eee8d8",
          300: "#dfd6bf",
          400: "#b8b09a",
          500: "#8c8676",
        },
        // gold = playful yellow/amber (primary accent)
        gold: {
          DEFAULT: "#ffc857",
          leaf: "#ffd97a",
          dim: "#e0a93e",
        },
        // oxblood = warm coral pink (alert / danger)
        oxblood: {
          DEFAULT: "#ff6b6b",
          glow: "#ff8a8a",
          deep: "#e04545",
        },
        // verdigris = mint teal (success / cool accent)
        verdigris: {
          DEFAULT: "#3ed598",
          glow: "#6aebb6",
        },
        // bruise = lavender (secondary accent)
        bruise: {
          DEFAULT: "#a78bfa",
          glow: "#c4b5fd",
        },
      },
      boxShadow: {
        leaf: "0 0 24px -6px rgba(255,200,87,0.45)",
        oxblood: "0 0 32px -10px rgba(255,107,107,0.45)",
        plate:
          "0 12px 40px -16px rgba(0,0,0,0.45), 0 1px 0 0 rgba(255,255,255,0.06) inset",
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
        sigil: "sigil 30s linear infinite",
        rise: "rise 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        seal: "seal 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both",
        bob: "bob 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;

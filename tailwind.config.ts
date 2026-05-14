import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          950: "#08060a",
          900: "#0d0a07",
          800: "#15110a",
          700: "#1f1a11",
          600: "#2a2317",
          500: "#3a3122",
          400: "#5a4d33",
        },
        parchment: {
          50: "#f6efdc",
          100: "#ecdfba",
          200: "#e8dcc0",
          300: "#d4c8aa",
          400: "#b8a986",
          500: "#9c8c66",
        },
        oxblood: {
          DEFAULT: "#7a1f1f",
          glow: "#a83232",
          deep: "#4a0f0f",
        },
        gold: {
          DEFAULT: "#c69b3d",
          leaf: "#e6bf6a",
          dim: "#8c6c2a",
        },
        verdigris: {
          DEFAULT: "#3d6a5a",
          glow: "#5d8c7a",
        },
        bruise: {
          DEFAULT: "#5d4a73",
          glow: "#7d6c8e",
        },
      },
      boxShadow: {
        leaf: "0 0 24px -6px rgba(198,155,61,0.45)",
        oxblood: "0 0 32px -10px rgba(168,50,50,0.5)",
        plate: "0 18px 60px -22px rgba(0,0,0,0.85), 0 1px 0 0 rgba(232,220,192,0.04) inset",
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.86" },
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
          "0%": { transform: "scale(0.6) rotate(-12deg)", opacity: "0" },
          "70%": { transform: "scale(1.06) rotate(2deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
      },
      animation: {
        flicker: "flicker 4.5s ease-in-out infinite",
        sigil: "sigil 30s linear infinite",
        rise: "rise 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        seal: "seal 0.7s cubic-bezier(0.2, 1.4, 0.4, 1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;

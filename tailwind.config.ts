import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          950: "#07070b",
          900: "#0c0c12",
          800: "#15151f",
          700: "#1f1f2c",
          600: "#2a2a3a",
          500: "#3a3a52",
          400: "#5a5a76",
        },
        accent: {
          DEFAULT: "#f4b942",
          glow: "#ffd877",
        },
        violet: {
          glow: "#a78bfa",
        },
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(244,185,66,0.4)",
        card: "0 8px 30px -10px rgba(0,0,0,0.6)",
      },
      keyframes: {
        shimmer: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        shimmer: "shimmer 3s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;

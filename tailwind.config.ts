import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Krea-inspired dark theme
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        canvas: {
          DEFAULT: "#0a0a0b",
          dark: "#050506",
        },
        surface: {
          DEFAULT: "#111115",
          elevated: "#18181e",
          overlay: "#1e1e26",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          subtle: "rgba(255,255,255,0.05)",
          strong: "rgba(255,255,255,0.14)",
        },
        accent: {
          purple: "#7c5cfa",
          "purple-light": "#9b7dff",
          "purple-dark": "#5c3fd4",
          glow: "rgba(124, 92, 250, 0.4)",
        },
        node: {
          bg: "#141418",
          header: "#1a1a20",
          border: "rgba(255,255,255,0.1)",
        },
        text: {
          primary: "#f0f0f2",
          secondary: "#8b8b9a",
          muted: "#55555f",
          accent: "#9b7dff",
        },
        status: {
          success: "#22c55e",
          error: "#ef4444",
          warning: "#f59e0b",
          running: "#7c5cfa",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": {
            boxShadow: "0 0 10px 2px rgba(124, 92, 250, 0.3)",
          },
          "50%": {
            boxShadow: "0 0 25px 6px rgba(124, 92, 250, 0.6)",
          },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "edge-flow": {
          "0%": { strokeDashoffset: "30" },
          "100%": { strokeDashoffset: "0" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in-left": "slide-in-left 0.25s ease-out",
        "slide-in-right": "slide-in-right 0.25s ease-out",
        shimmer: "shimmer 2s linear infinite",
        "edge-flow": "edge-flow 0.5s linear infinite",
      },
      boxShadow: {
        node: "0 2px 20px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset",
        "node-selected": "0 0 0 2px rgba(124, 92, 250, 0.8), 0 2px 20px rgba(0,0,0,0.5)",
        "node-running": "0 0 0 2px rgba(124, 92, 250, 0.6), 0 0 25px 6px rgba(124, 92, 250, 0.3)",
        glow: "0 0 20px rgba(124, 92, 250, 0.4)",
        "glow-sm": "0 0 10px rgba(124, 92, 250, 0.3)",
      },
    },
  },
  plugins: [animate],
};

export default config;

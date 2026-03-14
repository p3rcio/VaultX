import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0A0F1E",
        surface: "#111827",
        "surface-high": "#1E2A3B",
        accent: "#2563EB",
        "accent-hover": "#3B82F6",
        "on-surface": "#E2E8F0",
        "on-surface-muted": "#94A3B8",
        error: "#EF4444",
        success: "#22C55E",
        warning: "#F59E0B",
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "24px",
      },
      boxShadow: {
        "elevation-1": "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
        "elevation-2": "0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)",
        "elevation-3": "0 8px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.3)",
        "accent-glow": "0 0 20px rgba(37, 99, 235, 0.35)",
      },
    },
  },
  plugins: [],
};
export default config;

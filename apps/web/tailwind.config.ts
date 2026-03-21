import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary:           "rgb(var(--c-primary) / <alpha-value>)",
        surface:           "rgb(var(--c-surface) / <alpha-value>)",
        "surface-high":    "rgb(var(--c-surface-high) / <alpha-value>)",
        accent:            "rgb(var(--c-accent) / <alpha-value>)",
        "accent-hover":    "rgb(var(--c-accent-hover) / <alpha-value>)",
        "on-surface":      "rgb(var(--c-on-surface) / <alpha-value>)",
        "on-surface-muted":"rgb(var(--c-on-surface-muted) / <alpha-value>)",
        error:             "rgb(var(--c-error) / <alpha-value>)",
        success:           "rgb(var(--c-success) / <alpha-value>)",
        warning:           "rgb(var(--c-warning) / <alpha-value>)",
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

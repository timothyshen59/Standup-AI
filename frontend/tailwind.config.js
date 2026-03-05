/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        surface: "#12121a",
        "surface-hover": "#1a1a26",
        border: "#1e1e2e",
        "border-active": "#3b3b5c",
        "text-primary": "#e4e4ef",
        "text-muted": "#6b6b8d",
        "text-dim": "#44445e",
        accent: "#6ee7b7",
        "accent-dim": "#2d6a4f",
        "accent-glow": "rgba(110,231,183,0.08)",
        danger: "#f87171",
        purple: "#a78bfa",
      },
      fontFamily: {
        display: ['"DM Sans"', "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
        body: ['"DM Sans"', "sans-serif"],
      },
    },
  },
  plugins: [],
};

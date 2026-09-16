/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base surfaces — layered near-blacks, not flat #000
        ink: {
          DEFAULT: "#0B0E13",
          950: "#07090C",
          900: "#0F131A",
          800: "#161B24",
          700: "#1E2530",
          muted: "#8B93A3",
        },
        paper: {
          DEFAULT: "#EDEFF4",
          dim: "#C7CCD8",
        },
        // Blueprint blue — desaturated, glows rather than shouts
        blueprint: {
          200: "#7FA8CE",
          300: "#5C87AC",
          400: "#4A7CA8",
          500: "#3E7BB0",
          600: "#5B9BD4",
          700: "#79B2E6",
        },
        // Brass — warm metal accent for primary actions
        brass: {
          200: "#E8D3A0",
          300: "#DCB876",
          400: "#CBA25C",
          500: "#C9A24D",
          600: "#D8B463",
          700: "#E8CB86",
        },
        moss: {
          400: "#5FAE85",
          500: "#4C9C72",
          600: "#3C7A5D",
        },
        clay: {
          400: "#E08A7A",
          500: "#D97662",
          600: "#B23B3B",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        sans: ["'Public Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      backgroundImage: {
        grid: "linear-gradient(to right, rgba(91,155,212,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(91,155,212,0.06) 1px, transparent 1px)",
        "radial-fade": "radial-gradient(circle at 50% 0%, rgba(91,155,212,0.10), transparent 60%)",
      },
      backgroundSize: {
        grid: "28px 28px",
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 32px -16px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(91,155,212,0.25), 0 0 24px -4px rgba(91,155,212,0.35)",
      },
    },
  },
  plugins: [],
};

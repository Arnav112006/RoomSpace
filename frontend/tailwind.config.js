/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#EEF1EC",
          dim: "#E3E7DF",
        },
        ink: {
          DEFAULT: "#151A21",
          soft: "#232A33",
          muted: "#5B6470",
        },
        blueprint: {
          50: "#EAF1F8",
          200: "#B7CFE3",
          400: "#5C87AC",
          600: "#2A5C8A",
          700: "#1F4468",
          900: "#132B44",
        },
        brass: {
          200: "#EAD8B4",
          400: "#CBA25C",
          600: "#B8863B",
          700: "#8F672B",
        },
        moss: {
          500: "#3C7A5D",
          600: "#2E6049",
        },
        clay: {
          500: "#B23B3B",
          600: "#953030",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        sans: ["'Public Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      backgroundImage: {
        grid: "linear-gradient(to right, rgba(42,92,138,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(42,92,138,0.08) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "24px 24px",
      },
    },
  },
  plugins: [],
};

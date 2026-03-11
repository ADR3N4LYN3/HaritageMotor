import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        black: "#0e0d0b",
        dark: "#1a1916",
        "dark-2": "#141310",
        gold: "#b8955a",
        "gold-lt": "#d4b07a",
        "gold-dk": "#96773e",
        white: "#faf9f7",
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      fontFamily: {
        display: ["var(--font-display)", "Cormorant Garamond", "serif"],
        sans: ["var(--font-sans)", "DM Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

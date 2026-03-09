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
        gold: "#b8955a",
        white: "#faf9f7",
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      fontFamily: {
        display: ["Cormorant Garamond", "serif"],
        sans: ["DM Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

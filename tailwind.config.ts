import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#05070d",
        panel: "#0b1020",
        line: "#1c2440",
        accent: "#5eead4",
        accent2: "#a78bfa",
        danger: "#f87171",
        warn: "#fbbf24",
        ok: "#34d399",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(94, 234, 212, 0.25)",
      },
    },
  },
  plugins: [],
};
export default config;

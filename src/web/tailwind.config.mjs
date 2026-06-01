import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    resolve(__dirname, "index.html"),
    resolve(__dirname, "src/**/*.{ts,tsx}"),
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        page: "rgb(var(--page) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        elev: "rgb(var(--elev) / <alpha-value>)",
        sunken: "rgb(var(--sunken) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        rule: "rgb(var(--rule) / <alpha-value>)",
        "rule-strong": "rgb(var(--rule-strong) / <alpha-value>)",
        brass: "rgb(var(--brass) / <alpha-value>)",
        "brass-soft": "rgb(var(--brass-soft) / <alpha-value>)",
        sage: "rgb(var(--sage) / <alpha-value>)",
        brick: "rgb(var(--brick) / <alpha-value>)",
        ember: "rgb(var(--ember) / <alpha-value>)",
        ink_on_brass: "rgb(var(--ink-on-brass) / <alpha-value>)",
      },
      fontFamily: {
        display: ['"Instrument Serif"', "ui-serif", "Georgia", "serif"],
        sans: ['"Geist"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', "ui-monospace", "Menlo", "monospace"],
      },
      letterSpacing: {
        caps: "0.18em",
      },
      boxShadow: {
        paper: "0 1px 0 rgb(var(--rule) / 0.6), 0 8px 24px -16px rgb(var(--shadow) / 0.18)",
        ink: "0 0 0 1px rgb(var(--rule) / 1)",
      },
      backgroundImage: {
        "grain": "var(--bg-grain)",
        "rose": "var(--bg-rose)",
      },
    },
  },
  plugins: [],
};

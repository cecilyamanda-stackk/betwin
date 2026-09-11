import type { Config } from "tailwindcss";

// Bet606 design tokens. These map 1:1 to the palette in the product spec.
// Kept in one place so future brand refreshes only touch this file plus
// /src/lib/branding.ts.
//
// The `gold` key name is legacy (kept as-is rather than renamed across the
// ~140 `text-gold` / `bg-gold` / `border-gold` call sites in src/), but it
// now resolves to Bet606's lime-green accent, sampled from the supplied
// icon/logo artwork (~#BBF90A) instead of the old amber.
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080B0D",
        surface: {
          DEFAULT: "#131519",
          secondary: "#1B1E24",
        },
        gold: {
          DEFAULT: "#BBF90A",
          hover: "#CCFA47",
        },
        // Exact neon lime from the BET606 wordmark spec — kept distinct
        // from `gold` above since the wordmark calls for this precise
        // value, while `gold` covers general UI accents/buttons.
        wordmark: "#B7FF00",
        border: {
          DEFAULT: "#262A31",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#AAB4C8",
        },
        live: "#E53935",
        success: "#22C55E",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-manrope)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "10px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
};

export default config;

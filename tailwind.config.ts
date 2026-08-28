import type { Config } from "tailwindcss";

// Betwin design tokens. These map 1:1 to the palette in the product spec.
// Kept in one place so the eventual brand refresh only touches this file
// plus /src/lib/branding.ts.
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0B132B",
        surface: {
          DEFAULT: "#111C36",
          secondary: "#162342",
        },
        gold: {
          DEFAULT: "#F4C430",
          hover: "#FFD95A",
        },
        border: {
          DEFAULT: "#263553",
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

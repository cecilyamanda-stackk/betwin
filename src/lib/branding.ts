/**
 * Single source of truth for brand text.
 *
 * "Betwin" is the working name for this build. When the client supplies a
 * final name/logo, update this file only — nothing else in the codebase
 * should hard-code the brand name. The <BrandLogo /> component
 * (src/components/layout/BrandLogo.tsx) is the one place the logo mark is
 * drawn, so swapping the SVG there completes the rebrand.
 */
export const BRAND = {
  name: "Betwin",
  tagline: "Sports Prediction Platform",
  supportEmail: "support@betwin.example", // placeholder — replace when client provides real contact info
} as const;

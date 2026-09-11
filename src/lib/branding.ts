/**
 * Single source of truth for brand text.
 *
 * "Bet606" is the current brand name for this build. If the client supplies
 * a further name/logo change, update this file only — nothing else in the
 * codebase should hard-code the brand name. The <BrandLogo /> component
 * (src/components/layout/BrandLogo.tsx) is the one place the logo mark is
 * drawn, so swapping the image assets there completes the rebrand.
 */
export const BRAND = {
  name: "Bet606",
  tagline: "Sports Prediction Platform",
  supportEmail: "support@bet606.example", // placeholder — replace when client provides real contact info
} as const;

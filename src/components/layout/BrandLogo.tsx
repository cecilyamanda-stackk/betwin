import Image from "next/image";
import { BRAND } from "@/lib/branding";

interface BrandLogoProps {
  className?: string;
  showWordmark?: boolean;
}

/**
 * The ONLY place the logo is drawn — every header, footer, auth screen, and
 * admin nav renders through this component (see BRAND in
 * src/lib/branding.ts), so changes here are enough to rebrand the whole app.
 *
 * This renders the icon mark (public/images/bet606-icon.png, the same
 * artwork as the browser favicon at src/app/icon.png) next to a live CSS
 * text wordmark rather than a flat logo image — a baked-in image box loses
 * its background color contrast whenever it sits on a surface other than
 * pure black, whereas real text always blends with whatever surface it's
 * on. The type styling (heavy weight, uppercase, tight tracking, forward
 * skew, two-tone BET / 606 color split) approximates the brand's wordmark
 * design spec using the existing Manrope display font.
 *
 * showWordmark=false renders the icon on its own for tight spaces like the
 * admin header.
 */
export function BrandLogo({ className = "", showWordmark = true }: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/images/bet606-icon.png"
        alt={showWordmark ? "" : BRAND.name}
        aria-hidden={showWordmark}
        width={1254}
        height={1254}
        className="h-7 w-7 shrink-0 rounded-md"
        priority
      />
      {showWordmark && (
        <span
          className="inline-block skew-x-[-8deg] font-display text-xl font-extrabold uppercase leading-none tracking-tighter"
          aria-label={BRAND.name}
        >
          <span className="text-white">Bet</span>
          <span className="text-wordmark">606</span>
        </span>
      )}
    </div>
  );
}

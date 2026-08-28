import { BRAND } from "@/lib/branding";

interface BrandLogoProps {
  className?: string;
  showWordmark?: boolean;
}

/**
 * Temporary placeholder mark: a simple gold flame over navy, echoing the
 * "flame + gold + navy" brief in section 4. This is the ONLY place the
 * logo graphic is drawn — replace the <svg> below when the client
 * supplies final artwork, and the rest of the app updates automatically.
 */
export function BrandLogo({ className = "", showWordmark = true }: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="28" height="28" rx="7" fill="#111C36" />
        <path
          d="M14 4c-.4 3-2.6 4.3-4 6.3-1.6 2.3-2 5.7.3 8 1.6 1.6 3.9 2 5.7 1.3-1-1-1.5-2-1.2-3.3.3-1.3 1.3-2 1.6-3.3.6 1 1.2 1.6 1.2 3 1.6-1.3 2.4-3.6 1.8-5.6-.4-1.4-1.4-2.3-1.7-3.7-.2 1-.5 1.6-1 2-.2-1.8-1-3.3-2.7-4.7Z"
          fill="#F4C430"
        />
      </svg>
      {showWordmark && (
        <span className="font-display text-lg font-extrabold tracking-tight text-text-primary">
          {BRAND.name}
        </span>
      )}
    </div>
  );
}

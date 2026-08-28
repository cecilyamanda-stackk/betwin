import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { BRAND } from "@/lib/branding";

const columns = [
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/how-it-works", label: "How It Works" },
      { href: "/faq", label: "FAQs" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/responsible-use", label: "Responsible Use" },
    ],
  },
  {
    title: "Support",
    // Placeholder contact channel only — no address/phone/socials until the
    // client supplies them (section 32/33).
    links: [{ href: `mailto:${BRAND.supportEmail}`, label: BRAND.supportEmail }],
  },
];

/** Site footer (section 32). Pads bottom on mobile to clear the tab bar. */
export function Footer() {
  return (
    <footer className="border-t border-border bg-surface pb-20 md:pb-0">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-6">
        <div>
          <BrandLogo />
          <p className="mt-3 max-w-xs text-sm text-text-secondary">{BRAND.tagline}</p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {col.title}
            </h4>
            <ul className="flex flex-col gap-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-text-secondary hover:text-text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-4 text-center text-xs text-text-secondary md:px-6">
        © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
      </div>
    </footer>
  );
}

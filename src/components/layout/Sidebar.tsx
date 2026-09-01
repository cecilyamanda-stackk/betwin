import Link from "next/link";
import { Home, Radio, Star, Flame, Trophy, HelpCircle, Receipt, ListChecks, History, LayoutList, IdCard, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const mainLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/live", label: "Live Matches", icon: Radio },
  { href: "/account/history", label: "My Bets", icon: Receipt },
  { href: "/featured", label: "Featured", icon: Star },
  { href: "/highlights", label: "Highlights", icon: Flame },
];

const userLinks = [
  { href: "/predictions", label: "My Predictions", icon: ListChecks },
  { href: "/predictions/history", label: "Prediction History", icon: History },
  { href: "/leaderboard", label: "Leaderboard", icon: LayoutList },
  { href: "/profile", label: "Profile", icon: IdCard },
  { href: "/account", label: "Account", icon: ShieldCheck },
];

const supportLinks = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/faq", label: "FAQs" },
  { href: "/contact", label: "Contact Us" },
];

/**
 * Desktop left sidebar (section 10). ~240px, collapses to the bottom
 * MobileNav below the md breakpoint (section 34).
 *
 * Sticky under the header (top-16 = header's h-16) with its own height and
 * internal scroll, so it stays put while the main content scrolls — it
 * must never travel with the page.
 *
 * The Sports section lists active sports with a live-match count,
 * queried directly here (Phase 3) rather than in a separate
 * SidebarSports component, since it's a small, single-purpose query.
 */
export async function Sidebar() {
  const supabase = await createClient();
  const { data: sports } = await supabase
    .from("sports")
    .select("id, name, slug, icon")
    .eq("active", true)
    .order("name")
    .limit(6);

  return (
    <aside className="hidden w-[240px] shrink-0 border-r border-border bg-background md:sticky md:top-16 md:block md:h-[calc(100vh-4rem)]">
      <nav className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-6">
        <SidebarSection title="Main">
          {mainLinks.map((l) => (
            <SidebarLink key={l.href} href={l.href} label={l.label} icon={l.icon} />
          ))}
        </SidebarSection>

        {sports && sports.length > 0 && (
          <SidebarSection title="Sports">
            {sports.map((s) => (
              <Link
                key={s.id}
                href={`/sports/${s.slug}`}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
              >
                <span className="w-4 shrink-0 text-center" aria-hidden="true">
                  {s.icon || "🏆"}
                </span>
                {s.name}
              </Link>
            ))}
            <Link
              href="/sports"
              className="rounded-md px-3 py-2 text-sm text-gold transition-colors hover:underline"
            >
              See all sports
            </Link>
          </SidebarSection>
        )}

        <SidebarSection title="User">
          {userLinks.map((l) => (
            <SidebarLink key={l.href} href={l.href} label={l.label} icon={l.icon} />
          ))}
        </SidebarSection>

        <SidebarSection title="Support">
          {supportLinks.map((l) => (
            <SidebarLink key={l.href} href={l.href} label={l.label} icon={HelpCircle} />
          ))}
        </SidebarSection>
      </nav>
    </aside>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {title}
      </h3>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Trophy;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

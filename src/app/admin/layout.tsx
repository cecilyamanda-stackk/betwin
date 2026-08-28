import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { BRAND } from "@/lib/branding";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: `${BRAND.name} Admin`,
};

/**
 * Independent root layout for the /admin tree (Next.js "multiple root
 * layouts" pattern — this and (public)/layout.tsx are the only two files
 * allowed to render <html>/<body>).
 *
 * Deliberately does NOT reuse the public Header/Sidebar/Footer — section
 * 20/21 calls for the admin surface to read as a distinct operations
 * console, not a themed variant of the public site. Full AdminSidebar/
 * AdminHeader chrome (nav, breadcrumbs, admin identity) is built out in
 * Phase 4 once there's real data to navigate to — see ROADMAP.md.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body className="min-h-screen bg-background font-sans text-text-primary">{children}</body>
    </html>
  );
}

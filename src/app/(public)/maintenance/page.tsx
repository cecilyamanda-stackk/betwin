import { BRAND } from "@/lib/branding";

export const metadata = {
  title: `${BRAND.name} — Under maintenance`,
};

/**
 * Shown to non-admins when /admin/settings has maintenance_mode on
 * (see the middleware.ts redirect). Admins bypass this entirely so they
 * can keep working and flip the setting back off.
 */
export default function MaintenancePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold text-text-primary">We&apos;ll be right back</h1>
      <p className="mt-3 text-sm text-text-secondary">
        {BRAND.name} is undergoing scheduled maintenance. Thanks for your patience — check back
        shortly.
      </p>
    </div>
  );
}

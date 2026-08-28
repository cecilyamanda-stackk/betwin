import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { SettingsManager } from "./SettingsManager";
import { PaymentsSettingsForm } from "./PaymentsSettingsForm";
import { parseMpesaPaymentConfig } from "@/lib/mpesa";

/**
 * /admin/settings: platform-wide toggles. Kept intentionally small for
 * Phase 4 — maintenance_mode is wired into middleware.ts (blocks the
 * public site for non-admins, shows /maintenance) and
 * registration_enabled is wired into the register page. New settings can
 * be added to platform_settings without a migration; only the keys an
 * admin can actually act on need a control here.
 */
export default async function AdminSettingsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: settings } = await supabase.from("platform_settings").select("key, value, updated_at");

  const maintenanceMode = Boolean(settings?.find((s) => s.key === "maintenance_mode")?.value ?? false);
  const registrationEnabled = Boolean(
    settings?.find((s) => s.key === "registration_enabled")?.value ?? true
  );
  // Wagering roadmap Phase 4/8: gates the header balance/Deposit UI.
  // Defaults false so wallet UI doesn't appear until an admin turns it on
  // deliberately — see the Phase 4 migration's scope note.
  const walletEnabled = Boolean(settings?.find((s) => s.key === "wallet_enabled")?.value ?? false);
  const mpesaPaymentConfig = parseMpesaPaymentConfig(settings?.find((s) => s.key === "mpesa_payment_config")?.value);

  return (
    <div className="flex flex-col gap-6">
      <SettingsManager
        initialMaintenanceMode={maintenanceMode}
        initialRegistrationEnabled={registrationEnabled}
        initialWalletEnabled={walletEnabled}
      />
      <PaymentsSettingsForm initialConfig={mpesaPaymentConfig} />
    </div>
  );
}

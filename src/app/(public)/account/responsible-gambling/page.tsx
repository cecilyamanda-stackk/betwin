import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResponsibleGamblingForm } from "@/components/account/ResponsibleGamblingForm";

/**
 * /account/responsible-gambling — wagering roadmap Phase 6. See the
 * Phase 6 migration's scope note: the *policy* this UI enforces (exact
 * limit defaults, jurisdiction-specific requirements) is still
 * Phase 0's to draft; this ships the mechanism, not the copy.
 */
export default async function ResponsibleGamblingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: settings } = await supabase
    .from("responsible_gambling_settings")
    .select("deposit_limit_amount, deposit_limit_period, excluded_until")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Responsible Gambling</h1>
      <ResponsibleGamblingForm
        initialDepositLimitAmount={settings?.deposit_limit_amount ?? null}
        initialDepositLimitPeriod={settings?.deposit_limit_period ?? null}
        excludedUntil={settings?.excluded_until ?? null}
      />
    </div>
  );
}

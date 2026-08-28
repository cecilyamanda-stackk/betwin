"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCheckbox } from "@/components/admin/AdminForm";
import { updateSetting } from "@/actions/admin/settings";

export function SettingsManager({
  initialMaintenanceMode,
  initialRegistrationEnabled,
  initialWalletEnabled,
}: {
  initialMaintenanceMode: boolean;
  initialRegistrationEnabled: boolean;
  initialWalletEnabled: boolean;
}) {
  const router = useRouter();
  const [maintenanceMode, setMaintenanceMode] = useState(initialMaintenanceMode);
  const [registrationEnabled, setRegistrationEnabled] = useState(initialRegistrationEnabled);
  const [walletEnabled, setWalletEnabled] = useState(initialWalletEnabled);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(
    key: "maintenance_mode" | "registration_enabled" | "wallet_enabled",
    value: boolean,
    setLocal: (v: boolean) => void
  ) {
    setLocal(value); // optimistic
    setLoadingKey(key);
    setError(null);

    const result = await updateSetting(key, value);

    setLoadingKey(null);
    if (result.error) {
      setLocal(!value); // revert
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 font-display text-2xl font-bold">Settings</h1>

      {error && (
        <p role="alert" className="mb-4 text-sm text-live">
          {error}
        </p>
      )}

      <div className="card flex flex-col gap-5 p-6">
        <div>
          <AdminCheckbox
            label="Maintenance mode"
            checked={maintenanceMode}
            onChange={(v) => toggle("maintenance_mode", v, setMaintenanceMode)}
          />
          <p className="mt-1 pl-6 text-xs text-text-secondary">
            Blocks the public site for everyone except admins and shows a maintenance page.
            {loadingKey === "maintenance_mode" && " Saving..."}
          </p>
        </div>

        <div className="border-t border-border pt-5">
          <AdminCheckbox
            label="Registration enabled"
            checked={registrationEnabled}
            onChange={(v) => toggle("registration_enabled", v, setRegistrationEnabled)}
          />
          <p className="mt-1 pl-6 text-xs text-text-secondary">
            When off, the register form is replaced with a &quot;registration closed&quot; message. Existing
            users can still log in.
            {loadingKey === "registration_enabled" && " Saving..."}
          </p>
        </div>

        <div className="border-t border-border pt-5">
          <AdminCheckbox
            label="Wallet enabled"
            checked={walletEnabled}
            onChange={(v) => toggle("wallet_enabled", v, setWalletEnabled)}
          />
          <p className="mt-1 pl-6 text-xs text-text-secondary">
            Shows the balance display and Deposit button in the header. Deposits themselves aren&apos;t
            live yet — no payment processor is wired up (Phase 0 of the wagering roadmap) — so turning
            this on is only useful for admins/testers who&apos;ve been given a wallet balance manually.
            {loadingKey === "wallet_enabled" && " Saving..."}
          </p>
        </div>
      </div>
    </div>
  );
}

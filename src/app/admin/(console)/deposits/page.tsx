import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { DepositsManager } from "./DepositsManager";

/**
 * /admin/deposits — manual M-Pesa deposit reconciliation. The client
 * hasn't applied for Daraja API access yet, so this is how a deposit
 * actually gets confirmed right now: a user forwards their M-Pesa
 * confirmation code through their Wallet page, and an admin who can see
 * it actually landed in the till approves it here, which credits their
 * wallet (see resolve_manual_deposit_request in the M-Pesa migration).
 */
export default async function AdminDepositsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("manual_deposit_requests")
    .select("id, user_id, mpesa_code, mpesa_phone, claimed_amount, status, admin_note, created_at, reviewed_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const userIds = [...new Set((requests ?? []).map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, username, email").in("id", userIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const rows = (requests ?? []).map((r) => ({
    id: r.id,
    username: profileById.get(r.user_id)?.username ?? "unknown",
    email: profileById.get(r.user_id)?.email ?? "unknown",
    mpesaCode: r.mpesa_code,
    mpesaPhone: r.mpesa_phone,
    claimedAmount: r.claimed_amount,
    status: r.status,
    adminNote: r.admin_note,
    createdAt: r.created_at,
  }));

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold">Deposits</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Manual M-Pesa reconciliation — confirm the code actually landed in the till before
        approving. Approving credits the user&apos;s withdrawable balance immediately.
      </p>
      <DepositsManager requests={rows} />
    </div>
  );
}

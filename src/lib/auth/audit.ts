import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The fixed set of auditable admin actions. Extend this as new admin
 * mutations are added in later phases (event/market/result management).
 */
export type AuditAction =
  | "SPORT_CREATED"
  | "SPORT_UPDATED"
  | "COMPETITION_CREATED"
  | "COMPETITION_UPDATED"
  | "TEAM_CREATED"
  | "TEAM_UPDATED"
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_PUBLISHED"
  | "EVENT_SUSPENDED"
  | "EVENT_RESUMED"
  | "EVENT_FINISHED"
  | "EVENT_CANCELLED"
  | "MARKET_CREATED"
  | "MARKET_UPDATED"
  | "SELECTION_CREATED"
  | "SELECTION_ODDS_UPDATED"
  | "RESULT_ENTERED"
  | "RESULT_CHANGED"
  | "USER_ROLE_CHANGED"
  | "USER_SUSPENDED"
  | "USER_UNSUSPENDED"
  | "NOTIFICATION_SENT"
  | "SETTINGS_UPDATED"
  // Wagering roadmap Phase 3.
  | "WALLET_ADJUSTED"
  | "WITHDRAWAL_APPROVED"
  | "WITHDRAWAL_REJECTED"
  | "MANUAL_DEPOSIT_APPROVED"
  | "MANUAL_DEPOSIT_REJECTED";

export type AuditEntityType =
  | "EVENT"
  | "MARKET"
  | "RESULT"
  | "USER"
  | "COMPETITION"
  | "TEAM"
  | "SPORT"
  | "NOTIFICATION"
  | "SETTINGS"
  // Wagering roadmap Phase 3.
  | "WALLET";

interface WriteAuditLogParams {
  actorUserId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records an admin action. Call this from every Server Action that
 * mutates admin-controlled data, immediately after the mutation succeeds.
 * Uses the service-role client since audit_logs is insert-only for admins
 * and should never be editable from the client.
 */
export async function writeAuditLog({
  actorUserId,
  action,
  entityType,
  entityId,
  metadata = {},
}: WriteAuditLogParams) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("audit_logs").insert({
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });

  if (error) {
    // Intentionally non-throwing: a logging failure should not roll back
    // the underlying admin action, but it must be visible in server logs.
    console.error("Failed to write audit log", { action, entityType, entityId, error });
  }
}

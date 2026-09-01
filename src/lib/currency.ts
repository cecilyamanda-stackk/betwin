/**
 * Every monetary amount in this app (wallet balances, stakes, payouts,
 * deposit/withdrawal amounts) is in Kenyan Shillings — this is the one
 * place that formatting decision lives, so changing it later (a
 * different display format, a different currency entirely) is a
 * one-file change instead of a grep-and-replace across the app.
 *
 * Odds are NOT money and must never go through this — a 1.85 in
 * "Home 1.85" is a multiplier, not an amount, and formatting it as
 * "KES 1.85" would be wrong and confusing.
 */
export function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** For inline quick-amount buttons ("KES 100") where the full "KES X.XX" precision would be noisy. */
export function formatKESWhole(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

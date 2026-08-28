export type MpesaPaymentMethod = "TILL" | "PAYBILL";

export interface MpesaPaymentConfig {
  method: MpesaPaymentMethod;
  tillNumber: string | null;
  paybillNumber: string | null;
  accountNumber: string | null;
}

const DEFAULT_MPESA_PAYMENT_CONFIG: MpesaPaymentConfig = {
  method: "PAYBILL",
  tillNumber: null,
  paybillNumber: null,
  accountNumber: null,
};

/**
 * platform_settings.value is stored as untyped jsonb — this is the one
 * place that turns it into something safe to read, so every caller
 * (admin settings form, deposit instructions wherever they're shown)
 * agrees on the shape and on how a partially-filled-in or missing config
 * is treated. Never trust the raw value directly.
 */
export function parseMpesaPaymentConfig(value: unknown): MpesaPaymentConfig {
  if (!value || typeof value !== "object") return DEFAULT_MPESA_PAYMENT_CONFIG;
  const v = value as Record<string, unknown>;

  const nonEmptyString = (x: unknown): string | null => (typeof x === "string" && x.trim() !== "" ? x.trim() : null);

  return {
    method: v.method === "TILL" ? "TILL" : "PAYBILL",
    tillNumber: nonEmptyString(v.till_number),
    paybillNumber: nonEmptyString(v.paybill_number),
    accountNumber: nonEmptyString(v.account_number),
  };
}

/**
 * True once the admin has actually filled in the number(s) the chosen
 * method needs. Till only needs a till number; Paybill needs both the
 * business number and an account number — the same asymmetry that
 * drives which fields the admin form shows and which instructions the
 * deposit form renders.
 */
export function isMpesaPaymentConfigured(config: MpesaPaymentConfig): boolean {
  if (config.method === "TILL") return config.tillNumber !== null;
  return config.paybillNumber !== null && config.accountNumber !== null;
}

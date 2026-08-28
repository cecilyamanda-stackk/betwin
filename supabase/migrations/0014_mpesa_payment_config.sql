-- Betwin — M-Pesa payment configuration (Till vs Paybill)
--
-- Reuses the existing platform_settings key-value mechanism (same as
-- wallet_enabled) rather than a dedicated table, since this is exactly
-- the shape platform_settings already exists for: a single admin-edited
-- config blob, read on every page that shows deposit instructions.
--
-- method: 'TILL' | 'PAYBILL'. Till (Buy Goods) only needs a till number;
-- Paybill needs both a business number and an account number — that
-- difference is what changes on the user-facing instructions and the
-- admin form, not just cosmetically (see MpesaDepositForm and
-- PaymentsSettingsForm). Left unset (all nulls) until an admin fills it
-- in — MpesaDepositForm treats "unconfigured" as its own honest state
-- rather than falling back to a placeholder number.
insert into public.platform_settings (key, value)
values (
  'mpesa_payment_config',
  jsonb_build_object(
    'method', 'PAYBILL',
    'till_number', null,
    'paybill_number', null,
    'account_number', null
  )
)
on conflict (key) do nothing;

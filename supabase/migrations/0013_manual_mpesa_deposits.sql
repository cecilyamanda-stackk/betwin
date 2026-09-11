-- Bet606 — Manual M-Pesa deposit reconciliation
--
-- Scope note: the client hasn't applied for M-Pesa's Daraja API key yet,
-- so there's still no automated way to confirm a payment happened (same
-- root cause as every "deposits aren't live yet" message elsewhere in
-- this schema). What this adds isn't automation — it's the standard
-- manual-reconciliation stopgap: the user pays via M-Pesa outside the
-- app, forwards the confirmation code through their Wallet page, and an
-- admin who can see that code actually landed in the till/paybill
-- approves it, which credits the wallet as a real, closed-loop-eligible
-- DEPOSIT (not a generic ADJUSTMENT) so a future withdrawal can still
-- correctly require paying out to that same M-Pesa number.
--
-- This is a real money-crediting path, so — same as every other write in
-- this schema — the user can only ever create the PENDING claim; only an
-- admin, via a security-definer function, can turn it into an actual
-- wallet credit.

create type public.manual_deposit_status as enum ('PENDING', 'APPROVED', 'REJECTED');

create table public.manual_deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mpesa_code text not null,
  mpesa_phone text not null,
  claimed_amount numeric(12, 2) not null check (claimed_amount > 0),
  status public.manual_deposit_status not null default 'PENDING',
  admin_note text,
  -- Set only on approval, pointing at the DEPOSIT transaction it created.
  transaction_id uuid references public.transactions (id),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint manual_deposit_requests_review_fields_consistent check (
    (status = 'PENDING' and reviewed_by is null and reviewed_at is null)
    or (status <> 'PENDING' and reviewed_by is not null and reviewed_at is not null)
  )
);

create index manual_deposit_requests_user_id_idx on public.manual_deposit_requests (user_id);
create index manual_deposit_requests_status_idx on public.manual_deposit_requests (status);

-- An M-Pesa confirmation code is unique per real transaction — block a
-- second PENDING/APPROVED claim on the same code (whether that's an
-- honest double-submit or someone trying to claim credit twice). A
-- rejected code can be resubmitted (e.g. the user mistyped it), so the
-- uniqueness only applies to still-live claims.
create unique index manual_deposit_requests_code_active_idx
  on public.manual_deposit_requests (mpesa_code)
  where status in ('PENDING', 'APPROVED');

alter table public.manual_deposit_requests enable row level security;

create policy "Users can view their own manual deposit requests"
  on public.manual_deposit_requests for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can view all manual deposit requests"
  on public.manual_deposit_requests for select
  to authenticated
  using (public.is_admin());

-- Direct insert is fine here (no security-definer function needed) since
-- submitting a claim doesn't move any money by itself — it's just a
-- reviewable statement of "I paid this". The WITH CHECK still pins every
-- new row to PENDING and to the submitter's own id, so a user can't
-- insert a pre-approved row or one claiming to be someone else's.
create policy "Users can submit their own manual deposit requests"
  on public.manual_deposit_requests for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'PENDING');

-- No update policy: approving/rejecting always goes through
-- resolve_manual_deposit_request below, never a direct client update.

-- ── resolve_manual_deposit_request: admin-only ───────────────────────────
-- Same trust boundary as every other admin function in this schema
-- (resolve_withdrawal, adjust_wallet_balance): reachable only via the
-- service-role client, so requireAdmin() at the Server Action layer is
-- what actually gates this, not a check inside the function. Takes the
-- admin's id as a parameter rather than reading auth.uid() because the
-- service-role client has no user session to read one from.
create or replace function public.resolve_manual_deposit_request(
  p_request_id uuid,
  p_approve boolean,
  p_admin_user_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_req public.manual_deposit_requests%rowtype;
  v_payment_method_id uuid;
  v_transaction_id uuid;
begin
  select * into v_req from public.manual_deposit_requests where id = p_request_id for update;
  if not found then
    raise exception 'Manual deposit request % not found.', p_request_id;
  end if;
  if v_req.status <> 'PENDING' then
    raise exception 'Request % has already been %.', p_request_id, lower(v_req.status::text);
  end if;

  if not p_approve then
    update public.manual_deposit_requests
    set status = 'REJECTED', admin_note = p_note, reviewed_by = p_admin_user_id, reviewed_at = now()
    where id = p_request_id;
    return;
  end if;

  -- Reuse an existing M-Pesa payment method for this phone number if the
  -- user already has one (e.g. a prior approved deposit), so repeated
  -- deposits from the same number don't pile up duplicate rows — this
  -- also keeps the withdrawal closed-loop check meaningful (one method
  -- per funding number, not one per deposit).
  select id into v_payment_method_id
  from public.payment_methods
  where user_id = v_req.user_id
    and provider = 'MPESA'
    and payment_method_token = v_req.mpesa_phone
    and active
  limit 1;

  if v_payment_method_id is null then
    insert into public.payment_methods (user_id, provider, payment_method_token, display_label)
    values (v_req.user_id, 'MPESA', v_req.mpesa_phone, 'M-Pesa (' || v_req.mpesa_phone || ')')
    returning id into v_payment_method_id;
  end if;

  update public.wallets
  set withdrawable_cash = withdrawable_cash + v_req.claimed_amount
  where user_id = v_req.user_id;

  if not found then
    raise exception 'Wallet not found for user %.', v_req.user_id;
  end if;

  insert into public.transactions (user_id, type, status, amount, payment_method_id, metadata)
  values (
    v_req.user_id, 'DEPOSIT', 'COMPLETED', v_req.claimed_amount, v_payment_method_id,
    jsonb_build_object('mpesa_code', v_req.mpesa_code, 'manual_deposit_request_id', v_req.id)
  )
  returning id into v_transaction_id;

  update public.manual_deposit_requests
  set
    status = 'APPROVED',
    admin_note = p_note,
    transaction_id = v_transaction_id,
    reviewed_by = p_admin_user_id,
    reviewed_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.resolve_manual_deposit_request(uuid, boolean, uuid, text) from public;
grant execute on function public.resolve_manual_deposit_request(uuid, boolean, uuid, text) to service_role;
-- 2026-10-16 · Party P&L: margins, loans and a true payment log.
--
-- What this adds
--   1. company_finance  — gross margin % and cost-to-serve % per company.
--   2. loans            — every loan / CC / OD limit with the amount used and
--                         its interest rate. The app uses the amount-weighted
--                         average rate of the active loans.
--   3. A payment log    — every time money is recorded against an invoice,
--                         the increase is written to payment_history with
--                         its own date. Before this, a second part-payment
--                         overwrote the first one's date, so the interest
--                         cost of the money a dealer held could not be
--                         worked out correctly.
--   4. A one-off backfill of payment_history from what invoices hold today.
--   5. payment_history RLS scoped by location (it was readable by any
--      logged-in user across both locations).
--
-- Margins and loans are admin-only, like the rest of Master Data.
-- Run once in Supabase -> SQL Editor. Safe to re-run.

begin;

-- ── 1. Margins per company ────────────────────────────────────
create table if not exists public.company_finance (
  company_id        uuid primary key references public.companies(id) on delete cascade,
  margin_pct        numeric(6,3) not null default 0 check (margin_pct between 0 and 100),
  cost_to_serve_pct numeric(6,3) not null default 0 check (cost_to_serve_pct between 0 and 100),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references public.user_profiles(id) on delete set null
);

alter table public.company_finance enable row level security;
drop policy if exists "company_finance: admin all" on public.company_finance;
create policy "company_finance: admin all" on public.company_finance
  for all using (is_admin()) with check (is_admin());

-- ── 2. Loans ──────────────────────────────────────────────────
create table if not exists public.loans (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  kind        text not null default 'cc' check (kind in ('cc', 'od', 'term', 'other')),
  amount      numeric(14,2) not null default 0 check (amount >= 0),
  rate_pct    numeric(6,3) not null check (rate_pct >= 0 and rate_pct <= 60),
  active      boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.loans enable row level security;
drop policy if exists "loans: admin all" on public.loans;
create policy "loans: admin all" on public.loans
  for all using (is_admin()) with check (is_admin());

-- ── 3. Payment log ────────────────────────────────────────────
-- is_estimate marks rows whose date had to be assumed (no date on the
-- invoice, or a part-paid invoice from before this log existed).
alter table public.payment_history
  add column if not exists is_estimate boolean not null default false;

create index if not exists payment_history_invoice_idx  on public.payment_history (invoice_id, payment_date);
create index if not exists payment_history_stockist_idx on public.payment_history (stockist_id);

create or replace function public.fn_log_invoice_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old   numeric := 0;
  v_new   numeric := coalesce(new.payment_received, 0);
  v_delta numeric;
  v_date  date    := coalesce(new.payment_date, new.due_date, new.invoice_date);
  v_by    uuid    := (select id from user_profiles where id = auth.uid());
begin
  if tg_op = 'UPDATE' then
    v_old := coalesce(old.payment_received, 0);

    -- Invoice moved to another dealer: its payments move with it.
    if new.stockist_id is distinct from old.stockist_id then
      update payment_history set stockist_id = new.stockist_id where invoice_id = new.id;
    end if;
  end if;

  v_delta := v_new - v_old;

  if v_delta <> 0 then
    -- New money (or a correction downwards) on its own row, with its own date.
    insert into payment_history
      (invoice_id, stockist_id, amount, payment_date, delay_days, was_overdue,
       notes, recorded_by, is_estimate)
    values
      (new.id, new.stockist_id, v_delta, v_date,
       greatest(0, v_date - new.due_date), v_date > new.due_date,
       case when v_delta < 0 then 'Correction: amount reduced'
            when new.payment_date is null then 'No date given: assumed due date' end,
       v_by, new.payment_date is null);

  elsif tg_op = 'UPDATE' and v_new > 0
        and new.payment_date is distinct from old.payment_date then
    -- Same money, different date: someone corrected the date of the latest payment.
    update payment_history
       set payment_date = v_date,
           delay_days   = greatest(0, v_date - new.due_date),
           was_overdue  = v_date > new.due_date,
           is_estimate  = new.payment_date is null
     where id = (select id from payment_history
                  where invoice_id = new.id
                  order by created_at desc, payment_date desc
                  limit 1);

  elsif tg_op = 'UPDATE' and new.due_date is distinct from old.due_date then
    -- Credit days changed: keep delay figures in step.
    update payment_history
       set delay_days  = greatest(0, payment_date - new.due_date),
           was_overdue = payment_date > new.due_date
     where invoice_id = new.id;
  end if;

  return new;
end;
$$;

-- Trigger-only function: nobody should call it over the API.
revoke execute on function public.fn_log_invoice_payment() from public, anon, authenticated;

drop trigger if exists trg_log_invoice_payment on public.invoices;
create trigger trg_log_invoice_payment
after insert or update of payment_received, payment_date, stockist_id, invoice_date, credit_days
on public.invoices
for each row execute function public.fn_log_invoice_payment();

-- ── 4. Backfill (only invoices with no log rows yet) ──────────
-- An invoice holds one total and one date, so the backfill writes one row
-- per paid invoice. Part-paid invoices may have had earlier payments whose
-- dates were overwritten; those rows are marked as estimates.
insert into public.payment_history
  (invoice_id, stockist_id, amount, payment_date, delay_days, was_overdue, notes, is_estimate)
select i.id, i.stockist_id, i.payment_received,
       coalesce(i.payment_date, i.due_date, i.invoice_date),
       greatest(0, coalesce(i.payment_date, i.due_date, i.invoice_date) - i.due_date),
       coalesce(i.payment_date, i.due_date, i.invoice_date) > i.due_date,
       case when i.payment_date is null then 'Opening entry: no date given, assumed due date'
            when coalesce(i.balance, 0) > 0 then 'Opening entry: part-paid, earlier dates unknown'
            else 'Opening entry' end,
       i.payment_date is null or coalesce(i.balance, 0) > 0
  from public.invoices i
 where coalesce(i.payment_received, 0) <> 0
   and not exists (select 1 from public.payment_history p where p.invoice_id = i.id);

-- ── 5. payment_history visibility by location ─────────────────
drop policy if exists "ph: read"   on public.payment_history;
drop policy if exists "ph: insert" on public.payment_history;
drop policy if exists "ph: read own location" on public.payment_history;
drop policy if exists "ph: admin insert"      on public.payment_history;

create policy "ph: read own location" on public.payment_history
  for select using (
    is_admin() or exists (
      select 1 from public.invoices i
       where i.id = payment_history.invoice_id
         and i.location_id = my_location()));

-- Rows are written by the trigger above; direct inserts are admin-only.
create policy "ph: admin insert" on public.payment_history
  for insert with check (is_admin());

commit;

-- Check: every invoice's log should add up to what the invoice says was received.
-- select count(*) as mismatched from (
--   select i.id from invoices i left join payment_history p on p.invoice_id = i.id
--   group by i.id, i.payment_received
--   having abs(coalesce(sum(p.amount), 0) - coalesce(i.payment_received, 0)) > 0.5) x;

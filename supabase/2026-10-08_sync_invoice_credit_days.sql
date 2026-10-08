-- 2026-10-08 · Keep unpaid invoices in step with the dealer's credit days.
--
-- Fault: each invoice stores its own copy of credit_days, taken from the
-- dealer when the invoice was entered, and due_date is calculated from that
-- copy. Raising a dealer from 7 to 15 days in Master Data left their existing
-- invoices on 7, so they showed overdue a week early.
--
-- Fix: when a dealer's credit_days change, copy the new value onto their
-- UNPAID invoices. fn_invoice_compute (BEFORE trigger on invoices) then
-- recalculates due_date and status, and fn_trigger_risk (AFTER trigger)
-- recalculates the dealer's risk score. Paid invoices keep the terms they
-- were settled under, as history.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

create or replace function public.fn_sync_invoice_credit_days()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update invoices
     set credit_days = new.credit_days
   where stockist_id = new.id
     and coalesce(balance, 0) > 0
     and credit_days is distinct from new.credit_days;
  return new;
end;
$$;

drop trigger if exists trg_stockist_credit_days_sync on stockists;
create trigger trg_stockist_credit_days_sync
after update of credit_days on stockists
for each row
when (old.credit_days is distinct from new.credit_days and new.credit_days is not null)
execute function public.fn_sync_invoice_credit_days();

-- One-off repair of the invoices already out of step
update invoices i
   set credit_days = s.credit_days
  from stockists s
 where s.id = i.stockist_id
   and s.credit_days is not null
   and coalesce(i.balance, 0) > 0
   and i.credit_days is distinct from s.credit_days;

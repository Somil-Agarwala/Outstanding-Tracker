-- 2026-10-16 · Let location managers edit Master Data, behind an admin switch.
--
-- app_settings holds app-wide switches. manager_master_edit = true lets a
-- location manager add and edit stockists and PSRs in THEIR OWN location
-- only. They cannot move anything to another location, and cannot delete.
-- Admins keep full access through the existing "admin all" policies.
--
-- The switch is checked inside the database, so turning it off blocks
-- edits immediately, even from a browser tab that is still open.
--
-- Run once in Supabase -> SQL Editor (project: Outstanding Tracker). Safe to re-run.

begin;

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.user_profiles(id) on delete set null
);

alter table public.app_settings enable row level security;
drop policy if exists "app_settings: read"      on public.app_settings;
drop policy if exists "app_settings: admin all" on public.app_settings;
create policy "app_settings: read" on public.app_settings
  for select using (auth.role() = 'authenticated');
create policy "app_settings: admin all" on public.app_settings
  for all using (is_admin()) with check (is_admin());

insert into public.app_settings (key, value)
values ('manager_master_edit', 'false'::jsonb)
on conflict (key) do nothing;

create or replace function public.manager_can_edit_master()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'true'::jsonb from app_settings where key = 'manager_master_edit'), false)
     and exists (select 1 from user_profiles
                  where id = auth.uid() and role = 'location_manager' and location_id is not null);
$$;
revoke execute on function public.manager_can_edit_master() from public, anon;
grant  execute on function public.manager_can_edit_master() to authenticated;

-- Stockists: add and edit in own location when the switch is on.
drop policy if exists "stockists: manager insert" on public.stockists;
drop policy if exists "stockists: manager update" on public.stockists;
create policy "stockists: manager insert" on public.stockists
  for insert with check (manager_can_edit_master() and location_id = my_location());
create policy "stockists: manager update" on public.stockists
  for update using     (manager_can_edit_master() and location_id = my_location())
             with check (manager_can_edit_master() and location_id = my_location());

-- PSRs: same rules.
drop policy if exists "psrs: manager insert" on public.psrs;
drop policy if exists "psrs: manager update" on public.psrs;
create policy "psrs: manager insert" on public.psrs
  for insert with check (manager_can_edit_master() and location_id = my_location());
create policy "psrs: manager update" on public.psrs
  for update using     (manager_can_edit_master() and location_id = my_location())
             with check (manager_can_edit_master() and location_id = my_location());

commit;

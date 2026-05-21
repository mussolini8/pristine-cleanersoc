-- Additive setup for simplified residential operations.
-- Run this in Supabase SQL Editor if the app shows schema cache errors for residential tables.

alter table public.staff_members
  add column if not exists hourly_rate numeric(10,2),
  add column if not exists payment_mode text not null default 'residential_only',
  add column if not exists active boolean not null default true,
  add column if not exists deleted_at timestamptz;

create table if not exists public.residential_recurring_cleaning_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  account_name text not null,
  scheduled_hours numeric(8,2) not null default 0,
  frequency text not null default 'weekly',
  frequency_detail text,
  day_of_week text,
  assigned_team_id uuid,
  assigned_team_name text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.residential_recurring_cleaning_accounts enable row level security;

drop policy if exists "Residential recurring accounts are readable by signed in users" on public.residential_recurring_cleaning_accounts;
create policy "Residential recurring accounts are readable by signed in users"
  on public.residential_recurring_cleaning_accounts for select
  using (auth.uid() is not null and deleted_at is null);

drop policy if exists "Residential recurring accounts are editable by owners" on public.residential_recurring_cleaning_accounts;
create policy "Residential recurring accounts are editable by owners"
  on public.residential_recurring_cleaning_accounts for all
  using (auth.uid() is not null and (user_id is null or auth.uid() = user_id))
  with check (auth.uid() is not null and (user_id is null or auth.uid() = user_id));

create index if not exists residential_recurring_accounts_active_idx
  on public.residential_recurring_cleaning_accounts(active, deleted_at, account_name);

create index if not exists residential_recurring_accounts_team_idx
  on public.residential_recurring_cleaning_accounts(assigned_team_id, assigned_team_name);

create table if not exists public.residential_work_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  account_id uuid references public.residential_recurring_cleaning_accounts(id) on delete set null,
  account_name text not null,
  team_id uuid references public.staff_members(id) on delete set null,
  team_name text not null,
  work_date date not null,
  hours_worked numeric(8,2) not null default 0,
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.residential_work_logs enable row level security;

drop policy if exists "Residential work logs are readable by signed in users" on public.residential_work_logs;
create policy "Residential work logs are readable by signed in users"
  on public.residential_work_logs for select
  using (auth.uid() is not null and deleted_at is null);

drop policy if exists "Residential work logs are editable by owners" on public.residential_work_logs;
create policy "Residential work logs are editable by owners"
  on public.residential_work_logs for all
  using (auth.uid() is not null and (user_id is null or auth.uid() = user_id))
  with check (auth.uid() is not null and (user_id is null or auth.uid() = user_id));

create index if not exists residential_work_logs_date_team_idx
  on public.residential_work_logs(work_date, team_id, team_name, status);

create index if not exists residential_work_logs_account_idx
  on public.residential_work_logs(account_id, account_name);

create table if not exists public.residential_weekly_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  team_id uuid references public.staff_members(id) on delete set null,
  team_name text not null,
  week_start date not null,
  week_end date not null,
  total_hours numeric(8,2) not null default 0,
  hourly_rate numeric(10,2) not null default 0,
  total_payment numeric(12,2) not null default 0,
  status text not null default 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.residential_weekly_payments enable row level security;

drop policy if exists "Residential weekly payments are readable by signed in users" on public.residential_weekly_payments;
create policy "Residential weekly payments are readable by signed in users"
  on public.residential_weekly_payments for select
  using (auth.uid() is not null and deleted_at is null);

drop policy if exists "Residential weekly payments are editable by owners" on public.residential_weekly_payments;
create policy "Residential weekly payments are editable by owners"
  on public.residential_weekly_payments for all
  using (auth.uid() is not null and (user_id is null or auth.uid() = user_id))
  with check (auth.uid() is not null and (user_id is null or auth.uid() = user_id));

create unique index if not exists residential_weekly_payments_team_week_uidx
  on public.residential_weekly_payments(coalesce(team_id::text, team_name), week_start)
  where deleted_at is null;

create index if not exists residential_weekly_payments_status_idx
  on public.residential_weekly_payments(week_start, week_end, status);

create table if not exists public.residential_weekly_payment_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  cleaner_id uuid references public.staff_members(id) on delete set null,
  cleaner_name text not null,
  work_date date not null,
  city text,
  payment_amount numeric(12,2) not null default 0,
  residential_amount numeric(12,2) not null default 0,
  commercial_amount numeric(12,2) not null default 0,
  payment_type text not null default 'residential',
  week_start date not null,
  week_end date not null,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.residential_weekly_payment_rows enable row level security;

drop policy if exists "Residential weekly payment rows are readable by signed in users" on public.residential_weekly_payment_rows;
create policy "Residential weekly payment rows are readable by signed in users"
  on public.residential_weekly_payment_rows for select
  using (auth.uid() is not null and deleted_at is null);

drop policy if exists "Residential weekly payment rows are editable by owners" on public.residential_weekly_payment_rows;
create policy "Residential weekly payment rows are editable by owners"
  on public.residential_weekly_payment_rows for all
  using (auth.uid() is not null and (user_id is null or auth.uid() = user_id))
  with check (auth.uid() is not null and (user_id is null or auth.uid() = user_id));

create index if not exists residential_weekly_payment_rows_cleaner_week_idx
  on public.residential_weekly_payment_rows(cleaner_id, cleaner_name, week_start, week_end, status)
  where deleted_at is null;

create index if not exists residential_weekly_payment_rows_work_date_idx
  on public.residential_weekly_payment_rows(work_date, city)
  where deleted_at is null;

update public.staff_members
set payment_mode = 'mixed',
    team_scope = coalesce(team_scope, 'residential'),
    active = true,
    updated_at = now()
where lower(name) = 'juan romero';

update public.staff_members
set payment_mode = 'residential_only',
    active = coalesce(active, true),
    updated_at = now()
where lower(name) <> 'juan romero'
  and payment_mode is distinct from 'residential_only';

notify pgrst, 'reload schema';

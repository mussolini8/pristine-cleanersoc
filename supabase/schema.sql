create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are readable by owners" on public.profiles;
create policy "Profiles are readable by owners"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles are editable by owners" on public.profiles;
create policy "Profiles are editable by owners"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'Residential Cleaner',
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_members enable row level security;

alter table public.staff_members
  add column if not exists display_role text,
  add column if not exists team_scope text,
  add column if not exists commercial_payroll_eligible boolean not null default true,
  add column if not exists hourly_rate numeric(10,2),
  add column if not exists payment_mode text not null default 'residential_only',
  add column if not exists active boolean not null default true,
  add column if not exists deleted_at timestamptz,
  add column if not exists interviewed boolean default false,
  add column if not exists notes text;

drop policy if exists "Staff members are readable by owners" on public.staff_members;
create policy "Staff members are readable by owners"
  on public.staff_members for select
  using (auth.uid() = user_id);

drop policy if exists "Staff members are editable by owners" on public.staff_members;
create policy "Staff members are editable by owners"
  on public.staff_members for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.operation_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'normal',
  status text not null default 'todo',
  category text not null default 'Operations',
  due_date date,
  assignee text,
  reminder boolean not null default false,
  recurrence text not null default 'none',
  custom_interval_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.operation_tasks enable row level security;

drop policy if exists "Tasks are editable by owners" on public.operation_tasks;

alter table public.operation_tasks
  add column if not exists sop_source_key text unique;
create policy "Tasks are editable by owners"
  on public.operation_tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.payment_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cleaner_name text not null,
  cleaner_email text,
  cleaner_type text not null default 'residential',
  month_key text not null,
  week_index integer not null check (week_index between 0 and 4),
  service_date text,
  city text,
  residential_amount numeric(10,2) not null default 0,
  commercial_amount numeric(10,2) not null default 0,
  payment_amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_entries enable row level security;

drop policy if exists "Payment entries are editable by owners" on public.payment_entries;
create policy "Payment entries are editable by owners"
  on public.payment_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.payment_extras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_key text not null,
  week_index integer not null check (week_index between 0 and 4),
  cleaner text,
  hours numeric(10,2) not null default 0,
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_extras enable row level security;

drop policy if exists "Payment extras are editable by owners" on public.payment_extras;
create policy "Payment extras are editable by owners"
  on public.payment_extras for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.commercial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  city text,
  pricing_model text,
  cleaner_name text,
  hours numeric(10,2),
  frequency text,
  revenue numeric(10,2),
  cost numeric(10,2),
  cleaner_pay_type text,
  cleaner_hourly_rate numeric(10,2),
  cleaner_flat_rate numeric(10,2),
  payment_method text,
  contract_start date,
  contract_end date,
  last_qcc_date date,
  last_contact_date date,
  has_supplies boolean not null default false,
  has_keys boolean not null default false,
  supplies_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commercial_accounts
  add column if not exists cleaner_pay_type text,
  add column if not exists cleaner_hourly_rate numeric(10,2),
  add column if not exists cleaner_flat_rate numeric(10,2),
  add column if not exists supply_delivery_date date,
  add column if not exists estimated_fill_date text;

alter table public.commercial_accounts enable row level security;

drop policy if exists "Commercial accounts are readable by signed in users" on public.commercial_accounts;
create policy "Commercial accounts are readable by signed in users"
  on public.commercial_accounts for select
  using (auth.uid() is not null);

drop policy if exists "Commercial accounts are editable by signed in users" on public.commercial_accounts;
create policy "Commercial accounts are editable by signed in users"
  on public.commercial_accounts for all
  using (auth.uid() is not null and (user_id is null or auth.uid() = user_id))
  with check (auth.uid() is not null and (user_id is null or auth.uid() = user_id));

-- Payroll tables for commercial cleaning (additive, non-destructive)
create table if not exists public.commercial_pay_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  label text,
  status text not null default 'draft',
  total_estimated_hours numeric(10,2) default 0,
  total_adjusted_hours numeric(10,2) default 0,
  total_estimated_amount numeric(12,2) default 0,
  total_final_amount numeric(12,2) default 0,
  generated_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  locked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commercial_pay_periods enable row level security;

drop policy if exists "Pay periods are readable by signed in users" on public.commercial_pay_periods;
create policy "Pay periods are readable by signed in users"
  on public.commercial_pay_periods for select
  using (auth.uid() is not null);

drop policy if exists "Pay periods are editable by owners" on public.commercial_pay_periods;
create policy "Pay periods are editable by owners"
  on public.commercial_pay_periods for all
  using (auth.uid() is not null and (user_id is null or auth.uid() = user_id))
  with check (auth.uid() is not null and (user_id is null or auth.uid() = user_id));

create table if not exists public.commercial_payroll_entries (
  id uuid primary key default gen_random_uuid(),
  pay_period_id uuid not null references public.commercial_pay_periods(id) on delete cascade,
  cleaner_name text,
  cleaner_id uuid,
  account_id uuid,
  account_name text,
  city text,
  service_date date,
  scheduled_day text,
  base_hours numeric(8,2) default 0,
  adjusted_hours numeric(8,2) default 0,
  pay_rate numeric(10,2) default 0,
  estimated_amount numeric(12,2) default 0,
  adjustment_amount numeric(12,2) default 0,
  final_amount numeric(12,2) default 0,
  status text default 'draft',
  requires_manual_review boolean default false,
  review_notes text,
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commercial_payroll_entries enable row level security;

drop policy if exists "Payroll entries are readable by signed in users" on public.commercial_payroll_entries;
create policy "Payroll entries are readable by signed in users"
  on public.commercial_payroll_entries for select
  using (auth.uid() is not null);

drop policy if exists "Payroll entries are editable by owners" on public.commercial_payroll_entries;
create policy "Payroll entries are editable by owners"
  on public.commercial_payroll_entries for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create table if not exists public.commercial_payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  pay_period_id uuid not null references public.commercial_pay_periods(id) on delete cascade,
  payroll_entry_id uuid references public.commercial_payroll_entries(id) on delete set null,
  cleaner_name text,
  account_id uuid,
  adjustment_type text,
  hours_delta numeric(8,2) default 0,
  amount_delta numeric(12,2) default 0,
  reason text,
  internal_note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.commercial_payroll_adjustments enable row level security;

create table if not exists public.cleaner_payment_settings (
  id uuid primary key default gen_random_uuid(),
  cleaner_name text,
  cleaner_id uuid,
  default_pay_type text,
  default_pay_rate numeric(10,2),
  payment_method text,
  requires_manual_review boolean default false,
  manual_review_reason text,
  active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cleaner_payment_settings enable row level security;

create table if not exists public.commercial_account_schedule_rules (
  id uuid primary key default gen_random_uuid(),
  commercial_account_id uuid references public.commercial_accounts(id) on delete cascade,
  day_of_week integer,
  start_time time,
  end_time time,
  paid_hours numeric(6,2) default 0,
  assigned_cleaner_name text,
  active boolean default true,
  effective_start_date date,
  effective_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commercial_account_schedule_rules enable row level security;

create table if not exists public.payroll_audit_log (
  id uuid primary key default gen_random_uuid(),
  pay_period_id uuid references public.commercial_pay_periods(id) on delete cascade,
  entity_type text,
  entity_id uuid,
  action text,
  old_value text,
  new_value text,
  changed_by uuid,
  created_at timestamptz not null default now()
);

alter table public.payroll_audit_log enable row level security;


-- Commercial payroll hardening 2026-05-14
alter table public.commercial_pay_periods
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists total_adjusted_hours numeric(10,2) default 0;

alter table public.commercial_payroll_entries
  add column if not exists review_status text default 'pending',
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists notes text,
  add column if not exists payment_method text,
  add column if not exists source text,
  add column if not exists exceptions text[] not null default '{}';

alter table public.commercial_payroll_adjustments
  add column if not exists updated_at timestamptz not null default now();

alter table public.cleaner_payment_settings
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists review_notes text,
  add column if not exists commercial_payroll_eligible boolean not null default true;

alter table public.commercial_account_schedule_rules
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists notes text,
  add column if not exists frequency_type text,
  add column if not exists frequency_interval integer,
  add column if not exists anchor_date date,
  add column if not exists scheduled_hours numeric(8,2),
  add column if not exists effective_from date,
  add column if not exists effective_until date;

-- frequency_type: weekly, biweekly, monthly, custom
-- frequency_interval: 1 for weekly, 2 for biweekly
-- anchor_date: required for biweekly calculations

create index if not exists commercial_pay_periods_window_idx
  on public.commercial_pay_periods(start_date, end_date, user_id);

create index if not exists commercial_payroll_entries_period_cleaner_idx
  on public.commercial_payroll_entries(pay_period_id, cleaner_name);

create index if not exists commercial_payroll_entries_period_account_idx
  on public.commercial_payroll_entries(pay_period_id, account_name);

create index if not exists commercial_payroll_adjustments_period_idx
  on public.commercial_payroll_adjustments(pay_period_id);

create index if not exists cleaner_payment_settings_name_idx
  on public.cleaner_payment_settings(cleaner_name);

create index if not exists commercial_account_schedule_rules_account_idx
  on public.commercial_account_schedule_rules(commercial_account_id, active, day_of_week);

create table if not exists public.commercial_hours_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  account_id uuid references public.commercial_accounts(id) on delete set null,
  account_name text not null,
  team_id uuid references public.staff_members(id) on delete set null,
  team_name text,
  work_date date not null,
  period_start date,
  period_end date,
  scheduled_day text,
  scheduled_hours numeric(8,2) not null default 0,
  completed_hours numeric(8,2) not null default 0,
  verified_hours numeric(8,2) not null default 0,
  status text not null default 'completed',
  verified boolean not null default false,
  paid_at timestamptz,
  notes text,
  manual_entry boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.commercial_hours_entries enable row level security;

drop policy if exists "Commercial hours are readable by signed in users" on public.commercial_hours_entries;
create policy "Commercial hours are readable by signed in users"
  on public.commercial_hours_entries for select
  using (auth.uid() is not null and deleted_at is null);

drop policy if exists "Commercial hours are editable by signed in users" on public.commercial_hours_entries;
create policy "Commercial hours are editable by signed in users"
  on public.commercial_hours_entries for all
  using (auth.uid() is not null and (user_id is null or auth.uid() = user_id))
  with check (auth.uid() is not null and (user_id is null or auth.uid() = user_id));

create index if not exists commercial_hours_entries_period_idx
  on public.commercial_hours_entries(work_date, status, account_id, team_id)
  where deleted_at is null;

drop policy if exists "Payroll adjustments are readable by signed in users" on public.commercial_payroll_adjustments;
create policy "Payroll adjustments are readable by signed in users"
  on public.commercial_payroll_adjustments for select
  using (auth.uid() is not null);

drop policy if exists "Payroll adjustments are editable by signed in users" on public.commercial_payroll_adjustments;
create policy "Payroll adjustments are editable by signed in users"
  on public.commercial_payroll_adjustments for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "Cleaner payment settings are readable by signed in users" on public.cleaner_payment_settings;
create policy "Cleaner payment settings are readable by signed in users"
  on public.cleaner_payment_settings for select
  using (auth.uid() is not null);

drop policy if exists "Cleaner payment settings are editable by signed in users" on public.cleaner_payment_settings;
create policy "Cleaner payment settings are editable by signed in users"
  on public.cleaner_payment_settings for all
  using (auth.uid() is not null and (user_id is null or auth.uid() = user_id))
  with check (auth.uid() is not null and (user_id is null or auth.uid() = user_id));

drop policy if exists "Commercial schedule rules are readable by signed in users" on public.commercial_account_schedule_rules;
create policy "Commercial schedule rules are readable by signed in users"
  on public.commercial_account_schedule_rules for select
  using (auth.uid() is not null);

drop policy if exists "Commercial schedule rules are editable by signed in users" on public.commercial_account_schedule_rules;
create policy "Commercial schedule rules are editable by signed in users"
  on public.commercial_account_schedule_rules for all
  using (auth.uid() is not null and (user_id is null or auth.uid() = user_id))
  with check (auth.uid() is not null and (user_id is null or auth.uid() = user_id));

drop policy if exists "Payroll audit is readable by signed in users" on public.payroll_audit_log;
create policy "Payroll audit is readable by signed in users"
  on public.payroll_audit_log for select
  using (auth.uid() is not null);

drop policy if exists "Payroll audit is writable by signed in users" on public.payroll_audit_log;
create policy "Payroll audit is writable by signed in users"
  on public.payroll_audit_log for insert
  with check (auth.uid() is not null);

insert into public.cleaner_payment_settings (
  cleaner_name,
  default_pay_type,
  default_pay_rate,
  payment_method,
  requires_manual_review,
  manual_review_reason,
  active
)
select
  'Lucia Portillo',
  'hourly',
  null,
  'ACH',
  true,
  'Confirm final commercial hours before approval.',
  true
where not exists (
  select 1 from public.cleaner_payment_settings
  where lower(cleaner_name) = 'lucia portillo'
);

update public.staff_members
set
  role = 'Mixed Route Cleaner',
  display_role = 'Mixed Route Cleaner',
  team_scope = 'mixed',
  commercial_payroll_eligible = false,
  updated_at = now()
where lower(name) in ('juan romero', 'esperanza youseff', 'esperanza yoseff', 'lorena benitez');

update public.staff_members
set
  display_role = 'Operations Manager',
  team_scope = 'global',
  commercial_payroll_eligible = false,
  updated_at = now()
where lower(name) = 'carlos lopez';

update public.staff_members
set
  display_role = 'Owner',
  team_scope = 'global',
  commercial_payroll_eligible = false,
  updated_at = now()
where lower(name) = 'jake ivan-pal';

update public.staff_members
set
  display_role = coalesce(display_role, role),
  team_scope = 'residential',
  commercial_payroll_eligible = false,
  updated_at = now()
where lower(name) not in ('juan romero', 'esperanza youseff', 'esperanza yoseff', 'lorena benitez', 'carlos lopez', 'jake ivan-pal')
  and role in ('Residential Cleaner', 'Deep Cleaning Specialist', 'Move In/Move Out Cleaner');

update public.staff_members
set
  display_role = coalesce(display_role, role),
  team_scope = 'commercial',
  commercial_payroll_eligible = true,
  updated_at = now()
where lower(name) not in ('juan romero', 'esperanza youseff', 'esperanza yoseff', 'lorena benitez', 'carlos lopez', 'jake ivan-pal')
  and role in ('Commercial Cleaner', 'Janitorial Cleaner', 'Day Porter', 'Office Cleaning Crew', 'Restaurant Cleaning Crew', 'Post Construction Crew', 'Commercial Supervisor', 'Account Manager');

update public.cleaner_payment_settings
set
  commercial_payroll_eligible = false,
  requires_manual_review = true,
  manual_review_reason = 'Mixed route · Not in commercial payroll.',
  review_notes = 'Visible in commercial operations, excluded from commercial payroll payouts.',
  updated_at = now()
where lower(cleaner_name) in ('juan romero', 'esperanza youseff', 'esperanza yoseff', 'lorena benitez');


-- Simplified residential operations scope 2026-05-20
-- Additive residential tables for recurring accounts, worked hours, and weekly payments.
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

alter table public.residential_recurring_cleaning_accounts
  add column if not exists city text,
  add column if not exists custom_city text;

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

alter table public.residential_weekly_payment_rows
  add column if not exists payment_mode text,
  add column if not exists custom_city text,
  add column if not exists verified_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

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


-- Unified payments progressive migration 2026-05-14
alter table public.payment_entries
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists pay_period_id uuid references public.commercial_pay_periods(id) on delete set null,
  add column if not exists account_id uuid,
  add column if not exists account_name text,
  add column if not exists category text,
  add column if not exists payment_type text,
  add column if not exists base_hours numeric(10,2),
  add column if not exists adjusted_hours numeric(10,2),
  add column if not exists pay_rate numeric(10,2),
  add column if not exists adjustment_amount numeric(12,2),
  add column if not exists final_amount numeric(12,2),
  add column if not exists status text,
  add column if not exists requires_review boolean default false,
  add column if not exists review_status text,
  add column if not exists payment_method text,
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists paid_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists notes text;

alter table public.payment_extras
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists category text,
  add column if not exists payment_type text,
  add column if not exists status text,
  add column if not exists paid_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists notes text,
  add column if not exists payment_method text;

create index if not exists payment_entries_source_idx
  on public.payment_entries(source_type, source_id);

create index if not exists payment_entries_pay_period_idx
  on public.payment_entries(pay_period_id);

create index if not exists payment_entries_status_idx
  on public.payment_entries(status);

create index if not exists payment_entries_category_idx
  on public.payment_entries(category);

create index if not exists payment_extras_source_idx
  on public.payment_extras(source_type, source_id);

alter table public.residential_weekly_payment_rows
  add column if not exists payment_mode text;

-- Commercial operations separation hardening 2026-05-15 (additive, non-destructive)
-- Schedule multi-day selection is stored as one row per day so existing payroll logic remains compatible.
create unique index if not exists payment_entries_commercial_payroll_source_uidx
  on public.payment_entries(source_type, source_id)
  where source_type = 'commercial_payroll' and source_id is not null;

create index if not exists commercial_payroll_entries_service_date_idx
  on public.commercial_payroll_entries(service_date, status);

create index if not exists commercial_payroll_entries_natural_open_idx
  on public.commercial_payroll_entries(pay_period_id, account_name, cleaner_name, service_date, source)
  where status not in ('approved', 'paid', 'locked');


-- Operations role access and task notifications 2026-05-15
alter table public.profiles
  add column if not exists username text,
  add column if not exists app_role text not null default 'residential',
  add column if not exists access_scope text not null default 'residential';

create unique index if not exists profiles_username_uidx
  on public.profiles(lower(username))
  where username is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, username, app_role, access_scope)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    case
      when lower(new.email) = 'pristinecleaners@pristine.local' then 'pristinecleaners'
      when lower(new.email) = 'pristinejanitorial@pristine.local' then 'pristinejanitorial'
      when lower(new.email) = 'pristineseo@pristine.local' then 'pristineseo'
      else null
    end,
    case
      when lower(new.email) = 'pristinejanitorial@pristine.local' then 'commercial'
      when lower(new.email) = 'pristineseo@pristine.local' then 'seo'
      else 'residential'
    end,
    case
      when lower(new.email) = 'pristinejanitorial@pristine.local' then 'commercial'
      when lower(new.email) = 'pristineseo@pristine.local' then 'seo'
      else 'residential'
    end
  )
  on conflict (id) do update set
    username = coalesce(excluded.username, public.profiles.username),
    app_role = excluded.app_role,
    access_scope = excluded.access_scope,
    updated_at = now();
  return new;
end;
$$;

-- SEO operations panel 2026-05-19

update public.profiles p
set username = 'pristinecleaners',
    app_role = 'residential',
    access_scope = 'residential',
    updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = 'pristinecleaners@pristine.local';

update public.profiles p
set username = 'pristinejanitorial',
    app_role = 'commercial',
    access_scope = 'commercial',
    updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = 'pristinejanitorial@pristine.local';

update public.profiles p
set username = 'pristineseo',
    full_name = coalesce(nullif(p.full_name, ''), 'Pristine SEO'),
    app_role = 'seo',
    access_scope = 'seo',
    updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = 'pristineseo@pristine.local';

alter table public.operation_tasks
  add column if not exists assigned_by text,
  add column if not exists account_name text,
  add column if not exists property_address text,
  add column if not exists panel text not null default 'Residential',
  add column if not exists completion_notes text,
  add column if not exists completed_at timestamptz,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists completed_by uuid references auth.users(id) on delete set null,
  add column if not exists business_unit text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists deleted_at timestamptz;

create index if not exists operation_tasks_panel_status_idx
  on public.operation_tasks(panel, status, due_date);

create index if not exists operation_tasks_assigned_to_idx
  on public.operation_tasks(assigned_to);

create index if not exists operation_tasks_deleted_at_idx
  on public.operation_tasks(deleted_at);

drop policy if exists "SEO tasks are readable by SEO and owners" on public.operation_tasks;
create policy "SEO tasks are readable by SEO and owners"
  on public.operation_tasks for select
  using (
    lower(panel) = 'seo'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.app_role in ('seo', 'owner', 'admin')
    )
  );

drop policy if exists "SEO tasks are editable by SEO and owners" on public.operation_tasks;
create policy "SEO tasks are editable by SEO and owners"
  on public.operation_tasks for all
  using (
    lower(panel) = 'seo'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.app_role in ('seo', 'owner', 'admin')
    )
  )
  with check (
    lower(panel) = 'seo'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.app_role in ('seo', 'owner', 'admin')
    )
  );

create table if not exists public.operation_task_audit_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.operation_tasks(id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.operation_task_audit_log enable row level security;

drop policy if exists "Operation task audit is readable by signed in users" on public.operation_task_audit_log;
create policy "Operation task audit is readable by signed in users"
  on public.operation_task_audit_log for select
  using (auth.uid() is not null);

drop policy if exists "Operation task audit is writable by signed in users" on public.operation_task_audit_log;
create policy "Operation task audit is writable by signed in users"
  on public.operation_task_audit_log for insert
  with check (auth.uid() is not null);

create table if not exists public.operation_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.operation_tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null default 'Pristine Operations',
  body text not null,
  internal boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.operation_task_comments enable row level security;

create index if not exists operation_task_comments_task_created_idx
  on public.operation_task_comments(task_id, created_at);

drop policy if exists "Operation task comments readable by task viewers" on public.operation_task_comments;
create policy "Operation task comments readable by task viewers"
  on public.operation_task_comments for select
  using (
    exists (
      select 1 from public.operation_tasks t
      where t.id = task_id
        and (
          t.user_id = auth.uid()
          or (
            lower(t.panel) = 'seo'
            and exists (
              select 1 from public.profiles p
              where p.id = auth.uid()
                and p.app_role in ('seo', 'owner', 'admin')
            )
          )
        )
    )
  );

drop policy if exists "Operation task comments writable by task viewers" on public.operation_task_comments;
create policy "Operation task comments writable by task viewers"
  on public.operation_task_comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.operation_tasks t
      where t.id = task_id
        and (
          t.user_id = auth.uid()
          or (
            lower(t.panel) = 'seo'
            and exists (
              select 1 from public.profiles p
              where p.id = auth.uid()
                and p.app_role in ('seo', 'owner', 'admin')
            )
          )
        )
    )
  );

create table if not exists public.operation_task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.operation_tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_url text,
  file_type text,
  file_size integer,
  uploaded_by text not null default 'Pristine Operations',
  created_at timestamptz not null default now()
);

alter table public.operation_task_attachments enable row level security;

create index if not exists operation_task_attachments_task_created_idx
  on public.operation_task_attachments(task_id, created_at);

drop policy if exists "Operation task attachments readable by task viewers" on public.operation_task_attachments;
create policy "Operation task attachments readable by task viewers"
  on public.operation_task_attachments for select
  using (
    exists (
      select 1 from public.operation_tasks t
      where t.id = task_id
        and (
          t.user_id = auth.uid()
          or (
            lower(t.panel) = 'seo'
            and exists (
              select 1 from public.profiles p
              where p.id = auth.uid()
                and p.app_role in ('seo', 'owner', 'admin')
            )
          )
        )
    )
  );

drop policy if exists "Operation task attachments writable by task viewers" on public.operation_task_attachments;
create policy "Operation task attachments writable by task viewers"
  on public.operation_task_attachments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.operation_tasks t
      where t.id = task_id
        and (
          t.user_id = auth.uid()
          or (
            lower(t.panel) = 'seo'
            and exists (
              select 1 from public.profiles p
              where p.id = auth.uid()
                and p.app_role in ('seo', 'owner', 'admin')
            )
          )
        )
    )
  );

drop policy if exists "Operation task attachments deletable by uploader or owners" on public.operation_task_attachments;
create policy "Operation task attachments deletable by uploader or owners"
  on public.operation_task_attachments for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.app_role in ('owner', 'admin')
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seo-task-attachments',
  'seo-task-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "SEO task attachments storage readable by signed in users" on storage.objects;
create policy "SEO task attachments storage readable by signed in users"
  on storage.objects for select
  using (bucket_id = 'seo-task-attachments' and auth.uid() is not null);

drop policy if exists "SEO task attachments storage uploadable by signed in users" on storage.objects;
create policy "SEO task attachments storage uploadable by signed in users"
  on storage.objects for insert
  with check (bucket_id = 'seo-task-attachments' and auth.uid() is not null);

drop policy if exists "SEO task attachments storage deletable by signed in users" on storage.objects;
create policy "SEO task attachments storage deletable by signed in users"
  on storage.objects for delete
  using (bucket_id = 'seo-task-attachments' and auth.uid() is not null);

-- Residential monthly SOP recurring task templates 2026-05-18
create table if not exists public.operation_task_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  natural_key text not null,
  title text not null,
  description text,
  category text not null,
  frequency text not null default 'monthly',
  schedule_label text not null,
  preferred_due_timing text,
  week_scope text not null default 'general',
  week_of_month integer,
  day_of_week text,
  assigned_to text not null default 'Carlos Lopez',
  assigned_role text not null default 'Operations Manager',
  panel text not null default 'Residential',
  business_unit text not null default 'Pristine Cleaners / Residential',
  priority text not null default 'normal',
  status text not null default 'active',
  source text not null default 'monthly_sop',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.operation_task_templates enable row level security;

create unique index if not exists operation_task_templates_user_natural_key_uidx
  on public.operation_task_templates(user_id, natural_key);

create index if not exists operation_task_templates_residential_sop_idx
  on public.operation_task_templates(panel, source, status, week_scope, day_of_week);

drop policy if exists "Operation task templates are readable by owners" on public.operation_task_templates;
create policy "Operation task templates are readable by owners"
  on public.operation_task_templates for select
  using (auth.uid() is not null and (user_id is null or auth.uid() = user_id));

drop policy if exists "Operation task templates are editable by owners" on public.operation_task_templates;
create policy "Operation task templates are editable by owners"
  on public.operation_task_templates for all
  using (auth.uid() is not null and (user_id is null or auth.uid() = user_id))
  with check (auth.uid() is not null and (user_id is null or auth.uid() = user_id));

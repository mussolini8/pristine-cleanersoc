create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by owners"
  on public.profiles for select
  using (auth.uid() = id);

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

create policy "Staff members are readable by owners"
  on public.staff_members for select
  using (auth.uid() = user_id);

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

create policy "Commercial accounts are readable by signed in users"
  on public.commercial_accounts for select
  using (auth.uid() is not null);

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

create policy "Pay periods are readable by signed in users"
  on public.commercial_pay_periods for select
  using (auth.uid() is not null);

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

create policy "Payroll entries are readable by signed in users"
  on public.commercial_payroll_entries for select
  using (auth.uid() is not null);

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
  add column if not exists review_notes text;

alter table public.commercial_account_schedule_rules
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists notes text,
  add column if not exists frequency_type text,
  add column if not exists frequency_interval integer,
  add column if not exists anchor_date date;

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

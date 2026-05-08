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
  add column if not exists cleaner_flat_rate numeric(10,2);

alter table public.commercial_accounts enable row level security;

create policy "Commercial accounts are readable by signed in users"
  on public.commercial_accounts for select
  using (auth.uid() is not null);

create policy "Commercial accounts are editable by signed in users"
  on public.commercial_accounts for all
  using (auth.uid() is not null and (user_id is null or auth.uid() = user_id))
  with check (auth.uid() is not null and (user_id is null or auth.uid() = user_id));

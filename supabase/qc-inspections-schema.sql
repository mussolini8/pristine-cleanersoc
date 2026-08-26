-- ============================================================
-- PRISTINE CLEANERS — QC INSPECTION SUITE
-- Migration: qc-inspections-schema.sql
-- Run this entire script in: Supabase → SQL Editor → Run
-- Safe: uses CREATE TABLE IF NOT EXISTS
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. QC INSPECTORS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.qc_inspectors (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  name         text not null,
  email        text,
  phone        text,
  color        text not null default '#10b981',
  avatar_url   text,
  status       text not null default 'active',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.qc_inspectors enable row level security;

drop policy if exists "QC inspectors readable by signed in users" on public.qc_inspectors;
create policy "QC inspectors readable by signed in users"
  on public.qc_inspectors for select
  using (auth.uid() is not null);

drop policy if exists "QC inspectors editable by signed in users" on public.qc_inspectors;
create policy "QC inspectors editable by signed in users"
  on public.qc_inspectors for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create index if not exists qc_inspectors_status_idx
  on public.qc_inspectors(status);


-- ─────────────────────────────────────────────────────────────
-- 2. PROPERTY GEOFENCES
-- ─────────────────────────────────────────────────────────────
create table if not exists public.qc_property_geofences (
  id                    uuid primary key default gen_random_uuid(),
  commercial_account_id uuid references public.commercial_accounts(id) on delete cascade,
  account_name          text not null,
  address               text,
  latitude              numeric(10, 7) not null,
  longitude             numeric(10, 7) not null,
  radius_meters         integer not null default 75,
  active                boolean not null default true,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.qc_property_geofences enable row level security;

drop policy if exists "QC geofences readable by signed in users" on public.qc_property_geofences;
create policy "QC geofences readable by signed in users"
  on public.qc_property_geofences for select
  using (auth.uid() is not null);

drop policy if exists "QC geofences editable by signed in users" on public.qc_property_geofences;
create policy "QC geofences editable by signed in users"
  on public.qc_property_geofences for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create index if not exists qc_geofences_account_idx
  on public.qc_property_geofences(commercial_account_id, active);


-- ─────────────────────────────────────────────────────────────
-- 3. QC INSPECTION SCHEDULES (Flexible Frequency Engine)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.qc_inspection_schedules (
  id                    uuid primary key default gen_random_uuid(),
  inspector_id          uuid not null references public.qc_inspectors(id) on delete cascade,
  commercial_account_id uuid references public.commercial_accounts(id) on delete cascade,
  account_name          text not null,
  frequency_type        text not null default 'weekly',
  days_of_week          integer[],
  frequency_interval    integer default 1,
  anchor_date           date,
  specific_date         date,
  day_of_month          integer,
  scheduled_time        time,
  duration_minutes      integer default 60,
  effective_start_date  date,
  effective_end_date    date,
  notes                 text,
  active                boolean not null default true,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.qc_inspection_schedules enable row level security;

drop policy if exists "QC schedules editable by signed in users" on public.qc_inspection_schedules;
create policy "QC schedules editable by signed in users"
  on public.qc_inspection_schedules for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create index if not exists qc_schedules_inspector_idx
  on public.qc_inspection_schedules(inspector_id, active);

create index if not exists qc_schedules_account_idx
  on public.qc_inspection_schedules(commercial_account_id, active);


-- ─────────────────────────────────────────────────────────────
-- 4. QC INSPECTIONS (One per visit)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.qc_inspections (
  id                    uuid primary key default gen_random_uuid(),
  schedule_id           uuid references public.qc_inspection_schedules(id) on delete set null,
  inspector_id          uuid not null references public.qc_inspectors(id) on delete restrict,
  commercial_account_id uuid references public.commercial_accounts(id) on delete set null,
  account_name          text not null,
  check_in_at           timestamptz,
  check_out_at          timestamptz,
  check_in_latitude     numeric(10, 7),
  check_in_longitude    numeric(10, 7),
  check_out_latitude    numeric(10, 7),
  check_out_longitude   numeric(10, 7),
  score_percentage      numeric(5, 2),
  grade                 text,
  ai_executive_summary  text,
  inspector_notes       text,
  status                text not null default 'in_progress',
  inspector_signature_url text,
  client_signature_url    text,
  client_signed_at        timestamptz,
  pdf_url               text,
  pdf_generated_at      timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.qc_inspections enable row level security;

drop policy if exists "QC inspections readable by signed in users" on public.qc_inspections;
create policy "QC inspections readable by signed in users"
  on public.qc_inspections for select
  using (auth.uid() is not null);

drop policy if exists "QC inspections editable by signed in users" on public.qc_inspections;
create policy "QC inspections editable by signed in users"
  on public.qc_inspections for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create index if not exists qc_inspections_inspector_idx
  on public.qc_inspections(inspector_id, status, check_in_at desc);

create index if not exists qc_inspections_account_idx
  on public.qc_inspections(commercial_account_id, check_in_at desc);

create index if not exists qc_inspections_status_idx
  on public.qc_inspections(status, check_in_at desc);


-- ─────────────────────────────────────────────────────────────
-- 5. QC INSPECTION AREAS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.qc_inspection_areas (
  id               uuid primary key default gen_random_uuid(),
  inspection_id    uuid not null references public.qc_inspections(id) on delete cascade,
  area_name        text not null,
  area_order       integer default 0,
  weight           numeric(5, 2) default 1.0,
  score_percentage numeric(5, 2),
  status           text default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.qc_inspection_areas enable row level security;

drop policy if exists "QC areas readable by signed in users" on public.qc_inspection_areas;
create policy "QC areas readable by signed in users"
  on public.qc_inspection_areas for select
  using (auth.uid() is not null);

drop policy if exists "QC areas editable by signed in users" on public.qc_inspection_areas;
create policy "QC areas editable by signed in users"
  on public.qc_inspection_areas for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create index if not exists qc_areas_inspection_idx
  on public.qc_inspection_areas(inspection_id, area_order);


-- ─────────────────────────────────────────────────────────────
-- 6. QC CHECKLIST ITEMS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.qc_checklist_items (
  id                   uuid primary key default gen_random_uuid(),
  area_id              uuid not null references public.qc_inspection_areas(id) on delete cascade,
  inspection_id        uuid not null references public.qc_inspections(id) on delete cascade,
  item_label           text not null,
  item_order           integer default 0,
  rating               text default 'na',
  item_weight          numeric(5, 2) default 1.0,
  voice_note_raw       text,
  voice_note_ai        text,
  manual_note          text,
  severity             text default 'minor',
  photo_urls           text[],
  annotated_photo_urls text[],
  has_action_item      boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.qc_checklist_items enable row level security;

drop policy if exists "QC checklist items readable by signed in users" on public.qc_checklist_items;
create policy "QC checklist items readable by signed in users"
  on public.qc_checklist_items for select
  using (auth.uid() is not null);

drop policy if exists "QC checklist items editable by signed in users" on public.qc_checklist_items;
create policy "QC checklist items editable by signed in users"
  on public.qc_checklist_items for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create index if not exists qc_items_area_idx
  on public.qc_checklist_items(area_id, item_order);

create index if not exists qc_items_inspection_deficient_idx
  on public.qc_checklist_items(inspection_id, rating)
  where rating = 'deficient';


-- ─────────────────────────────────────────────────────────────
-- 7. QC ACTION ITEMS (Re-Work Tickets — email via Nodemailer)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.qc_action_items (
  id                    uuid primary key default gen_random_uuid(),
  inspection_id         uuid not null references public.qc_inspections(id) on delete cascade,
  checklist_item_id     uuid references public.qc_checklist_items(id) on delete set null,
  area_name             text not null,
  account_name          text not null,
  commercial_account_id uuid references public.commercial_accounts(id) on delete set null,
  inspector_id          uuid references public.qc_inspectors(id) on delete set null,
  description           text not null,
  severity              text not null default 'attention',
  photo_url             text,
  assigned_to_name      text,
  assigned_to_email     text,
  status                text not null default 'open',
  resolved_at           timestamptz,
  resolved_by           text,
  resolve_notes         text,
  email_sent_at         timestamptz,
  email_sent_to         text[],
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.qc_action_items enable row level security;

drop policy if exists "QC action items readable by signed in users" on public.qc_action_items;
create policy "QC action items readable by signed in users"
  on public.qc_action_items for select
  using (auth.uid() is not null);

drop policy if exists "QC action items editable by signed in users" on public.qc_action_items;
create policy "QC action items editable by signed in users"
  on public.qc_action_items for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create index if not exists qc_action_items_inspection_idx
  on public.qc_action_items(inspection_id, status);

create index if not exists qc_action_items_open_idx
  on public.qc_action_items(status, created_at desc)
  where status = 'open';


-- ─────────────────────────────────────────────────────────────
-- 8. QC CHECKLIST TEMPLATES + TEMPLATE AREAS + TEMPLATE ITEMS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.qc_checklist_templates (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  description           text,
  account_type          text,
  commercial_account_id uuid references public.commercial_accounts(id) on delete set null,
  is_default            boolean not null default false,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists public.qc_template_areas (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.qc_checklist_templates(id) on delete cascade,
  area_name    text not null,
  area_order   integer default 0,
  weight       numeric(5, 2) default 1.0,
  created_at   timestamptz not null default now()
);

create table if not exists public.qc_template_items (
  id               uuid primary key default gen_random_uuid(),
  template_area_id uuid not null references public.qc_template_areas(id) on delete cascade,
  item_label       text not null,
  item_order       integer default 0,
  item_weight      numeric(5, 2) default 1.0,
  created_at       timestamptz not null default now()
);

alter table public.qc_checklist_templates enable row level security;
alter table public.qc_template_areas enable row level security;
alter table public.qc_template_items enable row level security;

drop policy if exists "QC templates readable" on public.qc_checklist_templates;
create policy "QC templates readable"
  on public.qc_checklist_templates for select using (auth.uid() is not null);
drop policy if exists "QC templates editable" on public.qc_checklist_templates;
create policy "QC templates editable"
  on public.qc_checklist_templates for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "QC template areas readable" on public.qc_template_areas;
create policy "QC template areas readable"
  on public.qc_template_areas for select using (auth.uid() is not null);
drop policy if exists "QC template areas editable" on public.qc_template_areas;
create policy "QC template areas editable"
  on public.qc_template_areas for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "QC template items readable" on public.qc_template_items;
create policy "QC template items readable"
  on public.qc_template_items for select using (auth.uid() is not null);
drop policy if exists "QC template items editable" on public.qc_template_items;
create policy "QC template items editable"
  on public.qc_template_items for all
  using (auth.uid() is not null) with check (auth.uid() is not null);


-- ─────────────────────────────────────────────────────────────
-- 9. STORAGE BUCKET: qc-media
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('qc-media', 'qc-media', true)
on conflict (id) do nothing;

drop policy if exists "QC media is publicly readable" on storage.objects;
create policy "QC media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'qc-media');

drop policy if exists "QC media uploadable by signed in users" on storage.objects;
create policy "QC media uploadable by signed in users"
  on storage.objects for insert
  with check (bucket_id = 'qc-media' and auth.uid() is not null);

drop policy if exists "QC media deletable by signed in users" on storage.objects;
create policy "QC media deletable by signed in users"
  on storage.objects for delete
  using (bucket_id = 'qc-media' and auth.uid() is not null);


-- ─────────────────────────────────────────────────────────────
-- 10. SEED: DEFAULT COMMERCIAL OFFICE CHECKLIST TEMPLATE
-- ─────────────────────────────────────────────────────────────
do $$
declare
  v_template_id    uuid;
  v_area_lobby     uuid;
  v_area_restrooms uuid;
  v_area_kitchen   uuid;
  v_area_offices   uuid;
  v_area_hallways  uuid;
begin
  if not exists (
    select 1 from public.qc_checklist_templates
    where name = 'General Commercial Office'
  ) then

    insert into public.qc_checklist_templates (name, description, account_type, is_default)
    values ('General Commercial Office', 'Standard QC checklist for commercial office spaces.', 'commercial', true)
    returning id into v_template_id;

    -- LOBBY (weight 1.5)
    insert into public.qc_template_areas (template_id, area_name, area_order, weight)
    values (v_template_id, 'Main Lobby / Reception', 1, 1.5)
    returning id into v_area_lobby;

    insert into public.qc_template_items (template_area_id, item_label, item_order, item_weight) values
    (v_area_lobby, 'Floors swept and mopped', 1, 1.0),
    (v_area_lobby, 'Entrance glass doors clean and streak-free', 2, 1.0),
    (v_area_lobby, 'Reception desk dusted and wiped', 3, 1.0),
    (v_area_lobby, 'Trash emptied and bags replaced', 4, 1.0),
    (v_area_lobby, 'Furniture wiped and arranged properly', 5, 1.0),
    (v_area_lobby, 'High-touch surfaces disinfected (door handles, light switches)', 6, 1.2);

    -- RESTROOMS (weight 2.0)
    insert into public.qc_template_areas (template_id, area_name, area_order, weight)
    values (v_template_id, 'Restrooms', 2, 2.0)
    returning id into v_area_restrooms;

    insert into public.qc_template_items (template_area_id, item_label, item_order, item_weight) values
    (v_area_restrooms, 'Toilets scrubbed inside and outside', 1, 1.2),
    (v_area_restrooms, 'Mirrors polished and streak-free', 2, 1.0),
    (v_area_restrooms, 'Sinks scrubbed and faucets shined', 3, 1.0),
    (v_area_restrooms, 'Floors mopped and dried', 4, 1.0),
    (v_area_restrooms, 'Soap and paper towels restocked', 5, 1.0),
    (v_area_restrooms, 'Trash emptied and bags replaced', 6, 1.0),
    (v_area_restrooms, 'Air freshener present and functional', 7, 0.8);

    -- KITCHEN (weight 1.3)
    insert into public.qc_template_areas (template_id, area_name, area_order, weight)
    values (v_template_id, 'Kitchen / Break Room', 3, 1.3)
    returning id into v_area_kitchen;

    insert into public.qc_template_items (template_area_id, item_label, item_order, item_weight) values
    (v_area_kitchen, 'Countertops wiped and disinfected', 1, 1.0),
    (v_area_kitchen, 'Sink scrubbed clean', 2, 1.0),
    (v_area_kitchen, 'Microwave interior and exterior cleaned', 3, 1.0),
    (v_area_kitchen, 'Refrigerator exterior wiped', 4, 0.8),
    (v_area_kitchen, 'Trash emptied and bags replaced', 5, 1.0),
    (v_area_kitchen, 'Floor swept and mopped', 6, 1.0);

    -- OFFICES (weight 1.0)
    insert into public.qc_template_areas (template_id, area_name, area_order, weight)
    values (v_template_id, 'Private Offices / Workstations', 4, 1.0)
    returning id into v_area_offices;

    insert into public.qc_template_items (template_area_id, item_label, item_order, item_weight) values
    (v_area_offices, 'Desks and surfaces dusted', 1, 1.0),
    (v_area_offices, 'Floors vacuumed or swept', 2, 1.0),
    (v_area_offices, 'Trash emptied and bags replaced', 3, 1.0),
    (v_area_offices, 'Baseboards wiped', 4, 0.8),
    (v_area_offices, 'Windows and glass surfaces wiped', 5, 0.9);

    -- HALLWAYS (weight 1.0)
    insert into public.qc_template_areas (template_id, area_name, area_order, weight)
    values (v_template_id, 'Hallways & Common Areas', 5, 1.0)
    returning id into v_area_hallways;

    insert into public.qc_template_items (template_area_id, item_label, item_order, item_weight) values
    (v_area_hallways, 'Floors swept and mopped throughout', 1, 1.0),
    (v_area_hallways, 'Elevator interior and buttons wiped', 2, 1.0),
    (v_area_hallways, 'Stairwells swept', 3, 0.8),
    (v_area_hallways, 'Baseboards and corners dust-free', 4, 0.8);

  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- DONE ✅
-- Tables: qc_inspectors, qc_property_geofences,
--   qc_inspection_schedules, qc_inspections,
--   qc_inspection_areas, qc_checklist_items,
--   qc_action_items, qc_checklist_templates,
--   qc_template_areas, qc_template_items
-- Storage bucket: qc-media (public)
-- Default template seeded: "General Commercial Office"
-- ─────────────────────────────────────────────────────────────

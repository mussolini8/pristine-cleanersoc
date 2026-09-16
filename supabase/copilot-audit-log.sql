-- Copilot Action Audit Log
-- Records every action executed by the AI copilot with full payload, snapshot and result
create table if not exists public.copilot_action_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  conversation_id text,
  prompt text,
  action_type text,
  intent text,
  payload jsonb,
  snapshot_before jsonb,
  result text,
  success boolean not null default true,
  duration_ms integer,
  created_at timestamptz not null default now()
);

alter table public.copilot_action_log enable row level security;

drop policy if exists "Copilot log readable by signed in users" on public.copilot_action_log;
create policy "Copilot log readable by signed in users"
  on public.copilot_action_log for select
  using (auth.uid() is not null);

drop policy if exists "Copilot log writable by signed in users" on public.copilot_action_log;
create policy "Copilot log writable by signed in users"
  on public.copilot_action_log for insert
  with check (auth.uid() is not null);

create index if not exists copilot_action_log_created_idx
  on public.copilot_action_log(created_at desc);

create index if not exists copilot_action_log_conversation_idx
  on public.copilot_action_log(conversation_id)
  where conversation_id is not null;

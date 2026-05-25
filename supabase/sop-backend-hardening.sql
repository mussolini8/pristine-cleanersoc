-- Pristine Cleaners SOP backend hardening
-- Additive only: no drops, no destructive renames, no data deletion.

create index if not exists operation_tasks_status_due_idx
  on public.operation_tasks(status, due_date)
  where deleted_at is null;

create index if not exists operation_tasks_priority_idx
  on public.operation_tasks(priority)
  where deleted_at is null;

create index if not exists operation_tasks_created_at_idx
  on public.operation_tasks(created_at desc);

create index if not exists residential_weekly_payment_rows_status_period_idx
  on public.residential_weekly_payment_rows(status, week_start, week_end)
  where deleted_at is null;

create index if not exists residential_weekly_payment_rows_cleaner_date_idx
  on public.residential_weekly_payment_rows(cleaner_id, work_date)
  where deleted_at is null;

create index if not exists commercial_hours_entries_account_date_idx
  on public.commercial_hours_entries(account_id, work_date)
  where deleted_at is null;

create index if not exists commercial_hours_entries_team_date_idx
  on public.commercial_hours_entries(team_id, work_date)
  where deleted_at is null;

create index if not exists commercial_hours_entries_status_period_idx
  on public.commercial_hours_entries(status, period_start, period_end)
  where deleted_at is null;

create index if not exists commercial_hours_entries_source_idx
  on public.commercial_hours_entries(manual_entry, work_date)
  where deleted_at is null;

create index if not exists commercial_schedule_rules_effective_idx
  on public.commercial_account_schedule_rules(commercial_account_id, active, effective_start_date, effective_end_date);

create index if not exists commercial_schedule_rules_effective_alias_idx
  on public.commercial_account_schedule_rules(commercial_account_id, active, effective_from, effective_until);

create index if not exists staff_members_role_status_idx
  on public.staff_members(role, status)
  where deleted_at is null;

create index if not exists staff_members_scope_status_idx
  on public.staff_members(team_scope, status)
  where deleted_at is null;

create index if not exists payroll_audit_log_entity_created_idx
  on public.payroll_audit_log(entity_type, entity_id, created_at desc);

create index if not exists payroll_audit_log_actor_created_idx
  on public.payroll_audit_log(changed_by, created_at desc);

create index if not exists operation_task_audit_log_task_created_idx
  on public.operation_task_audit_log(task_id, created_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'operation_tasks_valid_status_chk') then
    alter table public.operation_tasks
      add constraint operation_tasks_valid_status_chk
      check (status in ('todo', 'pending', 'in_progress', 'done', 'completed', 'cancelled'))
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'operation_tasks_valid_priority_chk') then
    alter table public.operation_tasks
      add constraint operation_tasks_valid_priority_chk
      check (priority in ('low', 'normal', 'high', 'urgent'))
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'operation_tasks_completed_at_status_chk') then
    alter table public.operation_tasks
      add constraint operation_tasks_completed_at_status_chk
      check (completed_at is null or status in ('done', 'completed'))
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'residential_payment_rows_amounts_chk') then
    alter table public.residential_weekly_payment_rows
      add constraint residential_payment_rows_amounts_chk
      check (
        payment_amount >= 0
        and residential_amount >= 0
        and commercial_amount >= 0
        and (
          (coalesce(payment_mode, 'residential_only') = 'mixed' and residential_amount + commercial_amount > 0)
          or (coalesce(payment_mode, 'residential_only') <> 'mixed' and payment_amount > 0)
        )
      )
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'residential_payment_rows_valid_status_chk') then
    alter table public.residential_weekly_payment_rows
      add constraint residential_payment_rows_valid_status_chk
      check (status in ('pending', 'verified', 'needs_review', 'paid', 'no_jobs'))
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'commercial_hours_positive_hours_chk') then
    alter table public.commercial_hours_entries
      add constraint commercial_hours_positive_hours_chk
      check (scheduled_hours >= 0 and completed_hours >= 0 and verified_hours >= 0)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'commercial_hours_valid_status_chk') then
    alter table public.commercial_hours_entries
      add constraint commercial_hours_valid_status_chk
      check (status in ('scheduled', 'completed', 'verified', 'pending_payment', 'paid', 'needs_review', 'skipped'))
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'commercial_hours_paid_verified_chk') then
    alter table public.commercial_hours_entries
      add constraint commercial_hours_paid_verified_chk
      check (status <> 'paid' or verified is true)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'staff_members_valid_scope_chk') then
    alter table public.staff_members
      add constraint staff_members_valid_scope_chk
      check (team_scope is null or team_scope in ('residential', 'commercial', 'mixed', 'global'))
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'staff_members_valid_payment_mode_chk') then
    alter table public.staff_members
      add constraint staff_members_valid_payment_mode_chk
      check (payment_mode in ('residential_only', 'mixed'))
      not valid;
  end if;
end $$;

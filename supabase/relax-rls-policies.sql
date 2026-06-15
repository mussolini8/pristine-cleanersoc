-- Relax RLS policies to allow both manager accounts (pristinecleaners and pristinejanitorial)
-- to view, edit, or delete operations data regardless of which manager account created them.

-- 1. Residential Weekly Payment Rows
drop policy if exists "Residential weekly payment rows are editable by owners" on public.residential_weekly_payment_rows;
create policy "Residential weekly payment rows are editable by owners"
  on public.residential_weekly_payment_rows for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- 2. Residential Work Logs
drop policy if exists "Residential work logs are editable by owners" on public.residential_work_logs;
create policy "Residential work logs are editable by owners"
  on public.residential_work_logs for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- 3. Residential Weekly Payments
drop policy if exists "Residential weekly payments are editable by owners" on public.residential_weekly_payments;
create policy "Residential weekly payments are editable by owners"
  on public.residential_weekly_payments for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- 4. Staff Members (Reading & Editing)
drop policy if exists "Staff members are readable by owners" on public.staff_members;
create policy "Staff members are readable by signed in users"
  on public.staff_members for select
  using (auth.uid() is not null);

drop policy if exists "Staff members are editable by owners" on public.staff_members;
create policy "Staff members are editable by owners"
  on public.staff_members for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- 5. Residential Recurring Cleaning Accounts
drop policy if exists "Residential recurring accounts are editable by owners" on public.residential_recurring_cleaning_accounts;
create policy "Residential recurring accounts are editable by owners"
  on public.residential_recurring_cleaning_accounts for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- 6. Operation Tasks
drop policy if exists "Tasks are editable by owners" on public.operation_tasks;
create policy "Tasks are editable by all signed in users"
  on public.operation_tasks for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- 7. Commercial Accounts
drop policy if exists "Commercial accounts are editable by signed in users" on public.commercial_accounts;
create policy "Commercial accounts are editable by all signed in users"
  on public.commercial_accounts for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- 8. Commercial Pay Periods
drop policy if exists "Pay periods are editable by owners" on public.commercial_pay_periods;
create policy "Commercial pay periods are editable by all signed in users"
  on public.commercial_pay_periods for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- 9. Commercial Hours Logged
drop policy if exists "Commercial hours are editable by signed in users" on public.commercial_hours_entries;
create policy "Commercial hours are editable by all signed in users"
  on public.commercial_hours_entries for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- 10. Commercial Schedule Rules
drop policy if exists "Commercial schedule rules are editable by signed in users" on public.commercial_account_schedule_rules;
create policy "Commercial schedule rules are editable by all signed in users"
  on public.commercial_account_schedule_rules for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

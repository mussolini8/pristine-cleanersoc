-- Relax RLS policies to allow both manager accounts (pristinecleaners and pristinejanitorial)
-- to edit or delete operations data regardless of which manager account created them.

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

-- 4. Staff Members
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

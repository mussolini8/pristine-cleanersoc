# Simplified Operations Scope

## Product Direction

Pristine Cleaners is now focused on a simple residential operations tool:

- Dashboard
- Task Reminders
- Residential Hours / Payments
- Staff / Teams
- Reports
- Settings

The active product is an Operations Reminder + Residential Weekly Payments Tracker for Jake Ivan-Pal and Carlos Lopez.

## Active Modules

### Dashboard

Shows the operating snapshot for residential work:

- Tasks due today
- Overdue tasks
- Completed tasks this week
- Active residential accounts
- Weekly and monthly scheduled hours
- This week worked hours
- Pending residential payments

### Task Reminders

Simple reminders assigned only to:

- Jake Ivan-Pal, Owner
- Carlos Lopez, Operations Manager

Tasks support due dates, frequency, completion, soft deletion, notifications, and activity logs.

### Residential Hours / Payments

Tracks:

- Residential recurring cleaning accounts
- Scheduled hours and frequency
- Approximate weekly, biweekly, and monthly hours
- Work logs by account and team
- Weekly payment calculations by team

### Staff / Teams

Tracks residential teams and cleaners with hourly rates, active/inactive status, logged hours, and paid totals.

### Reports

Exports XLSX reports for:

- Tasks
- Hours
- Weekly residential payments

### Settings

Shows safe configured/missing status for:

- OWNER_EMAIL
- OPERATIONS_MANAGER_EMAIL
- GMAIL_USER
- GMAIL_APP_PASSWORD
- APP_BASE_URL

Secret values are never displayed.

## Legacy Hidden Scope

The following areas are no longer visible in primary navigation:

- Commercial accounts
- Commercial payroll
- Commercial account editing
- Commercial schedule pay rules
- SEO dashboard
- SEO Kanban
- SEO task panel
- Legacy commercial payment views
- Calendar route as a standalone module

## Legacy Routes

These routes remain in the codebase for data safety, but are no longer part of the active product experience:

- `/commercial`
- `/commercial/accounts`
- `/commercial/payroll`
- `/commercial/payroll/[id]`
- `/payments/commercial-payroll`
- `/payments/commercial-payroll/[id]`
- `/seo`
- `/seo/kanban`
- `/seo/tasks`
- `/calendar`

Current behavior:

- Commercial and SEO route trees redirect to `/dashboard`.
- `/calendar` redirects to `/tasks`.
- `/payments` redirects to `/residential?tab=weekly_payments`.

## Data Safety

This simplification is non-destructive:

- Commercial and SEO tables are not dropped.
- Legacy source files are not bulk-deleted.
- New residential tables are additive.
- Task and residential deletes use `deleted_at` soft deletion.
- Existing paid/locked commercial data is not recalculated or modified.

## Hour Calculations

Residential scheduled hours use the requested approximation:

- Weekly: monthly = scheduled hours x 4.33
- Every 2 weeks: monthly = scheduled hours x 2.165
- Every 3 weeks: monthly = scheduled hours x 1.44
- Monthly: monthly = scheduled hours

This is intentionally simple and readable for operations. A future phase can add exact date-based month calculations if Jake wants it.

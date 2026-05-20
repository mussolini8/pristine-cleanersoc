# Unified Operations Panel

Pristine Cleaners now treats Residential and Commercial as business units inside one operations workspace instead of separate products.

## Primary Navigation

- `/dashboard` - unified command center
- `/tasks` - unified task board
- `/calendar` - central operational calendar
- `/payments` - calendar-first payments and payroll review
- `/staff` - unified staff directory
- `/reports` - report preview with XLSX/PDF exports
- `/settings` - app, notification, task, staff, payment, export, and security settings

## Business Unit Selector

Operational modules expose a segmented selector:

- Residential
- Commercial
- Both

The selector is backed by the URL query param:

- `?unit=residential`
- `?unit=commercial`
- `?unit=both`

Users only see units allowed by their role. Residential-only users do not get Commercial/Both controls. Commercial-only users do not get Residential/Both controls. Owner, Admin, and Operations Manager roles can see both units.

Every combined view uses badges so Residential and Commercial records remain visually separate.

## Legacy Routes

Legacy routes remain compatible through redirects or aliases:

- `/residential` redirects to `/dashboard?unit=residential`
- `/commercial` redirects to `/dashboard?unit=commercial`
- `/commercial/payroll` redirects to `/payments?unit=commercial`
- `/payments/commercial-payroll` redirects to `/payments?unit=commercial`
- `/commercial/accounts` remains available for account administration
- `/commercial/payroll/[id]` remains available for existing payroll-period detail links

## Dashboard

The dashboard combines:

- tasks due today
- overdue tasks
- completed tasks in the selected period
- scheduled commercial account work
- residential SOP rhythm
- pending payment value
- review alerts
- active staff

The “Today’s Operations” section merges tasks, payments, and SOP reminders for the selected business unit.

## Tasks

`/tasks` uses one Kanban board for operational work:

- Backlog
- To Do
- In Progress
- Waiting Review
- Completed

Cards show business unit, category, priority, assignee, due date, notification state, comments, attachments, and completion action. Task detail supports comments, evidence uploads, notification controls, completion notes context, and activity log display.

SEO tasks remain logically separate and are visible only to SEO-capable users through existing SEO access rules.

## Calendar

`/calendar` shows tasks, payment events, commercial payroll/payment work, commercial account schedule context, and SOP templates. It supports:

- Month
- Week
- Day
- Agenda

Events include type, business unit badge, status, assignee/person, date, and account or schedule context.

## Payments

`/payments` is now calendar-first. It supports:

- Residential payment entries
- Manual extras
- Commercial payroll payment entries
- Commercial payroll rows not yet synced into payments

Filters include status, cleaner/team, account/client, source, needs review, business unit, and date range.

Commercial payroll does not appear in Residential-only mode. Residential payments do not appear in Commercial-only mode. Both mode combines records with clear badges.

Approved, paid, and locked payroll/payment records are not recalculated by this unified view. Paid/locked records cannot be marked paid again from the calendar.

## Staff

`/staff` separates team views:

- Residential Team
- Commercial Team
- Operations / Admin
- SEO / Marketing when present

Mixed-route staff appear with a Both badge. Carlos Lopez is treated as Operations Manager. Jake Ivan-Pal is treated as Owner. Commercial payroll eligibility remains protected by existing staff rules.

## Reports

`/reports` supports:

- Task completion report
- Overdue tasks report
- Payments report
- Commercial payroll report
- Residential payments report
- Staff activity report
- Cleaner performance report
- Monthly SOP completion report
- Needs review report
- Revenue / payment summary

Exports use:

- XLSX via `xlsx`
- PDF via `jspdf`

Filenames follow:

- `pristine-report-{type}-{unit}-{date}.xlsx`
- `pristine-report-{type}-{unit}-{date}.pdf`

The screen shows a preview with total rows, date range, unit, report type, and export actions before download.

## Settings

Settings show:

- general app/company defaults
- notifications configured/missing status
- task defaults
- staff roles and units
- payment lock/approval explanation
- export defaults
- role and route access summary

Secrets are never displayed. Environment variables are shown only as Configured or Missing.

## Permissions

The unified panel does not grant new data access. It only changes navigation and presentation.

- Residential users see Residential unit data.
- Commercial users see Commercial unit data.
- Owner/Admin/Operations Manager users can see Both.
- SEO users keep SEO access through the SEO panel and task access rules.
- Existing Supabase RLS and route guards remain the source of truth.

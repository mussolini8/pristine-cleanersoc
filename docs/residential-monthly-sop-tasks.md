# Residential Monthly SOP Tasks

## Overview

The Residential panel stores the Monthly SOP as recurring task templates in `operation_task_templates`.
These are product data, not only documentation. The dashboard calls `/api/residential-sop/seed` to seed and refresh them idempotently for the signed-in Residential user, and the CLI seed can do the same for a selected user.

## Assignment

All templates are assigned to Carlos Lopez:

- Name: Carlos Lopez
- Role: Operations Manager
- Internal role: `operations_manager`
- Panel/team: Residential operations
- Email source for CLI seed: `OPERATIONS_MANAGER_EMAIL`

The current `operation_tasks` model stores task assignees by name, so templates use `assigned_to = "Carlos Lopez"` and `assigned_role = "Operations Manager"`. The seed script also creates or updates the matching `staff_members` row for Carlos Lopez when it has an authenticated user context.

## Categories

New SOP templates use only these categories:

- Billing
- Billing / Reporting
- Client Follow-Up
- Cleaner Coordination
- Quality Control
- Inventory
- Marketing
- Reporting
- Admin / CRM

`Janitorial` is not used for new Residential SOP task categories. If historical data contains `Janitorial`, it should remain legacy-only and should not be used for new templates.

## Frequency Mapping

The SOP data lives in `src/data/residential-sop-tasks.json`.

- Monthly general priorities: first week, third Wednesday, last week, and Week 4 Friday tasks.
- Weekly Friday work: geofence tracking report and Jake summary templates.
- Week 1: Tuesday client/team setup, Thursday marketing/messages, Friday reporting.
- Week 2: Tuesday QC/client opportunities, Wednesday inventory, Thursday staffing/marketing/messages, Friday reporting.
- Week 3: Wednesday cleaner check-ins, Thursday marketing/messages, Friday reporting.
- Week 4: Wednesday inventory, Thursday marketing/messages, Friday billing/reporting/month-end/admin.

Important schedule labels include:

- `Every Friday`
- `Week 1 Tuesday`
- `Week 2 Wednesday`
- `3rd Wednesday of every month`
- `Week 4 Friday / last Friday of the month`

## Idempotency

Templates use a stable natural key:

`residential + sop_monthly + week_scope + day_of_week + normalized_task_title + assigned_to_carlos`

The database enforces this with:

`operation_task_templates_user_natural_key_uidx`

Running the UI seed or CLI seed repeatedly updates existing templates instead of creating duplicates.

## Seed Command

Run:

```bash
npm run seed:residential-sop
```

The script requires one of these authentication modes:

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_SEED_USER_ID=...
```

or:

```bash
SEED_USER_EMAIL=... SEED_USER_PASSWORD=...
```

The Route Handler and CLI seed both read `OPERATIONS_MANAGER_EMAIL` for Carlos Lopez. They do not hardcode secrets.

## Notification Behavior

Seeding creates recurring templates, not live assigned task instances. That means it does not call `/api/tasks/notifications` and does not send 47+ assignment emails.

Assignment emails still fire through the existing `task_assigned` hook when an actual `operation_tasks` instance is created or reassigned to Carlos Lopez from the dashboard.

## Residential Verification

1. Apply the additive schema in `supabase/schema.sql`.
2. Open `/dashboard` as a Residential user.
3. Confirm the Monthly SOP area shows active templates assigned to Carlos Lopez.
4. Use filters for week, day, category, assigned owner, status, and frequency.
5. Confirm Weekly Friday geofence templates show as `Weekly`.
6. Confirm cleaner check-ins show `3rd Wednesday of every month`.
7. Confirm Week 4 billing/month-end templates show `Week 4 Friday / last Friday of the month`.
8. Open `/commercial` and confirm these Residential SOP templates do not appear there.

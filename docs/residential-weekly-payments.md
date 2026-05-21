# Residential Weekly Payments

## Purpose

Weekly Payments stays a simple residential operations module. It is not the old commercial payroll system, and it does not reopen Commercial Accounts, SEO, schedule rules, or commercial account editing.

## Database Setup

If the app shows a Supabase schema cache warning for residential tables, run:

`supabase/simplified-residential-operations.sql`

in the Supabase SQL Editor. It is additive and ends with a PostgREST schema reload notification.

## Normal Cleaner Format

Every cleaner/team uses the residential-only format unless their staff `payment_mode` is `mixed`.

Columns:

- Date
- City
- Payment

Totals:

- Row count
- Total payment

Example:

| Date | City | Payment |
| --- | --- | ---: |
| 2026-06-05 | Irvine | $120.00 |

Total: $120.00

Normal cleaners never see a Commercial column.

## Juan Romero Mixed Pay

Juan Romero is the one supported mixed-pay exception.

His table uses:

- Date
- City
- Residential
- Commercial

Totals:

- Total Residential
- Total Commercial
- Grand Total

Example:

| Date | City | Residential | Commercial |
| --- | --- | ---: | ---: |
| 2026-06-05 | Costa Mesa | $100.00 | $50.00 |

Total Residential: $100.00
Total Commercial: $50.00
Grand Total: $150.00

This is only a simple commercial add-on column inside weekly payments. It is not commercial payroll.

## Calculations

Normal cleaner total:

`SUM(payment_amount)`

Juan Romero total:

`SUM(residential_amount) + SUM(commercial_amount)`

Weekly summary:

- Residential payments = all normal cleaner payments + Juan residential
- Juan commercial add-on = Juan commercial only
- Grand total weekly payments = residential payments + Juan commercial add-on
- Pending total = unpaid weekly rows
- Paid total = paid weekly rows

## Adding A Normal Cleaner

1. Open Staff / Teams.
2. Create or edit the cleaner/team.
3. Set Payment mode to `Residential only`.
4. Open Residential Hours / Payments > Weekly payments.
5. Add rows with Date, City, Payment, and optional notes.

## Marking Juan As Mixed

Juan Romero is always treated as mixed pay by name. The staff field is also stored as:

`payment_mode = mixed`

All other cleaners default to:

`payment_mode = residential_only`

## Hidden Legacy Modules

These remain hidden/legacy:

- Commercial Accounts
- Commercial Payroll
- Commercial Schedule Rules
- SEO dashboard
- SEO Kanban
- SEO tasks

Juan's Commercial column is a lightweight add-on for weekly pay only.

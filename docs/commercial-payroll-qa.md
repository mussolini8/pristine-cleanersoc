# Commercial Payroll QA Checklist

Operational QA notes for the commercial/residential separation and payroll hardening.

## Residential / Commercial Separation
- `/payments` is residential/manual/legacy only. Rows with `source_type = commercial_payroll` or `category = commercial` are filtered out of the legacy weekly workflow and unified payment list.
- `/commercial` is commercial overview only and reads from `commercial_payroll_entries`.
- `/commercial/accounts` owns commercial account setup and schedule pay rules.
- `/commercial/payroll` and `/commercial/payroll/[id]` are the canonical commercial payroll routes.
- `/payments/commercial-payroll` redirects to `/commercial/payroll`.
- `/payments/commercial-payroll/[id]` redirects to `/commercial/payroll/[id]`.

## Account Edit Buttons
- Save changes only updates account settings and writes `account_settings_saved_only` audit log without recalculating payroll.
- Save and apply going forward confirms first, then refreshes current/future open commercial periods only.
- Approved, paid, and locked periods are blocked from recalculation.
- Open Commercial Payroll links to `/commercial/payroll`.

## Schedule Pay Rules
- Multi-day chips write one schedule-rule row per selected day to preserve existing payroll generation compatibility.
- Saving blocks no selected days, interval <= 0, interval > 1 without anchor date, paid hours <= 0, and end time before start time.
- Intervals over one week use `anchor_date` to determine the active week cycle.

## Payroll Generation
- Periods with status `approved`, `paid`, or `locked` are not recalculated.
- Existing approved/paid/locked entries inside an otherwise open period are preserved by natural key: account + cleaner + service date + source.
- Open entries for the period may be replaced by regenerated schedule output.
- Payment sync skips existing approved/paid/locked payment rows.

## Amount / Review Reasons
- Hourly account rate + hours calculates amount.
- Flat account rate + hours converts to an effective visit rate.
- Cleaner default rate is used when account rate is absent.
- Missing pay inputs surface as `Needs Review` with `Missing rate` or `Missing account pay settings` instead of silent `$0.00`.
- Missing cleaner, schedule, anchor date, and paid hours surface as review notes.

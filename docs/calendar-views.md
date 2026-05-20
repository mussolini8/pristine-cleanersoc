# Calendar Views

## Modules

Commercial Payments and Tasks now support calendar-first scheduling views inside the unified operations workspace.

- `/payments` defaults to the commercial unit when the signed-in role can view commercial work.
- `/payments` defaults to `Calendar`, with `List` retained as a secondary fallback.
- `/tasks` defaults to `Calendar`, with `Kanban` and `List` retained.
- `/calendar` reuses the same normalized event pattern for tasks, payment items, and SOP context.

## Event Types

Calendar rendering uses normalized events from `src/lib/calendar-events.ts`:

- `booking`: commercial payroll cleaning/payment items shown on their service date.
- `payment`: manual, legacy, or adjustment payment items shown on their payment/service date.
- `task`: operation tasks shown on due date.
- `sop`: residential SOP templates shown only as agenda context until a real task instance exists.

Every event exposes:

- `id`
- `type`
- `title`
- `start`
- `end`
- `status`
- `businessUnit`
- `color`
- `summary`
- `meta`

Use `mapPaymentToCalendarEvent()`, `mapTaskToCalendarEvent()`, or `mapBookingToCalendarEvent()` when adding new calendar sources.

## Detail Panels

Booking/payment events open a booking/payment summary panel. It shows account, cleaner/team, amount, payment status, source, pay period, service date, hours, payment method, notes, review reason, and protected-state badges such as Needs Review, Approved, Paid, Locked, Synced, or Manual Commercial.

Task events open a task summary panel. It shows task title, completion state, status, priority, business unit, category, assignee, due date, recurrence, notification toggles, description, completion notes, comments, attachments, activity, and task actions.

The panels are intentionally type-specific. Task summaries do not show booking/payment fields, and payment summaries do not show task-only activity as generic content.

## Filters

Commercial Payments filters:

- Calendar view mode: Month, Week, Day, Agenda
- Status
- Cleaner/team
- Account/client
- Source
- Search
- Needs review
- Only commercial
- Date range from the page header

Tasks filters:

- Calendar view mode: Month, Week, Day, Agenda
- Status
- Priority
- Category
- Assigned to
- Search
- Business unit from the global unit selector
- Date range from the page header

## Defaults

- Commercial Payments: `Calendar` view, commercial-only filter on.
- Tasks: `Calendar` view.
- Calendar mode: `Month`.
- Date preset: current month.

## Extension Notes

To add a new source, map the domain row into `NormalizedCalendarEvent` in `src/lib/calendar-events.ts`, then open the matching detail panel from `openCalendarEventDetail()` in `src/components/operations/unified-operations-client.tsx`.

Closed commercial payroll states are not recalculated by these views. Approved, paid, and locked payroll/payment rows are displayed as protected state; direct calendar interactions do not rewrite closed periods.

## Limitations

Commercial account contact fields are shown only when present in the current data model. The current commercial account/payment models do not store customer email, phone, zip code, rooms, bathrooms, or square footage, so those fields are not fabricated in the summary.

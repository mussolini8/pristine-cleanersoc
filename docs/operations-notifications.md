# Operations Notifications

## Roles

- Carlos Lopez: `operations_manager`, displayed as Operations Manager. He is assignable on operation tasks.
- Jake Ivan-Pal: `owner`, displayed as Owner. He receives owner completion notifications.
- `pristinecleaners`: residential access. Create this Supabase Auth user as `pristinecleaners@pristine.local`.
- `pristinejanitorial`: commercial access. Create this Supabase Auth user as `pristinejanitorial@pristine.local`.

Owner and admin roles may access both residential and commercial panels. Residential users are limited to `/dashboard`, `/residential`, and `/payments`. Commercial users are limited to `/commercial`, `/commercial/accounts`, `/commercial/payroll`, and `/commercial/payroll/[id]`.

## Emails

- `task_assigned`: sent to `OPERATIONS_MANAGER_EMAIL` when a task is assigned to Carlos Lopez.
- `task_completed`: sent to `OWNER_EMAIL` when a task assigned to Carlos Lopez is completed.

Both emails include the title, category, priority, due date, assigned by, assigned to, account/client, property/address, panel, notes, current status, timestamp, and a direct task link.

## Environment Variables

Configure these in Vercel and local development:

```bash
APP_BASE_URL=
GMAIL_USER=
GMAIL_APP_PASSWORD=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_URL=
OPERATIONS_MANAGER_EMAIL=
OWNER_EMAIL=
```

Use a Gmail app password for `GMAIL_APP_PASSWORD`; do not use a normal Gmail password.

## Missing Email Configuration

Task creation and completion must continue even when email configuration is incomplete. In development, the app logs the rendered notification summary to the console. In production, the API records `notification_failed` in `operation_task_audit_log` and returns success for the task flow.

## Supabase Auth Setup

Do not insert passwords with SQL. In Supabase Auth, create or validate these users manually:

- Email: `pristinecleaners@pristine.local`, with the agreed temporary password set in Supabase Auth.
- Email: `pristinejanitorial@pristine.local`, with the agreed temporary password set in Supabase Auth.

After the users exist, run the additive schema in `supabase/schema.sql`. It updates linked `profiles` rows idempotently:

- `pristinecleaners` -> `app_role = residential`, `access_scope = residential`
- `pristinejanitorial` -> `app_role = commercial`, `access_scope = commercial`

The login form accepts the usernames `pristinecleaners` and `pristinejanitorial` and maps them to those Supabase Auth emails.

## Local QA

1. Set local env vars in `.env.local`.
2. Start the app with `npm run dev`.
3. Log in as `pristinecleaners` and confirm residential routes load while commercial redirects away.
4. Log in as `pristinejanitorial` and confirm commercial routes load while residential payments/dashboard redirect away.
5. Open the dashboard, create a task assigned to Carlos Lopez, and confirm a `task_assigned` audit event plus `notification_sent` or `notification_failed`.
6. Move that task to Completed and confirm a `task_completed` audit event plus owner notification status.

## Task Category Notes

`Janitorial` is no longer offered for new task categories. Existing tasks with that historical category remain visible and can be filtered as `Janitorial (legacy)`.

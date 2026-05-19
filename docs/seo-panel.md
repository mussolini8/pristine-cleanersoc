# SEO Panel

The SEO panel is a separate operations workspace for marketing and SEO execution. It is isolated from Residential, Commercial, and Payroll.

## Routes

- `/seo` dashboard with weekly metrics, recent work, activity, and task creation.
- `/seo/kanban` Kanban board grouped by SEO status.
- `/seo/tasks` searchable task list.
- `/seo/tasks/[id]` task detail with comments, evidence uploads, activity, and completion notes.

## Role and Access

- Role: `seo`
- Username: `pristineseo`
- Expected password: `123456`
- Expected auth email: `pristineseo@pristine.local`
- Display name: `Pristine SEO`
- Display role: `SEO Specialist`

`pristineseo` is routed to `/seo` after login and is blocked from `/dashboard`, `/residential`, `/payments`, `/commercial`, and `/commercial/payroll`. Owner and admin roles can access `/seo`.

## Environment Variables

Set these in the hosting provider or local env files as needed:

```env
APP_BASE_URL=
GMAIL_USER=
GMAIL_APP_PASSWORD=
OWNER_EMAIL=
SEO_USER_EMAIL=
```

`SEO_USER_EMAIL` is the recipient for new SEO task assignment emails. `OWNER_EMAIL` receives SEO completion notifications.

## Supabase Auth Setup

Supabase Auth users should be created through Supabase Auth, not SQL. If the user does not exist:

1. Open Supabase Dashboard.
2. Go to Authentication > Users.
3. Create a user with email `pristineseo@pristine.local`.
4. Set password to `123456`.
5. Apply `supabase/schema.sql`.
6. Confirm `profiles` contains:
   - `username = pristineseo`
   - `app_role = seo`
   - `access_scope = seo`
   - `full_name = Pristine SEO`

The schema updates are additive and idempotent.

## Kanban

SEO task statuses:

- Backlog
- To Do
- In Progress
- Waiting Review
- Approved
- Completed

Tasks can be advanced from cards or completed from the task detail page. Filters cover status, priority, category, assignee, due date, and search.

## Comments

Task comments are stored in `operation_task_comments`. Comments are internal by default and include author and timestamp. Adding a comment writes `comment_added` to `operation_task_audit_log`.

## Attachments

Evidence uploads use Supabase Storage bucket `seo-task-attachments` and metadata table `operation_task_attachments`.

Allowed file types:

- jpg/jpeg
- png
- webp
- pdf

Maximum file size is 10MB. Files are stored in Storage, not directly in the database. Uploads write `attachment_uploaded` activity.

## Notifications

When an SEO task is assigned, the app attempts to email `SEO_USER_EMAIL` with:

- Task title
- Category
- Priority
- Due date
- Assigned by
- Description
- Direct task link
- Current status

When an SEO task is completed, the app attempts to email `OWNER_EMAIL` with:

- Task title
- Completed by
- Completed at
- Category
- Priority
- Completion notes
- Attachment count
- Comment count
- Direct review link

Email failures do not block task creation, comments, uploads, or completion. The app records `notification_sent` or `notification_failed` in `operation_task_audit_log`. In development, missing Gmail credentials log the email summary instead of sending.

## Validation Checklist

- Login as `pristineseo` opens `/seo`.
- `/dashboard`, `/residential`, `/payments`, `/commercial`, and `/commercial/payroll` redirect away for `seo`.
- Owner/admin can create SEO tasks.
- SEO tasks use `panel = SEO` and do not appear in Residential task queries.
- Comments and attachments appear only on SEO task detail.
- Completing a task sets `completed_at`, stores completion notes, and attempts Owner notification.

# Task Calendar And Notifications Debug

## Why June Looked Empty

Residential SOP records are stored as recurring templates in `operation_task_templates`. The calendar was loading those templates, but it mapped them with an empty `start` date and then filtered empty-date events out of month/week/day views. June 2026 looked empty because the templates were treated as undated context instead of scheduled occurrences.

## Calendar Occurrences

The calendar now renders:

- Manual tasks from `operation_tasks` when they have `due_date`.
- SOP templates converted into virtual occurrences for the visible calendar range.
- Real recurring instances from `operation_tasks` when a SOP occurrence has been materialized.

Manual tasks are editable task rows. SOP templates are recurring definitions. SOP occurrences are virtual calendar events derived from a template plus an occurrence date. Completing or editing a virtual occurrence creates a real task instance for that template/date.

## Recurrence Rules

SOP template occurrences are calculated from `frequency`, `schedule_label`, `week_of_month`, and `day_of_week`.

- `Every Friday` renders every Friday in the visible month.
- `Week 1 Tuesday`, `Week 2 Wednesday`, `Week 3 Thursday`, and `Week 4 Friday` render the matching nth weekday.
- `3rd Wednesday of every month` renders the third Wednesday.
- `Last Friday` and `Last week of every month` render the last matching weekday in the month.
- `First week of every month` renders week 1 for the configured weekday.

For June 2026, Fridays fall on June 5, 12, 19, and 26. The third Wednesday is June 17. The last Friday is June 26.

## Duplicate Protection

Virtual SOP events are keyed by:

```text
template_id + occurrence_date
```

When a real task instance exists with matching `metadata.template_id` and `metadata.occurrence_date`, the virtual event is hidden and the real task appears instead. Reopening or completing the same occurrence reuses the existing instance.

## Notification Failed

`Notification Failed` means the task flow reached the notification service and the email was not sent. The Activity log now stores a reason in `operation_task_audit_log.details.reason`, plus safe metadata such as `code`, `responseCode`, `recipientType`, and masked recipient.

Examples:

- `Notification Failed - Missing required env vars: OPERATIONS_MANAGER_EMAIL`
- `Notification Failed - Missing required env vars: GMAIL_APP_PASSWORD`
- `Notification Failed - Gmail authentication failed. Check GMAIL_USER and GMAIL_APP_PASSWORD.`
- `Notification Failed - Could not connect to Gmail SMTP.`
- `Notification Skipped - Assignment email disabled.`
- `Notification Sent - Assignment email sent to Carlos Lopez`

## Required Env Vars

```bash
APP_BASE_URL=
GMAIL_USER=
GMAIL_APP_PASSWORD=
OPERATIONS_MANAGER_EMAIL=
OWNER_EMAIL=
```

`SEO_USER_EMAIL` is also used for SEO task notifications.

## Testing Assignment Email

1. Set the required env vars locally or in Vercel.
2. Create a Residential task assigned to Carlos Lopez.
3. Leave `Notify assignee when assigned` enabled.
4. Confirm the Activity log shows `Task Assigned`, then `Notification Sent` or `Notification Failed - reason`.
5. If it fails, check the reason before changing code.

## Testing Completion Email

1. Open a task with `Notify owner when completed` enabled.
2. Mark it completed.
3. Confirm the Activity log shows `Task Completed`, then `Notification Sent` or `Notification Failed - reason`.
4. Completing an already completed task does not send another email.

## Common Errors

- `Missing required env vars: OPERATIONS_MANAGER_EMAIL`: assignment email has no Operations Manager recipient.
- `Missing required env vars: OWNER_EMAIL`: completion email has no Owner recipient.
- `Missing required env vars: GMAIL_APP_PASSWORD`: Gmail SMTP cannot authenticate.
- `Gmail authentication failed`: use a Gmail App Password, not the normal Gmail account password.
- `Could not connect to Gmail SMTP`: network, SMTP, or timeout issue.

If Gmail blocks sending, verify 2-step verification is enabled on the Gmail account, create a new App Password, update `GMAIL_APP_PASSWORD`, and redeploy/restart the app. Never commit `.env.local` or real Gmail credentials.

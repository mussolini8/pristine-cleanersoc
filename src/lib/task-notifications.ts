import nodemailer from "nodemailer";
import { getServerEnv } from "@/lib/env";

export type TaskNotificationPerson = {
  name: string;
  role: string;
  email?: string | null;
};

export type TaskNotificationPayload = {
  id: string;
  title: string;
  category?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  assignedBy?: string | null;
  assignedTo?: string | null;
  accountOrProperty?: string | null;
  panel?: string | null;
  description?: string | null;
  notes?: string | null;
  status?: string | null;
  completedAt?: string | null;
  completionNotes?: string | null;
  commentsCount?: number | null;
  attachmentsCount?: number | null;
};

type SendEmailInput = {
  to?: string | null;
  subject: string;
  html: string;
  text: string;
  event: string;
};

const textColor = "#111827";
const mutedColor = "#64748b";

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "Not set")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  }).format(date);
}

function formatValue(value: string | null | undefined) {
  return value && value.trim() ? value : "Not set";
}

function taskUrl(taskId: string) {
  const env = getServerEnv();
  const baseUrl = env.APP_BASE_URL ?? env.NEXT_PUBLIC_APP_URL;
  return `${baseUrl.replace(/\/$/, "")}/dashboard?task=${encodeURIComponent(taskId)}`;
}

function seoTaskUrl(taskId: string) {
  const env = getServerEnv();
  const baseUrl = env.APP_BASE_URL ?? env.NEXT_PUBLIC_APP_URL;
  return `${baseUrl.replace(/\/$/, "")}/seo/tasks/${encodeURIComponent(taskId)}`;
}

function row(label: string, value: string | null | undefined) {
  return `
    <tr>
      <td style="padding:10px 0;color:${mutedColor};font-size:13px;font-weight:700;text-transform:uppercase;width:42%;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;color:${textColor};font-size:14px;font-weight:700;text-align:right;">${escapeHtml(formatValue(value))}</td>
    </tr>
  `;
}

function section(title: string, rows: string) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 8px;color:${mutedColor};font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(title)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
        </td>
      </tr>
    </table>
  `;
}

function layout(title: string, subtitle: string, body: string, ctaLabel: string, ctaUrl: string, footer: string) {
  return `
    <!doctype html>
    <html>
      <body style="margin:0;background:#edf2f7;padding:24px;font-family:Arial,Helvetica,sans-serif;color:${textColor};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;border-collapse:collapse;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #dbe4ee;">
          <tr>
            <td style="background:#0f172a;padding:28px 30px;">
              <p style="margin:0 0 8px;color:#93c5fd;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;">Pristine Operations</p>
              <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.15;font-weight:900;">${escapeHtml(title)}</h1>
              <p style="margin:10px 0 0;color:#cbd5e1;font-size:14px;font-weight:700;">${escapeHtml(subtitle)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 30px 30px;">
              ${body}
              <div style="margin-top:24px;">
                <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#437d65;color:#ffffff;text-decoration:none;font-size:14px;font-weight:900;padding:12px 18px;border-radius:8px;">${escapeHtml(ctaLabel)}</a>
              </div>
              <p style="margin:28px 0 0;color:${mutedColor};font-size:12px;font-weight:700;">${escapeHtml(footer)}</p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function plainRows(rows: Record<string, string | null | undefined>) {
  return Object.entries(rows).map(([key, value]) => `${key}: ${formatValue(value)}`).join("\n");
}

async function sendEmail({ to, subject, html, text, event }: SendEmailInput) {
  const env = getServerEnv();
  const missing = [
    !env.GMAIL_USER ? "GMAIL_USER" : null,
    !env.GMAIL_APP_PASSWORD ? "GMAIL_APP_PASSWORD" : null,
    !to ? "recipient" : null,
  ].filter(Boolean);

  if (missing.length > 0) {
    const message = `${event} notification skipped: missing ${missing.join(", ")}`;
    if (process.env.NODE_ENV !== "production") {
      console.info(message, { to, subject, text });
      return { sent: false, reason: message };
    }
    return { sent: false, reason: message };
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Pristine Operations" <${env.GMAIL_USER}>`,
    to: to ?? undefined,
    subject,
    html,
    text,
  });

  return { sent: true, reason: "sent" };
}

export async function sendTaskAssignedEmail(task: TaskNotificationPayload, assignee: TaskNotificationPerson) {
  const dateTime = formatDateTime();
  const link = taskUrl(task.id);
  const subject = `New task assigned: ${task.title}`;
  const body = [
    section("Contact / Assignment", [
      row("Assigned to", assignee.name),
      row("Role", assignee.role),
      row("Assigned by", task.assignedBy),
      row("Priority", task.priority),
      row("Due date", task.dueDate),
    ].join("")),
    section("Task Details", [
      row("Title", task.title),
      row("Category", task.category),
      row("Property / Account", task.accountOrProperty),
      row("Panel", task.panel),
      row("Status", task.status),
      row("Notes", task.notes ?? task.description),
    ].join("")),
  ].join("");
  const html = layout("Pristine: new task assigned", `Assigned to ${assignee.name} · ${dateTime}`, body, "Open task", link, "This notification was generated by Pristine Operations.");
  const text = [
    "Pristine: new task assigned",
    `Assigned to ${assignee.name} · ${dateTime}`,
    "",
    plainRows({
      "Assigned to": assignee.name,
      Role: assignee.role,
      "Assigned by": task.assignedBy,
      Priority: task.priority,
      "Due date": task.dueDate,
      Title: task.title,
      Category: task.category,
      "Property / Account": task.accountOrProperty,
      Panel: task.panel,
      Status: task.status,
      Notes: task.notes ?? task.description,
      Link: link,
    }),
  ].join("\n");

  return sendEmail({ to: assignee.email, subject, html, text, event: "task_assigned" });
}

export async function sendTaskCompletedEmail(task: TaskNotificationPayload, completedBy: TaskNotificationPerson, owner: TaskNotificationPerson) {
  const completedAt = task.completedAt ?? formatDateTime();
  const link = taskUrl(task.id);
  const subject = `Task completed by ${completedBy.name}: ${task.title}`;
  const body = [
    section("Completion Summary", [
      row("Completed by", completedBy.name),
      row("Role", completedBy.role),
      row("Completed at", completedAt),
      row("Original assignee", task.assignedTo),
      row("Priority", task.priority),
    ].join("")),
    section("Task Details", [
      row("Title", task.title),
      row("Category", task.category),
      row("Property / Account", task.accountOrProperty),
      row("Panel", task.panel),
      row("Final status", "Completed"),
      row("Completion notes", task.completionNotes ?? task.notes ?? task.description),
    ].join("")),
  ].join("");
  const html = layout("Pristine: task completed", `Completed by ${completedBy.name} · ${completedAt}`, body, "Review completed task", link, "Owner notification generated by Pristine Operations.");
  const text = [
    "Pristine: task completed",
    `Completed by ${completedBy.name} · ${completedAt}`,
    "",
    plainRows({
      "Completed by": completedBy.name,
      Role: completedBy.role,
      "Completed at": completedAt,
      "Original assignee": task.assignedTo,
      Priority: task.priority,
      Title: task.title,
      Category: task.category,
      "Property / Account": task.accountOrProperty,
      Panel: task.panel,
      "Final status": "Completed",
      "Completion notes": task.completionNotes ?? task.notes ?? task.description,
      Link: link,
    }),
  ].join("\n");

  return sendEmail({ to: owner.email, subject, html, text, event: "task_completed" });
}

export async function sendSeoTaskAssignedEmail(task: TaskNotificationPayload, assignee: TaskNotificationPerson) {
  const dateTime = formatDateTime();
  const link = seoTaskUrl(task.id);
  const subject = `New SEO task assigned: ${task.title}`;
  const body = [
    section("SEO Assignment", [
      row("Task title", task.title),
      row("Category", task.category),
      row("Priority", task.priority),
      row("Due date", task.dueDate),
      row("Assigned by", task.assignedBy),
      row("Status", task.status),
    ].join("")),
    section("Task Brief", [
      row("Assigned to", assignee.name),
      row("Description", task.description ?? task.notes),
      row("Panel", "SEO"),
    ].join("")),
  ].join("");
  const html = layout("New SEO task assigned", `Assigned to ${assignee.name} · ${dateTime}`, body, "Open SEO task", link, "This notification was generated by Pristine Operations.");
  const text = [
    "New SEO task assigned",
    `Assigned to ${assignee.name} · ${dateTime}`,
    "",
    plainRows({
      "Task title": task.title,
      Category: task.category,
      Priority: task.priority,
      "Due date": task.dueDate,
      "Assigned by": task.assignedBy,
      Description: task.description ?? task.notes,
      "Current status": task.status,
      Link: link,
    }),
  ].join("\n");

  return sendEmail({ to: assignee.email, subject, html, text, event: "seo_task_assigned" });
}

export async function sendSeoTaskCompletedEmail(task: TaskNotificationPayload, completedBy: TaskNotificationPerson, owner: TaskNotificationPerson) {
  const completedAt = task.completedAt ?? formatDateTime();
  const link = seoTaskUrl(task.id);
  const subject = `SEO task completed: ${task.title}`;
  const body = [
    section("Completion Summary", [
      row("Task title", task.title),
      row("Completed by", completedBy.name),
      row("Completed at", completedAt),
      row("Category", task.category),
      row("Priority", task.priority),
    ].join("")),
    section("Review Details", [
      row("Completion notes", task.completionNotes ?? task.notes ?? task.description),
      row("Photos / attachments", String(task.attachmentsCount ?? 0)),
      row("Comments", String(task.commentsCount ?? 0)),
      row("Panel", "SEO"),
    ].join("")),
  ].join("");
  const html = layout("SEO task completed", `Completed by ${completedBy.name} · ${completedAt}`, body, "Review SEO task", link, "This notification was generated by Pristine Operations.");
  const text = [
    "SEO task completed",
    `Completed by ${completedBy.name} · ${completedAt}`,
    "",
    plainRows({
      "Task title": task.title,
      "Completed by": completedBy.name,
      "Completed at": completedAt,
      Category: task.category,
      Priority: task.priority,
      "Completion notes": task.completionNotes ?? task.notes ?? task.description,
      "Photos / attachments": String(task.attachmentsCount ?? 0),
      Comments: String(task.commentsCount ?? 0),
      Link: link,
    }),
  ].join("\n");

  return sendEmail({ to: owner.email, subject, html, text, event: "seo_task_completed" });
}

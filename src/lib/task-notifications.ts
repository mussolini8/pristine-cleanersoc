import nodemailer from "nodemailer";

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
  createdBy?: string | null;
  completedBy?: string | null;
  completionEmailEnabled?: boolean | null;
  assignmentEmailEnabled?: boolean | null;
  frequency?: string | null;
  sourceSection?: string | null;
};

export type EmailSendResult = {
  ok: boolean;
  sent: boolean;
  reason: string;
  code?: string;
  command?: string;
  responseCode?: number;
  messageId?: string;
  transport?: string;
};

type SendEmailInput = {
  to?: string | null;
  recipientEnvName?: string;
  subject: string;
  html: string;
  text: string;
  event: string;
  recipientType: string;
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
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/dashboard?task=${encodeURIComponent(taskId)}`;
}

function seoTaskUrl(taskId: string) {
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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

export function getEmailConfigStatus(requiredRecipientEnv?: "OPERATIONS_MANAGER_EMAIL" | "OWNER_EMAIL" | "SEO_USER_EMAIL") {
  const missing = [
    !process.env.GMAIL_USER ? "GMAIL_USER" : null,
    !process.env.GMAIL_APP_PASSWORD ? "GMAIL_APP_PASSWORD" : null,
    !process.env.APP_BASE_URL ? "APP_BASE_URL" : null,
    requiredRecipientEnv && !process.env[requiredRecipientEnv] ? requiredRecipientEnv : null,
  ].filter((item): item is string => Boolean(item));

  return {
    configured: missing.length === 0,
    missing,
    safeStatus: {
      gmailUserConfigured: Boolean(process.env.GMAIL_USER),
      gmailPasswordConfigured: Boolean(process.env.GMAIL_APP_PASSWORD),
      appBaseUrlConfigured: Boolean(process.env.APP_BASE_URL),
      operationsManagerEmailConfigured: Boolean(process.env.OPERATIONS_MANAGER_EMAIL),
      ownerEmailConfigured: Boolean(process.env.OWNER_EMAIL),
      seoUserEmailConfigured: Boolean(process.env.SEO_USER_EMAIL),
    },
  };
}

function sanitizeMailerMessage(message: string) {
  let sanitized = message;
  for (const secret of [process.env.GMAIL_APP_PASSWORD, process.env.GMAIL_USER, process.env.OPERATIONS_MANAGER_EMAIL, process.env.OWNER_EMAIL, process.env.SEO_USER_EMAIL]) {
    if (secret) sanitized = sanitized.replaceAll(secret, "[redacted]");
  }
  return sanitized.replace(/AUTH\s+\S+/gi, "AUTH [redacted]").slice(0, 220);
}

function classifyMailerError(error: unknown): EmailSendResult {
  const mailerError = error as {
    code?: string;
    command?: string;
    responseCode?: number;
    response?: string;
    message?: string;
  };
  const code = mailerError.code;
  const command = mailerError.command;
  const responseCode = mailerError.responseCode;
  const message = sanitizeMailerMessage(mailerError.message ?? mailerError.response ?? "Unknown email error");
  const lower = message.toLowerCase();

  if (responseCode === 535 || code === "EAUTH" || lower.includes("invalid login") || lower.includes("authentication failed")) {
    return {
      ok: false,
      sent: false,
      reason: "Gmail authentication failed. Check GMAIL_USER and GMAIL_APP_PASSWORD.",
      code: code ?? "EAUTH",
      command,
      responseCode,
    };
  }

  if (code === "ENETUNREACH") {
    return {
      ok: false,
      sent: false,
      reason: "Could not reach Gmail SMTP from this server/network.",
      code,
      command,
      responseCode,
    };
  }

  if (code === "ECONNECTION" || code === "ETIMEDOUT" || code === "ESOCKET" || lower.includes("timeout")) {
    return {
      ok: false,
      sent: false,
      reason: "Could not connect to Gmail SMTP.",
      code,
      command,
      responseCode,
    };
  }

  if (lower.includes("no recipients") || lower.includes("recipient")) {
    return {
      ok: false,
      sent: false,
      reason: "Missing email recipient.",
      code,
      command,
      responseCode,
    };
  }

  return {
    ok: false,
    sent: false,
    reason: message ? `Email send failed: ${message}` : "Email send failed.",
    code,
    command,
    responseCode,
  };
}

async function sendEmail({ to, recipientEnvName, subject, html, text }: SendEmailInput): Promise<EmailSendResult> {
  const missing = [
    !process.env.GMAIL_USER ? "GMAIL_USER" : null,
    !process.env.GMAIL_APP_PASSWORD ? "GMAIL_APP_PASSWORD" : null,
    !process.env.APP_BASE_URL ? "APP_BASE_URL" : null,
    !to && recipientEnvName ? recipientEnvName : null,
  ].filter((item): item is string => Boolean(item));

  if (missing.length > 0) {
    return {
      ok: false,
      sent: false,
      reason: `Missing required env vars: ${missing.join(", ")}`,
      code: "EMAIL_CONFIG_MISSING",
    };
  }

  if (!to) {
    return {
      ok: false,
      sent: false,
      reason: "Missing email recipient.",
      code: "MISSING_RECIPIENT",
    };
  }

  const gmailUser = process.env.GMAIL_USER ?? "";
  const gmailPassword = process.env.GMAIL_APP_PASSWORD ?? "";
  const transports = [
    { port: 465, secure: true, label: "smtp.gmail.com:465" },
    { port: 587, secure: false, label: "smtp.gmail.com:587" },
  ];
  const failures: EmailSendResult[] = [];

  for (const transport of transports) {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: transport.port,
      secure: transport.secure,
      requireTLS: !transport.secure,
      connectionTimeout: 30000,
      greetingTimeout: 20000,
      socketTimeout: 45000,
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
    });

    try {
      const info = await transporter.sendMail({
        from: `"Pristine Operations" <${gmailUser}>`,
        to: to ?? undefined,
        subject,
        html,
        text,
      }) as { messageId?: string };

      return { ok: true, sent: true, reason: "sent", messageId: info.messageId, transport: transport.label };
    } catch (error) {
      failures.push({ ...classifyMailerError(error), transport: transport.label });
    }
  }

  const details = failures.map((failure) => `${failure.transport}: ${failure.reason}${failure.code ? ` (${failure.code})` : ""}`).join(" | ");
  return {
    ok: false,
    sent: false,
    reason: details || "Could not connect to Gmail SMTP.",
    code: failures[0]?.code,
    command: failures[0]?.command,
    responseCode: failures[0]?.responseCode,
    transport: "smtp.gmail.com:465,smtp.gmail.com:587",
  };
}

export async function sendTaskAssignedEmail(task: TaskNotificationPayload, assignee: TaskNotificationPerson) {
  const link = taskUrl(task.id);
  const subject = `New task reminder assigned: ${task.title}`;
  const body = [
    `<p style="margin:0;color:${textColor};font-size:15px;line-height:1.6;">Hi ${escapeHtml(assignee.name)},</p>
     <p style="margin:12px 0 0;color:${textColor};font-size:15px;line-height:1.6;">A task reminder has been assigned to you in Pristine Cleaners SOP.</p>`,
    section("Task reminder", [
      row("Task", task.title),
      row("Due date", task.dueDate),
      row("Frequency", task.frequency),
      row("Priority", task.priority),
      row("Source section", task.sourceSection),
      row("Assigned to", assignee.name),
      row("Assigned by", task.assignedBy),
      row("Description", task.description ?? task.notes),
    ].join("")),
  ].join("");
  const html = layout("New task reminder assigned", "Pristine Cleaners SOP", body, "Open SOP dashboard", link, "Please review it in the SOP dashboard.");
  const text = [
    `Hi ${assignee.name},`,
    "",
    "A task reminder has been assigned to you in Pristine Cleaners SOP.",
    "",
    plainRows({
      Task: task.title,
      "Due date": task.dueDate,
      Frequency: task.frequency,
      Priority: task.priority,
      "Source section": task.sourceSection,
    }),
    "",
    "Please review it in the SOP dashboard.",
    link,
  ].join("\n");

  return sendEmail({
    to: assignee.email,
    recipientEnvName: assignee.name === "Carlos Lopez" ? "OPERATIONS_MANAGER_EMAIL" : assignee.name === "Jake Ivan-Pal" ? "OWNER_EMAIL" : undefined,
    subject,
    html,
    text,
    event: "task_assigned",
    recipientType: "assignee",
  });
}

export async function sendTaskCompletedEmail(task: TaskNotificationPayload, completedBy: TaskNotificationPerson, owner: TaskNotificationPerson) {
  const completedAt = task.completedAt ?? formatDateTime();
  const link = taskUrl(task.id);
  const subject = `Task completed: ${task.title}`;
  const body = [
    `<p style="margin:0;color:${textColor};font-size:15px;line-height:1.6;">Hi ${escapeHtml(owner.name)},</p>
     <p style="margin:12px 0 0;color:${textColor};font-size:15px;line-height:1.6;">The following SOP task reminder was marked as completed.</p>`,
    section("Completion summary", [
      row("Task", task.title),
      row("Completed by", completedBy.name),
      row("Completed at", completedAt),
      row("Assigned to", task.assignedTo),
    ].join("")),
  ].join("");
  const html = layout("Task completed", "Pristine Cleaners SOP", body, "Review completed task", link, "Owner notification generated by Pristine Operations.");
  const text = [
    `Hi ${owner.name},`,
    "",
    "The following SOP task reminder was marked as completed.",
    "",
    plainRows({
      Task: task.title,
      "Completed by": completedBy.name,
      "Completed at": completedAt,
      "Assigned to": task.assignedTo,
    }),
    "",
    link,
  ].join("\n");

  return sendEmail({
    to: owner.email,
    recipientEnvName: "OWNER_EMAIL",
    subject,
    html,
    text,
    event: "task_completed",
    recipientType: "owner",
  });
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

  return sendEmail({
    to: assignee.email,
    recipientEnvName: "SEO_USER_EMAIL",
    subject,
    html,
    text,
    event: "seo_task_assigned",
    recipientType: "seo_assignee",
  });
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

  return sendEmail({
    to: owner.email,
    recipientEnvName: "OWNER_EMAIL",
    subject,
    html,
    text,
    event: "seo_task_completed",
    recipientType: "owner",
  });
}

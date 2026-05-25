import { NextResponse } from "next/server";
import { z } from "zod";
import { writeOperationTaskAudit } from "@/lib/operations/audit";
import { createClient } from "@/lib/supabase/server";
import {
  sendSeoTaskAssignedEmail,
  sendSeoTaskCompletedEmail,
  sendTaskAssignedEmail,
  sendTaskCompletedEmail,
  type TaskNotificationPayload,
} from "@/lib/task-notifications";

type NotificationEvent = "task_assigned" | "task_completed";

type RequestBody = {
  event: NotificationEvent;
  task: TaskNotificationPayload;
  actorName?: string | null;
  enabled?: boolean;
};

const notificationRequestSchema = z.object({
  event: z.enum(["task_assigned", "task_completed"]),
  enabled: z.boolean().optional(),
  actorName: z.string().trim().nullable().optional(),
  task: z.object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
  }).passthrough(),
});

const operationsManager = {
  name: "Carlos Lopez",
  role: "Operations Manager",
};

const owner = {
  name: "Jake Ivan-Pal",
  role: "Owner",
};

const seoSpecialist = {
  name: "Pristine SEO",
  role: "SEO Specialist",
};

function isCarlos(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase() === "carlos lopez";
}

function isJake(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase() === "jake ivan-pal";
}

function personRole(value: string | null | undefined) {
  if (isCarlos(value)) return operationsManager.role;
  if (isJake(value)) return owner.role;
  return "Team member";
}

function isSeoTask(task: TaskNotificationPayload) {
  return String(task.panel ?? "").trim().toLowerCase() === "seo";
}

function notificationType(event: NotificationEvent) {
  return event === "task_assigned" ? "assignment" : "completion";
}

function skippedReason(event: NotificationEvent) {
  return event === "task_assigned" ? "Assignment email disabled." : "Completion email disabled.";
}

function maskEmail(email: string | null | undefined) {
  if (!email) return null;
  const [name, domain] = email.split("@");
  if (!domain) return "[masked]";
  return `${name.slice(0, 2)}***@${domain}`;
}

function sanitizeReason(reason: string) {
  let sanitized = reason;
  for (const secret of [process.env.GMAIL_APP_PASSWORD, process.env.GMAIL_USER, process.env.OPERATIONS_MANAGER_EMAIL, process.env.OWNER_EMAIL, process.env.SEO_USER_EMAIL]) {
    if (secret) sanitized = sanitized.replaceAll(secret, "[redacted]");
  }
  return sanitized;
}

async function findStaffEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string | null | undefined,
) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return null;
  const { data } = await supabase.from("staff_members").select("email").ilike("name", trimmed).limit(1);
  return data?.[0]?.email ?? null;
}

async function writeAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
  action: string,
  details: Record<string, unknown>,
) {
  await writeOperationTaskAudit(supabase, taskId, action, details);
}

async function writeNotificationAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
  event: NotificationEvent,
  result: {
    sent?: boolean;
    reason?: string;
    code?: string;
    command?: string;
    responseCode?: number;
    messageId?: string;
    skipped?: boolean;
  },
  recipient: {
    name: string;
    type: string;
    email?: string | null;
  },
) {
  await writeAudit(supabase, taskId, result.skipped ? "notification_skipped" : result.sent ? "notification_sent" : "notification_failed", {
    event,
    notificationType: notificationType(event),
    recipient: recipient.name,
    recipientType: recipient.type,
    recipientMasked: maskEmail(recipient.email),
    reason: result.reason,
    code: result.code,
    command: result.command,
    responseCode: result.responseCode,
    messageId: result.messageId,
    message: result.sent
      ? event === "task_assigned"
        ? `Assignment email sent to ${recipient.name}`
        : "Owner completion email sent"
      : result.reason,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = notificationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification payload" }, { status: 400 });
  const body = parsed.data as RequestBody;

  await writeAudit(supabase, body.task.id, body.event, {
    actor: body.actorName ?? user.email ?? user.id,
    assignee: body.task.assignedTo,
    status: body.task.status,
  });

  try {
    if (body.enabled === false) {
      const result = { ok: true, sent: false, skipped: true, reason: skippedReason(body.event) };
      await writeNotificationAudit(supabase, body.task.id, body.event, result, {
        name: body.event === "task_completed" ? owner.name : body.task.assignedTo ?? "Unassigned",
        type: body.event === "task_completed" ? "owner" : "assignee",
      });
      return NextResponse.json({ ok: true, notification: result });
    }

    if (body.event === "task_assigned" && isSeoTask(body.task)) {
      const result = await sendSeoTaskAssignedEmail(body.task, {
        ...seoSpecialist,
        email: process.env.SEO_USER_EMAIL,
      });
      await writeNotificationAudit(supabase, body.task.id, body.event, result, {
        name: seoSpecialist.name,
        type: "seo_assignee",
        email: process.env.SEO_USER_EMAIL,
      });
      return NextResponse.json({ ok: true, notification: result });
    }

    if (body.event === "task_completed" && isSeoTask(body.task)) {
      const result = await sendSeoTaskCompletedEmail(body.task, seoSpecialist, {
        ...owner,
        email: process.env.OWNER_EMAIL,
      });
      await writeNotificationAudit(supabase, body.task.id, body.event, result, {
        name: owner.name,
        type: "owner",
        email: process.env.OWNER_EMAIL,
      });
      return NextResponse.json({ ok: true, notification: result });
    }

    if (body.event === "task_assigned") {
      const staffEmail = isCarlos(body.task.assignedTo) || isJake(body.task.assignedTo) ? null : await findStaffEmail(supabase, body.task.assignedTo);
      const assigneeEmail = isCarlos(body.task.assignedTo)
        ? process.env.OPERATIONS_MANAGER_EMAIL
        : isJake(body.task.assignedTo)
          ? process.env.OWNER_EMAIL
          : staffEmail;
      const assigneeName = body.task.assignedTo || "Unassigned";
      const result = await sendTaskAssignedEmail(body.task, {
        name: assigneeName,
        role: personRole(assigneeName),
        email: assigneeEmail,
      });
      await writeNotificationAudit(supabase, body.task.id, body.event, result, {
        name: assigneeName,
        type: "assignee",
        email: assigneeEmail,
      });
      return NextResponse.json({ ok: true, notification: result });
    }

    if (body.event === "task_completed") {
      const completedBy = {
        name: body.actorName ?? body.task.completedBy ?? body.task.assignedTo ?? operationsManager.name,
        role: personRole(body.actorName ?? body.task.completedBy ?? body.task.assignedTo),
        email: isCarlos(body.task.assignedTo) ? process.env.OPERATIONS_MANAGER_EMAIL : null,
      };
      const result = await sendTaskCompletedEmail(body.task, completedBy, {
        ...owner,
        email: process.env.OWNER_EMAIL,
      });
      await writeNotificationAudit(supabase, body.task.id, body.event, result, {
        name: owner.name,
        type: "owner",
        email: process.env.OWNER_EMAIL,
      });
      return NextResponse.json({ ok: true, notification: result });
    }

    return NextResponse.json({ ok: true, notification: { sent: false, reason: "No notification recipient for task event" } });
  } catch (error) {
    const reason = sanitizeReason(error instanceof Error ? error.message : "Unknown notification error");
    await writeAudit(supabase, body.task.id, "notification_failed", {
      event: body.event,
      reason,
    });
    return NextResponse.json({ ok: true, notification: { sent: false, reason } });
  }
}

import { NextResponse } from "next/server";
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
  event?: NotificationEvent;
  task?: TaskNotificationPayload;
  actorName?: string | null;
};

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

function isSeoTask(task: TaskNotificationPayload) {
  return String(task.panel ?? "").trim().toLowerCase() === "seo";
}

async function writeAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
  action: string,
  details: Record<string, unknown>,
) {
  const { error } = await supabase.from("operation_task_audit_log").insert({
    task_id: taskId,
    action,
    details,
  });
  if (error) {
    console.warn("Operation task audit write failed", error.message);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as RequestBody;
  if (!body.event || !body.task?.id || !body.task.title) {
    return NextResponse.json({ error: "Invalid notification payload" }, { status: 400 });
  }

  await writeAudit(supabase, body.task.id, body.event, {
    actor: body.actorName ?? user.email ?? user.id,
    assignee: body.task.assignedTo,
    status: body.task.status,
  });

  try {
    if (body.event === "task_assigned" && isSeoTask(body.task)) {
      const result = await sendSeoTaskAssignedEmail(body.task, {
        ...seoSpecialist,
        email: process.env.SEO_USER_EMAIL,
      });
      await writeAudit(supabase, body.task.id, result.sent ? "notification_sent" : "notification_failed", {
        event: body.event,
        recipient: seoSpecialist.name,
        reason: result.reason,
      });
      return NextResponse.json({ ok: true, notification: result });
    }

    if (body.event === "task_completed" && isSeoTask(body.task)) {
      const result = await sendSeoTaskCompletedEmail(body.task, seoSpecialist, {
        ...owner,
        email: process.env.OWNER_EMAIL,
      });
      await writeAudit(supabase, body.task.id, result.sent ? "notification_sent" : "notification_failed", {
        event: body.event,
        recipient: owner.name,
        reason: result.reason,
      });
      return NextResponse.json({ ok: true, notification: result });
    }

    if (body.event === "task_assigned" && isCarlos(body.task.assignedTo)) {
      const result = await sendTaskAssignedEmail(body.task, {
        ...operationsManager,
        email: process.env.OPERATIONS_MANAGER_EMAIL,
      });
      await writeAudit(supabase, body.task.id, result.sent ? "notification_sent" : "notification_failed", {
        event: body.event,
        recipient: operationsManager.name,
        reason: result.reason,
      });
      return NextResponse.json({ ok: true, notification: result });
    }

    if (body.event === "task_completed" && isCarlos(body.task.assignedTo)) {
      const completedBy = {
        ...operationsManager,
        email: process.env.OPERATIONS_MANAGER_EMAIL,
      };
      const result = await sendTaskCompletedEmail(body.task, completedBy, {
        ...owner,
        email: process.env.OWNER_EMAIL,
      });
      await writeAudit(supabase, body.task.id, result.sent ? "notification_sent" : "notification_failed", {
        event: body.event,
        recipient: owner.name,
        reason: result.reason,
      });
      return NextResponse.json({ ok: true, notification: result });
    }

    return NextResponse.json({ ok: true, notification: { sent: false, reason: "No notification recipient for task event" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown notification error";
    await writeAudit(supabase, body.task.id, "notification_failed", {
      event: body.event,
      reason,
    });
    return NextResponse.json({ ok: true, notification: { sent: false, reason } });
  }
}

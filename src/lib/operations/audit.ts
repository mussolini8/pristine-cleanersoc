import type { SupabaseClient } from "@supabase/supabase-js";

export async function writeOperationTaskAudit(
  supabase: SupabaseClient,
  taskId: string,
  action: string,
  details: Record<string, unknown>,
) {
  const { error } = await supabase.from("operation_task_audit_log").insert({
    task_id: taskId,
    action,
    details,
  });

  return { ok: !error, error: error?.message ?? null };
}

export async function writePayrollAudit(
  supabase: SupabaseClient,
  input: {
    entityType: string;
    entityId?: string | null;
    action: string;
    before?: unknown;
    after?: unknown;
    actorId?: string | null;
    payPeriodId?: string | null;
  },
) {
  const { error } = await supabase.from("payroll_audit_log").insert({
    pay_period_id: input.payPeriodId ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    action: input.action,
    old_value: input.before === undefined ? null : JSON.stringify(input.before),
    new_value: input.after === undefined ? null : JSON.stringify(input.after),
    changed_by: input.actorId ?? null,
  });

  return { ok: !error, error: error?.message ?? null };
}

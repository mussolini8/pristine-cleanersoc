import { NextRequest, NextResponse } from "next/server";
import {
  MONTHLY_SOP_IMPORT,
  generateMonthlySopTasks,
  monthlySopDedupeKey,
  monthlySopTemplateKey,
  type MonthlySopInstance,
  type MonthlySopTemplate,
} from "@/lib/operations/monthly-sop-import";
import { createClient } from "@/lib/supabase/server";

type ExistingMonthlySopTask = {
  id: string;
  title: string;
  due_date?: string | null;
  assignee?: string | null;
  recurrence?: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
};

type TemplateRow = {
  id: string;
  natural_key: string;
};

const EXPECTED_TASKS = 56;

function templatePayload(template: MonthlySopTemplate, userId: string, targetMonth: string, targetYear: number) {
  const naturalKey = monthlySopTemplateKey(template);
  return {
    user_id: userId,
    natural_key: naturalKey,
    title: template.title,
    description: template.title,
    category: "Operations",
    frequency: "monthly",
    schedule_label: template.sourceSection,
    preferred_due_timing: template.preferredDay ?? template.weekday ?? template.sopDay,
    week_scope: template.sopWeek,
    week_of_month: Number(template.sopWeek.match(/\d+/)?.[0] ?? null) || null,
    day_of_week: template.weekday ?? template.preferredDay ?? template.sopDay,
    assigned_to: MONTHLY_SOP_IMPORT.assignedTo,
    assigned_role: "Operations Manager",
    panel: "Operations",
    business_unit: "residential",
    priority: "normal",
    status: "active",
    source: "monthly_sop",
    metadata: {
      active: true,
      source_document_name: MONTHLY_SOP_IMPORT.sourceDocumentName,
      source_section: template.sourceSection,
      sop_week: template.sopWeek,
      sop_day: template.sopDay,
      recurrence_type: template.recurrenceType,
      recurrence_rule: template.recurrenceRule,
      preferred_day: template.preferredDay ?? null,
      nth: template.nth ?? null,
      weekday: template.weekday ?? null,
      original_title: template.title,
      recurrence_start_date: MONTHLY_SOP_IMPORT.calendarStartDate,
      last_generated_month: targetMonth,
      last_generated_year: targetYear,
      template_key: naturalKey,
    },
    updated_at: new Date().toISOString(),
  };
}

function taskMetadata(instance: MonthlySopInstance, dedupeKey: string, templateId: string | null) {
  return {
    source: "monthly_sop_import",
    source_document_name: MONTHLY_SOP_IMPORT.sourceDocumentName,
    source_section: instance.sourceSection,
    sop_week: instance.sopWeek,
    sop_day: instance.sopDay,
    target_month: instance.targetMonth,
    target_year: instance.targetYear,
    calendar_start_date: MONTHLY_SOP_IMPORT.calendarStartDate,
    assigned_to: "Carlos",
    recurrence_type: instance.recurrenceType,
    recurrence_rule: instance.recurrenceRule,
    preferred_day: instance.preferredDay ?? null,
    nth: instance.nth ?? null,
    weekday: instance.weekday ?? null,
    original_title: instance.title,
    recurrence_start_date: MONTHLY_SOP_IMPORT.calendarStartDate,
    active: true,
    template_id: templateId,
    dedupe_key: dedupeKey,
    notify_assignee_on_assignment: true,
    notify_owner_on_completed: true,
  };
}

function fallbackDedupeKey(instance: MonthlySopInstance) {
  return monthlySopDedupeKey(instance, null);
}

function legacyDedupeKey(row: ExistingMonthlySopTask) {
  const metadata = row.metadata ?? {};
  return [
    MONTHLY_SOP_IMPORT.sourceDocumentName,
    metadata.target_month,
    metadata.target_year,
    metadata.sop_week,
    metadata.sop_day,
    String(row.title ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
  ].join("|");
}

async function requestTarget(request: NextRequest) {
  try {
    const body = await request.json() as { month?: number; year?: number };
    return {
      month: body.month ?? 6,
      year: body.year ?? 2026,
    };
  } catch {
    return { month: 6, year: 2026 };
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (MONTHLY_SOP_IMPORT.templates.length !== EXPECTED_TASKS) {
    return NextResponse.json({
      ok: false,
      error: `Monthly SOP template definition has ${MONTHLY_SOP_IMPORT.templates.length} tasks; expected ${EXPECTED_TASKS}.`,
    }, { status: 500 });
  }

  const target = await requestTarget(request);
  const instances = generateMonthlySopTasks(target.month, target.year);
  const now = new Date().toISOString();

  const { error: templateError } = await supabase
    .from("operation_task_templates")
    .upsert(MONTHLY_SOP_IMPORT.templates.map((template) => templatePayload(template, user.id, instances[0]?.targetMonth ?? "June", target.year)), {
      onConflict: "user_id,natural_key",
    });

  if (templateError) {
    return NextResponse.json({ ok: false, error: templateError.message }, { status: 500 });
  }

  const { data: templateRows, error: templateReadError } = await supabase
    .from("operation_task_templates")
    .select("id,natural_key")
    .eq("user_id", user.id)
    .eq("source", "monthly_sop");

  if (templateReadError) {
    return NextResponse.json({ ok: false, error: templateReadError.message }, { status: 500 });
  }

  const templateIdByKey = new Map(((templateRows ?? []) as TemplateRow[]).map((template) => [template.natural_key, template.id]));

  const { data: existingRows, error: readError } = await supabase
    .from("operation_tasks")
    .select("id,title,due_date,assignee,recurrence,status,metadata")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .contains("metadata", {
      source_document_name: MONTHLY_SOP_IMPORT.sourceDocumentName,
      target_month: instances[0]?.targetMonth,
      target_year: target.year,
    });

  if (readError) {
    return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
  }

  const existingByDedupeKey = new Map<string, ExistingMonthlySopTask>();
  const duplicateIdsToArchive = new Set<string>();
  for (const row of (existingRows ?? []) as ExistingMonthlySopTask[]) {
    const dedupeKey = typeof row.metadata?.dedupe_key === "string" ? row.metadata.dedupe_key : null;
    const keys = Array.from(new Set([dedupeKey, legacyDedupeKey(row)].filter((key): key is string => Boolean(key))));
    for (const key of keys) {
      const existing = existingByDedupeKey.get(key);
      if (!existing) {
        existingByDedupeKey.set(key, row);
        continue;
      }
      if (existing.id === row.id) continue;
      const keepExisting = existing.status === "completed" || row.status !== "completed";
      duplicateIdsToArchive.add(keepExisting ? row.id : existing.id);
      if (!keepExisting) existingByDedupeKey.set(key, row);
    }
  }

  let created = 0;
  let duplicatesSkipped = 0;
  let updated = 0;
  let archivedDuplicates = 0;

  if (duplicateIdsToArchive.size > 0) {
    const { error } = await supabase
      .from("operation_tasks")
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .in("id", Array.from(duplicateIdsToArchive));
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    archivedDuplicates = duplicateIdsToArchive.size;
  }

  for (const instance of instances) {
    const templateKey = monthlySopTemplateKey(instance);
    const templateId = templateIdByKey.get(templateKey) ?? null;
    const dedupeKey = monthlySopDedupeKey(instance, templateId);
    const existing = existingByDedupeKey.get(dedupeKey) ?? existingByDedupeKey.get(fallbackDedupeKey(instance));
    const metadata = taskMetadata(instance, dedupeKey, templateId);
    const status = existing?.status === "completed" ? "completed" : "pending";
    const payload = {
      user_id: user.id,
      title: instance.title,
      description: instance.title,
      priority: "normal",
      status,
      category: "Operations",
      due_date: instance.dueDate,
      assignee: MONTHLY_SOP_IMPORT.assignedTo,
      assigned_by: MONTHLY_SOP_IMPORT.sourceDocumentName,
      panel: "Operations",
      business_unit: "residential",
      reminder: true,
      recurrence: "monthly",
      custom_interval_days: null,
      metadata,
      created_by: user.id,
      updated_at: now,
    };

    if (!existing) {
      const { error } = await supabase.from("operation_tasks").insert({ ...payload, created_at: now });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      created += 1;
      continue;
    }

    const existingMetadata = existing.metadata ?? {};
    const alreadyCurrent =
      existing.title === instance.title &&
      existing.due_date === instance.dueDate &&
      existing.assignee === MONTHLY_SOP_IMPORT.assignedTo &&
      existing.recurrence === "monthly" &&
      existing.status === status &&
      existingMetadata.source_document_name === metadata.source_document_name &&
      existingMetadata.source_section === metadata.source_section &&
      existingMetadata.sop_week === metadata.sop_week &&
      existingMetadata.sop_day === metadata.sop_day &&
      existingMetadata.target_month === metadata.target_month &&
      existingMetadata.target_year === metadata.target_year &&
      existingMetadata.recurrence_type === metadata.recurrence_type &&
      existingMetadata.recurrence_rule === metadata.recurrence_rule &&
      existingMetadata.template_id === metadata.template_id &&
      existingMetadata.dedupe_key === metadata.dedupe_key;

    if (alreadyCurrent) {
      duplicatesSkipped += 1;
      continue;
    }

    const { error } = await supabase.from("operation_tasks").update(payload).eq("id", existing.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    updated += 1;
  }

  const processed = created + duplicatesSkipped + updated;
  const templatesVerified = MONTHLY_SOP_IMPORT.templates.length;
  const mismatch = processed !== EXPECTED_TASKS || templatesVerified !== EXPECTED_TASKS;
  const monthLabel = `${instances[0]?.targetMonth ?? "June"} ${target.year}`;

  return NextResponse.json({
    ok: !mismatch,
    message: mismatch ? "Import count mismatch. Please review the Monthly SOP import." : "Monthly SOP imported successfully.",
    expected: EXPECTED_TASKS,
    created,
    duplicatesSkipped,
    archivedDuplicates,
    updated,
    templatesVerified,
    recurrence: templatesVerified === EXPECTED_TASKS ? "active monthly" : "Monthly SOP tasks were imported, but recurrence templates were not created.",
    month: monthLabel,
    calendarStart: target.month === 6 && target.year === 2026 ? MONTHLY_SOP_IMPORT.calendarStartLabel : `Generated from Monthly SOP templates for ${monthLabel}`,
    sourceDocument: MONTHLY_SOP_IMPORT.sourceDocumentName,
    processed,
  });
}

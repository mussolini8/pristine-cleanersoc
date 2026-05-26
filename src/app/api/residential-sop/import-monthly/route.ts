import { NextResponse } from "next/server";
import { MONTHLY_SOP_IMPORT, monthlySopDedupeKey, type MonthlySopImportTask } from "@/lib/operations/monthly-sop-import";
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

const EXPECTED_TASKS = 56;

function taskMetadata(task: MonthlySopImportTask, dedupeKey: string) {
  return {
    source: "monthly_sop_import",
    source_document_name: MONTHLY_SOP_IMPORT.sourceDocumentName,
    source_section: task.sourceSection,
    sop_week: task.sopWeek,
    sop_day: task.sopDay,
    target_month: MONTHLY_SOP_IMPORT.targetMonth,
    target_year: MONTHLY_SOP_IMPORT.targetYear,
    calendar_start_date: MONTHLY_SOP_IMPORT.calendarStartDate,
    assigned_to: "Carlos",
    recurrence_type: "monthly",
    dedupe_key: dedupeKey,
    notify_assignee_on_assignment: false,
    notify_owner_on_completed: true,
  };
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (MONTHLY_SOP_IMPORT.tasks.length !== EXPECTED_TASKS) {
    return NextResponse.json({
      ok: false,
      error: `Monthly SOP import definition has ${MONTHLY_SOP_IMPORT.tasks.length} tasks; expected ${EXPECTED_TASKS}.`,
    }, { status: 500 });
  }

  const { data: existingRows, error: readError } = await supabase
    .from("operation_tasks")
    .select("id,title,due_date,assignee,recurrence,status,metadata")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .contains("metadata", {
      source_document_name: MONTHLY_SOP_IMPORT.sourceDocumentName,
      target_month: MONTHLY_SOP_IMPORT.targetMonth,
      target_year: MONTHLY_SOP_IMPORT.targetYear,
    });

  if (readError) {
    return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
  }

  const existingByDedupeKey = new Map<string, ExistingMonthlySopTask>();
  for (const row of (existingRows ?? []) as ExistingMonthlySopTask[]) {
    const dedupeKey = typeof row.metadata?.dedupe_key === "string" ? row.metadata.dedupe_key : null;
    if (dedupeKey) existingByDedupeKey.set(dedupeKey, row);
  }

  const now = new Date().toISOString();
  let created = 0;
  let duplicatesSkipped = 0;
  let updated = 0;

  for (const task of MONTHLY_SOP_IMPORT.tasks) {
    const dedupeKey = monthlySopDedupeKey(task);
    const existing = existingByDedupeKey.get(dedupeKey);
    const metadata = taskMetadata(task, dedupeKey);
    const status = existing?.status === "completed" ? "completed" : "pending";
    const payload = {
      user_id: user.id,
      title: task.title,
      description: task.title,
      priority: "normal",
      status,
      category: "Operations",
      due_date: task.dueDate,
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
      existing.title === task.title &&
      existing.due_date === task.dueDate &&
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
  const mismatch = processed !== EXPECTED_TASKS;

  return NextResponse.json({
    ok: !mismatch,
    message: mismatch ? "Import count mismatch. Please review the Monthly SOP import." : "Monthly SOP imported successfully.",
    expected: EXPECTED_TASKS,
    created,
    duplicatesSkipped,
    updated,
    month: `${MONTHLY_SOP_IMPORT.targetMonth} ${MONTHLY_SOP_IMPORT.targetYear}`,
    calendarStart: MONTHLY_SOP_IMPORT.calendarStartLabel,
    sourceDocument: MONTHLY_SOP_IMPORT.sourceDocumentName,
    processed,
  });
}

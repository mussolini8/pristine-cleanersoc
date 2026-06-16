import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/tasks/deduplicate
 *
 * Soft-deletes duplicate operation_tasks where the same (normalized title, due_date day)
 * appears more than once. Keeps the best record per slot:
 *   1. Completed tasks over pending/todo ones
 *   2. Among same status, the task with the highest metadata quality (has dedupe_key) wins;
 *      otherwise the lexicographically smallest UUID (stable sort) is kept.
 *
 * Safe to call repeatedly — idempotent.
 */

function normTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all active tasks for this user
  const { data: tasks, error: fetchError } = await supabase
    .from("operation_tasks")
    .select("id,title,due_date,status,metadata,created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  }

  const rows = (tasks ?? []) as TaskRow[];

  // Group by normalized title + day
  const groups = new Map<string, TaskRow[]>();
  for (const t of rows) {
    if (!t.title || !t.due_date) continue;
    const day = String(t.due_date).split("T")[0];
    const key = `${normTitle(t.title)}|${day}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const toArchive: string[] = [];
  let duplicateGroups = 0;

  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    duplicateGroups++;

    // Sort: completed first → has dedupe_key in metadata → oldest created_at → stable by id
    group.sort((a, b) => {
      const aComp = a.status === "completed" ? 0 : 1;
      const bComp = b.status === "completed" ? 0 : 1;
      if (aComp !== bComp) return aComp - bComp;

      const aHasKey = typeof (a.metadata ?? {}).dedupe_key === "string" ? 0 : 1;
      const bHasKey = typeof (b.metadata ?? {}).dedupe_key === "string" ? 0 : 1;
      if (aHasKey !== bHasKey) return aHasKey - bHasKey;

      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;

      return a.id.localeCompare(b.id);
    });

    // Keep group[0], archive the rest
    for (const dup of group.slice(1)) {
      toArchive.push(dup.id);
    }
  }

  let archived = 0;

  if (toArchive.length > 0) {
    const now = new Date().toISOString();
    // Process in chunks to avoid query size limits
    const CHUNK = 100;
    for (let i = 0; i < toArchive.length; i += CHUNK) {
      const chunk = toArchive.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("operation_tasks")
        .update({ deleted_at: now, updated_at: now })
        .in("id", chunk)
        .eq("user_id", user.id); // safety: only touch own tasks

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      archived += chunk.length;
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: rows.length,
    duplicateGroups,
    archived,
    message:
      archived === 0
        ? "No duplicates found — all tasks are already unique."
        : `Removed ${archived} duplicate task${archived === 1 ? "" : "s"} across ${duplicateGroups} group${duplicateGroups === 1 ? "" : "s"}.`,
  });
}

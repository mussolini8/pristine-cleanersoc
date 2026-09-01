import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SopTemplateForGeneration = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  assigned_to: string | null;
  assigned_role: string | null;
  panel: string;
  frequency: string;
  day_of_week: string | null;
  week_of_month: number | null;
};

type OperationTaskInsert = {
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: "todo";
  due_date: string;
  assignee: string | null;
  assigned_by: string | null;
  panel: string;
  recurrence: "none";
  reminder: false;
  sop_source_key: string;
  created_at: string;
  updated_at: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const targetYear = body.year ? parseInt(body.year) : new Date().getFullYear();
  const targetMonth = body.month ? parseInt(body.month) : new Date().getMonth() + 1; // 1-12

  // 1. Fetch Templates
  const { data: templates, error: templateError } = await supabase
    .from("operation_task_templates")
    .select("*")
    .eq("panel", "Residential")
    .eq("status", "active");

  if (templateError) {
    return NextResponse.json({ ok: false, error: templateError.message }, { status: 500 });
  }

  if (!templates || templates.length === 0) {
    return NextResponse.json({ ok: false, expected: 0, created: 0, existing: 0, skipped: 0, error: "No templates found. Please seed templates first." });
  }

  // 2. Generate instances based on frequency
  const instancesToCreate: OperationTaskInsert[] = [];
  let expectedCount = 0;

  for (const t of templates) {
    const dates = generateDatesForTemplate(t, targetYear, targetMonth);
    for (const dateStr of dates) {
      expectedCount++;
      instancesToCreate.push({
        user_id: user.id,
        title: t.title,
        description: t.description,
        category: t.category,
        priority: t.priority,
        status: "todo",
        due_date: dateStr,
        assignee: t.assigned_to,
        assigned_by: t.assigned_role,
        panel: t.panel,
        recurrence: "none",
        reminder: false,
        sop_source_key: `sop:${t.id}:${dateStr}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  // 3. Check existing by sop_source_key AND by normalized (title, due_date) pair
  //    The second check prevents duplicates when import-monthly already created the same task
  //    under a different panel (e.g. "Operations" vs "Residential").
  const sopSourceKeys = instancesToCreate.map(i => i.sop_source_key);

  const targetDates = [...new Set(instancesToCreate.map(i => i.due_date))];
  const startDate = targetDates.reduce((a, b) => (a < b ? a : b));
  const endDate   = targetDates.reduce((a, b) => (a > b ? a : b));

  const [{ data: existingBySopKey }, { data: existingByDate }] = await Promise.all([
    supabase.from("operation_tasks").select("sop_source_key").in("sop_source_key", sopSourceKeys).is("deleted_at", null),
    supabase.from("operation_tasks").select("title,due_date").is("deleted_at", null).gte("due_date", startDate).lte("due_date", endDate),
  ]);

  const existingKeys = new Set(existingBySopKey?.map(e => e.sop_source_key) ?? []);

  // Build a set of "normTitle|YYYY-MM-DD" for all tasks that already exist in this date range
  const normTitle = (t: string) =>
    t.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const existingTitleDateKeys = new Set(
    (existingByDate ?? [])
      .filter(e => e.title && e.due_date)
      .map(e => `${normTitle(e.title)}|${String(e.due_date).split("T")[0]}`)
  );

  const seenKeysInBatch = new Set<string>();
  const newInstances = instancesToCreate.filter(i => {
    if (existingKeys.has(i.sop_source_key)) return false;
    const titleDateKey = `${normTitle(i.title)}|${i.due_date}`;
    if (existingTitleDateKeys.has(titleDateKey)) return false;
    if (seenKeysInBatch.has(titleDateKey) || seenKeysInBatch.has(i.sop_source_key)) return false;
    seenKeysInBatch.add(titleDateKey);
    seenKeysInBatch.add(i.sop_source_key);
    return true;
  });

  // 4. Insert ONLY new ones (idempotent)
  if (newInstances.length > 0) {
    const { error: insertError } = await supabase
      .from("operation_tasks")
      .insert(newInstances);
      
    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    expected: expectedCount,
    created: newInstances.length,
    existing: existingKeys.size,
    skipped: existingKeys.size,
  });
}

function generateDatesForTemplate(t: SopTemplateForGeneration, year: number, month: number): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  if (t.frequency === "daily") {
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      const dayOfWeek = date.getUTCDay(); // 0 = Sun, 6 = Sat
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        dates.push(formatDate(date));
      }
    }
  } else if (t.frequency === "weekly" && !t.week_of_month) {
    // True recurring weekly template without a specific week_of_month slot
    const targetDayIndex = parseDayOfWeek(t.day_of_week ?? "Friday");
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCDay() === targetDayIndex) {
        dates.push(formatDate(date));
      }
    }
  } else {
    // Monthly or week-specific template (e.g. Week 1 Friday, Week 2 Wednesday, etc.)
    const targetDayIndex = parseDayOfWeek(t.day_of_week ?? "Friday");
    const weekOfMonth = t.week_of_month ?? 1;
    
    let currentWeek = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCDay() === targetDayIndex) {
        currentWeek++;
        if (currentWeek === weekOfMonth) {
          dates.push(formatDate(date));
          break;
        }
      }
    }
    // Fallback if the month doesn't have that nth week, use the last occurrence of that day
    if (dates.length === 0) {
      for (let day = daysInMonth; day >= 1; day--) {
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCDay() === targetDayIndex) {
          dates.push(formatDate(date));
          break;
        }
      }
    }
  }

  return dates;
}

function parseDayOfWeek(dayStr: string): number {
  const map: Record<string, number> = {
    "sunday": 0, "monday": 1, "tuesday": 2, "wednesday": 3, "thursday": 4, "friday": 5, "saturday": 6
  };
  return map[dayStr.toLowerCase()] ?? 5; // Default to Friday
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

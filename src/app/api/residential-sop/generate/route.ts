import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";

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
  const instancesToCreate = [];
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

  // 3. Check existing to give accurate summary
  const sopSourceKeys = instancesToCreate.map(i => i.sop_source_key);
  const { data: existing } = await supabase
    .from("operation_tasks")
    .select("sop_source_key")
    .in("sop_source_key", sopSourceKeys);

  const existingKeys = new Set(existing?.map(e => e.sop_source_key) ?? []);
  const newInstances = instancesToCreate.filter(i => !existingKeys.has(i.sop_source_key));

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

function generateDatesForTemplate(t: any, year: number, month: number): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  if (t.frequency === "daily") {
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        dates.push(formatDate(date));
      }
    }
  } else if (t.frequency === "weekly") {
    // Find the specified day_of_week
    const targetDayIndex = parseDayOfWeek(t.day_of_week ?? "Monday");
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() === targetDayIndex) {
        dates.push(formatDate(date));
      }
    }
  } else if (t.frequency === "monthly") {
    // Determine the exact date based on week_of_month and day_of_week
    const targetDayIndex = parseDayOfWeek(t.day_of_week ?? "Monday");
    const weekOfMonth = t.week_of_month ?? 1;
    
    let currentWeek = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() === targetDayIndex) {
        currentWeek++;
        if (currentWeek === weekOfMonth) {
          dates.push(formatDate(date));
          break;
        }
      }
    }
    // Fallback if the month doesn't have a 5th week, just put it on the last instance of that day
    if (dates.length === 0) {
      for (let day = daysInMonth; day >= 1; day--) {
        const date = new Date(year, month - 1, day);
        if (date.getDay() === targetDayIndex) {
          dates.push(formatDate(date));
          break;
        }
      }
    }
  } else {
    // Fallback to 1st of month
    dates.push(formatDate(new Date(year, month - 1, 1)));
  }

  return dates;
}

function parseDayOfWeek(dayStr: string): number {
  const map: Record<string, number> = {
    "sunday": 0, "monday": 1, "tuesday": 2, "wednesday": 3, "thursday": 4, "friday": 5, "saturday": 6
  };
  return map[dayStr.toLowerCase()] ?? 1; // Default to Monday
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

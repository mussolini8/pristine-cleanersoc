import { NextResponse } from "next/server";
import residentialSopTasks from "@/data/residential-sop-tasks.json";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type SopTaskSeed = {
  natural_key: string;
  title: string;
  description: string;
  category: string;
  frequency: string;
  schedule_label: string;
  preferred_due_timing: string;
  week_scope: string;
  week_of_month: number | null;
  day_of_week: string | null;
  priority: string;
};

const tasks = residentialSopTasks as SopTaskSeed[];

function staffPayload(userId: string, email: string) {
  return {
    user_id: userId,
    name: "Carlos Lopez",
    email,
    role: "Operations Manager",
    display_role: "Operations Manager",
    team_scope: "global",
    status: "Active",
    updated_at: new Date().toISOString(),
  };
}

function templatePayload(task: SopTaskSeed, userId: string) {
  return {
    user_id: userId,
    natural_key: task.natural_key,
    title: task.title,
    description: task.description,
    category: task.category,
    frequency: task.frequency,
    schedule_label: task.schedule_label,
    preferred_due_timing: task.preferred_due_timing,
    week_scope: task.week_scope,
    week_of_month: task.week_of_month,
    day_of_week: task.day_of_week,
    assigned_to: "Carlos Lopez",
    assigned_role: "Operations Manager",
    panel: "Residential",
    business_unit: "Pristine Cleaners / Residential",
    priority: task.priority,
    status: "active",
    source: "monthly_sop",
    metadata: { notification: "template_seed_no_email" },
    updated_at: new Date().toISOString(),
  };
}

export async function POST() {
  const supabase = await createClient();
  const env = getServerEnv();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const operationsEmail = env.OPERATIONS_MANAGER_EMAIL ?? "operations-manager@pristine.local";
  const { data: existingStaff, error: staffReadError } = await supabase
    .from("staff_members")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", "Carlos Lopez")
    .limit(1);

  if (staffReadError) {
    return NextResponse.json({ ok: false, error: staffReadError.message }, { status: 500 });
  }

  if (existingStaff?.[0]?.id) {
    const { error } = await supabase.from("staff_members").update(staffPayload(user.id, operationsEmail)).eq("id", existingStaff[0].id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("staff_members").insert({ ...staffPayload(user.id, operationsEmail), created_at: new Date().toISOString() });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { error: templateError } = await supabase
    .from("operation_task_templates")
    .upsert(tasks.map((task) => templatePayload(task, user.id)), { onConflict: "user_id,natural_key" });

  if (templateError) {
    return NextResponse.json({ ok: false, error: templateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    seeded: tasks.length,
    assignedTo: "Carlos Lopez",
    notifications: "not_sent_for_templates",
  });
}

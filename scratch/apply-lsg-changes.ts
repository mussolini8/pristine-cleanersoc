import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const email = "pristineseo@pristine.local";
  const password = "123456";

  console.log(`Logging in as ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }

  const userId = authData.user?.id;
  const lsgAccountId = "a18dcd47-4516-407e-9c40-cd53fb1ff3c9";
  const vanessaStaffId = "2740de62-2d83-449b-be46-f611dc70575d";
  const luzStaffId = "da397a83-021b-426d-ad78-8559af12cf4b";

  console.log(`User ID: ${userId}`);

  // 1. Delete existing rules for LSG to avoid duplication if we re-run
  console.log("Deleting existing schedule rules for LSG Sky Chefs...");
  const { error: deleteRulesError } = await supabase
    .from("commercial_account_schedule_rules")
    .delete()
    .eq("commercial_account_id", lsgAccountId);

  if (deleteRulesError) {
    console.error("Error deleting old rules:", deleteRulesError);
    return;
  }

  // 2. Define schedule rules
  const rules = [
    // Vanessa Ortega: Domingo (0), Lunes (1), Miercoles (3), Jueves (4)
    { day: 0, cleaner: "Vanessa Ortega", notes: "Vanessa Ortega schedule: Sunday 10h" },
    { day: 1, cleaner: "Vanessa Ortega", notes: "Vanessa Ortega schedule: Monday 10h" },
    { day: 3, cleaner: "Vanessa Ortega", notes: "Vanessa Ortega schedule: Wednesday 10h" },
    { day: 4, cleaner: "Vanessa Ortega", notes: "Vanessa Ortega schedule: Thursday 10h" },
    // Luz Uribe: martes (2), viernes (5), sabado (6)
    { day: 2, cleaner: "Luz Uribe", notes: "Luz Uribe schedule: Tuesday 10h" },
    { day: 5, cleaner: "Luz Uribe", notes: "Luz Uribe schedule: Friday 10h" },
    { day: 6, cleaner: "Luz Uribe", notes: "Luz Uribe schedule: Saturday 10h" },
  ];

  const now = new Date().toISOString();
  const rulesPayload = rules.map((r) => ({
    commercial_account_id: lsgAccountId,
    day_of_week: r.day,
    paid_hours: 10,
    scheduled_hours: 10,
    assigned_cleaner_name: r.cleaner,
    effective_start_date: "2026-07-15",
    effective_end_date: null,
    effective_from: "2026-07-15",
    effective_until: null,
    active: true,
    frequency_type: "weekly",
    frequency_interval: 1,
    anchor_date: null,
    user_id: userId,
    notes: r.notes,
    created_at: now,
    updated_at: now,
  }));

  console.log("Inserting new schedule rules...");
  const { data: insertedRules, error: insertRulesError } = await supabase
    .from("commercial_account_schedule_rules")
    .insert(rulesPayload)
    .select();

  if (insertRulesError) {
    console.error("Error inserting rules:", insertRulesError);
    return;
  }
  console.log(`Successfully inserted ${insertedRules.length} schedule rules.`);

  // 3. Delete existing hours entries for LSG starting from 2026-07-15 to avoid duplication if we re-run
  console.log("Deleting existing hours entries for LSG starting July 15...");
  const { error: deleteHoursError } = await supabase
    .from("commercial_hours_entries")
    .delete()
    .eq("account_id", lsgAccountId)
    .gte("work_date", "2026-07-15");

  if (deleteHoursError) {
    console.error("Error deleting hours entries:", deleteHoursError);
    return;
  }

  // 4. Insert hours entries for Vanessa Ortega (Wednesday July 15 & Thursday July 16)
  const hoursPayload = [
    {
      user_id: userId,
      account_id: lsgAccountId,
      account_name: "LSG Sky Chefs",
      team_id: vanessaStaffId,
      team_name: "Vanessa Ortega",
      work_date: "2026-07-15", // Wednesday
      scheduled_day: "Wednesday",
      scheduled_hours: 10,
      completed_hours: 10,
      verified_hours: 10,
      status: "completed",
      verified: true,
      notes: "Vanessa Ortega - LSG Sky Chefs Wednesday 10h",
      manual_entry: true,
      period_start: "2026-07-01",
      period_end: "2026-07-15",
      created_at: now,
      updated_at: now,
    },
    {
      user_id: userId,
      account_id: lsgAccountId,
      account_name: "LSG Sky Chefs",
      team_id: vanessaStaffId,
      team_name: "Vanessa Ortega",
      work_date: "2026-07-16", // Thursday
      scheduled_day: "Thursday",
      scheduled_hours: 10,
      completed_hours: 10,
      verified_hours: 10,
      status: "completed",
      verified: true,
      notes: "Vanessa Ortega - LSG Sky Chefs Thursday 10h",
      manual_entry: true,
      period_start: "2026-07-16",
      period_end: "2026-07-31",
      created_at: now,
      updated_at: now,
    }
  ];

  console.log("Inserting new hours entries...");
  const { data: insertedHours, error: insertHoursError } = await supabase
    .from("commercial_hours_entries")
    .insert(hoursPayload)
    .select();

  if (insertHoursError) {
    console.error("Error inserting hours entries:", insertHoursError);
    return;
  }
  console.log(`Successfully inserted ${insertedHours.length} hours entries.`);
}

main().catch(console.error);

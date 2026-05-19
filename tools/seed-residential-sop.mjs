import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvConfig(root);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const seedUserId = process.env.SUPABASE_SEED_USER_ID || process.env.SEED_USER_ID;
const seedEmail = process.env.SEED_USER_EMAIL;
const seedPassword = process.env.SEED_USER_PASSWORD;
const operationsEmail = process.env.OPERATIONS_MANAGER_EMAIL || "operations-manager@pristine.local";

if (!supabaseUrl || !anonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

const dataPath = resolve(root, "src/data/residential-sop-tasks.json");
const tasks = JSON.parse(await readFile(dataPath, "utf8"));

function staffPayload(userId) {
  return {
    user_id: userId,
    name: "Carlos Lopez",
    email: operationsEmail,
    role: "Operations Manager",
    display_role: "Operations Manager",
    team_scope: "global",
    status: "Active",
    updated_at: new Date().toISOString(),
  };
}

function templatePayload(task, userId) {
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
    metadata: { sourceFile: "Monthly SOP.docx", notification: "template_seed_no_email" },
    updated_at: new Date().toISOString(),
  };
}

async function resolveClientAndUser() {
  if (serviceKey && seedUserId) {
    return {
      userId: seedUserId,
      supabase: createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }),
      mode: "service-role",
    };
  }

  if (!seedEmail || !seedPassword) {
    throw new Error([
      "Seed requires either SUPABASE_SERVICE_ROLE_KEY + SUPABASE_SEED_USER_ID,",
      "or SEED_USER_EMAIL + SEED_USER_PASSWORD for an existing app user.",
      "No emails are sent by this seed.",
    ].join(" "));
  }

  const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: seedEmail,
    password: seedPassword,
  });
  if (error || !data.user) throw new Error(error?.message ?? "Could not sign in seed user.");
  return { userId: data.user.id, supabase, mode: "authenticated-user" };
}

const { supabase, userId, mode } = await resolveClientAndUser();

const { data: existingStaff, error: staffReadError } = await supabase
  .from("staff_members")
  .select("id,name")
  .eq("user_id", userId)
  .ilike("name", "Carlos Lopez")
  .limit(1);

if (staffReadError) throw new Error(`Could not read staff_members: ${staffReadError.message}`);

if (existingStaff?.[0]?.id) {
  const { error } = await supabase
    .from("staff_members")
    .update(staffPayload(userId))
    .eq("id", existingStaff[0].id);
  if (error) throw new Error(`Could not update Carlos Lopez: ${error.message}`);
} else {
  const { error } = await supabase
    .from("staff_members")
    .insert({ ...staffPayload(userId), created_at: new Date().toISOString() });
  if (error) throw new Error(`Could not create Carlos Lopez: ${error.message}`);
}

const { error: templateError } = await supabase
  .from("operation_task_templates")
  .upsert(tasks.map((task) => templatePayload(task, userId)), {
    onConflict: "user_id,natural_key",
  });

if (templateError) throw new Error(`Could not upsert SOP templates: ${templateError.message}`);

console.log(`Seeded ${tasks.length} residential SOP task templates for Carlos Lopez.`);
console.log(`Mode: ${mode}`);
console.log("Notification behavior: templates are assigned but task_assigned emails are not sent during seed.");

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  console.log("Connecting to Supabase...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "pristineseo@pristine.local",
    password: "123456"
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }

  console.log("Logged in successfully. Searching for Field AI / Field Day accounts...");
  const { data: accounts, error: accErr } = await supabase
    .from("commercial_accounts")
    .select("*")
    .ilike("name", "%Field%");

  console.log("Accounts found:", accounts);

  if (accounts && accounts.length > 0) {
    for (const acc of accounts) {
      console.log(`Fixing account ${acc.name} (${acc.id})...`);
      // Restore hours to 6, ensure contract_end is 2026-08-31
      const { error: updErr } = await supabase
        .from("commercial_accounts")
        .update({
          hours: 6,
          contract_end: "2026-08-31",
          supplies_notes: `${acc.supplies_notes || ""}; Última limpieza activa el 31 de agosto de 2026. Sin servicios en septiembre.`.replace(/;;+/g, ";"),
          updated_at: new Date().toISOString()
        })
        .eq("id", acc.id);

      if (updErr) console.error("Error updating account:", updErr);
      else console.log("Account updated with hours: 6, contract_end: 2026-08-31");

      // Update schedule rules: active = true, effective_until = '2026-08-31'
      const { data: rules, error: rulesErr } = await supabase
        .from("commercial_account_schedule_rules")
        .select("*")
        .eq("commercial_account_id", acc.id);

      console.log(`Found ${rules?.length || 0} schedule rules for account.`);

      const { error: updRulesErr } = await supabase
        .from("commercial_account_schedule_rules")
        .update({
          active: true,
          effective_until: "2026-08-31",
          effective_end_date: "2026-08-31",
          updated_at: new Date().toISOString()
        })
        .eq("commercial_account_id", acc.id);

      if (updRulesErr) console.error("Error updating rules:", updRulesErr);
      else console.log("Schedule rules updated to active: true, effective_until: 2026-08-31");
    }
  }

  // Check and delete any September QC inspection schedules for Field AI
  console.log("Checking September QC inspection schedules for Field AI...");
  const { data: qcList, error: qcFetchErr } = await supabase
    .from("qc_inspection_schedules")
    .select("*")
    .ilike("account_name", "%Field%")
    .gte("specific_date", "2026-09-01");

  console.log("September QC schedules found:", qcList);

  if (qcList && qcList.length > 0) {
    const { error: delQcErr } = await supabase
      .from("qc_inspection_schedules")
      .delete()
      .ilike("account_name", "%Field%")
      .gte("specific_date", "2026-09-01");

    if (delQcErr) console.error("Error deleting September QC schedules:", delQcErr);
    else console.log(`Deleted ${qcList.length} September QC schedules for Field AI.`);
  }

  // Check and delete any September commercial hours entries for Field AI
  console.log("Checking September commercial hours entries for Field AI...");
  const { data: hoursList, error: hFetchErr } = await supabase
    .from("commercial_hours_entries")
    .select("*")
    .ilike("account_name", "%Field%")
    .gte("work_date", "2026-09-01");

  console.log("September hours entries found:", hoursList);

  if (hoursList && hoursList.length > 0) {
    const { error: delHErr } = await supabase
      .from("commercial_hours_entries")
      .delete()
      .ilike("account_name", "%Field%")
      .gte("work_date", "2026-09-01");

    if (delHErr) console.error("Error deleting September hours entries:", delHErr);
    else console.log(`Deleted ${hoursList.length} September hours entries for Field AI.`);
  }

  console.log("Done!");
}

main().catch(console.error);

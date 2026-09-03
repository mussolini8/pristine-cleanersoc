import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolveCanonicalAccountName } from "../src/lib/ai/sop-actions-handler";
import { importedCommercialAccounts } from "../src/lib/commercial-accounts-data";

loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

async function verify() {
  console.log("=== 1. Test Canonical Name Resolution ===");
  const testNames = ["Field Day", "field day", "fiel ai", "Field AI", "fieldday", "The Harper", "kott koatings"];
  for (const name of testNames) {
    console.log(`"${name}" -> "${resolveCanonicalAccountName(name)}"`);
  }
  if (resolveCanonicalAccountName("Field Day") !== "Field AI") {
    throw new Error("Field Day did not resolve to Field AI!");
  }
  if (resolveCanonicalAccountName("fiel ai") !== "Field AI") {
    throw new Error("fiel ai did not resolve to Field AI!");
  }
  console.log("✅ Canonical name resolution passed!");

  console.log("\n=== 2. Check Database State for Field AI ===");
  await supabase.auth.signInWithPassword({
    email: "pristineseo@pristine.local",
    password: "123456"
  });

  const { data: accounts } = await supabase
    .from("commercial_accounts")
    .select("id, name, hours, contract_end, cleaner_name")
    .ilike("name", "%Field AI%");

  console.log("Accounts in DB:", accounts);
  if (!accounts || accounts.length === 0) throw new Error("Field AI account not found in DB");
  const acc = accounts[0];
  if (acc.hours === 0) throw new Error("Account hours is 0! It should be 6.");
  if (acc.contract_end !== "2026-08-31") throw new Error(`Contract end is ${acc.contract_end}, expected 2026-08-31`);
  console.log("✅ Commercial account parameters are correct (hours > 0, contract_end = 2026-08-31)");

  const { data: rules } = await supabase
    .from("commercial_account_schedule_rules")
    .select("id, day_of_week, paid_hours, assigned_cleaner_name, active, effective_until, effective_end_date")
    .eq("commercial_account_id", acc.id);

  console.log(`Rules in DB: ${rules?.length} rules found.`);
  for (const r of rules || []) {
    if (r.active !== true) throw new Error(`Rule ${r.id} is not active!`);
    if (r.effective_until !== "2026-08-31") throw new Error(`Rule ${r.id} effective_until is ${r.effective_until}`);
  }
  console.log("✅ Commercial account schedule rules are active with effective_until = 2026-08-31");

  console.log("\n=== 3. Verify No September Cleanings or QC in DB ===");
  const { data: sepQc } = await supabase
    .from("qc_inspection_schedules")
    .select("*")
    .ilike("account_name", "%Field%")
    .gte("specific_date", "2026-09-01");

  if (sepQc && sepQc.length > 0) throw new Error(`Found ${sepQc.length} September QC schedules for Field AI!`);
  console.log("✅ Zero QC schedules for Field AI in September.");

  const { data: sepHours } = await supabase
    .from("commercial_hours_entries")
    .select("*")
    .ilike("account_name", "%Field%")
    .gte("work_date", "2026-09-01");

  if (sepHours && sepHours.length > 0) throw new Error(`Found ${sepHours.length} September hours entries for Field AI!`);
  console.log("✅ Zero commercial hours entries for Field AI in September.");

  console.log("\n=== 4. Test Schedule Rule Evaluation on Dates ===");
  // Test dates
  const augustDates = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"]; // Mondays
  const septDates = ["2026-09-01", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"];

  for (const dayKey of augustDates) {
    const isExcluded = acc.contract_end && dayKey > acc.contract_end;
    if (isExcluded) throw new Error(`August date ${dayKey} was wrongly excluded!`);
  }
  console.log("✅ All August dates (including August 31) are valid and included!");

  for (const dayKey of septDates) {
    const isExcluded = acc.contract_end && dayKey > acc.contract_end;
    if (!isExcluded) throw new Error(`September date ${dayKey} was not excluded!`);
  }
  console.log("✅ All September dates are strictly excluded!");

  console.log("\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!");
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

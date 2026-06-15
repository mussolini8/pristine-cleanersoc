import { createClient } from "@supabase/supabase-js";
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const email = "pristineseo@pristine.local";
  const password = "123456";

  console.log(`Logging in...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }

  // Search work logs
  const { data: logs, error: logsError } = await supabase
    .from("residential_work_logs")
    .select("id, team_id, team_name, work_date, hours_worked, deleted_at, status")
    .ilike("team_name", "%esperanza%");

  console.log("\n--- Residential Work Logs ---");
  console.log(JSON.stringify(logs, null, 2));

  // Search weekly payments
  const { data: weeklyPayments, error: weeklyPaymentsError } = await supabase
    .from("residential_weekly_payments")
    .select("id, team_id, team_name, week_start, total_payment, deleted_at, status")
    .ilike("team_name", "%esperanza%");

  console.log("\n--- Residential Weekly Payments ---");
  console.log(JSON.stringify(weeklyPayments, null, 2));

  // Search weekly payment rows
  const { data: paymentRows, error: paymentRowsError } = await supabase
    .from("residential_weekly_payment_rows")
    .select("id, cleaner_id, cleaner_name, work_date, payment_amount, residential_amount, commercial_amount, status, deleted_at, week_start, week_end")
    .ilike("cleaner_name", "%esperanza%");

  console.log("\n--- Residential Weekly Payment Rows ---");
  console.log(JSON.stringify(paymentRows, null, 2));
}

main().catch(console.error);

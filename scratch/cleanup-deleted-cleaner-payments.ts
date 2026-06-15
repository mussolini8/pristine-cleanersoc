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

  const targetCleanerId = "2717b343-499d-48b5-a02f-e8434f7694f1"; // Esperanza Yoseff
  const now = new Date().toISOString();

  console.log(`Soft-deleting pending payment rows for cleaner ${targetCleanerId}...`);
  const { data: updatedRows, error: updateRowsError } = await supabase
    .from("residential_weekly_payment_rows")
    .update({ deleted_at: now })
    .eq("cleaner_id", targetCleanerId)
    .eq("status", "pending");

  if (updateRowsError) {
    console.error("Error updating payment rows:", updateRowsError);
  } else {
    console.log("Successfully soft-deleted pending payment rows.");
  }

  console.log(`Soft-deleting pending work logs for cleaner ${targetCleanerId}...`);
  const { data: updatedLogs, error: updateLogsError } = await supabase
    .from("residential_work_logs")
    .update({ deleted_at: now })
    .eq("team_id", targetCleanerId)
    .eq("status", "pending");

  if (updateLogsError) {
    console.error("Error updating work logs:", updateLogsError);
  } else {
    console.log("Successfully soft-deleted pending work logs.");
  }

  console.log(`Soft-deleting pending weekly payments for cleaner ${targetCleanerId}...`);
  const { data: updatedPayments, error: updatePaymentsError } = await supabase
    .from("residential_weekly_payments")
    .update({ deleted_at: now })
    .eq("team_id", targetCleanerId)
    .eq("status", "pending");

  if (updatePaymentsError) {
    console.error("Error updating weekly payments:", updatePaymentsError);
  } else {
    console.log("Successfully soft-deleted pending weekly payments.");
  }
}

main().catch(console.error);

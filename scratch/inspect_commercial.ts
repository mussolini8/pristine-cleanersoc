import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  console.log("Fetching commercial schedule rules...");
  const { data: rules, error: err1 } = await supabase
    .from("commercial_account_schedule_rules")
    .select("*, commercial_accounts(name)");
  if (err1) console.error("Error rules:", err1);
  else {
    console.log(`Found ${rules.length} schedule rules.`);
    rules.forEach(r => {
      console.log(`Rule: Account: ${(r as any).commercial_accounts?.name}, DayOfWeek: ${r.day_of_week}, Cleaner: ${r.assigned_cleaner_name}`);
    });
  }

  console.log("Fetching commercial hours entries...");
  const { data: hours, error: err2 } = await supabase
    .from("commercial_hours_entries")
    .select("*");
  if (err2) console.error("Error hours:", err2);
  else {
    console.log(`Found ${hours.length} hours entries.`);
    hours.forEach(h => {
      console.log(`Hours Entry: Account: ${h.account_name}, Date: ${h.work_date}, Team: ${h.team_name}, Verified Hours: ${h.verified_hours}, Status: ${h.status}`);
    });
  }
}

main().catch(console.error);

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  const ocssAccountId = '93aa4335-911d-4a3b-9f6d-b759cff2ff07';
  
  // 1. Fetch schedule rules
  const { data: rules, error: rulesError } = await supabase
    .from("commercial_account_schedule_rules")
    .select("*")
    .eq("commercial_account_id", ocssAccountId);
  console.log("Schedule rules for OCSS Office:", rules);

  // 2. Fetch hours entries
  const { data: hours, error: hoursError } = await supabase
    .from("commercial_hours_entries")
    .select("*")
    .eq("account_id", ocssAccountId);
  console.log("Hours entries for OCSS Office:", hours);
}

main().catch(console.error);

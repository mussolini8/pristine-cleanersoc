import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  const { data: rules, error } = await supabase.from("commercial_account_schedule_rules").select("*").limit(20);
  if (error) {
    console.error("Error fetching rules:", error);
    return;
  }
  console.log("Existing schedule rules in DB:", rules.map(r => ({ id: r.id, commercial_account_id: r.commercial_account_id, user_id: r.user_id, day_of_week: r.day_of_week, paid_hours: r.paid_hours })));
}

main().catch(console.error);

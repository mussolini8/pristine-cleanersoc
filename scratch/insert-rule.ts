import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  const ocssAccountId = '93aa4335-911d-4a3b-9f6d-b759cff2ff07';
  const payload = {
    commercial_account_id: ocssAccountId,
    day_of_week: 6, // Saturday
    paid_hours: 2.5,
    scheduled_hours: 2.5,
    assigned_cleaner_name: 'Mirna Contreras',
    active: true,
    effective_start_date: '2026-06-06',
    effective_end_date: null,
    effective_from: '2026-06-06',
    effective_until: null,
    frequency_type: 'biweekly',
    frequency_interval: 2,
    anchor_date: '2026-06-06',
    notes: 'Every 2 weeks on Saturday starting June 6th',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("commercial_account_schedule_rules")
    .insert([payload])
    .select();

  if (error) {
    console.error("Insert failed:", error);
  } else {
    console.log("Insert succeeded! Data:", data);
  }
}

main().catch(console.error);

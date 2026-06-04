import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await supabase.from("residential_weekly_payment_rows").insert({
    user_id: "00000000-0000-0000-0000-000000000000",
    cleaner_id: "00000000-0000-0000-0000-000000000000",
    cleaner_name: "Carlos Lopez",
    work_date: new Date().toISOString().split("T")[0],
    city: "Operations",
    custom_city: null,
    payment_amount: 0,
    residential_amount: 280,
    commercial_amount: 0,
    payment_type: "operations_overtime",
    payment_mode: "residential_only",
    week_start: "2026-05-31",
    week_end: "2026-06-06",
    status: "pending",
    notes: "Test",
    updated_at: new Date().toISOString()
  });
  console.log("Error:", error);
}

main().catch(console.error);

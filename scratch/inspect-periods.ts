import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const email = "pristineseo@pristine.local";
  const password = "123456";

  console.log(`Logging in as ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }

  // Fetch pay periods
  const { data: periods, error: periodsError } = await supabase
    .from("commercial_pay_periods")
    .select("*")
    .order("start_date", { ascending: false });

  console.log("\n--- Pay Periods ---");
  console.log(JSON.stringify(periods, null, 2));
}

main().catch(console.error);

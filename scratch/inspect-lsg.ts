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

  const lsgAccountId = "a18dcd47-4516-407e-9c40-cd53fb1ff3c9";

  // Fetch LSG Sky Chefs Account
  const { data: account, error: accError } = await supabase
    .from("commercial_accounts")
    .select("*")
    .eq("id", lsgAccountId)
    .single();

  console.log("\n--- LSG Sky Chefs Account ---");
  console.log(JSON.stringify(account, null, 2));

  // Fetch Schedule Rules for LSG
  const { data: rules, error: rulesError } = await supabase
    .from("commercial_account_schedule_rules")
    .select("*")
    .eq("commercial_account_id", lsgAccountId);

  console.log("\n--- Schedule Rules ---");
  console.log(JSON.stringify(rules, null, 2));

  // Fetch Hours Entries for LSG
  const { data: hours, error: hoursError } = await supabase
    .from("commercial_hours_entries")
    .select("*")
    .eq("account_id", lsgAccountId)
    .order("work_date", { ascending: false });

  console.log("\n--- Hours Entries ---");
  console.log(JSON.stringify(hours, null, 2));
}

main().catch(console.error);

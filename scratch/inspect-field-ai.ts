import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  console.log("Logging in...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "pristineseo@pristine.local",
    password: "123456"
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }

  console.log("Searching for Field AI account in database...");
  const { data: accounts, error: accError } = await supabase
    .from("commercial_accounts")
    .select("*")
    .ilike("name", "%Field AI%");

  console.log("Accounts error:", accError);
  console.log("Accounts found:", JSON.stringify(accounts, null, 2));

  if (accounts && accounts.length > 0) {
    for (const acc of accounts) {
      const { data: rules, error: rulesError } = await supabase
        .from("commercial_account_schedule_rules")
        .select("*")
        .eq("commercial_account_id", acc.id);
      console.log(`Rules for ${acc.name} (${acc.id}):`, JSON.stringify(rules, null, 2));

      const { data: entries, error: entriesError } = await supabase
        .from("commercial_hours_entries")
        .select("*")
        .eq("account_id", acc.id)
        .gte("work_date", "2026-07-20");
      console.log(`Hours entries for ${acc.name} since July 20:`, JSON.stringify(entries, null, 2));
    }
  }
}

main().catch(console.error);

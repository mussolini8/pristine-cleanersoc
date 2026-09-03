import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: "pristineseo@pristine.local",
    password: "123456"
  });

  const { data: rules } = await supabase
    .from("commercial_account_schedule_rules")
    .select("*")
    .eq("commercial_account_id", "17117fe6-cb76-466d-b738-418532f46416");

  console.log("Field AI rules:", JSON.stringify(rules, null, 2));
}

main().catch(console.error);

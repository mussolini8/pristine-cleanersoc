import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  const { data: accounts, error } = await supabase.from("commercial_accounts").select("*");
  if (error) {
    console.error("Error fetching accounts:", error);
    return;
  }
  console.log("Accounts in DB:", accounts.map(a => ({ id: a.id, name: a.name, cleaner_name: a.cleaner_name })));
}

main().catch(console.error);

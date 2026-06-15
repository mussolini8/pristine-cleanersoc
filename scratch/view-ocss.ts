import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  const ocssAccountId = '93aa4335-911d-4a3b-9f6d-b759cff2ff07';
  const { data: account, error } = await supabase.from("commercial_accounts").select("*").eq("id", ocssAccountId).single();
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("OCSS Account Details:", account);
}

main().catch(console.error);

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  const r = await supabase.from("commercial_accounts").select("id, name, city");
  console.log("Count:", r.data?.length);
  console.log("Error:", r.error);
}

main().catch(console.error);

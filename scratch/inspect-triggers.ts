import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  console.log("Inspecting triggers in the database...");
  // Let's run a select query on pg_trigger using a simplerpc or by selecting if we have permissions
  // Wait, anon key cannot query pg_trigger directly, but let's see if we get a specific error
  const { data, error } = await supabase.from("profiles").select("*").limit(1);
  console.log("Profiles check:", { data, error });
}

main().catch(console.error);

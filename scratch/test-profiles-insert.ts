import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  console.log("Testing insert on public.profiles...");
  const tempId = "00000000-0000-0000-0000-000000000099";
  
  // Note: Since this is standard client, RLS might block it or show permission error, but we want to see if the database returns column/constraint errors
  const { error } = await supabase.from("profiles").insert({
    id: tempId,
    full_name: "Test User",
    username: "testusertemp",
    app_role: "residential",
    access_scope: "residential"
  });
  
  console.log("Result:", error);
}

main().catch(console.error);

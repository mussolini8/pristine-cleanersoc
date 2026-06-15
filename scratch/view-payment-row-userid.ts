import { createClient } from "@supabase/supabase-js";
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const email = "pristineseo@pristine.local";
  const password = "123456";

  console.log(`Logging in...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }

  // Fetch all details of the specific payment row
  const { data: row, error } = await supabase
    .from("residential_weekly_payment_rows")
    .select("*")
    .eq("id", "e984db75-5edd-43bd-b434-abaac03d36db")
    .single();

  if (error) {
    console.error("Error fetching row:", error);
    return;
  }

  console.log("\n--- Row Details ---");
  console.log(JSON.stringify(row, null, 2));
}

main().catch(console.error);

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
  const email = "pristinejanitorial@pristine.local";
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

  const userId = authData.user?.id;
  console.log(`Logged in successfully! User ID: ${userId}`);

  const { data, error } = await supabase
    .from("staff_members")
    .select("id, name, email, user_id, role, active, deleted_at, team_scope")
    .order("name");

  if (error) {
    console.error("Error querying staff_members:", error);
    return;
  }

  console.log("\n--- Staff Members in Database ---");
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);

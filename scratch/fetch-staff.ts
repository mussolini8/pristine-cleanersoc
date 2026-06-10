import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmZ2p5cnl0bGF2b2VxdWx0ZWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNjc3NjQsImV4cCI6MjA5Mzc0Mzc2NH0.eLFze09BFvVI4wEUL0zTg_QL7vO6I5YNCYY-5iohG7I";
const keyAlt = key.replace("lfgjyrytlavoequltefm", "lfgjyrtlavoqutlefm");

const supabase = createClient("https://lfgjyrtlavoqutlefm.supabase.co", keyAlt, {
  auth: { persistSession: false }
});

async function main() {
  // Try login in alternate DB
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "pristinejanitorial@pristine.local",
    password: "123456"
  });

  if (authError) {
    console.error("Login failed on alt DB:", authError.message);
    console.log("Trying pristinecleaners@pristine.local...");
    const { data: authData2, error: authError2 } = await supabase.auth.signInWithPassword({
      email: "pristinecleaners@pristine.local",
      password: "123456"
    });
    if (authError2) {
      console.error("Login fallback failed on alt DB:", authError2.message);
      return;
    }
  }

  const { data, error } = await supabase
    .from("staff_members")
    .select("id, name, role, team_scope, status, active, deleted_at")
    .order("name");
  
  if (error) {
    console.error("Error fetching staff from alt DB:", error);
    return;
  }
  
  console.log("SUCCESS ALT DB:");
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);

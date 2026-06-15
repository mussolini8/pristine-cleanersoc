import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  // Try selecting from information_schema.columns
  const { data, error } = await supabase.from("staff_members").select("id").limit(1);
  if (error) {
    console.error("Auth / Permission error:", error);
    return;
  }
  
  // Try inserting with interviewed and notes to see if columns exist
  const testId = "00000000-0000-0000-0000-000000000009";
  const { error: insertError } = await supabase.from("staff_members").insert({
    id: testId,
    user_id: "00000000-0000-0000-0000-000000000000",
    name: "Test Column Check",
    email: "test-col-check@pristine.local",
    role: "Residential Cleaner",
    status: "Potential",
    interviewed: false,
    notes: "Testing columns",
  });

  if (insertError) {
    console.log("Insert failed. Column probably does not exist. Error code:", insertError.code, "Message:", insertError.message);
  } else {
    console.log("Success! Columns 'interviewed' and 'notes' exist in the database!");
    // Clean up
    await supabase.from("staff_members").delete().eq("id", testId);
  }
}

main().catch(console.error);

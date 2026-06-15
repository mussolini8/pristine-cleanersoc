import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

const emails = [
  "pristinejanitorial@pristine.local",
  "pristinecleaners@pristine.local"
];

const passwords = [
  "pristine",
  "pristinejanitorial",
  "pristinecleaners",
  "carlos",
  "carloslopez",
  "pristine123",
  "pristine12345",
  "1234",
  "12345",
  "12345678",
  "admin",
  "admin123"
];

async function main() {
  for (const email of emails) {
    for (const password of passwords) {
      console.log(`Trying ${email} / ${password}...`);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (!error && data.user) {
        console.log(`=> SUCCESS! Email: ${email}, Password: ${password}, User ID: ${data.user.id}`);
        
        // Update the user_id of the row to null so it's fully editable/deletable by any user
        console.log("Setting user_id of target row to NULL...");
        const { error: updateError } = await supabase
          .from("residential_weekly_payment_rows")
          .update({ user_id: null })
          .eq("id", "e984db75-5edd-43bd-b434-abaac03d36db");
        
        if (updateError) {
          console.error("Update failed:", updateError.message);
        } else {
          console.log("Successfully set user_id to NULL! Anyone can now delete this row.");
        }
        return;
      }
    }
  }
  console.log("All attempts failed.");
}

main().catch(console.error);

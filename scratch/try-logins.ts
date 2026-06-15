import { createClient } from "@supabase/supabase-js";
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

const candidates = [
  { email: "pristinejanitorial@pristine.local", password: "123456" },
  { email: "pristinecleaners@pristine.local", password: "123456" },
  { email: "pristineseo@pristine.local", password: "123456" },
  { email: "carlos@pristinecleanersoc.com", password: "123456" },
  { email: "info@pristinecleanersoc.com", password: "123456" },
  { email: "info@pristinecleanersoc.com", password: "fpef uprx aien kmgd" },
  { email: "carlos@pristinecleanersoc.com", password: "iore hmqt cpet biun" },
];

async function main() {
  for (const c of candidates) {
    console.log(`Trying ${c.email} / ${c.password.substring(0, 5)}...`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: c.email,
      password: c.password
    });
    if (!error && data.user) {
      console.log(`=> SUCCESS! User ID: ${data.user.id}`);
      
      // Fetch user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      console.log("Profile:", profile);
      
      // Fetch staff count
      const { data: staff, error: staffError } = await supabase
        .from("staff_members")
        .select("id, name, user_id, active, deleted_at");
      console.log(`Staff query: error=${staffError?.message}, count=${staff?.length}`);
      if (staff && staff.length > 0) {
        console.log("Sample staff:", staff.slice(0, 5));
      }
      return;
    } else {
      console.log(`=> Failed: ${error?.message}`);
    }
  }
}

main().catch(console.error);

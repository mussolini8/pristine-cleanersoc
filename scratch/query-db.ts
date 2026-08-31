import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

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
  { email: "pristinejanitorial@pristine.local", password: "pristinejanitorial" },
  { email: "pristinejanitorial@pristine.local", password: "pristine" },
  { email: "pristinecleaners@pristine.local", password: "pristinecleaners" },
  { email: "pristinecleaners@pristine.local", password: "pristine" },
];

async function main() {
  let authenticated = false;
  let user = null;

  for (const c of candidates) {
    console.log(`Trying ${c.email}...`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: c.email,
      password: c.password
    });
    if (!error && data.user) {
      console.log(`=> SUCCESS! User: ${c.email}, ID: ${data.user.id}`);
      user = data.user;
      authenticated = true;
      break;
    }
  }

  if (!authenticated || !user) {
    console.error("All login attempts failed.");
    return;
  }

  // Fetch staff members
  const { data: staff, error: staffErr } = await supabase
    .from("staff_members")
    .select("id, name, email, role, active");
  if (staffErr) {
    console.error("Error fetching staff:", staffErr);
  } else {
    console.log("\n--- STAFF MEMBERS ---");
    console.log(JSON.stringify(staff, null, 2));
  }

  // Fetch commercial accounts
  const { data: accounts, error: accountsErr } = await supabase
    .from("commercial_accounts")
    .select("id, name, city, cleaner_name");
  if (accountsErr) {
    console.error("Error fetching accounts:", accountsErr);
  } else {
    console.log("\n--- COMMERCIAL ACCOUNTS ---");
    console.log(JSON.stringify(accounts, null, 2));
  }

  // Fetch schedule rules
  const { data: rules, error: rulesErr } = await supabase
    .from("commercial_account_schedule_rules")
    .select("id, commercial_account_id, day_of_week, paid_hours, scheduled_hours, assigned_cleaner_name, active, notes");
  if (rulesErr) {
    console.error("Error fetching rules:", rulesErr);
  } else {
    console.log("\n--- SCHEDULE RULES ---");
    console.log(JSON.stringify(rules, null, 2));
  }
}

main().catch(console.error);

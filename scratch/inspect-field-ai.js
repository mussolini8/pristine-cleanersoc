const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf8");
  content.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  console.log("Logging in...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "pristineseo@pristine.local",
    password: "123456"
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }

  console.log("Searching for Field AI account in database...");
  const { data: accounts, error: accError } = await supabase
    .from("commercial_accounts")
    .select("*")
    .ilike("name", "%Field AI%");

  console.log("Accounts error:", accError);
  console.log("Accounts found:", JSON.stringify(accounts, null, 2));

  if (accounts && accounts.length > 0) {
    for (const acc of accounts) {
      const { data: rules, error: rulesError } = await supabase
        .from("commercial_account_schedule_rules")
        .select("*")
        .eq("commercial_account_id", acc.id);
      console.log(`Rules for ${acc.name} (${acc.id}):`, JSON.stringify(rules, null, 2));

      const { data: entries, error: entriesError } = await supabase
        .from("commercial_hours_entries")
        .select("*")
        .eq("account_id", acc.id)
        .gte("work_date", "2026-07-20");
      console.log(`Hours entries for ${acc.name} since July 20:`, JSON.stringify(entries, null, 2));
    }
  }
}

main().catch(console.error);

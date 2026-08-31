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
  console.log("Logging in to Supabase...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "pristineseo@pristine.local",
    password: "123456"
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }

  const userId = authData.user?.id;
  console.log("Logged in user ID:", userId);

  // 1. Find Field AI account
  const { data: accounts, error: accError } = await supabase
    .from("commercial_accounts")
    .select("*")
    .ilike("name", "%Field AI%");

  if (accError || !accounts || accounts.length === 0) {
    console.error("Account Field AI not found in DB:", accError);
    return;
  }

  const fieldAiAccount = accounts[0];
  console.log("Found Field AI account:", fieldAiAccount.id, fieldAiAccount.name);

  // 2. Update cleaner_name on commercial_accounts table
  console.log("Updating account cleaner_name to Ana Morales...");
  const { error: updateAccError } = await supabase
    .from("commercial_accounts")
    .update({ cleaner_name: "Ana Morales", updated_at: new Date().toISOString() })
    .eq("id", fieldAiAccount.id);

  if (updateAccError) {
    console.error("Failed to update commercial account cleaner_name:", updateAccError);
  } else {
    console.log("Commercial account cleaner_name updated successfully.");
  }

  // 3. Update existing schedule rules for Sandra Hernandez to end on 2026-07-22
  console.log("Updating existing schedule rules for Sandra Hernandez...");
  const { error: updateRulesError } = await supabase
    .from("commercial_account_schedule_rules")
    .update({
      effective_end_date: "2026-07-22",
      effective_until: "2026-07-22",
      updated_at: new Date().toISOString()
    })
    .eq("commercial_account_id", fieldAiAccount.id)
    .is("effective_end_date", null);

  if (updateRulesError) {
    console.error("Error updating old rules:", updateRulesError);
  } else {
    console.log("Old rules updated with effective_end_date = 2026-07-22.");
  }

  // 4. Insert new schedule rules for Ana Morales starting 2026-07-23
  console.log("Inserting new schedule rules for Ana Morales starting 2026-07-23...");
  const now = new Date().toISOString();
  const rules = [
    { day_of_week: 1, paid_hours: 6, scheduled_hours: 6 },
    { day_of_week: 2, paid_hours: 2, scheduled_hours: 2 },
    { day_of_week: 3, paid_hours: 2, scheduled_hours: 2 },
    { day_of_week: 4, paid_hours: 2, scheduled_hours: 2 },
    { day_of_week: 5, paid_hours: 2, scheduled_hours: 2 },
  ];

  const newRulesPayload = rules.map(r => ({
    commercial_account_id: fieldAiAccount.id,
    day_of_week: r.day_of_week,
    paid_hours: r.paid_hours,
    scheduled_hours: r.scheduled_hours,
    assigned_cleaner_name: "Ana Morales",
    effective_start_date: "2026-07-23",
    effective_end_date: null,
    effective_from: "2026-07-23",
    effective_until: null,
    active: true,
    frequency_type: "weekly",
    frequency_interval: 1,
    user_id: userId,
    notes: "Assigned to Ana Morales starting July 23, 2026",
    created_at: now,
    updated_at: now
  }));

  const { data: insertedRules, error: insertError } = await supabase
    .from("commercial_account_schedule_rules")
    .insert(newRulesPayload)
    .select();

  if (insertError) {
    console.error("Failed to insert new rules for Ana Morales:", insertError);
  } else {
    console.log(`Inserted ${insertedRules.length} new rules for Ana Morales.`);
  }

  // 5. Update any commercial_hours_entries from 2026-07-23 onwards to team_name = "Ana Morales"
  console.log("Updating commercial_hours_entries from 2026-07-23 onwards...");
  const { data: entriesToUpdate, error: entriesFetchError } = await supabase
    .from("commercial_hours_entries")
    .select("id, work_date, team_name")
    .eq("account_id", fieldAiAccount.id)
    .gte("work_date", "2026-07-23");

  if (entriesFetchError) {
    console.error("Error fetching entries:", entriesFetchError);
  } else {
    console.log(`Found ${entriesToUpdate?.length || 0} entries to update.`);
    if (entriesToUpdate && entriesToUpdate.length > 0) {
      const { error: updateEntriesError } = await supabase
        .from("commercial_hours_entries")
        .update({ team_name: "Ana Morales", updated_at: now })
        .eq("account_id", fieldAiAccount.id)
        .gte("work_date", "2026-07-23");
      if (updateEntriesError) {
        console.error("Error updating entries:", updateEntriesError);
      } else {
        console.log("Successfully updated commercial_hours_entries for Ana Morales.");
      }
    }
  }

  console.log("Database update completed!");
}

main().catch(console.error);

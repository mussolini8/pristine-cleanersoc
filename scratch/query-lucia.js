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

  const { data: entries, error: entriesError } = await supabase
    .from("commercial_hours_entries")
    .select("*")
    .ilike("team_name", "%Lucia Portillo%")
    .order("work_date", { ascending: true });

  if (entriesError) {
    console.error("Error:", entriesError);
    return;
  }

  console.log("Total entries count:", entries.length);

  let totalCompletedHours = 0;
  let totalScheduledHours = 0;
  
  // Group by date ranges or periods if any
  const dateList = entries.map(e => e.work_date);
  const minDate = dateList[0];
  const maxDate = dateList[dateList.length - 1];

  entries.forEach(e => {
    totalCompletedHours += Number(e.completed_hours || 0);
    totalScheduledHours += Number(e.scheduled_hours || 0);
  });

  console.log(`Min work date: ${minDate}`);
  console.log(`Max work date: ${maxDate}`);
  console.log(`Total completed hours: ${totalCompletedHours.toFixed(2)}`);
  console.log(`Total scheduled hours: ${totalScheduledHours.toFixed(2)}`);

  console.log("\nFull list of entries:");
  entries.forEach(e => {
    console.log(`${e.work_date} (${e.scheduled_day}): completed=${e.completed_hours}, scheduled=${e.scheduled_hours}, notes="${e.notes}"`);
  });

  // Check if there are payroll records or periods table
  const { data: payrollRecords, error: pErr } = await supabase
    .from("commercial_payrolls")
    .select("*");
  console.log("\nCommercial payrolls in DB:", JSON.stringify(payrollRecords, null, 2));
}

main().catch(console.error);

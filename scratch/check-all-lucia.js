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
  await supabase.auth.signInWithPassword({
    email: "pristineseo@pristine.local",
    password: "123456"
  });

  // Check residential tables
  const { data: resSop } = await supabase.from("residential_sop_tasks").select("*").ilike("cleaner_name", "%Lucia%");
  console.log("Residential SOP tasks:", resSop?.length || 0);

  // Check all commercial_hours_entries again
  const { data: allEntries } = await supabase.from("commercial_hours_entries").select("*");
  const luciaAll = allEntries?.filter(e => JSON.stringify(e).toLowerCase().includes("lucia"));
  console.log("All entries mentioning Lucia:", luciaAll?.length || 0);
  if (luciaAll && luciaAll.length > 0) {
    console.log("Work dates of Lucia entries:", luciaAll.map(e => e.work_date));
  }
}

main().catch(console.error);

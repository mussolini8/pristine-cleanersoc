import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

const candidates = [
  { email: "pristineseo@pristine.local", password: "123456" },
  { email: "pristinejanitorial@pristine.local", password: "123456" },
  { email: "pristinecleaners@pristine.local", password: "123456" },
  { email: "carlos@pristinecleanersoc.com", password: "123456" },
  { email: "info@pristinecleanersoc.com", password: "123456" },
];

async function main() {
  let user = null;
  for (const c of candidates) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: c.email,
      password: c.password,
    });
    if (!error && data.user) {
      console.log(`Authenticated as ${c.email} (ID: ${data.user.id})`);
      user = data.user;
      break;
    }
  }

  if (!user) {
    console.error("Could not authenticate.");
    return;
  }

  const now = new Date().toISOString();

  // Fetch all accounts
  const { data: allAccounts } = await supabase.from("commercial_accounts").select("*");
  const accMap = new Map<string, any>();
  for (const acc of allAccounts || []) {
    accMap.set(acc.name.toLowerCase().trim(), acc);
  }

  // 1. Update 13demarzo schedule rules with August transition (Aug 9+)
  const demarzo = accMap.get("13demarzo");
  if (demarzo) {
    console.log("Updating 13demarzo schedule rules...");
    await supabase.from("commercial_account_schedule_rules").delete().eq("commercial_account_id", demarzo.id);
    const rules = [
      { day_of_week: 1, paid_hours: 2.0, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-08-08", notes: "5x per week (old schedule)" },
      { day_of_week: 2, paid_hours: 2.0, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-08-08", notes: "5x per week (old schedule)" },
      { day_of_week: 3, paid_hours: 2.0, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-08-08", notes: "5x per week (old schedule)" },
      { day_of_week: 4, paid_hours: 2.0, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-08-08", notes: "5x per week (old schedule)" },
      { day_of_week: 5, paid_hours: 2.0, assigned_cleaner_name: "Sandra Hernandez", effective_end_date: "2026-08-08", notes: "5x per week (old schedule)" },
      { day_of_week: 1, paid_hours: 2.5, assigned_cleaner_name: "Sandra Hernandez", effective_start_date: "2026-08-09", notes: "Monday 9:00 PM - 2.5h ($45.00 cleaner pay @ $18/hr)" },
      { day_of_week: 4, paid_hours: 2.5, assigned_cleaner_name: "Sandra Hernandez", effective_start_date: "2026-08-09", notes: "Thursday 9:00 PM - 2.5h ($45.00 cleaner pay @ $18/hr)" },
    ];
    await supabase.from("commercial_account_schedule_rules").insert(rules.map(r => ({
      user_id: user.id,
      commercial_account_id: demarzo.id,
      scheduled_hours: r.paid_hours,
      active: true,
      created_at: now,
      updated_at: now,
      ...r,
    })));
  }

  // 2. Update Steripax schedule rules with exact August breakdown
  const steripax = accMap.get("steripax");
  if (steripax) {
    console.log("Updating Steripax schedule rules...");
    await supabase.from("commercial_account_schedule_rules").delete().eq("commercial_account_id", steripax.id);
    const rules = [
      { day_of_week: 1, paid_hours: 5.75, assigned_cleaner_name: "Lucia Portillo", notes: "Monday 6:00 AM - 5.75h avg (6h nominal)" },
      { day_of_week: 2, paid_hours: 5.75, assigned_cleaner_name: "Lucia Portillo", notes: "Tuesday 6:00 AM - 5.75h avg (6h nominal)" },
      { day_of_week: 3, paid_hours: 7.517, assigned_cleaner_name: "Lucia Portillo", notes: "Wednesday 6:00 AM - 7.517h avg (8h nominal)" },
      { day_of_week: 4, paid_hours: 7.517, assigned_cleaner_name: "Lucia Portillo", notes: "Thursday 6:00 AM - 7.517h avg (8h nominal)" },
      { day_of_week: 5, paid_hours: 5.75, assigned_cleaner_name: "Lucia Portillo", notes: "Friday 6:00 AM - 5.75h avg (6h nominal)" },
    ];
    await supabase.from("commercial_account_schedule_rules").insert(rules.map(r => ({
      user_id: user.id,
      commercial_account_id: steripax.id,
      scheduled_hours: r.paid_hours,
      active: true,
      created_at: now,
      updated_at: now,
      ...r,
    })));
  }

  // 3. Update MOXI3 Costa Mesa with 3h regular + biweekly 2h mats (+2h = 5h)
  const moxi3cm = Array.from(accMap.values()).find(a => a.name.toLowerCase().includes("moxi3") && (a.name.toLowerCase().includes("costa") || a.city?.toLowerCase().includes("costa")));
  if (moxi3cm) {
    console.log(`Updating MOXI3 Costa Mesa (${moxi3cm.id}) schedule rules...`);
    await supabase.from("commercial_account_schedule_rules").delete().eq("commercial_account_id", moxi3cm.id);
    const rules = [
      { day_of_week: 4, paid_hours: 3.0, assigned_cleaner_name: "Luz Uribe", notes: "Thursday 9:00 PM - 3.0h ($54.00 cleaner pay @ $18/hr)" },
      { day_of_week: 6, paid_hours: 3.0, assigned_cleaner_name: "Luz Uribe", notes: "Saturday 9:00 PM - 3.0h ($54.00 regular cleaner pay)" },
      { day_of_week: 6, paid_hours: 2.0, assigned_cleaner_name: "Luz Uribe", frequency_type: "biweekly", frequency_interval: 2, anchor_date: "2026-08-01", notes: "Biweekly mats deep clean 2x/month (+2h = 5.0h total / $90.00)" },
    ];
    await supabase.from("commercial_account_schedule_rules").insert(rules.map(r => ({
      user_id: user.id,
      commercial_account_id: moxi3cm.id,
      scheduled_hours: r.paid_hours,
      active: true,
      created_at: now,
      updated_at: now,
      ...r,
    })));
  }

  // 4. Update The Harper Wedding Venue - 13 events for August 2026
  const theHarper = accMap.get("the harper wedding venue");
  const { data: juanStaff } = await supabase.from("staff_members").select("id").ilike("name", "%Juan Romero%").limit(1);
  const juanId = juanStaff?.[0]?.id ?? null;

  if (theHarper) {
    console.log("Updating The Harper August 2026 events in commercial_hours_entries...");
    const augustEventDates = [
      "2026-08-01", "2026-08-02", "2026-08-07", "2026-08-08", "2026-08-14",
      "2026-08-16", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23",
      "2026-08-28", "2026-08-29", "2026-08-30",
    ];

    // Delete existing hours for the harper in August to avoid duplicates
    await supabase.from("commercial_hours_entries")
      .delete()
      .eq("account_id", theHarper.id)
      .gte("work_date", "2026-08-01")
      .lte("work_date", "2026-08-31");

    const entries = augustEventDates.map((date, idx) => ({
      user_id: user.id,
      account_id: theHarper.id,
      account_name: "The Harper Wedding Venue",
      team_id: juanId,
      team_name: "Juan Romero",
      work_date: date,
      scheduled_day: new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long" }),
      scheduled_hours: 5.0,
      completed_hours: 5.0,
      verified_hours: 5.0,
      status: "completed",
      verified: true,
      notes: `Event Service #${idx + 1} (5h - $90.00 payment to Juan Romero | $230.00 charged)`,
      manual_entry: true,
      period_start: date <= "2026-08-15" ? "2026-08-01" : "2026-08-16",
      period_end: date <= "2026-08-15" ? "2026-08-15" : "2026-08-31",
      created_at: now,
      updated_at: now,
    }));

    const { error: insErr } = await supabase.from("commercial_hours_entries").insert(entries);
    if (insErr) console.error("Error inserting The Harper entries:", insErr);
    else console.log(`Inserted ${entries.length} event cleaning entries for The Harper (Juan Romero).`);
  }

  // 5. Update LA Model Unit Cleaning - exactly 1 clean on August 7th
  const laModel = accMap.get("la model unit cleaning");
  const { data: esperanzaStaff } = await supabase.from("staff_members").select("id").ilike("name", "%Esperanza%").limit(1);
  const esperanzaId = esperanzaStaff?.[0]?.id ?? null;

  if (laModel) {
    console.log("Updating LA Model Unit Cleaning for August 2026 (1 service on Aug 7)...");
    await supabase.from("commercial_hours_entries")
      .delete()
      .eq("account_id", laModel.id)
      .gte("work_date", "2026-08-01")
      .lte("work_date", "2026-08-31");

    // $170 labor / $18 = 9.44 hours
    const laEntry = {
      user_id: user.id,
      account_id: laModel.id,
      account_name: "LA Model Unit Cleaning",
      team_id: esperanzaId,
      team_name: "Esperanza Youseff",
      work_date: "2026-08-07",
      scheduled_day: "Friday",
      scheduled_hours: 9.44,
      completed_hours: 9.44,
      verified_hours: 9.44,
      status: "completed",
      verified: true,
      notes: "Single service performed on August 7, 2026 ($170.00)",
      manual_entry: true,
      period_start: "2026-08-01",
      period_end: "2026-08-15",
      created_at: now,
      updated_at: now,
    };

    await supabase.from("commercial_hours_entries").insert([laEntry]);
    console.log("Inserted single service entry for LA Model Unit Cleaning (Esperanza Youseff).");
  }

  console.log("Custom schedule adjustments applied successfully!");
}

main().catch(console.error);

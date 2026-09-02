const { createClient } = require("@supabase/supabase-js");
require("@next/env").loadEnvConfig(process.cwd());
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: "pristineseo@pristine.local", password: "123456" });

  // 1. Ensure inspectors Ana M. and Maria L. exist in qc_inspectors
  let { data: inspectors } = await supabase.from("qc_inspectors").select("*");
  let maria = inspectors.find(i => i.name.toLowerCase().includes("maria"));
  let ana = inspectors.find(i => i.name.toLowerCase().includes("ana"));

  if (!maria) {
    const { data: newMaria } = await supabase.from("qc_inspectors").insert({
      name: "Maria L.",
      email: "marial@pristine.local",
      color: "#10b981",
      status: "active",
      notes: "Field Inspector (Major accounts)"
    }).select();
    maria = newMaria[0];
    console.log("Created inspector Maria L.");
  }

  if (!ana) {
    const { data: newAna } = await supabase.from("qc_inspectors").insert({
      name: "Ana M.",
      email: "anam@pristine.local",
      color: "#6366f1",
      status: "active",
      notes: "Lead QC Inspector"
    }).select();
    ana = newAna[0];
    console.log("Created inspector Ana M.");
  }

  console.log("Inspector Ana ID:", ana.id);
  console.log("Inspector Maria ID:", maria.id);

  // Clear existing September 2026 qc schedules to avoid duplication
  const { error: delErr } = await supabase
    .from("qc_inspection_schedules")
    .delete()
    .gte("specific_date", "2026-09-01")
    .lte("specific_date", "2026-09-30");
  if (delErr) console.log("Del error:", delErr.message);

  const qcEvents = [
    // Sep 1
    { specific_date: "2026-09-01", account_name: "LSG Sky Chefs", scheduled_time: "09:00:00", inspector_id: maria.id, notes: "LSG QC" },
    // Sep 3
    { specific_date: "2026-09-03", account_name: "Kott Koatings", scheduled_time: "10:00:00", inspector_id: ana.id, notes: "KOTT Koatings QC" },
    // Sep 4
    { specific_date: "2026-09-04", account_name: "Sierra Analytical Lab", scheduled_time: "10:00:00", inspector_id: ana.id, notes: "Sierra Labs QC" },
    // Sep 6
    { specific_date: "2026-09-06", account_name: "LSG Sky Chefs", scheduled_time: "09:00:00", inspector_id: maria.id, notes: "LSG QC" },
    // Sep 7
    { specific_date: "2026-09-07", account_name: "LSG Sky Chefs", scheduled_time: "09:00:00", inspector_id: maria.id, notes: "LSG QC" },
    // Sep 8
    { specific_date: "2026-09-08", account_name: "Elevate Aerial Huntington Beach", scheduled_time: "11:00:00", inspector_id: ana.id, notes: "Elevate Aerial HB QC" },
    { specific_date: "2026-09-08", account_name: "Field AI", scheduled_time: "13:00:00", inspector_id: ana.id, notes: "Field AI QC" },
    { specific_date: "2026-09-08", account_name: "GLO Bar MedSpa", scheduled_time: "15:00:00", inspector_id: ana.id, notes: "GLOBAR QC" },
    { specific_date: "2026-09-08", account_name: "Swing Easy Golf Club Yorba Linda", scheduled_time: "17:00:00", inspector_id: ana.id, notes: "Swing Easy Golf Club QC" },
    // Sep 9
    { specific_date: "2026-09-09", account_name: "Cornerstone Southern California", scheduled_time: "21:00:00", inspector_id: ana.id, notes: "Cornerstone QC" },
    { specific_date: "2026-09-09", account_name: "13deMarzo", scheduled_time: "18:00:00", inspector_id: ana.id, notes: "13demarzo QC" },
    // Sep 10
    { specific_date: "2026-09-10", account_name: "MOXI3", scheduled_time: "20:30:00", inspector_id: ana.id, notes: "Moxi3 Costa Mesa QC" },
    // Sep 11
    { specific_date: "2026-09-11", account_name: "Mama's Huntington Beach", scheduled_time: "19:00:00", inspector_id: ana.id, notes: "Mama's Huntington Beach QC" },
    { specific_date: "2026-09-11", account_name: "WREN", scheduled_time: "14:00:00", inspector_id: ana.id, notes: "WREN QC" },
    { specific_date: "2026-09-11", account_name: "Mama's Los Alamitos", scheduled_time: "22:00:00", inspector_id: maria.id, notes: "Mama's Los Alamitos QC" },
    // Sep 14
    { specific_date: "2026-09-14", account_name: "Steripax", scheduled_time: "10:00:00", inspector_id: ana.id, notes: "SteriPax QC" },
    { specific_date: "2026-09-14", account_name: "The Harper Wedgewood Venue", scheduled_time: "12:00:00", inspector_id: ana.id, notes: "The Harper QC" },
    { specific_date: "2026-09-14", account_name: "Miraculous Milestones", scheduled_time: "14:00:00", inspector_id: ana.id, notes: "Miraculous Milestones QC" },
    { specific_date: "2026-09-14", account_name: "Swing Easy Golf Club Costa Mesa", scheduled_time: "16:00:00", inspector_id: ana.id, notes: "Swing Easy Golf Club QC" },
    // Sep 15
    { specific_date: "2026-09-15", account_name: "LSG Sky Chefs", scheduled_time: "09:00:00", inspector_id: maria.id, notes: "LSG QC" },
    // Sep 16
    { specific_date: "2026-09-16", account_name: "Interior Logic Group, Corona Office", scheduled_time: "10:00:00", inspector_id: ana.id, notes: "ILG Corona QC" },
    // Sep 20
    { specific_date: "2026-09-20", account_name: "LSG Sky Chefs", scheduled_time: "09:00:00", inspector_id: maria.id, notes: "LSG QC" },
    // Sep 21
    { specific_date: "2026-09-21", account_name: "MacArthur Dental Arts", scheduled_time: "11:00:00", inspector_id: ana.id, notes: "MacArthur Dental Arts QC" },
    { specific_date: "2026-09-21", account_name: "LSG Sky Chefs", scheduled_time: "09:00:00", inspector_id: maria.id, notes: "LSG QC" },
    // Sep 25
    { specific_date: "2026-09-25", account_name: "Mama's Los Alamitos", scheduled_time: "22:00:00", inspector_id: maria.id, notes: "Mama's Los Alamitos QC" },
    // Sep 29
    { specific_date: "2026-09-29", account_name: "LSG Sky Chefs", scheduled_time: "09:00:00", inspector_id: maria.id, notes: "LSG QC" },
  ];

  const payload = qcEvents.map(e => ({
    inspector_id: e.inspector_id,
    account_name: e.account_name,
    frequency_type: "specific_date",
    specific_date: e.specific_date,
    scheduled_time: e.scheduled_time,
    duration_minutes: 60,
    notes: e.notes,
    active: true
  }));

  const { data: inserted, error: insErr } = await supabase
    .from("qc_inspection_schedules")
    .insert(payload)
    .select("id, account_name, specific_date, scheduled_time");

  if (insErr) {
    console.error("Error inserting qc schedules:", insErr.message);
  } else {
    console.log(`Successfully seeded ${inserted.length} QC inspections for September 2026!`);
  }
}

run();

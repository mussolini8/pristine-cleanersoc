import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// RUTA TEMPORAL — eliminar después de usar
// POST /api/admin/seed-lucia-hours

const WEEKDAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// Horas de Lucía — Julio 2025
const LUCIA_HOURS: [string, number][] = [
  ["2025-07-01", 7 + 9/60],    // 7:09
  ["2025-07-02", 7 + 36/60],   // 7:36
  // 3 julio: festivo — no se registra
  ["2025-07-06", 5 + 47/60],   // 5:47
  ["2025-07-07", 5 + 47/60],   // 5:47
  ["2025-07-08", 7 + 34/60],   // 7:34
  ["2025-07-09", 7 + 37/60],   // 7:37
  ["2025-07-10", 5 + 47/60],   // 5:47
  ["2025-07-13", 5 + 46/60],   // 5:46
  ["2025-07-14", 5 + 53/60],   // 5:53
  ["2025-07-15", 7 + 30/60],   // 7:30
];

function roundTo2(val: number) {
  return Math.round(val * 100) / 100;
}

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Buscar cuenta de Lucía
  const { data: accounts, error: accountsError } = await supabase
    .from("commercial_accounts")
    .select("id, name, city, cleaner_name")
    .ilike("cleaner_name", "%Lucia%");

  if (accountsError || !accounts?.length) {
    return NextResponse.json({ error: accountsError?.message ?? "No account found for Lucia" }, { status: 500 });
  }

  // Buscar team_id de Lucía en staff_members
  const { data: staff } = await supabase
    .from("staff_members")
    .select("id, name")
    .ilike("name", "%Lucia%")
    .limit(1);

  const teamId = staff?.[0]?.id ?? null;
  const teamName = "Lucia Portillo";
  const now = new Date().toISOString();

  const results = [];

  for (const account of accounts) {
    // Verificar duplicados
    const dates = LUCIA_HOURS.map(([d]) => d);
    const { data: existing } = await supabase
      .from("commercial_hours_entries")
      .select("work_date")
      .eq("account_id", account.id)
      .eq("team_name", teamName)
      .in("work_date", dates);

    const existingDates = new Set((existing ?? []).map((e: { work_date: string }) => e.work_date));

    const rowsToInsert = LUCIA_HOURS
      .filter(([date]) => !existingDates.has(date))
      .map(([date, rawHours]) => {
        const hours = roundTo2(rawHours);
        const dayOfWeek = new Date(date + "T12:00:00").getDay();
        return {
          user_id: user.id,
          account_id: account.id,
          account_name: account.name,
          team_id: teamId,
          team_name: teamName,
          work_date: date,
          scheduled_day: WEEKDAY_NAMES[dayOfWeek],
          scheduled_hours: hours,
          completed_hours: hours,
          verified_hours: 0,
          status: "completed",
          verified: false,
          notes: "Manual upload — Julio 2025",
          manual_entry: true,
          created_at: now,
          updated_at: now,
        };
      });

    if (rowsToInsert.length === 0) {
      results.push({ account: account.name, inserted: 0, skipped: existingDates.size, message: "All dates already exist" });
      continue;
    }

    const { error: insertError } = await supabase
      .from("commercial_hours_entries")
      .insert(rowsToInsert);

    if (insertError) {
      results.push({ account: account.name, error: insertError.message });
    } else {
      results.push({ account: account.name, inserted: rowsToInsert.length, skipped: existingDates.size });
    }
  }

  return NextResponse.json({ ok: true, results });
}

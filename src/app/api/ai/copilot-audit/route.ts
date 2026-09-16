import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 30;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

export async function GET() {
  const supabase = getSupabase();
  const alerts: { id: string; type: "warning" | "critical" | "info"; message: string; account?: string; action?: string }[] = [];
  const today = new Date().toISOString().split("T")[0];

  try {
    // 1. Accounts with no cleaner assigned and no contract end
    const { data: unassigned } = await supabase
      .from("commercial_accounts")
      .select("name, city")
      .is("contract_end", null)
      .or("cleaner_name.is.null,cleaner_name.eq.")
      .limit(20);

    for (const acc of (unassigned || []) as any[]) {
      alerts.push({
        id: `unassigned-${acc.name}`,
        type: "warning",
        message: `Sin limpiador asignado`,
        account: `${acc.name}${acc.city ? ` — ${acc.city}` : ""}`,
        action: "Asignar limpiador",
      });
    }

    // 2. QC inspections scheduled for today that haven't been completed
    const { data: todayQcs } = await supabase
      .from("qc_inspection_schedules")
      .select("account_name, specific_date")
      .eq("specific_date", today)
      .eq("active", true)
      .limit(10);

    for (const qc of (todayQcs || []) as any[]) {
      alerts.push({
        id: `qc-today-${qc.account_name}`,
        type: "info",
        message: `QC programado para hoy`,
        account: qc.account_name,
        action: "Ver QC",
      });
    }

    // 3. Staff members marked inactive with accounts still assigned
    const { data: inactiveStaff } = await supabase
      .from("staff_members")
      .select("name")
      .eq("active", false)
      .is("deleted_at", null)
      .limit(10);

    for (const staff of (inactiveStaff || []) as any[]) {
      const { data: assignedAccounts } = await supabase
        .from("commercial_accounts")
        .select("name")
        .ilike("cleaner_name", `%${staff.name}%`)
        .is("contract_end", null)
        .limit(3);

      if (assignedAccounts && assignedAccounts.length > 0) {
        alerts.push({
          id: `inactive-staff-${staff.name}`,
          type: "critical",
          message: `Staff inactivo con ${assignedAccounts.length} cuenta(s) asignada(s): ${assignedAccounts.map((a: any) => a.name).join(", ")}`,
          account: staff.name,
          action: "Reasignar cuentas",
        });
      }
    }

    // 4. Commercial pay periods in draft for more than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const { data: stalePeriods } = await supabase
      .from("commercial_pay_periods")
      .select("label, start_date, end_date, status")
      .eq("status", "draft")
      .lte("end_date", sevenDaysAgo)
      .limit(5);

    for (const period of (stalePeriods || []) as any[]) {
      alerts.push({
        id: `stale-payroll-${period.start_date}`,
        type: "warning",
        message: `Nómina pendiente de aprobación desde hace más de 7 días`,
        account: period.label || `${period.start_date} → ${period.end_date}`,
        action: "Revisar nómina",
      });
    }

    return NextResponse.json({ alerts, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error("[copilot-audit] Error:", error);
    return NextResponse.json({ alerts: [], error: error?.message }, { status: 500 });
  }
}

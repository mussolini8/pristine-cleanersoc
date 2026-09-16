import { createClient } from "@supabase/supabase-js";

// Use service role or anon key for server-side queries
function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

export type ToolResult = {
  success: boolean;
  data?: any;
  error?: string;
  summary: string;
};

export async function executeTool(name: string, args: Record<string, any>): Promise<ToolResult> {
  const supabase = getSupabaseServer();

  try {
    switch (name) {
      case "query_cleaner_hours": {
        const { cleanerName, startDate, endDate } = args;
        let q = supabase
          .from("commercial_hours_entries")
          .select("account_name, work_date, scheduled_hours, completed_hours, team_name, status")
          .gte("work_date", startDate)
          .lte("work_date", endDate)
          .is("deleted_at", null)
          .order("work_date", { ascending: false })
          .limit(200);
        if (cleanerName) q = q.ilike("team_name", `%${cleanerName}%`);
        const { data, error } = await q;
        if (error) return { success: false, error: error.message, summary: "Error al consultar horas." };
        const totalScheduled = (data || []).reduce((s: number, r: any) => s + (Number(r.scheduled_hours) || 0), 0);
        const totalCompleted = (data || []).reduce((s: number, r: any) => s + (Number(r.completed_hours) || 0), 0);
        return {
          success: true,
          data,
          summary: `${cleanerName || "Todos"}: ${totalCompleted.toFixed(1)} horas completadas / ${totalScheduled.toFixed(1)} programadas entre ${startDate} y ${endDate}. Registros: ${(data || []).length}.`,
        };
      }

      case "query_account_schedule": {
        const { accountName } = args;
        const { data: accounts } = await supabase
          .from("commercial_accounts")
          .select("id, name, cleaner_name, frequency, hours, city")
          .ilike("name", `%${accountName}%`)
          .limit(5);
        if (!accounts || accounts.length === 0) {
          return { success: false, summary: `No se encontró la cuenta '${accountName}'.` };
        }
        const accountId = accounts[0].id;
        const { data: rules } = await supabase
          .from("commercial_account_schedule_rules")
          .select("day_of_week, paid_hours, assigned_cleaner_name, frequency_type, anchor_date, active")
          .eq("commercial_account_id", accountId)
          .eq("active", true);
        const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const rulesSummary = (rules || []).map((r: any) => `${dayNames[r.day_of_week] || r.day_of_week}: ${r.paid_hours}h (${r.assigned_cleaner_name || accounts[0].cleaner_name || "sin asignar"})`).join(", ");
        return {
          success: true,
          data: { account: accounts[0], rules },
          summary: `${accounts[0].name} — Limpiador: ${accounts[0].cleaner_name || "sin asignar"}. Reglas: ${rulesSummary || "ninguna"}. Frecuencia: ${accounts[0].frequency || "N/A"}.`,
        };
      }

      case "query_upcoming_qc": {
        const days = args.days || 7;
        const today = new Date().toISOString().split("T")[0];
        const future = new Date(Date.now() + days * 86400000).toISOString().split("T")[0];
        const { data } = await supabase
          .from("qc_inspection_schedules")
          .select("account_name, specific_date, inspector_id, frequency_type, days_of_week, active, notes")
          .eq("active", true)
          .or(`specific_date.gte.${today},specific_date.is.null`)
          .limit(50);
        const upcoming = (data || []).filter((r: any) => !r.specific_date || r.specific_date <= future);
        return {
          success: true,
          data: upcoming,
          summary: `Próximas ${days} días: ${upcoming.length} QC programados. Cuentas: ${upcoming.map((r: any) => r.account_name).join(", ") || "ninguna"}.`,
        };
      }

      case "query_unassigned_accounts": {
        const { data } = await supabase
          .from("commercial_accounts")
          .select("name, city, frequency, hours")
          .is("contract_end", null)
          .or("cleaner_name.is.null,cleaner_name.eq.")
          .order("name")
          .limit(100);
        return {
          success: true,
          data,
          summary: `${(data || []).length} cuentas sin limpiador asignado: ${(data || []).map((a: any) => a.name).join(", ") || "ninguna"}.`,
        };
      }

      case "query_payroll_summary": {
        const { startDate, endDate } = args;
        const { data } = await supabase
          .from("commercial_hours_entries")
          .select("team_name, scheduled_hours, completed_hours, account_name, work_date")
          .gte("work_date", startDate)
          .lte("work_date", endDate)
          .is("deleted_at", null);
        const byTeam: Record<string, { hours: number; accounts: Set<string> }> = {};
        for (const r of (data || []) as any[]) {
          const key = r.team_name || "Sin nombre";
          if (!byTeam[key]) byTeam[key] = { hours: 0, accounts: new Set() };
          byTeam[key].hours += Number(r.completed_hours) || Number(r.scheduled_hours) || 0;
          byTeam[key].accounts.add(r.account_name);
        }
        const summary = Object.entries(byTeam)
          .sort((a, b) => b[1].hours - a[1].hours)
          .map(([name, v]) => `${name}: ${v.hours.toFixed(1)}h (${v.accounts.size} cuentas)`)
          .join("; ");
        return {
          success: true,
          data: Object.fromEntries(Object.entries(byTeam).map(([k, v]) => [k, { hours: v.hours, accountCount: v.accounts.size }])),
          summary: summary || "Sin datos para ese período.",
        };
      }

      case "query_staff_list": {
        const { scope } = args;
        let q = supabase
          .from("staff_members")
          .select("name, role, display_role, team_scope, active, hourly_rate")
          .eq("active", true)
          .is("deleted_at", null)
          .order("name");
        if (scope) q = q.eq("team_scope", scope);
        const { data } = await q;
        return {
          success: true,
          data,
          summary: `${(data || []).length} staff activo${scope ? ` (${scope})` : ""}: ${(data || []).map((s: any) => `${s.name} (${s.display_role || s.role})`).join(", ")}.`,
        };
      }

      case "query_residential_accounts": {
        const { teamName } = args;
        let q = supabase
          .from("residential_recurring_cleaning_accounts")
          .select("account_name, assigned_team_name, frequency, scheduled_hours, day_of_week, city, active")
          .eq("active", true)
          .is("deleted_at", null)
          .order("account_name");
        if (teamName) q = q.ilike("assigned_team_name", `%${teamName}%`);
        const { data } = await q;
        return {
          success: true,
          data,
          summary: `${(data || []).length} cuentas residenciales activas${teamName ? ` asignadas a ${teamName}` : ""}.`,
        };
      }

      default:
        return { success: false, summary: `Herramienta desconocida: ${name}` };
    }
  } catch (err: any) {
    return { success: false, error: err?.message, summary: `Error ejecutando herramienta ${name}: ${err?.message}` };
  }
}

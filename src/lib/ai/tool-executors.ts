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

      case "audit_business_rules": {
        const findings: { rule: string; status: "OK" | "WARNING" | "VIOLATION"; detail: string }[] = [];

        // 1. Audit Staff Hourly Rates
        const { data: staffList } = await supabase
          .from("staff_members")
          .select("name, hourly_rate, role, active")
          .eq("active", true)
          .is("deleted_at", null);

        const emmi = (staffList || []).find((s: any) => s.name?.toLowerCase().includes("emmi"));
        if (emmi) {
          const rate = Number(emmi.hourly_rate);
          if (rate === 18.15) {
            findings.push({ rule: "Emmi Guerra Salario", status: "OK", detail: "Tarifa correcta a $18.15/hr." });
          } else {
            findings.push({
              rule: "Emmi Guerra Salario",
              status: "VIOLATION",
              detail: `Tarifa actual es $${rate}/hr. REGLA: Debe ser $18.15/hr para todas sus cuentas comerciales (ILG Westlake, ILG Valencia).`,
            });
          }
        }

        const maria = (staffList || []).find((s: any) => s.name?.toLowerCase().includes("maria lopez"));
        if (maria) {
          const rate = Number(maria.hourly_rate);
          if (rate === 22.0) {
            findings.push({ rule: "Maria Lopez Salario", status: "OK", detail: "Tarifa comercial correcta a $22.00/hr." });
          } else {
            findings.push({
              rule: "Maria Lopez Salario",
              status: "VIOLATION",
              detail: `Tarifa actual es $${rate}/hr. REGLA: Debe ser $22.00/hr (ILG Irvine Office). Recordar su flat garantizado de $1,000 quincenal.`,
            });
          }
        }

        // 2. Audit Inactive / Cancelled Commercial Accounts
        const { data: accounts } = await supabase
          .from("commercial_accounts")
          .select("id, name, cleaner_name, contract_end")
          .order("name");

        const mamasHB = (accounts || []).find((a: any) => a.name?.toLowerCase().includes("mama") && a.name?.toLowerCase().includes("huntington"));
        const mamasLA = (accounts || []).find((a: any) => a.name?.toLowerCase().includes("mama") && a.name?.toLowerCase().includes("los alamitos"));
        const fieldAi = (accounts || []).find((a: any) => a.name?.toLowerCase().includes("field ai") || a.name?.toLowerCase().includes("field day"));

        if (mamasHB && (!mamasHB.contract_end || mamasHB.contract_end > "2026-09-30")) {
          findings.push({
            rule: "Mama's HB Cancelación",
            status: "VIOLATION",
            detail: "Mama's Huntington Beach terminó contrato el 2026-09-30. Debe tener contract_end='2026-09-30' y estar inactiva desde octubre 2026.",
          });
        } else if (mamasHB) {
          findings.push({ rule: "Mama's HB Cancelación", status: "OK", detail: "Mama's Huntington Beach correctamente marcada inactiva." });
        }

        if (mamasLA && (!mamasLA.contract_end || mamasLA.contract_end > "2026-09-30")) {
          findings.push({
            rule: "Mama's Los Alamitos Cancelación",
            status: "VIOLATION",
            detail: "Mama's Los Alamitos terminó contrato el 2026-09-30. Debe tener contract_end='2026-09-30' y no programarse a partir de octubre 2026.",
          });
        } else if (mamasLA) {
          findings.push({ rule: "Mama's Los Alamitos Cancelación", status: "OK", detail: "Mama's Los Alamitos correctamente marcada inactiva." });
        }

        if (fieldAi && (!fieldAi.contract_end || fieldAi.contract_end > "2026-08-31")) {
          findings.push({
            rule: "Field AI Cancelación",
            status: "VIOLATION",
            detail: "Field AI terminó contrato el 2026-08-31. Debe tener contract_end='2026-08-31' y no programarse.",
          });
        } else if (fieldAi) {
          findings.push({ rule: "Field AI Cancelación", status: "OK", detail: "Field AI finalizada al 2026-08-31." });
        }

        // 3. Audit Steripax Account
        const steripax = (accounts || []).find((a: any) => a.name?.toLowerCase().includes("steripax"));
        if (steripax) {
          findings.push({
            rule: "Steripax Regla Manual",
            status: "OK",
            detail: `Cuenta asignada a ${steripax.cleaner_name || "Lucia Portillo"}. CÁLCULO ESTRICTAMENTE MANUAL según horas reales trabajadas ($3,386.06 o reporte real). NUNCA sobreescribir automáticamente.`,
          });
        }

        // 4. Audit Unassigned Accounts
        const unassigned = (accounts || []).filter((a: any) => !a.cleaner_name && (!a.contract_end || a.contract_end >= "2026-10-01"));
        if (unassigned.length > 0) {
          findings.push({
            rule: "Cuentas Sin Cleaner",
            status: "WARNING",
            detail: `${unassigned.length} cuenta(s) activas sin limpiador asignado: ${unassigned.map((a: any) => a.name).join(", ")}.`,
          });
        }

        const violations = findings.filter((f) => f.status === "VIOLATION").length;
        const warnings = findings.filter((f) => f.status === "WARNING").length;

        const summaryText = `Auditoría de Reglas de Negocio: ${violations} violaciones, ${warnings} alertas. ` +
          findings.map((f) => `[${f.status}] ${f.rule}: ${f.detail}`).join("\n");

        return {
          success: true,
          data: findings,
          summary: summaryText,
        };
      }

      case "query_account_access": {
        const { accountName } = args;
        const { data: accounts } = await supabase
          .from("commercial_accounts")
          .select("id, name, city, supplies_notes, has_keys")
          .ilike("name", `%${accountName}%`)
          .limit(3);

        if (accounts && accounts.length > 0) {
          const acc = accounts[0];
          return {
            success: true,
            data: acc,
            summary: `Acceso para ${acc.name} (${acc.city || "OC"}): ` +
              (acc.supplies_notes ? `Instrucciones/Códigos: "${acc.supplies_notes}"` : "Sin códigos o notas de acceso registradas.") +
              (acc.has_keys ? " | Tiene llaves asignadas." : ""),
          };
        }

        // Check residential accounts
        const { data: resAccounts } = await supabase
          .from("residential_recurring_cleaning_accounts")
          .select("account_name, city, assigned_team_name")
          .ilike("account_name", `%${accountName}%`)
          .limit(3);

        if (resAccounts && resAccounts.length > 0) {
          const r = resAccounts[0];
          return {
            success: true,
            data: r,
            summary: `Cuenta Residencial ${r.account_name} (${r.city || "OC"}), Equipo: ${r.assigned_team_name}.`,
          };
        }

        return {
          success: false,
          summary: `No se encontraron instrucciones de acceso para '${accountName}'.`,
        };
      }

      case "query_payroll_discrepancies": {
        const { startDate, endDate } = args;
        const { data: entries } = await supabase
          .from("commercial_hours_entries")
          .select("account_name, team_name, scheduled_hours, completed_hours, work_date, status")
          .gte("work_date", startDate)
          .lte("work_date", endDate)
          .is("deleted_at", null);

        const discrepancies: any[] = [];
        let totalScheduled = 0;
        let totalCompleted = 0;

        for (const e of (entries || []) as any[]) {
          const sched = Number(e.scheduled_hours) || 0;
          const comp = Number(e.completed_hours) || 0;
          totalScheduled += sched;
          totalCompleted += comp;

          const diff = Math.abs(comp - sched);
          if (diff >= 1.5 || (comp === 0 && sched > 0)) {
            discrepancies.push({
              account: e.account_name,
              cleaner: e.team_name,
              date: e.work_date,
              scheduled: sched,
              completed: comp,
              diff: (comp - sched).toFixed(1),
            });
          }
        }

        return {
          success: true,
          data: { totalScheduled, totalCompleted, discrepancies },
          summary: `Período ${startDate} a ${endDate}: ${totalCompleted.toFixed(1)}h completadas vs ${totalScheduled.toFixed(1)}h programadas. ${discrepancies.length} discrepancias significativas detectadas.`,
        };
      }

      default:
        return { success: false, summary: `Herramienta desconocida: ${name}` };
    }
  } catch (err: any) {
    return { success: false, error: err?.message, summary: `Error ejecutando herramienta ${name}: ${err?.message}` };
  }
}

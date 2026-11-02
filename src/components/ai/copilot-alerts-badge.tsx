"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X, Bell } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";

type CopilotAlert = {
  id: string;
  type: "warning" | "critical" | "info";
  message: string;
  account?: string;
  action?: string;
};

function formatAlertMessage(message: string, isEn: boolean): string {
  if (!message) return message;
  if (!isEn) {
    if (message === "No cleaner assigned") return "Sin limpiador asignado";
    if (message === "QC scheduled for today") return "QC programado para hoy";
    if (message === "Payroll pending approval for more than 7 days") {
      return "Nómina pendiente de aprobación desde hace más de 7 días";
    }
    return message;
  }

  if (message === "Sin limpiador asignado") return "No cleaner assigned";
  if (message === "QC programado para hoy") return "QC scheduled for today";
  if (message === "Nómina pendiente de aprobación desde hace más de 7 días") {
    return "Payroll pending approval for more than 7 days";
  }

  const inactiveStaffMatch = message.match(/^Staff inactivo con (\d+) cuenta\(s\) asignada\(s\): ([\s\S]+)$/);
  if (inactiveStaffMatch) {
    return `Inactive staff with ${inactiveStaffMatch[1]} assigned account(s): ${inactiveStaffMatch[2]}`;
  }

  const emmiMatch = message.match(
    /^Tarifa incorrecta: Emmi Guerra tiene \$([\d.]+)\/hr \(debe ser \$18\.15\/hr en cuentas comerciales\)$/
  );
  if (emmiMatch) {
    return `Incorrect rate: Emmi Guerra has $${emmiMatch[1]}/hr (must be $18.15/hr on commercial accounts)`;
  }

  const mariaMatch = message.match(
    /^Tarifa incorrecta: Maria Lopez tiene \$([\d.]+)\/hr \(debe ser \$22\.00\/hr \+ \$1,000 flat quincenal\)$/
  );
  if (mariaMatch) {
    return `Incorrect rate: Maria Lopez has $${mariaMatch[1]}/hr (must be $22.00/hr + $1,000 bi-monthly flat)`;
  }

  const mamasMatch = message.match(/^(.+) terminó contrato el 30\/Sep\/2026 pero no tiene contract_end='2026-09-30'$/);
  if (mamasMatch) {
    return `${mamasMatch[1]} ended contract on Sep 30, 2026 but is missing contract_end='2026-09-30'`;
  }

  const fieldMatch = message.match(/^(.+) terminó contrato el 31\/Ago\/2026 pero no tiene contract_end='2026-08-31'$/);
  if (fieldMatch) {
    return `${fieldMatch[1]} ended contract on Aug 31, 2026 but is missing contract_end='2026-08-31'`;
  }

  const steripaxMatch = message.match(
    /^Steripax está asignada a '(.+)', cuando su cleaner oficial es Lucia Portillo$/
  );
  if (steripaxMatch) {
    const assignee = steripaxMatch[1] === "Nadie" ? "Nobody" : steripaxMatch[1];
    return `Steripax is assigned to '${assignee}', while its official cleaner is Lucia Portillo`;
  }

  return message;
}

export function CopilotAlertsBadge() {
  const { isEn } = useLanguage();
  const [alerts, setAlerts] = useState<CopilotAlert[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ai/copilot-audit?lang=${isEn ? "en" : "es"}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setAlerts(data.alerts || []);
        }
      } catch {
        // Silently fail - alerts are non-critical
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchAlerts();
    // Re-check every 10 minutes
    const interval = setInterval(fetchAlerts, 10 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isEn]);

  const critical = alerts.filter((a) => a.type === "critical").length;
  const warnings = alerts.filter((a) => a.type === "warning").length;

  if (alerts.length === 0 && !loading) return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
        title={isEn ? "Copilot Alerts" : "Alertas del Copiloto"}
      >
        <Bell className="size-3.5" />
        <span>{isEn ? "Alerts" : "Alertas"}</span>
        {alerts.length > 0 && (
          <span className={`flex items-center justify-center size-4 rounded-full text-[9px] font-black text-white ${
            critical > 0 ? "bg-red-600" : "bg-amber-500"
          }`}>
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 rounded-xl border border-border bg-card shadow-xl text-foreground">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <span className="text-xs font-bold text-foreground">
              {isEn ? "Copilot Alerts" : "Alertas del Copiloto"}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
              title={isEn ? "Close" : "Cerrar"}
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto p-2 space-y-1.5">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-lg p-2.5 text-[11px] space-y-0.5 ${
                  alert.type === "critical"
                    ? "bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300"
                    : alert.type === "warning"
                    ? "bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300"
                    : "bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300"
                }`}
              >
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{formatAlertMessage(alert.message, isEn)}</span>
                </div>
                {alert.account && (
                  <p className="text-[10px] font-bold pl-4.5 opacity-80">{alert.account}</p>
                )}
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-4">
                {isEn ? "No active alerts ✓" : "Sin alertas activas ✓"}
              </p>
            )}
          </div>
          {(critical > 0 || warnings > 0) && (
            <div className="border-t border-border/60 px-3 py-2 text-[10px] text-muted-foreground">
              {critical > 0 && (
                <span className="text-red-600 font-bold">
                  {isEn ? `${critical} critical` : `${critical} crítico${critical > 1 ? "s" : ""}`}
                </span>
              )}
              {critical > 0 && warnings > 0 && <span> · </span>}
              {warnings > 0 && (
                <span className="text-amber-600 font-bold">
                  {isEn
                    ? `${warnings} warning${warnings > 1 ? "s" : ""}`
                    : `${warnings} aviso${warnings > 1 ? "s" : ""}`}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

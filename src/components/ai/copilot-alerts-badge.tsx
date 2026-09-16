"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X, Bell } from "lucide-react";

type CopilotAlert = {
  id: string;
  type: "warning" | "critical" | "info";
  message: string;
  account?: string;
  action?: string;
};

export function CopilotAlertsBadge() {
  const [alerts, setAlerts] = useState<CopilotAlert[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/ai/copilot-audit");
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
  }, []);

  const critical = alerts.filter((a) => a.type === "critical").length;
  const warnings = alerts.filter((a) => a.type === "warning").length;

  if (alerts.length === 0 && !loading) return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
      >
        <Bell className="size-3.5" />
        <span>Alertas</span>
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
            <span className="text-xs font-bold text-foreground">Alertas del Copiloto</span>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
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
                  <span className="leading-relaxed">{alert.message}</span>
                </div>
                {alert.account && (
                  <p className="text-[10px] font-bold pl-4.5 opacity-80">{alert.account}</p>
                )}
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-4">Sin alertas activas ✓</p>
            )}
          </div>
          {(critical > 0 || warnings > 0) && (
            <div className="border-t border-border/60 px-3 py-2 text-[10px] text-muted-foreground">
              {critical > 0 && <span className="text-red-600 font-bold">{critical} crítico{critical > 1 ? "s" : ""}</span>}
              {critical > 0 && warnings > 0 && <span> · </span>}
              {warnings > 0 && <span className="text-amber-600 font-bold">{warnings} aviso{warnings > 1 ? "s" : ""}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

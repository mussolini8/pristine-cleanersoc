"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  Star,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { QCCalendar, type QCInspector, type QCSchedule } from "@/components/qc/qc-calendar";
import {
  InspectorsPanel,
  type QCInspector as InspPanelInspector,
} from "@/components/qc/inspectors-panel";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Tab = "overview" | "calendar" | "inspectors" | "accounts";

type GeofenceRow = {
  id: string;
  commercial_account_id: string;
  account_name: string;
  address: string | null;
  active: boolean;
};

type CommercialAccountRow = {
  id: string;
  name: string;
  city: string | null;
};

// ─────────────────────────────────────────────
// Tab switcher
// ─────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: ClipboardList },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "inspectors", label: "Inspectors", icon: Users },
  { id: "accounts", label: "Accounts", icon: MapPin },
];

// ─────────────────────────────────────────────
// Overview metric card
// ─────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon: Icon,
  sub,
  accent = false,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-5 shadow-sm",
        accent
          ? "border-primary/20 bg-primary/[0.06]"
          : "border-border/70 bg-card",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-xl",
            accent ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground",
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p
        className={cn(
          "text-3xl font-bold tracking-tight",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Accounts tab
// ─────────────────────────────────────────────

function AccountsTab({
  geofences,
  allAccounts,
  loading,
}: {
  geofences: GeofenceRow[];
  allAccounts: CommercialAccountRow[];
  loading: boolean;
}) {
  const geofenceAccountIds = useMemo(
    () => new Set(geofences.map((g) => g.commercial_account_id)),
    [geofences],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Accounts</h2>
        <span className="text-xs font-semibold text-muted-foreground">
          {geofences.length} / {allAccounts.length} with geofence
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <table className="sop-table w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 text-left">Account</th>
              <th className="px-4 text-left">City</th>
              <th className="px-4 text-left">Geofence</th>
            </tr>
          </thead>
          <tbody>
            {allAccounts.map((acct) => {
              const hasGeo = geofenceAccountIds.has(acct.id);
              return (
                <tr key={acct.id}>
                  <td className="px-4 font-semibold text-foreground">
                    {acct.name}
                  </td>
                  <td className="px-4 text-muted-foreground">
                    {acct.city ?? "—"}
                  </td>
                  <td className="px-4">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        hasGeo
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          hasGeo ? "bg-primary" : "bg-muted-foreground/40",
                        )}
                      />
                      {hasGeo ? "Configured" : "Not configured"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main QCDashboardClient
// ─────────────────────────────────────────────

export function QCDashboardClient() {
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [inspectors, setInspectors] = useState<InspPanelInspector[]>([]);
  const [schedules, setSchedules] = useState<QCSchedule[]>([]);
  const [geofences, setGeofences] = useState<GeofenceRow[]>([]);
  const [allAccounts, setAllAccounts] = useState<CommercialAccountRow[]>([]);

  // ── Load data ──────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const [inspRes, schedRes, geoRes, acctRes] = await Promise.all([
        supabase
          .from("qc_inspectors")
          .select("*")
          .order("name"),
        supabase
          .from("qc_inspection_schedules")
          .select("*")
          .eq("active", true),
        supabase
          .from("qc_property_geofences")
          .select("id, commercial_account_id, account_name, address, active"),
        supabase
          .from("commercial_accounts")
          .select("id, name, city")
          .order("name"),
      ]);

      if (!mounted) return;

      if (inspRes.error) {
        setError(inspRes.error.message);
        setLoading(false);
        return;
      }

      setInspectors((inspRes.data ?? []) as InspPanelInspector[]);
      setSchedules((schedRes.data ?? []) as QCSchedule[]);
      setGeofences((geoRes.data ?? []) as GeofenceRow[]);
      setAllAccounts((acctRes.data ?? []) as CommercialAccountRow[]);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // ── Computed overview metrics ──────────────────
  const today = new Date();
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();

  /**
   * Count inspection occurrences this calendar month from active schedules.
   * We replicate a simplified version of the expansion here so the dashboard
   * doesn't need to import the full calendar helper.
   */
  const inspectionsThisMonth = useMemo(() => {
    const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
    let count = 0;
    for (const s of schedules) {
      const ft = s.frequency_type?.toLowerCase() ?? "";
      if (ft === "daily") {
        count += daysInMonth;
      } else if (ft === "weekly") {
        const days = s.days_of_week ?? [];
        for (let d = 1; d <= daysInMonth; d++) {
          const dow = new Date(thisYear, thisMonth, d).getDay();
          if (days.includes(dow)) count++;
        }
      } else if (ft === "biweekly" || ft === "bi-weekly") {
        const days = s.days_of_week ?? [];
        for (let d = 1; d <= daysInMonth; d++) {
          const dow = new Date(thisYear, thisMonth, d).getDay();
          if (days.includes(dow)) count++;
        }
        // biweekly — divide by 2 approximately
        count = Math.ceil(count / 2);
      } else if (ft === "monthly" || ft === "one_off" || ft === "one-off") {
        count += 1;
      }
    }
    return count;
  }, [schedules, thisMonth, thisYear]);

  const activeInspectors = useMemo(
    () => inspectors.filter((i) => i.status === "active").length,
    [inspectors],
  );

  // Cast inspectors to QCInspector for calendar (calendar only needs id/name/color)
  const calendarInspectors = useMemo<QCInspector[]>(
    () =>
      inspectors.map((i) => ({
        id: i.id,
        name: i.name,
        color: i.color,
      })),
    [inspectors],
  );

  // ── Render ─────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-muted-foreground">
            Loading QC data…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-semibold text-destructive">
          Error: {error}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page title */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">
          Quality Control
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          QC Manager Dashboard
        </h1>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex overflow-x-auto rounded-2xl border border-border/70 bg-card/80 p-1 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-150",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <tab.icon className="size-4 shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Inspections This Month"
              value={inspectionsThisMonth}
              icon={CalendarDays}
              accent
            />
            <MetricCard
              label="Open Action Items"
              value={0}
              icon={CheckCircle2}
              sub="No open items"
            />
            <MetricCard
              label="Average Score"
              value="—"
              icon={Star}
              sub="No scored inspections yet"
            />
            <MetricCard
              label="Active Inspectors"
              value={activeInspectors}
              icon={Users}
              sub={`${inspectors.length} total`}
            />
          </div>

          {/* Quick schedule summary */}
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-primary">
              Schedule Summary
            </p>
            {schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active inspection schedules.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border/50">
                {schedules.slice(0, 8).map((s) => {
                  const inspector = inspectors.find(
                    (i) => i.id === s.inspector_id,
                  );
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: inspector?.color ?? "#6b7280" }}
                      />
                      <p className="flex-1 truncate text-sm font-semibold text-foreground">
                        {s.account_name}
                      </p>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {inspector?.name ?? "Unassigned"}
                      </p>
                      <p className="hidden shrink-0 text-xs font-semibold capitalize text-muted-foreground sm:block">
                        {s.frequency_type}
                      </p>
                    </div>
                  );
                })}
                {schedules.length > 8 && (
                  <p className="pt-2 text-xs text-muted-foreground">
                    +{schedules.length - 8} more schedules
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calendar */}
      {activeTab === "calendar" && (
        <QCCalendar
          inspectors={calendarInspectors}
          schedules={schedules}
        />
      )}

      {/* Inspectors */}
      {activeTab === "inspectors" && (
        <InspectorsPanel
          inspectors={inspectors}
          schedules={schedules}
          onInspectorsChange={setInspectors}
        />
      )}

      {/* Accounts */}
      {activeTab === "accounts" && (
        <AccountsTab
          geofences={geofences}
          allAccounts={allAccounts}
          loading={false}
        />
      )}
    </div>
  );
}

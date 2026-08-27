"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Star,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { QCCalendar, type QCInspector, type QCSchedule } from "@/components/qc/qc-calendar";
import {
  InspectorsPanel,
  type QCInspector as InspPanelInspector,
} from "@/components/qc/inspectors-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Tab = "overview" | "calendar" | "inspectors" | "accounts" | "audits";

type GeofenceRow = {
  id: string;
  commercial_account_id: string;
  account_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
  active: boolean;
};

type CommercialAccountRow = {
  id: string;
  name: string;
  city: string | null;
};

type InspectionRow = {
  id: string;
  account_id: string;
  inspector_id: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  score_percentage: number | null;
  grade: string | null;
  inspector_signature: string | null;
  inspection_data: string | null;
};

// ─────────────────────────────────────────────
// Tab switcher
// ─────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: ClipboardList },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "inspectors", label: "Inspectors", icon: Users },
  { id: "accounts", label: "Accounts", icon: MapPin },
  { id: "audits", label: "Audits", icon: CheckCircle2 },
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
  onConfigureGeofence,
}: {
  geofences: GeofenceRow[];
  allAccounts: CommercialAccountRow[];
  loading: boolean;
  onConfigureGeofence: (account: CommercialAccountRow) => void;
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
              <th className="px-4 text-right">Actions</th>
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
                  <td className="px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onConfigureGeofence(acct)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-border hover:text-foreground transition-all cursor-pointer animate-none"
                    >
                      Configure
                    </button>
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
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [selectedGeofenceAccount, setSelectedGeofenceAccount] = useState<CommercialAccountRow | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<InspectionRow | null>(null);
  const [schedulingOpen, setSchedulingOpen] = useState(false);

  // ── Load data ──────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const [inspRes, schedRes, geoRes, acctRes, auditRes] = await Promise.all([
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
          .select("id, commercial_account_id, account_name, address, latitude, longitude, radius_meters, active"),
        supabase
          .from("commercial_accounts")
          .select("id, name, city")
          .order("name"),
        supabase
          .from("qc_inspections")
          .select("*")
          .eq("status", "submitted")
          .order("check_out_at", { ascending: false }),
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
      setInspections((auditRes.data ?? []) as InspectionRow[]);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // Geofence save handler
  async function handleSaveGeofence(
    lat: number,
    lng: number,
    radius: number,
    address: string | null
  ) {
    if (!selectedGeofenceAccount) return;
    const acct = selectedGeofenceAccount;

    const existing = geofences.find((g) => g.commercial_account_id === acct.id);

    if (existing) {
      // Update existing geofence
      const { data, error } = await supabase
        .from("qc_property_geofences")
        .update({
          address,
          latitude: lat,
          longitude: lng,
          radius_meters: radius,
          active: true,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;

      // Update state
      setGeofences((prev) =>
        prev.map((g) =>
          g.id === existing.id
            ? {
                ...g,
                address,
                latitude: lat,
                longitude: lng,
                radius_meters: radius,
              }
            : g
        )
      );
    } else {
      // Create new geofence
      const { data, error } = await supabase
        .from("qc_property_geofences")
        .insert({
          commercial_account_id: acct.id,
          account_name: acct.name,
          address,
          latitude: lat,
          longitude: lng,
          radius_meters: radius,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Update state
      setGeofences((prev) => [...prev, data as GeofenceRow]);
    }
  }

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
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button onClick={() => setSchedulingOpen(true)} size="sm" className="cursor-pointer gap-1">
              <Plus className="size-4" /> Schedule Inspection
            </Button>
          </div>
          <QCCalendar
            inspectors={calendarInspectors}
            schedules={schedules}
          />
        </div>
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
          onConfigureGeofence={(acct) => setSelectedGeofenceAccount(acct)}
        />
      )}

      {/* Audits */}
      {activeTab === "audits" && (
        <AuditsTab
          inspections={inspections}
          allAccounts={allAccounts}
          inspectors={inspectors}
          onViewAudit={(audit) => setSelectedAudit(audit)}
        />
      )}

      {selectedGeofenceAccount && (
        <GeofenceModal
          account={selectedGeofenceAccount}
          existingGeofence={geofences.find((g) => g.commercial_account_id === selectedGeofenceAccount.id) ?? null}
          onClose={() => setSelectedGeofenceAccount(null)}
          onSave={handleSaveGeofence}
        />
      )}

      {selectedAudit && (
        <AuditReportModal
          audit={selectedAudit}
          account={allAccounts.find((a) => a.id === selectedAudit.account_id) ?? null}
          inspector={inspectors.find((i) => i.id === selectedAudit.inspector_id) ?? null}
          onClose={() => setSelectedAudit(null)}
        />
      )}

      {schedulingOpen && (
        <ScheduleInspectionModal
          open={schedulingOpen}
          onClose={() => setSchedulingOpen(false)}
          accounts={allAccounts}
          inspectors={inspectors}
          onSaved={(newSched) => setSchedules((prev) => [...prev, newSched])}
        />
      )}
    </div>
  );
}

function parseGoogleMapsCoords(url: string): { lat: number; lng: number } | null {
  // 1. Raw coords: e.g. "33.6846, -117.8265"
  const rawCoordMatch = url.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
  if (rawCoordMatch) {
    return { lat: parseFloat(rawCoordMatch[1]), lng: parseFloat(rawCoordMatch[2]) };
  }
  // 2. Query format: e.g. q=33.6846,-117.8265
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }
  // 3. Location format: e.g. @33.6846,-117.8265,15z
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }
  // 4. Place URL format: e.g. place/33.6846,-117.8265
  const placeMatch = url.match(/place\/(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (placeMatch) {
    return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };
  }
  return null;
}

function GeofenceModal({
  account,
  existingGeofence,
  onClose,
  onSave,
}: {
  account: CommercialAccountRow;
  existingGeofence: GeofenceRow | null;
  onClose: () => void;
  onSave: (lat: number, lng: number, radius: number, address: string | null) => Promise<void>;
}) {
  const [mapsUrl, setMapsUrl] = useState(
    existingGeofence?.latitude && existingGeofence?.longitude
      ? `https://www.google.com/maps/place/${existingGeofence.latitude},${existingGeofence.longitude}`
      : ""
  );
  const [radius, setRadius] = useState(existingGeofence?.radius_meters?.toString() ?? "75");
  const [address, setAddress] = useState(existingGeofence?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mapsUrl.trim() || !radius) {
      setError("Please paste a Google Maps link and specify Radius.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let coords = parseGoogleMapsCoords(mapsUrl);

      // Try resolving redirect URL from short links (maps.app.goo.gl or share.google.com) via API
      if (!coords && (mapsUrl.startsWith("http://") || mapsUrl.startsWith("https://"))) {
        const resolveRes = await fetch("/api/qc/resolve-maps-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: mapsUrl }),
        });

        if (resolveRes.ok) {
          const { finalUrl } = await resolveRes.json();
          if (finalUrl) {
            coords = parseGoogleMapsCoords(finalUrl);
          }
        }
      }

      if (!coords) {
        setError("Could not parse coordinates. Paste a standard Google Maps URL containing coordinates (e.g. copied from URL bar or showing lat,lng).");
        setSaving(false);
        return;
      }

      await onSave(coords.lat, coords.lng, Number(radius), address || null);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Error saving geofence");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
            <h3 className="text-base font-bold text-foreground">Configure Geofence</h3>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer">
              <X className="size-4" />
            </button>
          </div>
          <CardContent className="p-5 space-y-4">
            <div className="bg-primary/[0.04] border border-primary/10 rounded-xl p-3 text-xs text-primary font-semibold">
              Property: {account.name}
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs font-semibold text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Google Maps Link</label>
              <input
                type="text"
                required
                placeholder="Paste Google Maps URL or 'lat,lng'"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Paste the URL copied from Google Maps, or coordinates directly (e.g. <code>33.6846, -117.8265</code>).
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Radius (meters)</label>
              <input
                type="number"
                required
                placeholder="Default: 75"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Address</label>
              <textarea
                placeholder="Optional property address"
                className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </CardContent>
          <div className="flex gap-2 border-t border-border/50 px-5 py-4 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Geofence"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function AuditsTab({
  inspections,
  allAccounts,
  inspectors,
  onViewAudit,
}: {
  inspections: InspectionRow[];
  allAccounts: CommercialAccountRow[];
  inspectors: InspPanelInspector[];
  onViewAudit: (audit: InspectionRow) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Audit History</h2>
        <span className="text-xs font-semibold text-muted-foreground">
          {inspections.length} audit{inspections.length !== 1 ? "s" : ""} completed
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        {inspections.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No audits submitted yet.
          </div>
        ) : (
          <table className="sop-table w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 text-left">Date</th>
                <th className="px-4 text-left">Account</th>
                <th className="px-4 text-left">Inspector</th>
                <th className="px-4 text-left">Score</th>
                <th className="px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((audit) => {
                const acct = allAccounts.find((a) => a.id === audit.account_id);
                const insp = inspectors.find((i) => i.id === audit.inspector_id);
                const dateStr = audit.check_out_at
                  ? new Date(audit.check_out_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—";

                return (
                  <tr key={audit.id}>
                    <td className="px-4 text-muted-foreground">{dateStr}</td>
                    <td className="px-4 font-semibold text-foreground">
                      {acct?.name ?? "Unknown Account"}
                    </td>
                    <td className="px-4 text-foreground flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: insp?.color ?? "#9ca3af" }} />
                      {insp?.name ?? "Unknown Inspector"}
                    </td>
                    <td className="px-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
                        (audit.score_percentage ?? 0) >= 90
                          ? "bg-primary/10 text-primary"
                          : (audit.score_percentage ?? 0) >= 80
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-destructive/10 text-destructive"
                      )}>
                        {audit.score_percentage}% ({audit.grade})
                      </span>
                    </td>
                    <td className="px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onViewAudit(audit)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-border hover:text-foreground transition-all cursor-pointer"
                      >
                        <FileText className="size-3.5" /> View Report
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

interface ChecklistItem {
  label: string;
  rating: "pass" | "attention" | "fail" | "na";
  notes?: string;
  photoUrl?: string;
}

interface InspectionArea {
  name: string;
  items: ChecklistItem[];
}

function AuditReportModal({
  audit,
  account,
  inspector,
  onClose,
}: {
  audit: InspectionRow;
  account: CommercialAccountRow | null;
  inspector: InspPanelInspector | null;
  onClose: () => void;
}) {
  const areas = useMemo<InspectionArea[]>(() => {
    try {
      return audit.inspection_data ? (JSON.parse(audit.inspection_data) as InspectionArea[]) : [];
    } catch {
      return [];
    }
  }, [audit.inspection_data]);

  const dateStr = audit.check_out_at
    ? new Date(audit.check_out_at).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border-border/60 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4 shrink-0">
          <div>
            <h3 className="text-base font-bold text-foreground">Inspection Report</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <CardContent className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-3 gap-4 border border-border/60 rounded-xl p-4 bg-muted/30">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Account</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{account?.name ?? "Unknown"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Inspector</p>
              <p className="text-sm font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: inspector?.color ?? "#9ca3af" }} />
                {inspector?.name ?? "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pristine Score</p>
              <p className="text-sm font-bold text-primary mt-0.5">
                {audit.score_percentage}% ({audit.grade})
              </p>
            </div>
          </div>

          {/* Checklist Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-1">Checklist Areas</h4>
            {areas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items audited.</p>
            ) : (
              <div className="space-y-6">
                {areas.map((area, aIdx) => (
                  <div key={aIdx} className="space-y-2">
                    <h5 className="text-sm font-bold text-foreground bg-primary/[0.04] px-3 py-1 rounded-lg border border-primary/10">
                      {area.name}
                    </h5>
                    <div className="divide-y divide-border/50 pl-2">
                      {area.items.map((item, iIdx) => (
                        <div key={iIdx} className="py-2.5 space-y-1.5">
                          <div className="flex items-start justify-between gap-3 text-sm">
                            <span className="font-medium text-foreground">{item.label}</span>
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0",
                              item.rating === "pass"
                                ? "bg-primary/10 text-primary"
                                : item.rating === "attention"
                                ? "bg-amber-500/10 text-amber-600"
                                : item.rating === "fail"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground"
                            )}>
                              {item.rating}
                            </span>
                          </div>
                          {(item.notes || item.photoUrl) && (
                            <div className="bg-muted/40 border border-border/40 rounded-xl p-3 space-y-2 text-xs">
                              {item.notes && <p className="text-muted-foreground font-medium italic">"{item.notes}"</p>}
                              {item.photoUrl && (
                                <img
                                  src={item.photoUrl}
                                  alt="Audit Photo"
                                  className="max-h-40 w-auto rounded-lg border object-cover shadow-sm"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Signature */}
          {audit.inspector_signature && (
            <div className="border-t pt-4 space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Inspector Signature</h4>
              <div className="flex flex-col items-start bg-muted/30 border rounded-xl p-4 max-w-sm">
                <img
                  src={audit.inspector_signature}
                  alt="Signature"
                  className="max-h-24 w-auto object-contain dark:invert"
                />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-2">
                  Signed: {inspector?.name ?? "Inspector"}
                </span>
              </div>
            </div>
          )}
        </CardContent>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border/50 px-5 py-4 justify-end shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ScheduleInspectionModal({
  open,
  onClose,
  accounts,
  inspectors,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  accounts: CommercialAccountRow[];
  inspectors: InspPanelInspector[];
  onSaved: (schedule: QCSchedule) => void;
}) {
  const supabase = createClient();
  const [acctId, setAcctId] = useState("");
  const [inspId, setInspId] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [days, setDays] = useState<number[]>([]);
  const [time, setTime] = useState("18:00");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function handleDayToggle(idx: number) {
    setDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!acctId || !inspId) {
      setError("Please select an Account and an Inspector.");
      return;
    }
    if ((frequency === "weekly" || frequency === "biweekly") && days.length === 0) {
      setError("Please select at least one day of the week.");
      return;
    }
    if (frequency === "one_off" && !date) {
      setError("Please select a specific date.");
      return;
    }

    setSaving(true);
    setError(null);

    const selectedAcct = accounts.find((a) => a.id === acctId);

    try {
      const { data, error: dbErr } = await supabase
        .from("qc_inspection_schedules")
        .insert({
          inspector_id: inspId,
          commercial_account_id: acctId,
          account_name: selectedAcct?.name ?? "Unknown Property",
          frequency_type: frequency,
          days_of_week: frequency === "weekly" || frequency === "biweekly" ? days : null,
          scheduled_time: time || null,
          specific_date: frequency === "one_off" ? date : null,
          notes: notes || null,
          active: true,
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      onSaved(data as QCSchedule);
      onClose();
      // Reset form
      setAcctId("");
      setInspId("");
      setDays([]);
      setNotes("");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
            <h3 className="text-base font-bold text-foreground">Schedule Inspection</h3>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer">
              <X className="size-4" />
            </button>
          </div>
          <CardContent className="p-5 space-y-4">
            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs font-semibold text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Property / Account *</label>
              <select
                required
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                value={acctId}
                onChange={(e) => setAcctId(e.target.value)}
              >
                <option value="">Select account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.city ?? "No City"})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Assigned Inspector *</label>
              <select
                required
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                value={inspId}
                onChange={(e) => setInspId(e.target.value)}
              >
                <option value="">Select inspector...</option>
                {inspectors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Frequency *</label>
                <select
                  required
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="one_off">One-off Date</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Time *</label>
                <input
                  type="time"
                  required
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            {frequency === "one_off" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Specific Date *</label>
                <input
                  type="date"
                  required
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            ) : (frequency === "weekly" || frequency === "biweekly") ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Days of Week *</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((label, idx) => {
                    const selected = days.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleDayToggle(idx)}
                        className={cn(
                          "rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-all cursor-pointer",
                          selected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Notes</label>
              <textarea
                placeholder="Instructions or schedule notes..."
                className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
          <div className="flex gap-2 border-t border-border/50 px-5 py-4 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Scheduling..." : "Schedule"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

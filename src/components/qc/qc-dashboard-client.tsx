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
import { useLanguage } from "@/components/providers/language-provider";
import { cn } from "@/lib/utils";
import { QCCalendar, type QCInspector, type QCSchedule } from "@/components/qc/qc-calendar";
import {
  InspectorsPanel,
  type QCInspector as InspPanelInspector,
} from "@/components/qc/inspectors-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkScheduleModal } from "@/components/operations/work-schedule-modal";

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
// Bilingual helpers
// ─────────────────────────────────────────────

const QC_TEXT_ES: Record<string, string> = {
  // Areas
  "Entrance & Lobby": "Entrada y Recepción",
  "Restrooms": "Baños",
  "Office / Work Areas": "Oficinas / Áreas de Trabajo",
  "Break Room / Kitchen": "Comedor / Cocina",
  "General / Wrap-up": "General / Cierre",
  // Items
  "Floors swept & mopped": "Pisos barridos y trapeados",
  "Mats clean & positioned": "Tapetes limpios y en su lugar",
  "Glass doors streak-free": "Puertas de vidrio sin marcas",
  "Light switches & outlets wiped": "Interruptores y tomacorrientes limpios",
  "Trash emptied & liner replaced": "Basura vaciada y bolsa reemplazada",
  "Toilets & urinals sanitized": "Inodoros y urinarios desinfectados",
  "Sinks & counters cleaned": "Lavamanos y mostradores limpios",
  "Mirrors streak-free": "Espejos sin marcas",
  "Floors mopped & dry": "Pisos trapeados y secos",
  "Supplies restocked (soap, paper)": "Suministros repuestos (jabón, papel)",
  "Trash emptied": "Basura vaciada",
  "Odor-free": "Sin malos olores",
  "Desks & surfaces dusted": "Escritorios y superficies desempolvados",
  "Floors vacuumed or swept": "Pisos aspirados o barridos",
  "Trash emptied & liners replaced": "Basura vaciada y bolsas reemplazadas",
  "Common areas tidied": "Áreas comunes ordenadas",
  "Electronics dusted (exteriors)": "Equipos electrónicos desempolvados (exterior)",
  "Counters & surfaces sanitized": "Mostradores y superficies desinfectados",
  "Sink cleaned": "Fregadero limpio",
  "Microwave cleaned inside & out": "Microondas limpio por dentro y por fuera",
  "Appliance exteriors wiped": "Exterior de electrodomésticos limpio",
  "All lights off in unoccupied rooms": "Luces apagadas en áreas desocupadas",
  "Supplies restocked in cart": "Suministros repuestos en el carrito",
  "No equipment left behind": "Ningún equipo olvidado",
  "Client sign-off obtained": "Conformidad del cliente obtenida",
};

function translateQcText(text: string, isEn: boolean): string {
  if (isEn) return text;
  return QC_TEXT_ES[text] ?? text;
}

function translateFrequency(freq: string | null | undefined, isEn: boolean): string {
  const ft = (freq ?? "").toLowerCase();
  if (ft === "daily") return isEn ? "Daily" : "Diario";
  if (ft === "weekly") return isEn ? "Weekly" : "Semanal";
  if (ft === "biweekly" || ft === "bi-weekly") return isEn ? "Bi-weekly" : "Quincenal";
  if (ft === "monthly") return isEn ? "Monthly" : "Mensual";
  if (ft === "one_off" || ft === "one-off" || ft === "specific_date") {
    return isEn ? "One-off Date" : "Fecha única";
  }
  return freq ?? "";
}

// ─────────────────────────────────────────────
// Tab switcher
// ─────────────────────────────────────────────

const TABS: { id: Tab; labelEn: string; labelEs: string; icon: React.ElementType }[] = [
  { id: "overview", labelEn: "Overview", labelEs: "Resumen", icon: ClipboardList },
  { id: "calendar", labelEn: "Calendar", labelEs: "Calendario", icon: CalendarDays },
  { id: "inspectors", labelEn: "Inspectors", labelEs: "Inspectores", icon: Users },
  { id: "accounts", labelEn: "Accounts", labelEs: "Cuentas", icon: MapPin },
  { id: "audits", labelEn: "Audits", labelEs: "Auditorías", icon: CheckCircle2 },
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
  const { isEn } = useLanguage();
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
        <h2 className="text-lg font-bold text-foreground">
          {isEn ? "Accounts" : "Cuentas"}
        </h2>
        <span className="text-xs font-semibold text-muted-foreground">
          {geofences.length} / {allAccounts.length} {isEn ? "with geofence" : "con geocerca"}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <table className="sop-table w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 text-left">{isEn ? "Account" : "Cuenta"}</th>
              <th className="px-4 text-left">{isEn ? "City" : "Ciudad"}</th>
              <th className="px-4 text-left">{isEn ? "Geofence" : "Geocerca"}</th>
              <th className="px-4 text-right">{isEn ? "Actions" : "Acciones"}</th>
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
                      {hasGeo
                        ? isEn
                          ? "Configured"
                          : "Configurada"
                        : isEn
                          ? "Not configured"
                          : "Sin configurar"}
                    </span>
                  </td>
                  <td className="px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onConfigureGeofence(acct)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-border hover:text-foreground transition-all cursor-pointer animate-none"
                    >
                      {isEn ? "Configure" : "Configurar"}
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
  const { isEn } = useLanguage();
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
  const [workScheduleOpen, setWorkScheduleOpen] = useState(false);

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
            {isEn ? "Loading QC data…" : "Cargando datos de QC…"}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-semibold text-destructive">
          {isEn ? "Error:" : "Error:"} {error}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page title */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">
          {isEn ? "Quality Control" : "Control de Calidad"}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isEn ? "QC Manager Dashboard" : "Panel de Control de Calidad (QC)"}
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
            <span className="hidden sm:inline">
              {isEn ? tab.labelEn : tab.labelEs}
            </span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label={isEn ? "Inspections This Month" : "Inspecciones Este Mes"}
              value={inspectionsThisMonth}
              icon={CalendarDays}
              accent
            />
            <MetricCard
              label={isEn ? "Open Action Items" : "Acciones Pendientes"}
              value={0}
              icon={CheckCircle2}
              sub={isEn ? "No open items" : "Sin acciones pendientes"}
            />
            <MetricCard
              label={isEn ? "Average Score" : "Puntaje Promedio"}
              value="—"
              icon={Star}
              sub={
                isEn
                  ? "No scored inspections yet"
                  : "Aún sin inspecciones calificadas"
              }
            />
            <MetricCard
              label={isEn ? "Active Inspectors" : "Inspectores Activos"}
              value={activeInspectors}
              icon={Users}
              sub={
                isEn
                  ? `${inspectors.length} total`
                  : `${inspectors.length} en total`
              }
            />
          </div>

          {/* Quick schedule summary */}
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-primary">
              {isEn ? "Schedule Summary" : "Resumen de Horarios"}
            </p>
            {schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isEn
                  ? "No active inspection schedules."
                  : "No hay horarios de inspección activos."}
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
                        {inspector?.name ?? (isEn ? "Unassigned" : "Sin asignar")}
                      </p>
                      <p className="hidden shrink-0 text-xs font-semibold capitalize text-muted-foreground sm:block">
                        {translateFrequency(s.frequency_type, isEn)}
                      </p>
                    </div>
                  );
                })}
                {schedules.length > 8 && (
                  <p className="pt-2 text-xs text-muted-foreground">
                    +{schedules.length - 8}{" "}
                    {isEn ? "more schedules" : "horarios más"}
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
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWorkScheduleOpen(true)}
              className="cursor-pointer gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
            >
              <FileText className="size-4" />{" "}
              {isEn ? "Work Schedule (PDF)" : "Horario de Trabajo (PDF)"}
            </Button>
            <Button onClick={() => setSchedulingOpen(true)} size="sm" className="cursor-pointer gap-1">
              <Plus className="size-4" />{" "}
              {isEn ? "Schedule Inspection" : "Programar Inspección"}
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

      <WorkScheduleModal
        open={workScheduleOpen}
        onClose={() => setWorkScheduleOpen(false)}
        initialEmployee="Maria Lopez"
        initialPeriod="October 2026"
        initialScope="qc"
      />
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
  const { isEn } = useLanguage();
  const [mapsUrl, setMapsUrl] = useState("");
  const [lat, setLat] = useState(existingGeofence?.latitude?.toString() ?? "");
  const [lng, setLng] = useState(existingGeofence?.longitude?.toString() ?? "");
  const [radius, setRadius] = useState(existingGeofence?.radius_meters?.toString() ?? "75");
  const [address, setAddress] = useState(existingGeofence?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill maps URL if editing existing coordinates
  useEffect(() => {
    if (existingGeofence?.latitude && existingGeofence?.longitude) {
      setMapsUrl(`https://www.google.com/maps/place/${existingGeofence.latitude},${existingGeofence.longitude}`);
    }
  }, [existingGeofence]);

  async function handleGeocodeAddress() {
    if (!address.trim()) return;
    setGeocoding(true);
    setError(null);
    try {
      const res = await fetch("/api/qc/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (res.ok) {
        const data = await res.json();
        setLat(data.lat.toString());
        setLng(data.lng.toString());
      } else {
        const data = await res.json();
        setError(
          data.error ??
            (isEn
              ? "Failed to geocode address automatically. Enter coordinates manually."
              : "No se pudo geocodificar la dirección automáticamente. Ingresa las coordenadas manualmente."),
        );
      }
    } catch (e: any) {
      setError(
        isEn
          ? "Error calling geocoder. Please enter coordinates manually."
          : "Error al consultar el geocodificador. Por favor ingresa las coordenadas manualmente.",
      );
    } finally {
      setGeocoding(false);
    }
  }

  // Auto-geocode address on mount if coordinates are empty
  useEffect(() => {
    if (!lat && !lng && address.trim()) {
      handleGeocodeAddress();
    }
  }, [address]);

  async function handleLinkChange(value: string) {
    setMapsUrl(value);
    setError(null);
    if (!value.trim()) return;

    // 1. Try local client-side parsing first
    const coords = parseGoogleMapsCoords(value);
    if (coords) {
      setLat(coords.lat.toString());
      setLng(coords.lng.toString());
      return;
    }

    // 2. Try server-side redirect resolver for short links (maps.app.goo.gl or share.google)
    if (value.startsWith("http://") || value.startsWith("https://")) {
      setResolving(true);
      try {
        const resolveRes = await fetch("/api/qc/resolve-maps-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: value }),
        });

        if (resolveRes.ok) {
          const { finalUrl } = await resolveRes.json();
          if (finalUrl) {
            const resolvedCoords = parseGoogleMapsCoords(finalUrl);
            if (resolvedCoords) {
              setLat(resolvedCoords.lat.toString());
              setLng(resolvedCoords.lng.toString());
              setResolving(false);
              return;
            }
          }
        }
      } catch (e) {
        // Fall back to manual input without raising an error
      }
      setResolving(false);
      setError(
        isEn
          ? "Could not auto-extract coordinates from this link. Please enter Latitude and Longitude manually below."
          : "No se pudieron extraer las coordenadas de este enlace. Ingresa la Latitud y Longitud manualmente abajo.",
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lat || !lng || !radius) {
      setError(
        isEn
          ? "Please specify Latitude, Longitude, and Radius."
          : "Por favor especifica Latitud, Longitud y Radio.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(Number(lat), Number(lng), Number(radius), address || null);
      onClose();
    } catch (err: any) {
      setError(
        err?.message ??
          (isEn ? "Error saving geofence" : "Error al guardar la geocerca"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
            <h3 className="text-base font-bold text-foreground">
              {isEn ? "Configure Geofence" : "Configurar Geocerca"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label={isEn ? "Close" : "Cerrar"}
              className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
          <CardContent className="p-5 space-y-4">
            <div className="bg-primary/[0.04] border border-primary/10 rounded-xl p-3 text-xs text-primary font-semibold">
              {isEn ? "Property:" : "Propiedad:"} {account.name}
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs font-semibold text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                {isEn ? "Google Maps Link" : "Enlace de Google Maps"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={
                    isEn ? "Paste Google Maps URL" : "Pegar URL de Google Maps"
                  }
                  className="w-full rounded-xl border border-input bg-background pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  value={mapsUrl}
                  onChange={(e) => handleLinkChange(e.target.value)}
                />
                {resolving && (
                  <div className="absolute right-3 top-2.5">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isEn
                  ? "Paste the URL copied from Google Maps, and coordinates will be auto-filled below."
                  : "Pega la URL copiada de Google Maps y las coordenadas se completarán automáticamente abajo."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  {isEn ? "Latitude *" : "Latitud *"}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder={isEn ? "e.g. 33.6846" : "ej. 33.6846"}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  {isEn ? "Longitude *" : "Longitud *"}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder={isEn ? "e.g. -117.8265" : "ej. -117.8265"}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                {isEn ? "Radius (meters) *" : "Radio (metros) *"}
              </label>
              <input
                type="number"
                required
                placeholder={isEn ? "Default: 75" : "Predeterminado: 75"}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                {isEn ? "Address" : "Dirección"}
              </label>
              <textarea
                placeholder={
                  isEn
                    ? "Optional property address"
                    : "Dirección opcional de la propiedad"
                }
                className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              {address.trim() && (
                <button
                  type="button"
                  onClick={handleGeocodeAddress}
                  disabled={geocoding}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                >
                  {geocoding ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />{" "}
                      {isEn ? "Locating address..." : "Localizando dirección..."}
                    </>
                  ) : isEn ? (
                    "📍 Auto-locate Coordinates from Address"
                  ) : (
                    "📍 Autolocalizar Coordenadas desde Dirección"
                  )}
                </button>
              )}
            </div>
          </CardContent>
          <div className="flex gap-2 border-t border-border/50 px-5 py-4 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {isEn ? "Cancel" : "Cancelar"}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? isEn
                  ? "Saving..."
                  : "Guardando..."
                : isEn
                  ? "Save Geofence"
                  : "Guardar Geocerca"}
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
  const { isEn } = useLanguage();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">
          {isEn ? "Audit History" : "Historial de Auditorías"}
        </h2>
        <span className="text-xs font-semibold text-muted-foreground">
          {isEn
            ? `${inspections.length} audit${inspections.length !== 1 ? "s" : ""} completed`
            : `${inspections.length} ${inspections.length === 1 ? "auditoría completada" : "auditorías completadas"}`}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        {inspections.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {isEn ? "No audits submitted yet." : "Aún no se han enviado auditorías."}
          </div>
        ) : (
          <table className="sop-table w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 text-left">{isEn ? "Date" : "Fecha"}</th>
                <th className="px-4 text-left">{isEn ? "Account" : "Cuenta"}</th>
                <th className="px-4 text-left">{isEn ? "Inspector" : "Inspector"}</th>
                <th className="px-4 text-left">{isEn ? "Score" : "Puntaje"}</th>
                <th className="px-4 text-right">{isEn ? "Actions" : "Acciones"}</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((audit) => {
                const acct = allAccounts.find((a) => a.id === audit.account_id);
                const insp = inspectors.find((i) => i.id === audit.inspector_id);
                const dateStr = audit.check_out_at
                  ? new Date(audit.check_out_at).toLocaleDateString(
                      isEn ? "en-US" : "es-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      },
                    )
                  : "—";

                return (
                  <tr key={audit.id}>
                    <td className="px-4 text-muted-foreground">{dateStr}</td>
                    <td className="px-4 font-semibold text-foreground">
                      {acct?.name ?? (isEn ? "Unknown Account" : "Cuenta Desconocida")}
                    </td>
                    <td className="px-4 text-foreground flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: insp?.color ?? "#9ca3af" }} />
                      {insp?.name ?? (isEn ? "Unknown Inspector" : "Inspector Desconocido")}
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
                        <FileText className="size-3.5" />{" "}
                        {isEn ? "View Report" : "Ver Reporte"}
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
  const { isEn } = useLanguage();
  const areas = useMemo<InspectionArea[]>(() => {
    try {
      return audit.inspection_data ? (JSON.parse(audit.inspection_data) as InspectionArea[]) : [];
    } catch {
      return [];
    }
  }, [audit.inspection_data]);

  const dateStr = audit.check_out_at
    ? new Date(audit.check_out_at).toLocaleString(isEn ? "en-US" : "es-US", {
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
            <h3 className="text-base font-bold text-foreground">
              {isEn ? "Inspection Report" : "Reporte de Inspección"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? "Close" : "Cerrar"}
            className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <CardContent className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-3 gap-4 border border-border/60 rounded-xl p-4 bg-muted/30">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {isEn ? "Account" : "Cuenta"}
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {account?.name ?? (isEn ? "Unknown" : "Desconocido")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {isEn ? "Inspector" : "Inspector"}
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: inspector?.color ?? "#9ca3af" }} />
                {inspector?.name ?? (isEn ? "Unknown" : "Desconocido")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {isEn ? "Pristine Score" : "Puntaje Pristine"}
              </p>
              <p className="text-sm font-bold text-primary mt-0.5">
                {audit.score_percentage}% ({audit.grade})
              </p>
            </div>
          </div>

          {/* Checklist Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-1">
              {isEn ? "Checklist Areas" : "Áreas Evaluadas"}
            </h4>
            {areas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isEn ? "No items audited." : "No se auditaron elementos."}
              </p>
            ) : (
              <div className="space-y-6">
                {areas.map((area, aIdx) => (
                  <div key={aIdx} className="space-y-2">
                    <h5 className="text-sm font-bold text-foreground bg-primary/[0.04] px-3 py-1 rounded-lg border border-primary/10">
                      {translateQcText(area.name, isEn)}
                    </h5>
                    <div className="divide-y divide-border/50 pl-2">
                      {area.items.map((item, iIdx) => (
                        <div key={iIdx} className="py-2.5 space-y-1.5">
                          <div className="flex items-start justify-between gap-3 text-sm">
                            <span className="font-medium text-foreground">
                              {translateQcText(item.label, isEn)}
                            </span>
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
                              {item.rating === "pass"
                                ? isEn
                                  ? "pass"
                                  : "aprobado"
                                : item.rating === "attention"
                                  ? isEn
                                    ? "attention"
                                    : "atención"
                                  : item.rating === "fail"
                                    ? isEn
                                      ? "fail"
                                      : "falla"
                                    : "N/A"}
                            </span>
                          </div>
                          {(item.notes || item.photoUrl) && (
                            <div className="bg-muted/40 border border-border/40 rounded-xl p-3 space-y-2 text-xs">
                              {item.notes && <p className="text-muted-foreground font-medium italic">"{item.notes}"</p>}
                              {item.photoUrl && (
                                <img
                                  src={item.photoUrl}
                                  alt={isEn ? "Audit Photo" : "Foto de Auditoría"}
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
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                {isEn ? "Inspector Signature" : "Firma del Inspector"}
              </h4>
              <div className="flex flex-col items-start bg-muted/30 border rounded-xl p-4 max-w-sm">
                <img
                  src={audit.inspector_signature}
                  alt={isEn ? "Signature" : "Firma"}
                  className="max-h-24 w-auto object-contain dark:invert"
                />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-2">
                  {isEn ? "Signed:" : "Firmado por:"}{" "}
                  {inspector?.name ?? (isEn ? "Inspector" : "Inspector")}
                </span>
              </div>
            </div>
          )}
        </CardContent>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border/50 px-5 py-4 justify-end shrink-0">
          <Button variant="outline" onClick={onClose}>
            {isEn ? "Close" : "Cerrar"}
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
  const { isEn } = useLanguage();
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

  const daysOfWeek = isEn
    ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    : ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  function handleDayToggle(idx: number) {
    setDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!acctId || !inspId) {
      setError(
        isEn
          ? "Please select an Account and an Inspector."
          : "Por favor selecciona una Cuenta y un Inspector.",
      );
      return;
    }
    if ((frequency === "weekly" || frequency === "biweekly") && days.length === 0) {
      setError(
        isEn
          ? "Please select at least one day of the week."
          : "Por favor selecciona al menos un día de la semana.",
      );
      return;
    }
    if (frequency === "one_off" && !date) {
      setError(
        isEn
          ? "Please select a specific date."
          : "Por favor selecciona una fecha específica.",
      );
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

      // ── Sync last_qcc_date on commercial_accounts for one-off QC dates ──
      if (frequency === "one_off" && date && acctId) {
        await supabase
          .from("commercial_accounts")
          .update({ last_qcc_date: date, updated_at: new Date().toISOString() })
          .eq("id", acctId);

        // Fire refresh events so the accounts table updates live
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("pristine:data-updated"));
          window.dispatchEvent(new CustomEvent("commercial-accounts-updated"));
        }
      }

      onSaved(data as QCSchedule);
      onClose();
      // Reset form
      setAcctId("");
      setInspId("");
      setDays([]);
      setNotes("");
    } catch (err: any) {
      setError(
        err?.message ??
          (isEn ? "Failed to save schedule." : "No se pudo guardar el horario."),
      );
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
            <h3 className="text-base font-bold text-foreground">
              {isEn ? "Schedule Inspection" : "Programar Inspección"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label={isEn ? "Close" : "Cerrar"}
              className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
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
              <label className="text-xs font-bold text-muted-foreground uppercase">
                {isEn ? "Property / Account *" : "Propiedad / Cuenta *"}
              </label>
              <select
                required
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                value={acctId}
                onChange={(e) => setAcctId(e.target.value)}
              >
                <option value="">
                  {isEn ? "Select account..." : "Seleccionar cuenta..."}
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.city ?? (isEn ? "No City" : "Sin Ciudad")})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                {isEn ? "Assigned Inspector *" : "Inspector Asignado *"}
              </label>
              <select
                required
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                value={inspId}
                onChange={(e) => setInspId(e.target.value)}
              >
                <option value="">
                  {isEn ? "Select inspector..." : "Seleccionar inspector..."}
                </option>
                {inspectors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  {isEn ? "Frequency *" : "Frecuencia *"}
                </label>
                <select
                  required
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <option value="daily">{isEn ? "Daily" : "Diario"}</option>
                  <option value="weekly">{isEn ? "Weekly" : "Semanal"}</option>
                  <option value="biweekly">{isEn ? "Bi-weekly" : "Quincenal"}</option>
                  <option value="monthly">{isEn ? "Monthly" : "Mensual"}</option>
                  <option value="one_off">{isEn ? "One-off Date" : "Fecha única"}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  {isEn ? "Time *" : "Hora *"}
                </label>
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
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  {isEn ? "Specific Date *" : "Fecha Específica *"}
                </label>
                <input
                  type="date"
                  lang={isEn ? "en-US" : "es-US"}
                  required
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            ) : (frequency === "weekly" || frequency === "biweekly") ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  {isEn ? "Days of Week *" : "Días de la Semana *"}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {daysOfWeek.map((label, idx) => {
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
              <label className="text-xs font-bold text-muted-foreground uppercase">
                {isEn ? "Notes" : "Notas"}
              </label>
              <textarea
                placeholder={
                  isEn
                    ? "Instructions or schedule notes..."
                    : "Instrucciones o notas del horario..."
                }
                className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
          <div className="flex gap-2 border-t border-border/50 px-5 py-4 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {isEn ? "Cancel" : "Cancelar"}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? isEn
                  ? "Scheduling..."
                  : "Programando..."
                : isEn
                  ? "Schedule"
                  : "Programar"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

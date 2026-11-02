"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import {
  ALL_TRACKER_CLEANERS,
  addSopManualBooking,
  extractBookingKoalaId,
  getCurrentMonthKey,
  getInitialDynamicMonthBookings,
  getMonthInfo,
  reconcileMonthlyTracker,
  saveSopBookingOverride,
  type MonthlyReconciliationResult,
} from "@/lib/sales-tracker/monthly-reconciler";
import { calculateExecutiveKpis, isCommercialBooking } from "@/lib/sales-tracker/calculator";
import type { ServiceBookingRow } from "@/lib/sales-tracker/types";

function getSmartDefaultMonthKey(taskDueDate?: string | null): string {
  if (taskDueDate && /^\d{4}-\d{2}/.test(taskDueDate)) {
    const dueMonth = taskDueDate.slice(0, 7);
    if (dueMonth <= "2026-10") return "2026-10";
    // Si estamos en los primeros 12 días del mes cerrando el mes anterior
    const now = new Date();
    const currentMonth = getCurrentMonthKey();
    if (dueMonth === currentMonth && now.getDate() <= 12) {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    }
    return dueMonth;
  }
  const now = new Date();
  if (now.getDate() <= 12) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  }
  return getCurrentMonthKey();
}

function normalizeCsvDate(raw?: any): string {
  if (!raw) return new Date().toISOString().split("T")[0];
  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(Math.round(raw));
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const trimmed = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (match) {
    const month = match[1].padStart(2, "0");
    const day = match[2].padStart(2, "0");
    let year = match[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  return trimmed;
}

function parseNum(raw?: any): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  const val = parseFloat(String(raw).replace(/[^0-9.-]/g, ""));
  return isNaN(val) ? 0 : val;
}

function parseJobHours(raw?: any): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  const value = String(raw).trim();
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (m) return Number((Number(m[1]) + Number(m[2]) / 60).toFixed(2));
  return parseNum(value);
}

function cleanProviderName(raw?: string): string {
  if (!raw) return "Unassigned";
  const stripped = raw.replace(/^\d+\s*:\s*/, "").trim();
  if (!stripped || stripped.toLowerCase() === "unassigned") return "Unassigned";
  const match = ALL_TRACKER_CLEANERS.find(
    (c) => c.toLowerCase() === stripped.toLowerCase() || stripped.toLowerCase().includes(c.toLowerCase())
  );
  return match || stripped;
}

function weekBounds(date: string) {
  const d = new Date(`${date}T12:00:00`);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
  };
}

export function SopMonthlyTrackerReconciler({
  supabase,
  taskDueDate,
  isCompletingTask,
  onCompleteTaskWithSummary,
  onNotify,
}: {
  supabase: SupabaseClient;
  taskDueDate?: string | null;
  isCompletingTask?: boolean;
  onCompleteTaskWithSummary: (summaryNote: string) => Promise<void>;
  onNotify?: (tone: "success" | "error", text: string) => void;
}) {
  const { isEn } = useLanguage();
  const [monthKey, setMonthKey] = useState<string>(() => getSmartDefaultMonthKey(taskDueDate));
  const [bookings, setBookings] = useState<ServiceBookingRow[]>(() =>
    getInitialDynamicMonthBookings(getSmartDefaultMonthKey(taskDueDate))
  );
  const [loading, setLoading] = useState(false);
  const [reconcilingAndCompleting, setReconcilingAndCompleting] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  // Inline editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editorFilter, setEditorFilter] = useState<"all" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [rowDrafts, setRowDrafts] = useState<Record<string, { cleanerTeam: string; pay: string; subTotal: string }>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [savedRowId, setSavedRowId] = useState<string | null>(null);

  // Add manual booking form inside SOP
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingManual, setAddingManual] = useState(false);
  const [newDraft, setNewDraft] = useState({
    date: `${getSmartDefaultMonthKey(taskDueDate)}-15`,
    clientName: "",
    service: "Deep Clean",
    city: "Irvine",
    cleanerTeam: "Mayra Lopez",
    subTotal: "",
    pay: "",
    hours: "3.0",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const monthInfo = useMemo(() => getMonthInfo(monthKey, isEn ? "en" : "es"), [monthKey, isEn]);

  const monthOptions = useMemo(
    () => [
      { key: "2026-10", label: isEn ? "October 2026" : "Octubre 2026" },
      { key: "2026-11", label: isEn ? "November 2026" : "Noviembre 2026" },
      { key: "2026-12", label: isEn ? "December 2026" : "Diciembre 2026" },
      { key: "2027-01", label: isEn ? "January 2027" : "Enero 2027" },
    ],
    [isEn]
  );

  const loadMonth = async (targetMonth: string) => {
    setLoading(true);
    try {
      setBookings(getInitialDynamicMonthBookings(targetMonth));
      const res = await reconcileMonthlyTracker(supabase, targetMonth);
      setBookings(res.bookings);
      const pending = res.residentialBookings.filter(
        (b) => b.cleanerTeam.toLowerCase() === "unassigned" || b.teamEarningsWithoutTips <= 0
      );
      if (pending.length > 0) {
        setShowEditor(true);
        setEditorFilter("pending");
      }
    } catch (e: any) {
      console.warn("SOP Reconciler load warning:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setNewDraft((prev) => ({ ...prev, date: `${monthKey}-15` }));
    loadMonth(monthKey);
  }, [monthKey]);

  const residentialBookings = useMemo(
    () => bookings.filter((b) => !isCommercialBooking(b)),
    [bookings]
  );
  const commercialBookings = useMemo(
    () => bookings.filter((b) => isCommercialBooking(b)),
    [bookings]
  );

  const unassignedOrZeroBookings = useMemo(
    () =>
      residentialBookings.filter(
        (b) => b.cleanerTeam.toLowerCase() === "unassigned" || b.teamEarningsWithoutTips <= 0
      ),
    [residentialBookings]
  );

  const kpis = useMemo(() => calculateExecutiveKpis(bookings), [bookings]);
  const resKpis = useMemo(() => calculateExecutiveKpis(residentialBookings), [residentialBookings]);
  const commKpis = useMemo(() => calculateExecutiveKpis(commercialBookings), [commercialBookings]);
  const laborPct = kpis.totalRevenue > 0 ? (kpis.totalGrossCost / kpis.totalRevenue) * 100 : 0;

  const filteredResidential = useMemo(() => {
    return residentialBookings.filter((b) => {
      if (editorFilter === "pending") {
        const isPending = b.cleanerTeam.toLowerCase() === "unassigned" || b.teamEarningsWithoutTips <= 0;
        if (!isPending) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const bkId = extractBookingKoalaId(b).toLowerCase();
        return (
          b.clientName.toLowerCase().includes(q) ||
          b.cleanerTeam.toLowerCase().includes(q) ||
          b.service.toLowerCase().includes(q) ||
          b.city.toLowerCase().includes(q) ||
          b.date.includes(q) ||
          bkId.includes(q)
        );
      }
      return true;
    });
  }, [residentialBookings, editorFilter, searchQuery]);

  const getDraftForRow = (row: ServiceBookingRow) => {
    return (
      rowDrafts[row.id] || {
        cleanerTeam: row.cleanerTeam,
        pay: String(row.teamEarningsWithoutTips),
        subTotal: String(row.subTotal),
      }
    );
  };

  const updateRowDraft = (
    row: ServiceBookingRow,
    patch: Partial<{ cleanerTeam: string; pay: string; subTotal: string }>
  ) => {
    const current = getDraftForRow(row);
    setRowDrafts((prev) => ({
      ...prev,
      [row.id]: { ...current, ...patch },
    }));
  };

  const handleSaveRow = async (row: ServiceBookingRow) => {
    const draft = getDraftForRow(row);
    setSavingRowId(row.id);
    try {
      const res = await saveSopBookingOverride(supabase, monthKey, row, {
        cleanerTeam: draft.cleanerTeam,
        teamEarningsWithoutTips: parseFloat(draft.pay) || 0,
        subTotal: parseFloat(draft.subTotal) || row.subTotal,
      });
      setBookings(res.bookings);
      setRowDrafts((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });
      setSavedRowId(row.id);
      setTimeout(() => setSavedRowId((curr) => (curr === row.id ? null : curr)), 2500);
      onNotify?.(
        "success",
        isEn
          ? `Updated ${row.clientName}: ${draft.cleanerTeam} ($${(parseFloat(draft.pay) || 0).toFixed(2)})`
          : `Actualizado ${row.clientName}: ${draft.cleanerTeam} ($${(parseFloat(draft.pay) || 0).toFixed(2)})`
      );
    } catch (err: any) {
      onNotify?.("error", isEn ? `Error saving change: ${err.message}` : `Error al guardar cambio: ${err.message}`);
    } finally {
      setSavingRowId(null);
    }
  };

  const handleAddExtraBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDraft.clientName.trim()) return;
    setAddingManual(true);
    try {
      const res = await addSopManualBooking(supabase, monthKey, {
        date: newDraft.date,
        clientName: newDraft.clientName.trim(),
        service: newDraft.service,
        city: newDraft.city.trim() || "Orange County",
        cleanerTeam: newDraft.cleanerTeam,
        subTotal: parseFloat(newDraft.subTotal) || 0,
        teamEarningsWithoutTips: parseFloat(newDraft.pay) || 0,
        hours: parseFloat(newDraft.hours) || 2.5,
      });
      setBookings(res.bookings);
      setShowAddForm(false);
      setNewDraft({
        date: `${monthKey}-15`,
        clientName: "",
        service: "Deep Clean",
        city: "Irvine",
        cleanerTeam: "Mayra Lopez",
        subTotal: "",
        pay: "",
        hours: "3.0",
      });
      onNotify?.(
        "success",
        isEn
          ? `Additional booking for ${newDraft.clientName} added to ${monthInfo.label}.`
          : `Servicio adicional de ${newDraft.clientName} añadido a ${monthInfo.label}.`
      );
    } catch (err: any) {
      onNotify?.("error", isEn ? `Error adding booking: ${err.message}` : `Error al añadir servicio: ${err.message}`);
    } finally {
      setAddingManual(false);
    }
  };

  const handleCsvUploadInSop = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCsv(true);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const gridRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][];

      if (!gridRows || gridRows.length < 2) {
        onNotify?.("error", isEn ? "CSV file contains no valid rows." : "El archivo CSV no contiene filas válidas.");
        setUploadingCsv(false);
        return;
      }

      const headers = gridRows[0].map((h) => String(h || "").trim().toLowerCase());
      const parsedResidential: {
        bookingId: string;
        customerName: string;
        serviceDate: string;
        cleanerName: string;
        serviceType: string;
        frequency: string;
        chargedAmount: number;
        processingFee: number;
        tip: number;
        cleanerPay: number;
        hours: number;
        city: string;
      }[] = [];

      gridRows.slice(1).forEach((cols, idx) => {
        if (!cols || cols.length === 0) return;
        let customerName = "";
        let serviceDate = "";
        let cleanerName = "Unassigned";
        let serviceType = "Express Clean";
        let frequency = "One-Time";
        let serviceTotal = 0;
        let finalAmount = 0;
        let processingFee = 0;
        let tip = 0;
        let cleanerPay = 0;
        let hours = 2.5;
        let city = "Orange County";
        let bookingId = `BK-${idx + 1}`;

        headers.forEach((h, hIdx) => {
          const rawVal = cols[hIdx];
          if (rawVal === undefined || rawVal === null || rawVal === "") return;
          const val = String(rawVal).trim();

          if (h === "full name" || h === "customer" || h === "client") customerName = val;
          else if (h === "company name" && val && !customerName) customerName = val;
          else if (h === "date" || h.includes("service date")) serviceDate = normalizeCsvDate(rawVal);
          else if (h.includes("provider/team payment") || h.includes("cleaner pay")) cleanerPay = parseNum(val);
          else if (h === "provider/team" || h === "provider" || h === "cleaner") cleanerName = cleanProviderName(val);
          else if (h === "service" || h.includes("service type")) serviceType = val;
          else if (h === "frequency") frequency = val;
          else if (h.includes("service total")) serviceTotal = parseNum(val);
          else if (h.includes("final amount")) finalAmount = parseNum(val);
          else if (h.includes("processing fee")) processingFee = parseNum(val);
          else if (h === "tip (usd)" || h === "tip") tip = parseNum(val);
          else if (h.includes("estimated job length") || h.includes("duration")) hours = parseJobHours(val) || 2.5;
          else if (h === "city") city = val || city;
          else if (h === "booking id" || h === "id") bookingId = val;
        });

        if (!customerName || !serviceDate) return;
        if (serviceType.toLowerCase().includes("commercial")) return;

        const chargedAmount =
          serviceTotal > 0 ? serviceTotal : Math.max(0, Number((finalAmount - processingFee - tip).toFixed(2)));

        parsedResidential.push({
          bookingId,
          customerName,
          serviceDate,
          cleanerName,
          serviceType,
          frequency,
          chargedAmount,
          processingFee,
          tip,
          cleanerPay: cleanerName === "Unassigned" ? 0 : cleanerPay,
          hours,
          city,
        });
      });

      const detectedMonth = parsedResidential[0]?.serviceDate?.slice(0, 7) || monthKey;
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId && parsedResidential.length > 0) {
        const dates = parsedResidential.map((r) => r.serviceDate).sort();
        const { data: existingRows } = await supabase
          .from("residential_work_logs")
          .select("notes")
          .is("deleted_at", null)
          .ilike("notes", "%BookingKoala ID:%")
          .gte("work_date", dates[0])
          .lte("work_date", dates[dates.length - 1]);

        const existingIds = new Set(
          (existingRows || []).flatMap((r: { notes: string | null }) => {
            const m = r.notes?.match(/BookingKoala ID:\s*([^;]+)/i);
            return m?.[1] ? [m[1].trim()] : [];
          })
        );

        const now = new Date().toISOString();
        const toInsert = parsedResidential
          .filter((item) => !existingIds.has(item.bookingId))
          .map((item) => ({
            user_id: userId,
            account_name: item.customerName,
            team_name: item.cleanerName,
            work_date: item.serviceDate,
            hours_worked: item.hours,
            notes: `BookingKoala ID: ${item.bookingId}; ${item.serviceType}; freq: ${item.frequency}; charged $${item.chargedAmount}; fee $${item.processingFee}; tip $${item.tip}; cleaner pay $${item.cleanerPay}; city: ${item.city}`,
            status: "completed",
            created_at: now,
            updated_at: now,
          }));

        if (toInsert.length > 0) {
          await supabase.from("residential_work_logs").insert(toInsert);
        }

        const payToInsert = parsedResidential
          .filter((item) => item.cleanerPay > 0 && item.cleanerName !== "Unassigned" && !existingIds.has(item.bookingId))
          .map((item) => {
            const { weekStart, weekEnd } = weekBounds(item.serviceDate);
            return {
              user_id: userId,
              cleaner_name: item.cleanerName,
              work_date: item.serviceDate,
              city: item.city,
              payment_amount: item.cleanerPay,
              residential_amount: 0,
              commercial_amount: 0,
              payment_type: "residential",
              payment_mode: "residential_only",
              week_start: weekStart,
              week_end: weekEnd,
              status: "pending",
              notes: `BookingKoala ID: ${item.bookingId}; ${item.customerName}; ${item.serviceType}; freq: ${item.frequency}; charged $${item.chargedAmount}; fee $${item.processingFee}; tip $${item.tip}`,
              created_at: now,
              updated_at: now,
            };
          });

        if (payToInsert.length > 0) {
          await supabase.from("residential_weekly_payment_rows").insert(payToInsert);
        }
      }

      if (detectedMonth !== monthKey) {
        setMonthKey(detectedMonth);
      }
      const res = await reconcileMonthlyTracker(supabase, detectedMonth);
      setBookings(res.bookings);

      const pendingAfter = res.residentialBookings.filter(
        (b) => b.cleanerTeam.toLowerCase() === "unassigned" || b.teamEarningsWithoutTips <= 0
      );
      if (pendingAfter.length > 0) {
        setShowEditor(true);
        setEditorFilter("pending");
      }

      onNotify?.(
        "success",
        isEn
          ? `CSV processed (${parsedResidential.length} residential bookings in ${res.monthInfo.label}). ${
              pendingAfter.length > 0
                ? `There are ${pendingAfter.length} unassigned/unpaid: assign them below.`
                : "All bookings have cleaner and payment assigned."
            }`
          : `CSV procesado (${parsedResidential.length} servicios residenciales en ${res.monthInfo.label}). ${
              pendingAfter.length > 0
                ? `Hay ${pendingAfter.length} sin cleaner/pago: asígnalos abajo.`
                : "Todos los servicios tienen cleaner y pago asignado."
            }`
      );
    } catch (err: any) {
      onNotify?.("error", isEn ? `Error processing CSV: ${err.message}` : `Error al procesar CSV: ${err.message}`);
    } finally {
      setUploadingCsv(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleReconcileAndComplete = async () => {
    setReconcilingAndCompleting(true);
    try {
      const res = await reconcileMonthlyTracker(supabase, monthKey);
      setBookings(res.bookings);
      const summaryNote = isEn
        ? `SOP reconciliation completed for ${res.monthInfo.label}: Total Revenue: $${res.stats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Labor Cost: $${res.stats.totalGrossCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${res.stats.laborPct.toFixed(1)}%) | Net Profit: $${res.stats.totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ${res.stats.residentialCount} BookingKoala bookings + ${res.stats.commercialCount} active commercial visits.`
        : `Conciliación SOP completada para ${res.monthInfo.label}: Total Revenue: $${res.stats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Costo Laboral: $${res.stats.totalGrossCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${res.stats.laborPct.toFixed(1)}%) | Ganancia Neta: $${res.stats.totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ${res.stats.residentialCount} servicios BookingKoala + ${res.stats.commercialCount} visitas comerciales activas.`;
      await onCompleteTaskWithSummary(summaryNote);
    } catch (err: any) {
      onNotify?.("error", isEn ? `Error reconciling tracker: ${err.message}` : `Error al conciliar tracker: ${err.message}`);
    } finally {
      setReconcilingAndCompleting(false);
    }
  };

  return (
    <section className="space-y-3.5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/[0.04] p-4 dark:border-emerald-500/25">
      {/* Header + Month Picker + Direct CSV Upload */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="size-4.5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">
              {isEn ? "Monthly Reconciler Integrated in SOP" : "Conciliador Mensual Integrado en SOP"}
            </h4>
            <p className="text-xs text-muted-foreground">
              {isEn
                ? "Upload BookingKoala CSV, assign pending cleaners/pay and reconcile commercial accounts right here"
                : "Sube CSV BookingKoala, asigna cleaners/pagos pendientes y concilia contratos comerciales aquí mismo"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-card px-2.5 py-1.5 text-xs">
            <Calendar className="size-3.5 text-emerald-600" />
            <select
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
            >
              {!monthOptions.some((m) => m.key === monthKey) && (
                <option value={monthKey}>{monthInfo.label}</option>
              )}
              {monthOptions.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleCsvUploadInSop}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploadingCsv}
            onClick={() => fileInputRef.current?.click()}
            className="h-8 gap-1.5 rounded-xl text-xs border-primary/30 text-primary hover:bg-primary/10"
          >
            <Upload className="size-3.5" />
            {uploadingCsv
              ? (isEn ? "Importing CSV..." : "Importando CSV...")
              : (isEn ? "Upload BookingKoala CSV" : "Subir CSV BookingKoala")}
          </Button>
        </div>
      </div>

      {/* Live Summary KPI Strip */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-emerald-500/25 bg-card p-3 text-xs sm:grid-cols-4">
        <div>
          <span className="text-[10px] font-bold uppercase text-muted-foreground">
            {isEn ? "Residential" : "Residencial"} ({residentialBookings.length} BK)
          </span>
          <p className="text-sm font-black text-blue-600 dark:text-blue-400">
            ${resKpis.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {isEn ? "Labor:" : "Labor:"} ${resKpis.totalGrossCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase text-muted-foreground">
            {isEn ? "Commercial" : "Comercial"} ({commercialBookings.length} {isEn ? "vis." : "vis."})
          </span>
          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
            ${commKpis.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {isEn ? "Labor:" : "Labor:"} ${commKpis.totalGrossCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase text-muted-foreground">
            {isEn ? "Consolidated Revenue" : "Revenue Consolidado"}
          </span>
          <p className="text-sm font-black text-foreground">
            ${kpis.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {isEn ? "Total Labor:" : "Labor Total:"} ${kpis.totalGrossCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({laborPct.toFixed(1)}%)
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase text-muted-foreground">
            {isEn ? "Net Profit" : "Ganancia Neta"}
          </span>
          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
            ${kpis.totalGrossProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] font-semibold text-emerald-600/90 dark:text-emerald-400/90">
            {kpis.totalGrossProfitPct.toFixed(1)}% {isEn ? "net margin" : "margen neto"}
          </span>
        </div>
      </div>

      {/* Unassigned / Cleaner & Pay Quick Assignment Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card/90 px-3 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          {unassignedOrZeroBookings.length > 0 ? (
            <>
              <AlertTriangle className="size-4 text-amber-500 shrink-0" />
              <span className="font-bold text-amber-700 dark:text-amber-400">
                {isEn
                  ? `${unassignedOrZeroBookings.length} booking(s) without cleaner or $0 pay in ${monthInfo.label}`
                  : `${unassignedOrZeroBookings.length} servicio(s) sin cleaner o con pago $0 en ${monthInfo.label}`}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span className="font-semibold text-foreground">
                {isEn
                  ? `${residentialBookings.length} BookingKoala bookings with cleaner and pay assigned`
                  : `${residentialBookings.length} servicios BookingKoala con cleaner y pago asignados`}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setShowEditor((v) => !v);
              if (!showEditor && unassignedOrZeroBookings.length > 0) {
                setEditorFilter("pending");
              } else if (!showEditor) {
                setEditorFilter("all");
              }
            }}
            className="h-7 gap-1 rounded-lg px-2.5 text-xs font-semibold"
          >
            <UserCheck className="size-3.5 text-primary" />
            {showEditor
              ? (isEn ? "Hide Editor" : "Ocultar Editor")
              : (isEn ? `Assign / Edit Cleaners & Pay (${residentialBookings.length})` : `Asignar / Editar Cleaners y Pagos (${residentialBookings.length})`)}
            {showEditor ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAddForm((v) => !v);
              setShowEditor(true);
            }}
            className="h-7 gap-1 rounded-lg px-2.5 text-xs font-semibold border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
          >
            <Plus className="size-3.5" />
            {isEn ? "Add Booking" : "Añadir Booking"}
          </Button>
        </div>
      </div>

      {/* Inline Add Extra Booking Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddExtraBooking}
          className="space-y-2.5 rounded-xl border border-primary/30 bg-card p-3 text-xs shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground">
              {isEn ? `Add Additional Booking to ${monthInfo.label}` : `Añadir Servicio Adicional a ${monthInfo.label}`}
            </span>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input
              type="date"
              required
              value={newDraft.date}
              onChange={(e) => setNewDraft({ ...newDraft, date: e.target.value })}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
            />
            <input
              type="text"
              required
              placeholder={isEn ? "Customer name *" : "Nombre del cliente *"}
              value={newDraft.clientName}
              onChange={(e) => setNewDraft({ ...newDraft, clientName: e.target.value })}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs"
            />
            <select
              value={newDraft.service}
              onChange={(e) => setNewDraft({ ...newDraft, service: e.target.value })}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="Deep Clean">Deep Clean</option>
              <option value="Move In/Out Clean">Move In/Out Clean</option>
              <option value="Express Clean">Express Clean</option>
              <option value="Commercial Cleaning">Commercial Cleaning</option>
            </select>
            <input
              type="text"
              placeholder={isEn ? "City (e.g. Irvine)" : "Ciudad (ej. Irvine)"}
              value={newDraft.city}
              onChange={(e) => setNewDraft({ ...newDraft, city: e.target.value })}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select
              value={newDraft.cleanerTeam}
              onChange={(e) => setNewDraft({ ...newDraft, cleanerTeam: e.target.value })}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium"
            >
              {ALL_TRACKER_CLEANERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              required
              placeholder={isEn ? "Client Fee ($)" : "Cobro Cliente ($)"}
              value={newDraft.subTotal}
              onChange={(e) => setNewDraft({ ...newDraft, subTotal: e.target.value })}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs"
            />
            <input
              type="number"
              step="0.01"
              required
              placeholder={isEn ? "Cleaner Pay ($)" : "Pago Cleaner ($)"}
              value={newDraft.pay}
              onChange={(e) => setNewDraft({ ...newDraft, pay: e.target.value })}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs"
            />
            <Button type="submit" size="sm" disabled={addingManual} className="h-8 rounded-lg text-xs font-bold">
              {addingManual ? (isEn ? "Saving..." : "Guardando...") : (isEn ? "Save Booking" : "Guardar Servicio")}
            </Button>
          </div>
        </form>
      )}

      {/* Inline Cleaner & Payment Assignment Table inside SOP */}
      {showEditor && (
        <div className="space-y-2.5 rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setEditorFilter("all")}
                className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  editorFilter === "all"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isEn ? `All (${residentialBookings.length})` : `Todos (${residentialBookings.length})`}
              </button>
              <button
                type="button"
                onClick={() => setEditorFilter("pending")}
                className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  editorFilter === "pending"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isEn ? `Unassigned / $0 (${unassignedOrZeroBookings.length})` : `Sin Asignar / $0 (${unassignedOrZeroBookings.length})`}
              </button>
            </div>

            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isEn ? "Search client, cleaner or ID (e.g. Yuri, Carlos)..." : "Buscar cliente, cleaner o ID (ej. Yuri, Carlos)..."}
                className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-border/70">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-xs text-[10px] font-bold uppercase text-muted-foreground border-b border-border/70">
                <tr>
                  <th className="px-2.5 py-2">{isEn ? "Date" : "Fecha"}</th>
                  <th className="px-2.5 py-2">{isEn ? "Client / Booking" : "Cliente / Booking"}</th>
                  <th className="px-2.5 py-2 text-right">{isEn ? "Fee ($)" : "Cobro ($)"}</th>
                  <th className="px-2.5 py-2">{isEn ? "Assigned Cleaner" : "Cleaner Asignada"}</th>
                  <th className="px-2.5 py-2 text-right">{isEn ? "Cleaner Pay ($)" : "Pago Cleaner ($)"}</th>
                  <th className="px-2.5 py-2 text-right">{isEn ? "Action" : "Acción"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredResidential.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      {editorFilter === "pending"
                        ? (isEn ? "Great! No bookings pending cleaner or payment assignment." : "¡Excelente! No hay servicios pendientes de asignar cleaner o pago.")
                        : (isEn ? "No bookings found matching filter." : "No se encontraron servicios con ese filtro.")}
                    </td>
                  </tr>
                ) : (
                  filteredResidential.map((row) => {
                    const draft = getDraftForRow(row);
                    const bkId = extractBookingKoalaId(row);
                    const isDirty =
                      draft.cleanerTeam !== row.cleanerTeam ||
                      Number(draft.pay) !== row.teamEarningsWithoutTips ||
                      Number(draft.subTotal) !== row.subTotal;
                    const isPending =
                      row.cleanerTeam.toLowerCase() === "unassigned" || row.teamEarningsWithoutTips <= 0;
                    const cleanerOptions = ALL_TRACKER_CLEANERS.includes(draft.cleanerTeam)
                      ? ALL_TRACKER_CLEANERS
                      : [draft.cleanerTeam, ...ALL_TRACKER_CLEANERS];

                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          isPending ? "bg-amber-500/[0.06]" : "hover:bg-muted/30"
                        }`}
                      >
                        <td className="px-2.5 py-2 font-mono text-[11px] whitespace-nowrap">{row.date}</td>
                        <td className="px-2.5 py-2">
                          <div className="font-bold text-foreground leading-tight">{row.clientName}</div>
                          <div className="text-[10px] text-muted-foreground">
                            #{bkId} · {row.service} · {row.city}
                          </div>
                        </td>
                        <td className="px-2.5 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={draft.subTotal}
                            onChange={(e) => updateRowDraft(row, { subTotal: e.target.value })}
                            className="h-7 w-20 rounded border border-border/80 bg-background px-1.5 text-right font-mono text-xs"
                          />
                        </td>
                        <td className="px-2.5 py-2">
                          <select
                            value={draft.cleanerTeam}
                            onChange={(e) => updateRowDraft(row, { cleanerTeam: e.target.value })}
                            className={`h-7 rounded border px-1.5 text-xs font-medium bg-background ${
                              draft.cleanerTeam.toLowerCase() === "unassigned"
                                ? "border-amber-500/60 text-amber-700 dark:text-amber-400"
                                : "border-border/80 text-foreground"
                            }`}
                          >
                            {cleanerOptions.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2.5 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={draft.pay}
                            onChange={(e) => updateRowDraft(row, { pay: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveRow(row);
                              }
                            }}
                            className={`h-7 w-20 rounded border bg-background px-1.5 text-right font-mono text-xs font-bold ${
                              Number(draft.pay) <= 0
                                ? "border-amber-500/60 text-amber-700 dark:text-amber-400"
                                : "border-border/80 text-emerald-700 dark:text-emerald-400"
                            }`}
                          />
                        </td>
                        <td className="px-2.5 py-2 text-right whitespace-nowrap">
                          {savedRowId === row.id ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                              <Check className="size-3.5" /> {isEn ? "Saved" : "Guardado"}
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant={isDirty ? "default" : "outline"}
                              disabled={savingRowId === row.id || !isDirty}
                              onClick={() => handleSaveRow(row)}
                              className="h-7 px-2.5 text-[11px] font-bold"
                            >
                              {savingRowId === row.id ? "..." : (isEn ? "Save" : "Guardar")}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Primary Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={handleReconcileAndComplete}
            disabled={reconcilingAndCompleting || isCompletingTask || loading}
            className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700"
          >
            <Sparkles className="size-4" />
            {reconcilingAndCompleting
              ? (isEn ? "Reconciling..." : "Conciliando...")
              : `⚡ ${isEn ? `Reconcile ${monthInfo.label} & Complete SOP` : `Conciliar ${monthInfo.label} & Completar SOP`}`}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => loadMonth(monthKey)}
            className="h-9 gap-1.5 rounded-xl text-xs"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            {isEn ? "Reload" : "Recargar"}
          </Button>
        </div>

        <Link
          href={`/commercial/sales-track?month=${monthKey}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
        >
          <ExternalLink className="size-3.5 text-muted-foreground" />
          {isEn ? `Open Sales Tracker (${monthInfo.shortLabel})` : `Abrir Sales Tracker (${monthInfo.shortLabel})`}
        </Link>
      </div>
    </section>
  );
}

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Sparkles,
  FileSpreadsheet,
  FileText,
  Search,
  Plus,
  Building2,
  Calendar,
  DollarSign,
  Users,
  Percent,
  Clock,
  Filter,
  Trash2,
  Target,
  LayoutDashboard,
  Table as TableIcon,
  ListOrdered,
  ArrowUpRight,
  ShieldCheck,
  Home,
  Briefcase,
  Layers,
  Scale,
  CheckCircle2,
  RefreshCw,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AiSopCopilotModal } from "@/components/operations/ai-sop-copilot-modal";
import {
  exportComprehensiveTrackerToXLSX,
  exportComprehensiveTrackerToPDF,
  type SalesTrackItem,
} from "@/lib/export/sales-track-export";
import type {
  CategoryPerformance,
  ExecutiveKpis,
  ServiceBookingRow,
  ServiceCategory,
  TargetRateModel,
} from "@/lib/sales-tracker/types";
import {
  calculateCategoryBreakdown,
  calculateExecutiveKpis,
  calculateTargetModels,
  computeBookingFormulas,
  isCommercialBooking,
} from "@/lib/sales-tracker/calculator";
import { initialSalesTrackerBookings } from "@/lib/sales-tracker/seed-data";
import { augustSalesTrackerBookings } from "@/lib/sales-tracker/seed-data-august-2026";
import { septemberSalesTrackerBookings } from "@/lib/sales-tracker/seed-data-september-2026";
import {
  ALL_TRACKER_CLEANERS,
  getMonthInfo,
  getCurrentMonthKey,
  getInitialDynamicMonthBookings,
  reconcileMonthlyTracker,
  saveSopBookingOverride,
  TRACKER_CACHE_PREFIX,
  type MonthlyReconciliationResult,
} from "@/lib/sales-tracker/monthly-reconciler";
import { createClient } from "@/lib/supabase/client";

export function SalesTrackClient() {
  const { isEn } = useLanguage();
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("2026-10");
  const [currentMonthBookings, setCurrentMonthBookings] = useState<ServiceBookingRow[]>([]);
  const [dynamicMonthBookings, setDynamicMonthBookings] = useState<ServiceBookingRow[]>(() =>
    getInitialDynamicMonthBookings("2026-10")
  );
  const [syncingMonth, setSyncingMonth] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const [scopeFilter, setScopeFilter] = useState<"all" | "residential" | "commercial">("all");
  const [activeTab, setActiveTab] = useState<"dash" | "table" | "target" | "comparison" | "ledger">("dash");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ cleanerTeam: string; pay: string; subTotal: string }>({
    cleanerTeam: "",
    pay: "",
    subTotal: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const LEDGER_PAGE_SIZE = 50;

  // New Booking Draft State
  const [newBookingDraft, setNewBookingDraft] = useState<Partial<ServiceBookingRow>>({
    clientName: "",
    service: "Commercial Cleaning",
    frequency: "Weekly",
    city: "Irvine",
    cleanerTeam: "Ana Morales",
    subTotal: 300,
    salesTax: 0,
    tip: 0,
    teamEarningsWithoutTips: 150,
    durationHours: 3.0,
    actualHours: 3.0,
  });

  const syncMonthFromSupabase = async (monthKey: string) => {
    setSyncingMonth(true);
    setSyncFeedback(null);
    try {
      if (monthKey === "2026-07" || monthKey === "2026-08" || monthKey === "2026-09") {
        setSyncingMonth(false);
        return;
      }

      const res = await reconcileMonthlyTracker(supabase, monthKey);
      setDynamicMonthBookings(res.bookings);

      const bkCount = res.stats.residentialCount;
      const commCount = res.stats.commercialCount;
      const mLabel = isEn ? res.monthInfo.labelEn : res.monthInfo.labelEs;
      if (bkCount > 0) {
        setSyncFeedback(
          isEn
            ? `Synced ${bkCount} BookingKoala bookings + ${commCount} commercial visits for ${mLabel}.`
            : `Sincronizados ${bkCount} reservas BookingKoala + ${commCount} visitas comerciales de ${mLabel}.`
        );
      } else {
        setSyncFeedback(
          isEn
            ? `${mLabel}: ${commCount} active commercial visits consolidated.`
            : `${mLabel}: ${commCount} visitas comerciales activas consolidadas.`
        );
      }
    } catch (e: any) {
      console.warn("Could not sync month bookings from Supabase:", e);
      setSyncFeedback(isEn ? "Could not connect to database." : "No se pudo conectar a la base de datos.");
    } finally {
      setSyncingMonth(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  // Load bookings from localStorage on mount and trigger initial sync
  useEffect(() => {
    let initialMonth = "2026-10";
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const m = params.get("month");
      if (m && /^\d{4}-\d{2}$/.test(m)) {
        initialMonth = m;
      }
    }
    setSelectedMonthKey(initialMonth);

    // September legacy cache
    const savedSep = localStorage.getItem("pristine_sales_tracker_sep_2026");
    if (savedSep) {
      try {
        const parsed = JSON.parse(savedSep);
        if (Array.isArray(parsed)) setCurrentMonthBookings(parsed);
      } catch (e) {}
    }

    // Remove legacy polluted v1 cache and load clean v2 cache / baseline
    localStorage.removeItem(`pristine_sales_tracker_${initialMonth}`);
    const baseline = getInitialDynamicMonthBookings(initialMonth);
    setDynamicMonthBookings(baseline);

    const cached = localStorage.getItem(`${TRACKER_CACHE_PREFIX}${initialMonth}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDynamicMonthBookings(parsed);
        }
      } catch (e) {}
    }

    syncMonthFromSupabase(initialMonth);
  }, []);

  const rawPeriodBookings = useMemo(() => {
    if (selectedMonthKey === "2026-07") return initialSalesTrackerBookings;
    if (selectedMonthKey === "2026-08") return augustSalesTrackerBookings;
    if (selectedMonthKey === "2026-09") {
      const manualIds = new Set(currentMonthBookings.map((b) => b.id));
      const seedFiltered = septemberSalesTrackerBookings.filter((b) => !manualIds.has(b.id));
      return [...currentMonthBookings, ...seedFiltered];
    }
    // Dynamic month (October 2026, November 2026, December 2026, etc.):
    return dynamicMonthBookings;
  }, [selectedMonthKey, currentMonthBookings, dynamicMonthBookings]);

  // Split into Residential vs Commercial
  const residentialBookings = useMemo(() => {
    return rawPeriodBookings.filter((b) => !isCommercialBooking(b));
  }, [rawPeriodBookings]);

  const commercialBookings = useMemo(() => {
    return rawPeriodBookings.filter((b) => isCommercialBooking(b));
  }, [rawPeriodBookings]);

  // Bookings subjected to current scope filter
  const scopedBookings = useMemo(() => {
    if (scopeFilter === "residential") return residentialBookings;
    if (scopeFilter === "commercial") return commercialBookings;
    return rawPeriodBookings;
  }, [scopeFilter, residentialBookings, commercialBookings, rawPeriodBookings]);

  const saveCurrentBookings = (newBookings: ServiceBookingRow[]) => {
    if (selectedMonthKey === "2026-09") {
      setCurrentMonthBookings(newBookings);
      localStorage.setItem("pristine_sales_tracker_sep_2026", JSON.stringify(newBookings));
    } else {
      setDynamicMonthBookings(newBookings);
      localStorage.setItem(`${TRACKER_CACHE_PREFIX}${selectedMonthKey}`, JSON.stringify(newBookings));
    }
  };

  const handleClearCurrentMonth = () => {
    const monthInfo = getMonthInfo(selectedMonthKey, isEn ? "en" : "es");
    const confirmMsg = isEn
      ? `Reset ${monthInfo.labelEn} to official synced data (removing manual additions)?`
      : `¿Deseas restablecer ${monthInfo.labelEs} a los datos oficiales sincronizados (eliminando adiciones manuales)?`;
    if (confirm(confirmMsg)) {
      if (selectedMonthKey === "2026-09") {
        saveCurrentBookings([]);
      } else {
        localStorage.removeItem(`pristine_sales_tracker_${selectedMonthKey}`);
        localStorage.removeItem(`${TRACKER_CACHE_PREFIX}${selectedMonthKey}`);
        setDynamicMonthBookings(getInitialDynamicMonthBookings(selectedMonthKey));
        syncMonthFromSupabase(selectedMonthKey);
      }
    }
  };

  const handleApplySalesTrack = (newEntries: SalesTrackItem[]) => {
    const convertedRows: ServiceBookingRow[] = newEntries.map((item, idx) => {
      const subTotal = Number(item.monthlyRevenue) || 0;
      const teamEarnings = Number(item.cleanerCost) || 0;
      const hrs = Number(item.hoursPerVisit) || 3.0;

      const merchantFee = Math.round(subTotal * 0.03 * 100) / 100; // ~3% CC processing fee

      return computeBookingFormulas({
        id: `manual-${Date.now()}-${idx}`,
        clientName: item.clientName,
        city: item.city || "Orange County",
        service: "Commercial Cleaning",
        serviceCategory: "Commercial Cleaning",
        frequency: item.serviceFrequency || "Weekly",
        cleanerTeam: item.cleanerTeam || "Unassigned",
        subTotal,
        salesTax: 0,
        tip: 0,
        teamEarningsWithoutTips: teamEarnings,
        merchantFee,
        stripeFee: 0,
        durationHours: hrs,
        actualHours: hrs,
        status: "completed",
        notes: item.notes || "",
      });
    });

    const baseList = selectedMonthKey === "2026-09" ? currentMonthBookings : dynamicMonthBookings;
    const updated = [...convertedRows, ...baseList];
    saveCurrentBookings(updated);
  };

  const handleAddManualBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookingDraft.clientName) return;

    const row = computeBookingFormulas({
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...newBookingDraft,
      subTotal: Number(newBookingDraft.subTotal) || 0,
      teamEarningsWithoutTips: Number(newBookingDraft.teamEarningsWithoutTips) || 0,
    });

    const baseList = selectedMonthKey === "2026-09" ? currentMonthBookings : dynamicMonthBookings;
    saveCurrentBookings([row, ...baseList]);
    setShowAddModal(false);
    setNewBookingDraft({
      clientName: "",
      service: "Commercial Cleaning",
      frequency: "Weekly",
      city: "Irvine",
      cleanerTeam: "Ana Morales",
      subTotal: 300,
      salesTax: 0,
      tip: 0,
      teamEarningsWithoutTips: 150,
      durationHours: 3.0,
      actualHours: 3.0,
    });
  };

  const handleDeleteBooking = (id: string) => {
    if (selectedMonthKey === "2026-09") {
      saveCurrentBookings(currentMonthBookings.filter((b) => b.id !== id));
    } else {
      saveCurrentBookings(dynamicMonthBookings.filter((b) => b.id !== id));
    }
  };

  // Calculations for active scope
  const kpis: ExecutiveKpis = useMemo(() => calculateExecutiveKpis(scopedBookings), [scopedBookings]);
  const breakdowns: CategoryPerformance[] = useMemo(() => calculateCategoryBreakdown(scopedBookings), [scopedBookings]);
  const targets: TargetRateModel[] = useMemo(() => calculateTargetModels(scopedBookings), [scopedBookings]);

  // Overall Global Stats for side comparison & top banner
  const totalKpis: ExecutiveKpis = useMemo(() => calculateExecutiveKpis(rawPeriodBookings), [rawPeriodBookings]);
  const resKpis: ExecutiveKpis = useMemo(() => calculateExecutiveKpis(residentialBookings), [residentialBookings]);
  const commKpis: ExecutiveKpis = useMemo(() => calculateExecutiveKpis(commercialBookings), [commercialBookings]);

  const filteredBookings = useMemo(() => {
    return scopedBookings.filter((b) => {
      const matchSearch =
        search === "" ||
        b.clientName.toLowerCase().includes(search.toLowerCase()) ||
        b.city.toLowerCase().includes(search.toLowerCase()) ||
        b.cleanerTeam.toLowerCase().includes(search.toLowerCase()) ||
        b.service.toLowerCase().includes(search.toLowerCase());

      const matchCategory =
        categoryFilter === "all" ||
        b.serviceCategory.toLowerCase() === categoryFilter.toLowerCase() ||
        b.frequency.toLowerCase().includes(categoryFilter.toLowerCase());

      return matchSearch && matchCategory;
    });
  }, [scopedBookings, search, categoryFilter]);

  useEffect(() => {
    setLedgerPage(1);
  }, [search, categoryFilter, scopeFilter, selectedMonthKey]);

  const totalLedgerPages = Math.ceil(filteredBookings.length / LEDGER_PAGE_SIZE) || 1;
  const paginatedBookings = useMemo(() => {
    return filteredBookings.slice((ledgerPage - 1) * LEDGER_PAGE_SIZE, ledgerPage * LEDGER_PAGE_SIZE);
  }, [filteredBookings, ledgerPage]);

  const currentMonthInfo = useMemo(() => getMonthInfo(selectedMonthKey, isEn ? "en" : "es"), [selectedMonthKey, isEn]);
  const periodLabel = `${currentMonthInfo.label.replace(/\s+/g, "-")}-${isEn ? "Active" : "Activo"}`;
  const periodTitle = currentMonthInfo.label;

  const scopeLabel =
    scopeFilter === "all"
      ? isEn
        ? "All"
        : "Todas"
      : scopeFilter === "residential"
      ? isEn
        ? "Residential"
        : "Residencial"
      : isEn
      ? "Commercial"
      : "Comercial";

  const translateCategoryName = (cat: string) => {
    if (isEn) return cat;
    const map: Record<string, string> = {
      All: "Todas",
      "All Recurring": "Todas las Recurrentes",
      "All One-Time": "Todas las Eventuales",
      "Commercial Cleaning": "Limpieza Comercial",
      Weekly: "Semanal",
      Biweekly: "Quincenal",
      Triweekly: "Cada 3 Semanas",
      Monthly: "Mensual",
      "Standard Clean": "Limpieza Estándar",
      "Express Clean": "Limpieza Express",
      "Deep Clean": "Limpieza Profunda",
      "Move In/Out Clean": "Mudanza (Move In/Out)",
      "Airbnb Clean": "Limpieza Airbnb",
      "One Time": "Una Vez",
      "Every 2 weeks": "Cada 2 semanas",
      "Every 3 Weeks": "Cada 3 semanas",
      "Every 3 weeks": "Cada 3 semanas",
      "Tri Weekly": "Cada 3 semanas",
      "5 days a week": "5 días por semana",
      "3 times per week": "3 veces por semana",
      Unassigned: "Sin asignar",
    };
    return map[cat] || cat;
  };

  const AVAILABLE_MONTHS = isEn
    ? [
        { key: "2026-12", label: "December 2026 (Next Month)" },
        { key: "2026-11", label: "November 2026 (Current Month - Auto SOP)" },
        { key: "2026-10", label: "October 2026 (Consolidated: 42 BK Residential + 30 Commercial Contracts)" },
        { key: "2026-09", label: "September 2026 (Consolidated: 51 BK Residential + 30 Commercial Contracts)" },
        { key: "2026-08", label: "August 2026 (Closed: 55 BK Residential + 31 Commercial Contracts)" },
        { key: "2026-07", label: "July 2026 (Historical / Demo Template - $34.2k)" },
      ]
    : [
        { key: "2026-12", label: "Diciembre 2026 (Próximo Mes)" },
        { key: "2026-11", label: "Noviembre 2026 (Mes en Curso - SOP Automático)" },
        { key: "2026-10", label: "Octubre 2026 (Consolidado: 42 BK Residenciales + 30 Contratos Comerciales)" },
        { key: "2026-09", label: "Septiembre 2026 (Consolidado: 51 BK Residenciales + 30 Contratos Comerciales)" },
        { key: "2026-08", label: "Agosto 2026 (Cerrado: 55 BK Residenciales + 31 Contratos Comerciales)" },
        { key: "2026-07", label: "Julio 2026 (Histórico / Plantilla Demo - $34.2k)" },
      ];

  const handleExportXLSX = () => {
    const scopeTag =
      scopeFilter === "all"
        ? isEn
          ? "Unified"
          : "Unificado"
        : scopeFilter === "residential"
        ? isEn
          ? "Residential"
          : "Residencial"
        : isEn
        ? "Commercial"
        : "Comercial";
    exportComprehensiveTrackerToXLSX(`${periodLabel}-${scopeTag}-Income-Labor-Sales-Tracker`, scopedBookings);
  };

  const handleExportPDF = () => {
    const scopeTag =
      scopeFilter === "all"
        ? isEn
          ? "Unified Consolidated"
          : "Consolidado Unificado"
        : scopeFilter === "residential"
        ? isEn
          ? "Residential Only (Booking Koala)"
          : "Solo Residencial (Booking Koala)"
        : isEn
        ? "Commercial Only (Accounts)"
        : "Solo Comercial (Cuentas)";
    const reportTitle = isEn
      ? `Income, Labor & Sales Tracker (${periodTitle} - ${scopeTag})`
      : `Control de Ingresos, Mano de Obra y Ventas (${periodTitle} - ${scopeTag})`;
    exportComprehensiveTrackerToPDF(
      `${periodLabel}-${scopeFilter}-Income-Labor-Sales-Tracker`,
      scopedBookings,
      reportTitle
    );
  };

  return (
    <DashboardShell>
      <div className="space-y-6 pb-12">
        {/* Header & Hero */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="size-3.5" />
                {isEn ? "Financial & Operational Control" : "Control Financiero y Operativo"}
              </span>

              {/* Dynamic Period Selector Dropdown */}
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span className="font-semibold text-muted-foreground">{isEn ? "Period:" : "Periodo:"}</span>
                <select
                  value={selectedMonthKey}
                  onChange={(e) => {
                    const newMonth = e.target.value;
                    setSelectedMonthKey(newMonth);
                    localStorage.removeItem(`pristine_sales_tracker_${newMonth}`);
                    setDynamicMonthBookings(getInitialDynamicMonthBookings(newMonth));
                    const cached = localStorage.getItem(`${TRACKER_CACHE_PREFIX}${newMonth}`);
                    if (cached) {
                      try {
                        const parsed = JSON.parse(cached);
                        if (Array.isArray(parsed) && parsed.length > 0) setDynamicMonthBookings(parsed);
                      } catch {}
                    }
                    syncMonthFromSupabase(newMonth);
                  }}
                  className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
                >
                  {!AVAILABLE_MONTHS.some((m) => m.key === selectedMonthKey) && (
                    <option value={selectedMonthKey}>{currentMonthInfo.label}</option>
                  )}
                  {AVAILABLE_MONTHS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              {isEn ? "Income, Labor & Sales Tracker" : "Control de Ingresos, Mano de Obra y Ventas"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selectedMonthKey === "2026-07"
                ? isEn
                  ? "Showing historical data for July 2026 ($34,252.70)."
                  : "Mostrando datos históricos de Julio 2026 ($34,252.70)."
                : selectedMonthKey === "2026-08"
                ? isEn
                  ? "August 2026 closed ($74,266.28): 55 individual BookingKoala services ($24.3k) and 31 active commercial contracts ($50.0k) fully synced with CleanGuru."
                  : "Agosto 2026 cerrado ($74,266.28): 55 servicios individuales Booking Koala ($24.3k) y 31 contratos comerciales activos ($50.0k) totalmente sincronizados con CleanGuru."
                : selectedMonthKey === "2026-09"
                ? isEn
                  ? "September 2026 consolidated: 51 BookingKoala services and 30 commercial contracts (252 visits) fully audited and synced with CleanGuru and payroll."
                  : "Septiembre 2026 consolidado: 51 servicios Booking Koala y 30 contratos comerciales (252 visitas) totalmente auditados y sincronizados con CleanGuru y nómina."
                : isEn
                ? `${currentMonthInfo.labelEn} reconciled: ${residentialBookings.length} BookingKoala bookings and ${commercialBookings.length} active commercial visits fully consolidated with rates and hours.`
                : `${currentMonthInfo.labelEs} conciliado: ${residentialBookings.length} reservas BookingKoala y ${commercialBookings.length} visitas comerciales activas totalmente consolidadas con tarifas y horas.`}
            </p>
            {syncFeedback && (
              <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                {syncFeedback}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedMonthKey >= "2026-10" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMonthFromSupabase(selectedMonthKey)}
                disabled={syncingMonth}
                className="gap-1.5 h-9 text-xs border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              >
                <RefreshCw className={`size-3.5 ${syncingMonth ? "animate-spin" : ""}`} />
                {syncingMonth
                  ? isEn
                    ? "Syncing..."
                    : "Sincronizando..."
                  : isEn
                  ? `Sync ${currentMonthInfo.shortLabelEn}`
                  : `Sincronizar ${currentMonthInfo.shortLabelEs}`}
              </Button>
            )}

            {((selectedMonthKey !== "2026-09" && dynamicMonthBookings.length > 0) ||
              (selectedMonthKey === "2026-09" && currentMonthBookings.length > 0)) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCurrentMonth}
                className="h-9 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40"
              >
                {isEn ? "Reset Month" : "Limpiar Mes"}
              </Button>
            )}

            <Button
              onClick={() => setIsCopilotOpen(true)}
              className="gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 font-bold text-white shadow-md hover:from-emerald-700 hover:to-teal-700"
            >
              <img src="/pristiner-logo-white.png" alt="Pristiner" className="size-4 object-contain" />
              {isEn ? "Pristiner (AI Copilot)" : "Pristiner (Copiloto IA)"}
            </Button>
            <Button
              variant="outline"
              onClick={handleExportXLSX}
              className="gap-2 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
            >
              <FileSpreadsheet className="size-4 text-emerald-600" />
              {isEn ? "Export Excel (.xlsx)" : "Exportar Excel (.xlsx)"}
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPDF}
              className="gap-2 border-rose-600/30 text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <FileText className="size-4 text-rose-600" />
              {isEn ? "Export PDF" : "Exportar PDF"}
            </Button>
          </div>
        </div>

        {/* SUMMARY COMPARISON MINI-PANEL */}
        {/* Mobile View: Compact 3-selector grid + active scope card (< sm) */}
        <div className="sm:hidden space-y-2">
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-border/70 bg-card p-1.5 shadow-xs">
            {/* 1. Residential */}
            <button
              type="button"
              onClick={() => setScopeFilter("residential")}
              className={`flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all tap-active ${
                scopeFilter === "residential"
                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/40 font-bold shadow-xs"
                  : "text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-1 text-[11px]">
                <Home className="size-3 text-blue-500 shrink-0" />
                <span className="font-semibold">{isEn ? "Residential" : "Residencial"}</span>
              </div>
              <span className="text-sm font-black mt-0.5 text-foreground">
                ${(resKpis.totalRevenue / 1000).toFixed(1)}k
              </span>
              <span className="text-[10px] text-muted-foreground">
                {residentialBookings.length} {isEn ? "serv." : "serv."}
              </span>
            </button>

            {/* 2. Commercial */}
            <button
              type="button"
              onClick={() => setScopeFilter("commercial")}
              className={`flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all tap-active ${
                scopeFilter === "commercial"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/40 font-bold shadow-xs"
                  : "text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-1 text-[11px]">
                <Building2 className="size-3 text-emerald-500 shrink-0" />
                <span className="font-semibold">{isEn ? "Commercial" : "Comercial"}</span>
              </div>
              <span className="text-sm font-black mt-0.5 text-foreground">
                ${(commKpis.totalRevenue / 1000).toFixed(1)}k
              </span>
              <span className="text-[10px] text-muted-foreground">
                {commercialBookings.length} {isEn ? "accts." : "ctas."}
              </span>
            </button>

            {/* 3. Unified */}
            <button
              type="button"
              onClick={() => setScopeFilter("all")}
              className={`flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all tap-active ${
                scopeFilter === "all"
                  ? "bg-primary/15 text-primary ring-1 ring-primary/40 font-bold shadow-xs"
                  : "text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-1 text-[11px]">
                <Layers className="size-3 text-primary shrink-0" />
                <span className="font-semibold">{isEn ? "Unified" : "Unificado"}</span>
              </div>
              <span className="text-sm font-black mt-0.5 text-primary">
                ${(totalKpis.totalRevenue / 1000).toFixed(1)}k
              </span>
              <span className="text-[10px] text-muted-foreground">
                {rawPeriodBookings.length} {isEn ? "total" : "total"}
              </span>
            </button>
          </div>

          {/* Active scope details pill in mobile */}
          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/90 px-3 py-2 text-xs shadow-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">
                {scopeFilter === "all"
                  ? isEn
                    ? "Unified Total"
                    : "Total Unificado"
                  : scopeFilter === "residential"
                  ? isEn
                    ? "Residential BK"
                    : "Residencial BK"
                  : isEn
                  ? "Commercial Contracts"
                  : "Comercial Contratos"}
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {kpis.totalGrossProfitPct.toFixed(1)}% {isEn ? "margin" : "margen"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{isEn ? "Labor" : "Mano de obra"}: ${kpis.totalGrossCost.toLocaleString("en-US")}</span>
              <span>{isEn ? "Profit" : "Ganancia"}: ${kpis.totalGrossProfit.toLocaleString("en-US")}</span>
            </div>
          </div>
        </div>

        {/* Tablet & Desktop View: 3 Side-by-Side Cards (>= sm) */}
        <div className="hidden sm:grid sm:grid-cols-3 gap-4">
          <div
            onClick={() => setScopeFilter("residential")}
            className={`cursor-pointer rounded-2xl border p-4.5 transition-all shadow-sm ${
              scopeFilter === "residential"
                ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20"
                : "border-border/70 bg-card hover:border-blue-500/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <Home className="size-4" />
                </div>
                <span className="text-xs font-bold text-foreground">
                  {isEn ? "Residential (BookingKoala)" : "Residencial (Booking Koala)"}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600 dark:text-blue-400">
                {residentialBookings.length} {isEn ? "services" : "servicios"}
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xl font-black text-foreground">
                ${resKpis.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-emerald-600">
                {resKpis.totalGrossProfitPct.toFixed(1)}% {isEn ? "margin" : "margen"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{isEn ? "Labor" : "Mano de obra"}: ${resKpis.totalGrossCost.toLocaleString("en-US")}</span>
              <span>{isEn ? "Profit" : "Ganancia"}: ${resKpis.totalGrossProfit.toLocaleString("en-US")}</span>
            </div>
          </div>

          <div
            onClick={() => setScopeFilter("commercial")}
            className={`cursor-pointer rounded-2xl border p-4.5 transition-all shadow-sm ${
              scopeFilter === "commercial"
                ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20"
                : "border-border/70 bg-card hover:border-emerald-500/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Building2 className="size-4" />
                </div>
                <span className="text-xs font-bold text-foreground">
                  {isEn ? "Commercial (Contracts)" : "Comercial (Contratos)"}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                {commercialBookings.length} {isEn ? "visits" : "visitas"}
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xl font-black text-foreground">
                ${commKpis.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-emerald-600">
                {commKpis.totalGrossProfitPct.toFixed(1)}% {isEn ? "margin" : "margen"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{isEn ? "Labor" : "Mano de obra"}: ${commKpis.totalGrossCost.toLocaleString("en-US")}</span>
              <span>{isEn ? "Profit" : "Ganancia"}: ${commKpis.totalGrossProfit.toLocaleString("en-US")}</span>
            </div>
          </div>

          <div
            onClick={() => setScopeFilter("all")}
            className={`cursor-pointer rounded-2xl border p-4.5 transition-all shadow-sm ${
              scopeFilter === "all"
                ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                : "border-border/70 bg-card hover:border-primary/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Layers className="size-4" />
                </div>
                <span className="text-xs font-bold text-foreground">
                  {isEn ? "Unified Total (Consolidated)" : "Total Unificado (Consolidado)"}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                {rawPeriodBookings.length} {isEn ? "total" : "total"}
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xl font-black text-primary">
                ${totalKpis.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-emerald-600">
                {totalKpis.totalGrossProfitPct.toFixed(1)}% {isEn ? "margin" : "margen"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{isEn ? "Labor" : "Mano de obra"}: ${totalKpis.totalGrossCost.toLocaleString("en-US")}</span>
              <span>{isEn ? "Total Profit" : "Ganancia Total"}: ${totalKpis.totalGrossProfit.toLocaleString("en-US")}</span>
            </div>
          </div>
        </div>

        {/* SCOPE FILTER PILLS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-border/70 bg-card p-2.5 sm:p-3 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 shrink-0">
              <Filter className="size-3.5" /> {isEn ? "Scope:" : "Ámbito:"}
            </span>
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg overflow-x-auto no-scrollbar touch-scroll max-w-full">
              <button
                type="button"
                onClick={() => setScopeFilter("all")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1 text-xs font-bold whitespace-nowrap shrink-0 transition-all tap-active ${
                  scopeFilter === "all"
                    ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="size-3.5 text-primary shrink-0" />
                <span>{isEn ? "All" : "Todas"} ({rawPeriodBookings.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("residential")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1 text-xs font-bold whitespace-nowrap shrink-0 transition-all tap-active ${
                  scopeFilter === "residential"
                    ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Home className="size-3.5 text-blue-500 shrink-0" />
                <span>{isEn ? "Residential" : "Residencial"} ({residentialBookings.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("commercial")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1 text-xs font-bold whitespace-nowrap shrink-0 transition-all tap-active ${
                  scopeFilter === "commercial"
                    ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="size-3.5 text-emerald-500 shrink-0" />
                <span>{isEn ? "Commercial" : "Comercial"} ({commercialBookings.length})</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] sm:text-xs font-medium text-muted-foreground shrink-0 self-end sm:self-auto">
            {isEn ? "Viewing" : "Visualizando"}{" "}
            <span className="font-bold text-foreground">{scopedBookings.length}</span>{" "}
            {isEn ? "in" : "en"}{" "}
            <span className="font-bold text-foreground">{scopeLabel}</span>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-b border-border/80 pb-2.5 overflow-x-auto no-scrollbar touch-scroll">
          <button
            type="button"
            onClick={() => setActiveTab("dash")}
            className={`flex items-center gap-1.5 rounded-xl px-3 sm:px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition-all duration-150 tap-active ${
              activeTab === "dash"
                ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground bg-card/60 border border-border/50"
            }`}
          >
            <LayoutDashboard className="size-3.5 shrink-0" />
            <span className="sm:hidden">KPIs</span>
            <span className="hidden sm:inline">{isEn ? "Dash (Executive KPIs)" : "Resumen (KPIs Ejecutivos)"}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={`flex items-center gap-1.5 rounded-xl px-3 sm:px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition-all duration-150 tap-active ${
              activeTab === "table"
                ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground bg-card/60 border border-border/50"
            }`}
          >
            <TableIcon className="size-3.5 shrink-0" />
            <span className="sm:hidden">{isEn ? "Categories" : "Categorías"}</span>
            <span className="hidden sm:inline">{isEn ? "Table (Category Breakdown)" : "Tabla (Desglose por Categoría)"}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("target")}
            className={`flex items-center gap-1.5 rounded-xl px-3 sm:px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition-all duration-150 tap-active ${
              activeTab === "target"
                ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground bg-card/60 border border-border/50"
            }`}
          >
            <Target className="size-3.5 shrink-0" />
            <span className="sm:hidden">{isEn ? "Targets" : "Objetivos"}</span>
            <span className="hidden sm:inline">{isEn ? "Target (Rate Modeling)" : "Objetivos (Modelado de Tarifas)"}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("comparison")}
            className={`flex items-center gap-1.5 rounded-xl px-3 sm:px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition-all duration-150 tap-active ${
              activeTab === "comparison"
                ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground bg-card/60 border border-border/50"
            }`}
          >
            <Scale className="size-3.5 shrink-0" />
            <span className="sm:hidden">Res vs Com</span>
            <span className="hidden sm:inline">{isEn ? "⚖️ Residential vs Commercial" : "⚖️ Residencial vs Comercial"}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ledger")}
            className={`flex items-center gap-1.5 rounded-xl px-3 sm:px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition-all duration-150 tap-active ${
              activeTab === "ledger"
                ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground bg-card/60 border border-border/50"
            }`}
          >
            <ListOrdered className="size-3.5 shrink-0" />
            <span className="sm:hidden">{isEn ? "Ledger" : "Registros"}</span>
            <span className="hidden sm:inline">{isEn ? "Master Ledger (Details)" : "Master Ledger (Detalle)"}</span>
            <span className="ml-1 rounded-md bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
              {filteredBookings.length}
            </span>
          </button>
        </div>

        {/* TAB 1: DASH (EXECUTIVE KPIS) */}
        {activeTab === "dash" && (
          <div className="space-y-6 view-transition">
            {/* Top 4 Primary KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/70 bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {isEn ? `Total Revenue (${scopeLabel})` : `Ingresos Totales (${scopeLabel})`}
                    </span>
                    <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <DollarSign className="size-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      ${kpis.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                    {isEn
                      ? `${kpis.totalBookings} services / contracts in this scope`
                      : `${kpis.totalBookings} servicios / contratos en este ámbito`}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {isEn ? "Total Gross Profit" : "Ganancia Bruta Total"}
                    </span>
                    <div className="flex size-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                      <TrendingUp className="size-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-foreground">
                      ${kpis.totalGrossProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {kpis.totalGrossProfitPct.toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                    {isEn ? "Operating net profit margin" : "Margen de beneficio neto operativo"}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {isEn ? "Monthly Recurring (MRR)" : "Ingresos Recurrentes (MRR)"}
                    </span>
                    <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <Building2 className="size-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-foreground">
                      ${kpis.mrr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {kpis.recurringRevenuePct.toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                    {isEn
                      ? `${kpis.totalRecurringBookings} recurring services`
                      : `${kpis.totalRecurringBookings} servicios recurrentes`}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {isEn ? "Labor Cost & Hours" : "Costo Laboral y Horas"}
                    </span>
                    <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Clock className="size-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-foreground">
                      ${kpis.totalGrossCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                    {isEn
                      ? `${kpis.totalCleanHours.toFixed(1)} total cleaning hrs`
                      : `${kpis.totalCleanHours.toFixed(1)} hrs totales de limpieza`}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Secondary Operational Metrics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase text-muted-foreground">
                  {isEn ? "Avg. Revenue Per Clean/Acc" : "Ingreso Prom. por Servicio/Cta"}
                </span>
                <p className="mt-2 text-xl font-bold text-foreground">${kpis.avgRevenuePerClean.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase text-muted-foreground">
                  {isEn ? "Avg. Profit Per Clean/Acc" : "Ganancia Prom. por Servicio/Cta"}
                </span>
                <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">${kpis.avgGrossProfitPerBooking.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase text-muted-foreground">
                  {isEn ? "Avg. Revenue / Clean Hour" : "Ingreso Prom. / Hora Limpieza"}
                </span>
                <p className="mt-2 text-xl font-bold text-foreground">${kpis.avgRevenuePerCleanHour.toFixed(2)}/hr</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase text-muted-foreground">
                  {isEn ? "Avg. Labor Cost / Clean Hour" : "Costo Laboral Prom. / Hora"}
                </span>
                <p className="mt-2 text-xl font-bold text-muted-foreground">${kpis.avgGrossCostPerCleanHour.toFixed(2)}/hr</p>
              </div>
            </div>

            {/* Summary Highlights */}
            <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-base font-bold text-foreground mb-4">
                <ShieldCheck className="size-5 text-primary" />
                {isEn
                  ? `Executive Summary (${periodTitle} — Scope: ${scopeLabel.toUpperCase()})`
                  : `Resumen Ejecutivo (${periodTitle} — Ámbito: ${scopeLabel.toUpperCase()})`}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="rounded-xl bg-muted/40 p-4 space-y-1">
                  <span className="text-muted-foreground font-semibold">
                    {isEn ? "Profitability Rate" : "Tasa de Rentabilidad"}
                  </span>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {kpis.totalGrossProfitPct.toFixed(1)}% {isEn ? "gross margin" : "margen bruto"}
                  </div>
                  <p className="text-muted-foreground">
                    {isEn ? (
                      <>
                        For every $100 billed, $<strong>{kpis.totalGrossProfitPct.toFixed(1)}</strong> remains as gross profit after labor.
                      </>
                    ) : (
                      <>
                        Por cada $100 cobrados, $<strong>{kpis.totalGrossProfitPct.toFixed(1)}</strong> quedan como beneficio tras pagar mano de obra.
                      </>
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/40 p-4 space-y-1">
                  <span className="text-muted-foreground font-semibold">
                    {isEn ? "Recurring Stability" : "Estabilidad de Recurrencia"}
                  </span>
                  <div className="text-lg font-black text-blue-600 dark:text-blue-400">
                    {kpis.recurringRevenuePct.toFixed(1)}% MRR
                  </div>
                  <p className="text-muted-foreground">
                    {isEn
                      ? `$${kpis.mrr.toLocaleString("en-US")} comes from regular weekly, biweekly, or monthly recurring clients.`
                      : `$${kpis.mrr.toLocaleString("en-US")} provienen de clientes con frecuencia regular semanal, quincenal o mensual.`}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/40 p-4 space-y-1">
                  <span className="text-muted-foreground font-semibold">
                    {isEn ? "Hourly Efficiency" : "Eficiencia Horaria"}
                  </span>
                  <div className="text-lg font-black text-foreground">
                    ${(kpis.avgRevenuePerCleanHour - kpis.avgGrossCostPerCleanHour).toFixed(2)}/hr {isEn ? "net profit" : "beneficio neto"}
                  </div>
                  <p className="text-muted-foreground">
                    {isEn
                      ? "Net margin generated per cleaning hour performed in the field."
                      : "Margen neto generado por cada hora de limpieza ejecutada en el campo."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TABLE (CATEGORY BREAKDOWN MATRIX) */}
        {activeTab === "table" && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border/80 bg-muted/40 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {isEn ? "Category Performance Matrix (Table Sheet)" : "Matriz de Rendimiento por Categoría"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isEn
                      ? "Breakdown of hours, revenue, labor costs, and margin by service type."
                      : "Desglose de horas, ingresos, costos laborales y margen por tipo de servicio."}
                  </p>
                </div>
                <Badge variant="outline" className="border-primary/30 text-primary font-bold">
                  {breakdowns.length} {isEn ? "Categories Analyzed" : "Categorías Analizadas"}
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/80 bg-muted/70 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3">{isEn ? "Service Type" : "Tipo de Servicio"}</th>
                      <th className="px-3 py-3 text-center">{isEn ? "Jobs / Accts" : "Trabajos / Ctas"}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "Total Hours" : "Total Horas"}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "Avg. Hours" : "Prom. Horas"}</th>
                      <th className="px-4 py-3 text-right">{isEn ? "Total Revenue" : "Ingreso Total"}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "Rev / Job" : "Ingreso / Trab."}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "Rev / Hr" : "Ingreso / Hr"}</th>
                      <th className="px-4 py-3 text-right">{isEn ? "Labor Cost" : "Costo Laboral"}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "Cost / Hr" : "Costo / Hr"}</th>
                      <th className="px-4 py-3 text-right">{isEn ? "Gross Profit" : "Ganancia Bruta"}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "Margin %" : "Margen %"}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "Labor %" : "Mano de Obra %"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {breakdowns.map((row, idx) => {
                      const isAll = row.category === "All";
                      const isAllRecur = row.category === "All Recurring";
                      const isAllOnce = row.category === "All One-Time";
                      const isComm = row.category === "Commercial Cleaning";

                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-muted/30 transition-colors ${
                            isAll
                              ? "bg-primary/5 font-black text-foreground"
                              : isAllRecur || isAllOnce
                              ? "bg-muted/20 font-bold"
                              : isComm
                              ? "bg-emerald-500/5 font-bold"
                              : ""
                          }`}
                        >
                          <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-1.5">
                            {isComm && <Building2 className="size-3.5 text-emerald-600" />}
                            {translateCategoryName(row.category)}
                          </td>
                          <td className="px-3 py-3 text-center text-muted-foreground">{row.totalBookings}</td>
                          <td className="px-3 py-3 text-right text-foreground">{row.totalCleanHours.toFixed(1)}</td>
                          <td className="px-3 py-3 text-right text-muted-foreground">{row.avgCleanHours.toFixed(1)}</td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">
                            ${row.totalRevenue.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-right text-muted-foreground">
                            ${row.avgRevenuePerBooking.toFixed(1)}
                          </td>
                          <td className="px-3 py-3 text-right text-foreground font-medium">
                            ${row.avgRevenuePerCleanHour.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400 font-semibold">
                            ${row.totalGrossCost.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-right text-muted-foreground">
                            ${row.avgGrossCostPerCleanHour.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                            ${row.totalGrossProfit.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                            {(row.grossProfitPct * 100).toFixed(1)}%
                          </td>
                          <td className="px-3 py-3 text-right text-muted-foreground">
                            {(row.laborPct * 100).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TARGET (RATE MODELING & BENCHMARKS) */}
        {activeTab === "target" && (
          <div className="space-y-4 view-transition">
            <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border/80 bg-muted/40 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {isEn ? "Rate, Discount & Target Modeling (Target Sheet)" : "Modelado de Tarifas, Descuentos y Metas"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isEn
                      ? "Base rate ($60/hr or $50/hr), subscription discounts, cleaner pay, and target vs. actual margin."
                      : "Tarifa base ($60/hr o $50/hr), descuentos por suscripción, pago a cleaner y margen objetivo vs real."}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/80 bg-muted/70 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3">{isEn ? "Service / Frequency" : "Servicio / Frecuencia"}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "Base Rate" : "Tarifa Base"}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "Discount" : "Descuento"}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "Effective Rate" : "Tarifa Efectiva"}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "Cleaner Pay" : "Pago Cleaner"}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "Effective Cleaner" : "Cleaner Efectivo"}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "Profit / Hr" : "Ganancia / Hr"}</th>
                      <th className="px-3 py-3 text-right font-bold">{isEn ? "Target Margin %" : "Meta Margen %"}</th>
                      <th className="px-3 py-3 text-right font-bold">{isEn ? "Actual Margin %" : "Margen Real %"}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "Actual Revenue" : "Ingreso Real"}</th>
                      <th className="px-3 py-3 text-right">{isEn ? "% of Sales" : "% de Ventas"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {targets.map((t, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-foreground">{translateCategoryName(t.service)}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">${t.baseHourlyRate}/hr</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">{t.discountPct}%</td>
                        <td className="px-3 py-3 text-right font-semibold text-foreground">${t.effectiveHourlyRate.toFixed(2)}/hr</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">${t.cleanerBaseRate}/hr</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">${t.cleanerEffectiveRate.toFixed(2)}/hr</td>
                        <td className="px-3 py-3 text-right font-bold text-foreground">${t.grossProfitPerHour.toFixed(2)}/hr</td>
                        <td className="px-3 py-3 text-right font-bold text-blue-600 dark:text-blue-400">{t.grossProfitTargetPct.toFixed(1)}%</td>
                        <td className="px-3 py-3 text-right font-black text-emerald-600 dark:text-emerald-400">{t.actualGrossProfitPct.toFixed(1)}%</td>
                        <td className="px-3 py-3 text-right font-bold text-foreground">${t.actualGrossRevenue.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">{t.revenuePctOfTotal.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dynamic Revenue Share Breakdown Cards */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col">
                <div className="p-3.5 border-b border-border/80 bg-muted/40">
                  <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">
                    {isEn ? `Revenue & Earnings by Segment (${periodTitle})` : `Ingresos y Ganancias por Segmento (${periodTitle})`}
                  </h4>
                </div>
                <div className="p-4 space-y-4 text-xs">
                  {/* Commercial Share */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-emerald-600" />
                        {isEn ? "Commercial (Contracts)" : "Comercial (Contratos)"}
                      </span>
                      <span className="font-black text-emerald-600">
                        ${commKpis.totalRevenue.toLocaleString("en-US")} ({totalKpis.totalRevenue > 0 ? ((commKpis.totalRevenue / totalKpis.totalRevenue) * 100).toFixed(1) : "0"}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${totalKpis.totalRevenue > 0 ? (commKpis.totalRevenue / totalKpis.totalRevenue) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{isEn ? "Margin" : "Margen"}: {commKpis.totalGrossProfitPct.toFixed(1)}%</span>
                      <span>{isEn ? "Profit" : "Beneficio"}: ${commKpis.totalGrossProfit.toLocaleString("en-US")}</span>
                    </div>
                  </div>

                  {/* Residential Share */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Home className="size-3.5 text-blue-600" />
                        {isEn ? "Residential (BookingKoala)" : "Residencial (Booking Koala)"}
                      </span>
                      <span className="font-black text-blue-600">
                        ${resKpis.totalRevenue.toLocaleString("en-US")} ({totalKpis.totalRevenue > 0 ? ((resKpis.totalRevenue / totalKpis.totalRevenue) * 100).toFixed(1) : "0"}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${totalKpis.totalRevenue > 0 ? (resKpis.totalRevenue / totalKpis.totalRevenue) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{isEn ? "Margin" : "Margen"}: {resKpis.totalGrossProfitPct.toFixed(1)}%</span>
                      <span>{isEn ? "Profit" : "Beneficio"}: ${resKpis.totalGrossProfit.toLocaleString("en-US")}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm flex flex-col justify-between text-xs">
                <h4 className="font-bold text-xs text-foreground uppercase tracking-wider mb-2">
                  {isEn ? "Financial Diagnostics & Goals" : "Diagnóstico Financiero y Metas"}
                </h4>
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                    {isEn ? (
                      <>
                        <strong>🏢 Commercial:</strong> Generates the largest monthly recurring base ($60.5k / mo) with steady revenue backed by long-term contracts.
                      </>
                    ) : (
                      <>
                        <strong>🏢 Comercial:</strong> Genera la mayor base recurrente mensual ($60.5k / mes) con ingresos constantes garantizados por contratos a largo plazo.
                      </>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300">
                    {isEn ? (
                      <>
                        <strong>🏠 Residential:</strong> Delivers strong unit gross margin (~53.2%), led by Move In/Out Clean and Deep Clean services.
                      </>
                    ) : (
                      <>
                        <strong>🏠 Residencial:</strong> Ofrece el mayor margen bruto unitario (~53.2%), destacándose servicios como Move In/Out Clean y Deep Clean.
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border flex justify-between items-center text-[11px] text-muted-foreground">
                  <span>{isEn ? "Company Overall Margin:" : "Margen Global Empresa:"}</span>
                  <span className="font-black text-foreground text-sm">{totalKpis.totalGrossProfitPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: COMPARISON (RESIDENTIAL VS COMMERCIAL SPLIT PANEL) */}
        {activeTab === "comparison" && (
          <div className="space-y-6 view-transition">
            <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-base font-bold text-foreground mb-4">
                <Scale className="size-5 text-primary" />
                {isEn
                  ? "Comparison Panel: Residential (BookingKoala) vs Commercial (Contracts)"
                  : "Panel Comparativo: Residencial (Booking Koala) vs Comercial (Contratos)"}
              </div>

              {/* Side-by-Side Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Residential Side */}
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-blue-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <Home className="size-5 text-blue-500" />
                      <h4 className="font-black text-foreground">
                        {isEn ? "Residential (BookingKoala)" : "Residencial (Booking Koala)"}
                      </h4>
                    </div>
                    <Badge variant="outline" className="border-blue-500/40 text-blue-600 font-bold">
                      {residentialBookings.length} {isEn ? "Bookings" : "Citas"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-card rounded-xl border border-border">
                      <div className="text-muted-foreground">{isEn ? "Total Revenue" : "Ingresos Totales"}</div>
                      <div className="text-lg font-black text-foreground mt-1">${resKpis.totalRevenue.toLocaleString("en-US")}</div>
                    </div>
                    <div className="p-3 bg-card rounded-xl border border-border">
                      <div className="text-muted-foreground">{isEn ? "Gross Margin %" : "Margen Bruto %"}</div>
                      <div className="text-lg font-black text-emerald-600 mt-1">{resKpis.totalGrossProfitPct.toFixed(1)}%</div>
                    </div>
                    <div className="p-3 bg-card rounded-xl border border-border">
                      <div className="text-muted-foreground">{isEn ? "Labor Cost" : "Costo Laboral"}</div>
                      <div className="text-lg font-black text-amber-600 mt-1">${resKpis.totalGrossCost.toLocaleString("en-US")}</div>
                    </div>
                    <div className="p-3 bg-card rounded-xl border border-border">
                      <div className="text-muted-foreground">{isEn ? "Avg. Rate / Hr" : "Tarifa Promedio / Hr"}</div>
                      <div className="text-lg font-black text-foreground mt-1">${resKpis.avgRevenuePerCleanHour.toFixed(2)}/h</div>
                    </div>
                  </div>
                </div>

                {/* Commercial Side */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-5 text-emerald-500" />
                      <h4 className="font-black text-foreground">
                        {isEn ? "Commercial (Contracts)" : "Comercial (Contratos)"}
                      </h4>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 font-bold">
                      {commercialBookings.length} {isEn ? "Visits" : "Visitas"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-card rounded-xl border border-border">
                      <div className="text-muted-foreground">{isEn ? "Total Revenue" : "Ingresos Totales"}</div>
                      <div className="text-lg font-black text-foreground mt-1">${commKpis.totalRevenue.toLocaleString("en-US")}</div>
                    </div>
                    <div className="p-3 bg-card rounded-xl border border-border">
                      <div className="text-muted-foreground">{isEn ? "Gross Margin %" : "Margen Bruto %"}</div>
                      <div className="text-lg font-black text-emerald-600 mt-1">{commKpis.totalGrossProfitPct.toFixed(1)}%</div>
                    </div>
                    <div className="p-3 bg-card rounded-xl border border-border">
                      <div className="text-muted-foreground">{isEn ? "Labor Cost" : "Costo Laboral"}</div>
                      <div className="text-lg font-black text-amber-600 mt-1">${commKpis.totalGrossCost.toLocaleString("en-US")}</div>
                    </div>
                    <div className="p-3 bg-card rounded-xl border border-border">
                      <div className="text-muted-foreground">{isEn ? "Avg. Rate / Hr" : "Tarifa Promedio / Hr"}</div>
                      <div className="text-lg font-black text-foreground mt-1">${commKpis.avgRevenuePerCleanHour.toFixed(2)}/h</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MASTER LEDGER (MON / INDIVIDUAL BOOKINGS) */}
        {activeTab === "ledger" && (
          <div className="space-y-4 view-transition">
            {/* Filter and Actions Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/70 bg-card p-3 shadow-sm">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    isEn
                      ? "Search by client, cleaner, service, or city..."
                      : "Buscar por cliente, cleaner, servicio o ciudad..."
                  }
                  className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="size-3.5 text-muted-foreground" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">{isEn ? "All frequencies / services" : "Todas las frecuencias/servicios"}</option>
                  <option value="commercial">{isEn ? "Commercial" : "Comercial"}</option>
                  <option value="weekly">{isEn ? "Weekly" : "Semanal"}</option>
                  <option value="biweekly">{isEn ? "Biweekly" : "Quincenal"}</option>
                  <option value="monthly">{isEn ? "Monthly" : "Mensual"}</option>
                  <option value="deep">{isEn ? "Deep Clean" : "Limpieza Profunda"}</option>
                  <option value="move">{isEn ? "Move In/Out" : "Mudanza (Move In/Out)"}</option>
                </select>

                <Button
                  size="sm"
                  onClick={() => setShowAddModal(true)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Plus className="size-3.5" /> {isEn ? "Add Booking" : "Registrar Cita"}
                </Button>
              </div>
            </div>

            {/* Master Ledger Table */}
            <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/80 bg-muted/60 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-3 py-2.5">{isEn ? "Type" : "Tipo"}</th>
                      <th className="px-3 py-2.5">{isEn ? "Date" : "Fecha"}</th>
                      <th className="px-4 py-2.5">{isEn ? "Client" : "Cliente"}</th>
                      <th className="px-3 py-2.5">{isEn ? "Service" : "Servicio"}</th>
                      <th className="px-3 py-2.5">{isEn ? "Frequency" : "Frecuencia"}</th>
                      <th className="px-3 py-2.5">{isEn ? "Cleaner / Team" : "Cleaner / Equipo"}</th>
                      <th className="px-3 py-2.5">{isEn ? "City" : "Ciudad"}</th>
                      <th className="px-3 py-2.5 text-right">{isEn ? "Subtotal" : "Subtotal"}</th>
                      <th className="px-3 py-2.5 text-right">{isEn ? "Cleaner Pay" : "Pago Cleaner"}</th>
                      <th className="px-3 py-2.5 text-right">{isEn ? "Labor %" : "Mano de Obra %"}</th>
                      <th className="px-3 py-2.5 text-right">{isEn ? "PC Profit" : "Ganancia PC"}</th>
                      <th className="px-3 py-2.5 text-right">{isEn ? "Profit %" : "Margen %"}</th>
                      <th className="px-3 py-2.5 text-center">{isEn ? "Hours" : "Horas"}</th>
                      <th className="px-3 py-2.5 text-center">{isEn ? "Actions" : "Acciones"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {paginatedBookings.map((b) => {
                      const isComm = isCommercialBooking(b);
                      const isEditing = editingRowId === b.id;
                      const cleanerOpts = ALL_TRACKER_CLEANERS.includes(editDraft.cleanerTeam)
                        ? ALL_TRACKER_CLEANERS
                        : editDraft.cleanerTeam
                        ? [editDraft.cleanerTeam, ...ALL_TRACKER_CLEANERS]
                        : ALL_TRACKER_CLEANERS;

                      return (
                        <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5">
                            {isComm ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <Building2 className="size-3" /> {isEn ? "Commercial" : "Comercial"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                <Home className="size-3" /> {isEn ? "Residential" : "Residencial"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground font-mono">{b.date}</td>
                          <td className="px-4 py-2.5 font-bold text-foreground">{b.clientName}</td>
                          <td className="px-3 py-2.5 text-foreground">{translateCategoryName(b.service)}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{translateCategoryName(b.frequency)}</td>
                          <td className="px-3 py-2.5 font-medium text-foreground">
                            {isEditing ? (
                              <select
                                value={editDraft.cleanerTeam}
                                onChange={(e) => setEditDraft({ ...editDraft, cleanerTeam: e.target.value })}
                                className="h-7 rounded border border-primary/50 bg-background px-1.5 text-xs font-medium"
                              >
                                {cleanerOpts.map((c) => (
                                  <option key={c} value={c}>
                                    {translateCategoryName(c)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              translateCategoryName(b.cleanerTeam)
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{b.city}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-foreground">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editDraft.subTotal}
                                onChange={(e) => setEditDraft({ ...editDraft, subTotal: e.target.value })}
                                className="h-7 w-20 rounded border border-primary/50 bg-background px-1.5 text-right font-mono text-xs"
                              />
                            ) : (
                              `$${b.subTotal.toFixed(2)}`
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-amber-600 dark:text-amber-400 font-semibold">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editDraft.pay}
                                onChange={(e) => setEditDraft({ ...editDraft, pay: e.target.value })}
                                className="h-7 w-20 rounded border border-primary/50 bg-background px-1.5 text-right font-mono text-xs"
                              />
                            ) : (
                              `$${b.teamEarningsWithoutTips.toFixed(2)}`
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{(b.laborPct * 100).toFixed(0)}%</td>
                          <td className="px-3 py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">${b.pcEarnings.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{(b.pcProfitPct * 100).toFixed(0)}%</td>
                          <td className="px-3 py-2.5 text-center font-semibold text-foreground">{b.actualHours}h</td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="inline-flex items-center gap-1">
                              {isEditing ? (
                                <>
                                  <button
                                    disabled={savingEdit}
                                    onClick={async () => {
                                      setSavingEdit(true);
                                      try {
                                        if (selectedMonthKey >= "2026-10") {
                                          const res = await saveSopBookingOverride(supabase, selectedMonthKey, b, {
                                            cleanerTeam: editDraft.cleanerTeam,
                                            teamEarningsWithoutTips: parseFloat(editDraft.pay) || 0,
                                            subTotal: parseFloat(editDraft.subTotal) || b.subTotal,
                                          });
                                          setDynamicMonthBookings(res.bookings);
                                          setSyncFeedback(
                                            isEn
                                              ? `Updated ${b.clientName}: ${editDraft.cleanerTeam} ($${(
                                                  parseFloat(editDraft.pay) || 0
                                                ).toFixed(2)})`
                                              : `Actualizado ${b.clientName}: ${editDraft.cleanerTeam} ($${(
                                                  parseFloat(editDraft.pay) || 0
                                                ).toFixed(2)})`
                                          );
                                          setTimeout(() => setSyncFeedback(null), 4000);
                                        }
                                        setEditingRowId(null);
                                      } finally {
                                        setSavingEdit(false);
                                      }
                                    }}
                                    className="size-6 rounded bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 transition-colors inline-flex items-center justify-center"
                                    title={isEn ? "Save changes" : "Guardar cambios"}
                                  >
                                    <Check className="size-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingRowId(null)}
                                    className="size-6 rounded text-muted-foreground hover:bg-muted transition-colors inline-flex items-center justify-center"
                                    title={isEn ? "Cancel" : "Cancelar"}
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {selectedMonthKey >= "2026-10" && (
                                    <button
                                      onClick={() => {
                                        setEditingRowId(b.id);
                                        setEditDraft({
                                          cleanerTeam: b.cleanerTeam,
                                          pay: String(b.teamEarningsWithoutTips),
                                          subTotal: String(b.subTotal),
                                        });
                                      }}
                                      className="size-6 rounded text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors inline-flex items-center justify-center"
                                      title={isEn ? "Edit cleaner / pay" : "Editar cleaner / pago"}
                                    >
                                      <Pencil className="size-3" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteBooking(b.id)}
                                    className="size-6 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors inline-flex items-center justify-center"
                                    title={isEn ? "Delete record" : "Eliminar registro"}
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Ledger Pagination Bar */}
              {totalLedgerPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-border/80 bg-muted/20">
                  <span className="text-xs text-muted-foreground">
                    {isEn
                      ? `Showing ${(ledgerPage - 1) * LEDGER_PAGE_SIZE + 1} - ${Math.min(
                          ledgerPage * LEDGER_PAGE_SIZE,
                          filteredBookings.length
                        )} of ${filteredBookings.length} records`
                      : `Mostrando ${(ledgerPage - 1) * LEDGER_PAGE_SIZE + 1} - ${Math.min(
                          ledgerPage * LEDGER_PAGE_SIZE,
                          filteredBookings.length
                        )} de ${filteredBookings.length} registros`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={ledgerPage === 1}
                      onClick={() => setLedgerPage((p) => Math.max(p - 1, 1))}
                      className="h-7 text-xs px-2.5 cursor-pointer tap-active"
                    >
                      {isEn ? "Previous" : "Anterior"}
                    </Button>
                    <span className="text-xs font-bold text-foreground px-2">
                      {ledgerPage} / {totalLedgerPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={ledgerPage === totalLedgerPages}
                      onClick={() => setLedgerPage((p) => Math.min(p + 1, totalLedgerPages))}
                      className="h-7 text-xs px-2.5 cursor-pointer tap-active"
                    >
                      {isEn ? "Next" : "Siguiente"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Manual Add Booking */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-bold text-base text-foreground">
                  {isEn ? "Register New Service / Booking" : "Registrar Nuevo Servicio / Cita"}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                  ✕
                </button>
              </div>
              <form onSubmit={handleAddManualBooking} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="font-semibold text-muted-foreground">{isEn ? "Client *" : "Cliente *"}</span>
                    <input
                      required
                      type="text"
                      value={newBookingDraft.clientName || ""}
                      onChange={(e) => setNewBookingDraft({ ...newBookingDraft, clientName: e.target.value })}
                      placeholder={isEn ? "Client Name" : "Nombre del Cliente"}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold text-muted-foreground">{isEn ? "City" : "Ciudad"}</span>
                    <input
                      type="text"
                      value={newBookingDraft.city || ""}
                      onChange={(e) => setNewBookingDraft({ ...newBookingDraft, city: e.target.value })}
                      placeholder="Irvine, Newport Beach..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="font-semibold text-muted-foreground">{isEn ? "Service" : "Servicio"}</span>
                    <select
                      value={newBookingDraft.service || "Commercial Cleaning"}
                      onChange={(e) => setNewBookingDraft({ ...newBookingDraft, service: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="Commercial Cleaning">{isEn ? "Commercial Cleaning" : "Limpieza Comercial"}</option>
                      <option value="Express Cleaning/Bathroom">{isEn ? "Express Cleaning / Standard" : "Limpieza Express / Estándar"}</option>
                      <option value="Deep Clean">{isEn ? "Deep Clean" : "Limpieza Profunda"}</option>
                      <option value="Move In/Out Clean">{isEn ? "Move In/Out Clean" : "Mudanza (Move In/Out)"}</option>
                      <option value="Airbnb Clean">{isEn ? "Airbnb Clean" : "Limpieza Airbnb"}</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold text-muted-foreground">{isEn ? "Frequency" : "Frecuencia"}</span>
                    <select
                      value={newBookingDraft.frequency || "Weekly"}
                      onChange={(e) => setNewBookingDraft({ ...newBookingDraft, frequency: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="Weekly">{isEn ? "Weekly" : "Semanal"}</option>
                      <option value="Every 2 weeks">{isEn ? "Every 2 weeks" : "Cada 2 semanas (Quincenal)"}</option>
                      <option value="Tri Weekly">{isEn ? "Every 3 weeks" : "Cada 3 semanas"}</option>
                      <option value="Monthly">{isEn ? "Monthly" : "Mensual"}</option>
                      <option value="5 days a week">{isEn ? "5 days a week" : "5 días por semana"}</option>
                      <option value="3 times per week">{isEn ? "3 times per week" : "3 veces por semana"}</option>
                      <option value="One Time">{isEn ? "One Time" : "Una vez (Eventual)"}</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <label className="space-y-1">
                    <span className="font-semibold text-muted-foreground">{isEn ? "Subtotal ($)" : "Subtotal ($)"}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={newBookingDraft.subTotal ?? ""}
                      onChange={(e) => setNewBookingDraft({ ...newBookingDraft, subTotal: Number(e.target.value) })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold text-muted-foreground">{isEn ? "Cleaner Pay ($)" : "Pago Cleaner ($)"}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={newBookingDraft.teamEarningsWithoutTips ?? ""}
                      onChange={(e) => setNewBookingDraft({ ...newBookingDraft, teamEarningsWithoutTips: Number(e.target.value) })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold text-muted-foreground">{isEn ? "Hours" : "Horas"}</span>
                    <input
                      type="number"
                      step="0.1"
                      value={newBookingDraft.actualHours ?? ""}
                      onChange={(e) => setNewBookingDraft({ ...newBookingDraft, actualHours: Number(e.target.value), durationHours: Number(e.target.value) })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                    {isEn ? "Cancel" : "Cancelar"}
                  </Button>
                  <Button type="submit" size="sm">
                    {isEn ? "Save Record" : "Guardar Registro"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* AI Copilot Modal Trigger */}
        <AiSopCopilotModal
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          onApplySalesTrack={handleApplySalesTrack}
          onApplyBookings={(extractedList) => {
            const baseList = selectedMonthKey === "2026-09" ? currentMonthBookings : dynamicMonthBookings;
            const updated = [...extractedList, ...baseList];
            saveCurrentBookings(updated);
            setActiveTab("ledger");
          }}
        />
      </div>
    </DashboardShell>
  );
}

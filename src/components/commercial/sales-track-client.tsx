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
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
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

export function SalesTrackClient() {
  const [selectedPeriod, setSelectedPeriod] = useState<"september_2026" | "august_2026" | "july_2026">("august_2026");
  const [currentMonthBookings, setCurrentMonthBookings] = useState<ServiceBookingRow[]>([]);
  const [scopeFilter, setScopeFilter] = useState<"all" | "residential" | "commercial">("all");
  const [activeTab, setActiveTab] = useState<"dash" | "table" | "target" | "comparison" | "ledger">("dash");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

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

  // Load from local storage for September 2026; fallback to empty array
  useEffect(() => {
    const saved = localStorage.getItem("pristine_sales_tracker_sep_2026");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCurrentMonthBookings(parsed);
          return;
        }
      } catch (e) {
        console.error("Could not load stored bookings", e);
      }
    }
    setCurrentMonthBookings([]);
  }, []);

  const rawPeriodBookings = useMemo(() => {
    if (selectedPeriod === "july_2026") return initialSalesTrackerBookings;
    if (selectedPeriod === "august_2026") return augustSalesTrackerBookings;
    return currentMonthBookings;
  }, [selectedPeriod, currentMonthBookings]);

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
    setCurrentMonthBookings(newBookings);
    localStorage.setItem("pristine_sales_tracker_sep_2026", JSON.stringify(newBookings));
  };

  const handleClearCurrentMonth = () => {
    if (confirm("¿Deseas limpiar todos los registros de Septiembre 2026 para empezar desde cero?")) {
      saveCurrentBookings([]);
    }
  };

  const handleApplySalesTrack = (newEntries: SalesTrackItem[]) => {
    const convertedRows: ServiceBookingRow[] = newEntries.map((item) => {
      const subTotal = Number(item.monthlyRevenue) || 0;
      const teamEarnings = Number(item.cleanerCost) || 0;
      const hrs = Number(item.hoursPerVisit) || 3.0;

      return computeBookingFormulas({
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
        durationHours: hrs,
        actualHours: hrs,
        status: "completed",
        notes: item.notes || "",
      });
    });

    const updated = [...convertedRows, ...currentMonthBookings];
    saveCurrentBookings(updated);
  };

  const handleAddManualBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookingDraft.clientName) return;

    const row = computeBookingFormulas({
      ...newBookingDraft,
      subTotal: Number(newBookingDraft.subTotal) || 0,
      teamEarningsWithoutTips: Number(newBookingDraft.teamEarningsWithoutTips) || 0,
    });

    saveCurrentBookings([row, ...currentMonthBookings]);
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
    if (selectedPeriod !== "september_2026") return;
    saveCurrentBookings(currentMonthBookings.filter((b) => b.id !== id));
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

  const periodLabel =
    selectedPeriod === "september_2026"
      ? "Septiembre-2026-Activo"
      : selectedPeriod === "august_2026"
      ? "Agosto-2026-Cerrado"
      : "Julio-2026-Historico";

  const periodTitle =
    selectedPeriod === "september_2026"
      ? "Septiembre 2026 (Mes Actual)"
      : selectedPeriod === "august_2026"
      ? "Agosto 2026 (Cerrado - $37.5k)"
      : "Julio 2026 (Histórico / Demo - $34.2k)";

  const handleExportXLSX = () => {
    const scopeTag = scopeFilter === "all" ? "Unificado" : scopeFilter === "residential" ? "Residencial" : "Comercial";
    exportComprehensiveTrackerToXLSX(`${periodLabel}-${scopeTag}-Income-Labor-Sales-Tracker`, scopedBookings);
  };

  const handleExportPDF = () => {
    const scopeTag = scopeFilter === "all" ? "Consolidado Unificado" : scopeFilter === "residential" ? "Solo Residencial (Booking Koala)" : "Solo Comercial (Cuentas)";
    exportComprehensiveTrackerToPDF(
      `${periodLabel}-${scopeFilter}-Income-Labor-Sales-Tracker`,
      scopedBookings,
      `Income, Labor & Sales Tracker (${periodTitle} - ${scopeTag})`
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
                Control Financiero y Operativo
              </span>

              {/* Period Selector Dropdown */}
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span className="font-semibold text-muted-foreground">Periodo:</span>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as any)}
                  className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
                >
                  <option value="august_2026">Agosto 2026 (Cerrado - $37.5k: 62 BK + 16 Comerciales)</option>
                  <option value="september_2026">Septiembre 2026 (Mes Actual en Vivo)</option>
                  <option value="july_2026">Julio 2026 (Histórico / Plantilla Demo - $34.2k)</option>
                </select>
              </div>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Income, Labor & Sales Tracker
            </h1>
            <p className="text-sm text-muted-foreground">
              {selectedPeriod === "august_2026"
                ? "Agosto 2026 completo ($37,532.58): 62 limpiezas Booking Koala ($23.2k) y 16 contratos comerciales activos ($14.3k)."
                : selectedPeriod === "september_2026"
                ? "Mes actual en curso. Listo para registrar y procesar citas y contratos en tiempo real."
                : "Mostrando datos históricos de Julio 2026 ($34,252.70)."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedPeriod === "september_2026" && currentMonthBookings.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCurrentMonth}
                className="h-9 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40"
              >
                Limpiar Mes
              </Button>
            )}

            <Button
              onClick={() => setIsCopilotOpen(true)}
              className="gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 font-bold text-white shadow-md hover:from-emerald-700 hover:to-teal-700"
            >
              <img src="/pristiner-logo.png" alt="Pristiner" className="size-4 object-contain brightness-0 invert" />
              Pristiner (Copiloto IA)
            </Button>
            <Button
              variant="outline"
              onClick={handleExportXLSX}
              className="gap-2 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
            >
              <FileSpreadsheet className="size-4 text-emerald-600" />
              Exportar Excel (.xlsx)
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPDF}
              className="gap-2 border-rose-600/30 text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <FileText className="size-4 text-rose-600" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* SUMMARY COMPARISON MINI-PANEL */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <span className="text-xs font-bold text-foreground">Residencial (Booking Koala)</span>
              </div>
              <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600 dark:text-blue-400">
                {residentialBookings.length} servicios
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xl font-black text-foreground">
                ${resKpis.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-emerald-600">
                {resKpis.totalGrossProfitPct.toFixed(1)}% margen
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Labor: ${resKpis.totalGrossCost.toLocaleString()}</span>
              <span>Profit: ${resKpis.totalGrossProfit.toLocaleString()}</span>
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
                <span className="text-xs font-bold text-foreground">Comercial (Contratos)</span>
              </div>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                {commercialBookings.length} cuentas
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xl font-black text-foreground">
                ${commKpis.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-emerald-600">
                {commKpis.totalGrossProfitPct.toFixed(1)}% margen
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Labor: ${commKpis.totalGrossCost.toLocaleString()}</span>
              <span>Profit: ${commKpis.totalGrossProfit.toLocaleString()}</span>
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
                <span className="text-xs font-bold text-foreground">Total Unificado (Consolidado)</span>
              </div>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                {rawPeriodBookings.length} total
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xl font-black text-primary">
                ${totalKpis.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-emerald-600">
                {totalKpis.totalGrossProfitPct.toFixed(1)}% margen
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Labor: ${totalKpis.totalGrossCost.toLocaleString()}</span>
              <span>Ganancia Total: ${totalKpis.totalGrossProfit.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* SCOPE FILTER PILLS */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Filter className="size-3.5" /> Ámbito Activo:
            </span>
            <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg">
              <button
                onClick={() => setScopeFilter("all")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  scopeFilter === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="size-3.5 text-primary" />
                Todas / Unificado ({rawPeriodBookings.length})
              </button>
              <button
                onClick={() => setScopeFilter("residential")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  scopeFilter === "residential"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Home className="size-3.5 text-blue-500" />
                Residencial Booking Koala ({residentialBookings.length})
              </button>
              <button
                onClick={() => setScopeFilter("commercial")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  scopeFilter === "commercial"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="size-3.5 text-emerald-500" />
                Comercial Contratos ({commercialBookings.length})
              </button>
            </div>
          </div>

          <div className="text-xs font-medium text-muted-foreground">
            Visualizando <span className="font-bold text-foreground">{scopedBookings.length}</span> registros en{" "}
            <span className="font-bold text-foreground capitalize">{scopeFilter}</span>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 border-b border-border/80 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab("dash")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === "dash"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="size-3.5" />
            Dash (Executive KPIs)
          </button>
          <button
            onClick={() => setActiveTab("table")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === "table"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <TableIcon className="size-3.5" />
            Table (Category Breakdown)
          </button>
          <button
            onClick={() => setActiveTab("target")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === "target"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Target className="size-3.5" />
            Target (Rate Modeling)
          </button>
          <button
            onClick={() => setActiveTab("comparison")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === "comparison"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Scale className="size-3.5" />
            ⚖️ Residencial vs Comercial
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === "ledger"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <ListOrdered className="size-3.5" />
            Master Ledger (Detalle de Citas & Contratos)
          </button>
        </div>

        {/* TAB 1: DASH (EXECUTIVE KPIS) */}
        {activeTab === "dash" && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            {/* Top 4 Primary KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/70 bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Total Revenue ({scopeFilter})
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
                    {kpis.totalBookings} servicios / contratos en este ámbito
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Total Gross Profit
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
                    Margen de beneficio neto operativo
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Monthly Recurring (MRR)
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
                    {kpis.totalRecurringBookings} servicios recurrentes
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Labor Cost & Hours
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
                    {kpis.totalCleanHours.toFixed(1)} hrs totales de limpieza
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Secondary Operational Metrics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase text-muted-foreground">Avg. Revenue Per Clean/Acc</span>
                <p className="mt-2 text-xl font-bold text-foreground">${kpis.avgRevenuePerClean.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase text-muted-foreground">Avg. Profit Per Clean/Acc</span>
                <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">${kpis.avgGrossProfitPerBooking.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase text-muted-foreground">Avg. Revenue / Clean Hour</span>
                <p className="mt-2 text-xl font-bold text-foreground">${kpis.avgRevenuePerCleanHour.toFixed(2)}/hr</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase text-muted-foreground">Avg. Labor Cost / Clean Hour</span>
                <p className="mt-2 text-xl font-bold text-muted-foreground">${kpis.avgGrossCostPerCleanHour.toFixed(2)}/hr</p>
              </div>
            </div>

            {/* Summary Highlights */}
            <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-base font-bold text-foreground mb-4">
                <ShieldCheck className="size-5 text-primary" />
                Resumen Ejecutivo ({periodTitle} — Ámbito: {scopeFilter.toUpperCase()})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="rounded-xl bg-muted/40 p-4 space-y-1">
                  <span className="text-muted-foreground font-semibold">Tasa de Rentabilidad</span>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {kpis.totalGrossProfitPct.toFixed(1)}% margen bruto
                  </div>
                  <p className="text-muted-foreground">
                    Por cada $100 cobrados, $<strong>{kpis.totalGrossProfitPct.toFixed(1)}</strong> quedan como beneficio tras pagar mano de obra.
                  </p>
                </div>
                <div className="rounded-xl bg-muted/40 p-4 space-y-1">
                  <span className="text-muted-foreground font-semibold">Estabilidad de Recurrencia</span>
                  <div className="text-lg font-black text-blue-600 dark:text-blue-400">
                    {kpis.recurringRevenuePct.toFixed(1)}% MRR
                  </div>
                  <p className="text-muted-foreground">
                    ${kpis.mrr.toLocaleString()} provienen de clientes con frecuencia regular semanal, quincenal o mensual.
                  </p>
                </div>
                <div className="rounded-xl bg-muted/40 p-4 space-y-1">
                  <span className="text-muted-foreground font-semibold">Eficiencia Horaria</span>
                  <div className="text-lg font-black text-foreground">
                    ${(kpis.avgRevenuePerCleanHour - kpis.avgGrossCostPerCleanHour).toFixed(2)}/hr beneficio neto
                  </div>
                  <p className="text-muted-foreground">
                    Margen neto generado por cada hora de limpieza ejecutada en el campo.
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
                  <h3 className="font-bold text-sm text-foreground">Matriz de Rendimiento por Categoría (Table Sheet)</h3>
                  <p className="text-xs text-muted-foreground">Desglose de horas, ingresos, costos laborales y margen por tipo de servicio.</p>
                </div>
                <Badge variant="outline" className="border-primary/30 text-primary font-bold">
                  {breakdowns.length} Categorías Analizadas
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/80 bg-muted/70 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3">Tipo de Servicio</th>
                      <th className="px-3 py-3 text-center">Jobs/Cuentas</th>
                      <th className="px-3 py-3 text-right">Total Horas</th>
                      <th className="px-3 py-3 text-right">Prom. Horas</th>
                      <th className="px-4 py-3 text-right">Ingreso Total</th>
                      <th className="px-3 py-3 text-right">Ingreso / Job</th>
                      <th className="px-3 py-3 text-right">Ingreso / Hr</th>
                      <th className="px-4 py-3 text-right">Costo Laboral</th>
                      <th className="px-3 py-3 text-right">Costo / Hr</th>
                      <th className="px-4 py-3 text-right">Ganancia Bruta</th>
                      <th className="px-3 py-3 text-right">Margen %</th>
                      <th className="px-3 py-3 text-right">Labor %</th>
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
                            {row.category}
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
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border/80 bg-muted/40 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-foreground">Modelado de Tarifas, Descuentos y Metas (Target Sheet)</h3>
                  <p className="text-xs text-muted-foreground">
                    Tarifa base ($60/hr o $50/hr), descuentos por suscripción, pago a cleaner y margen objetivo vs real.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/80 bg-muted/70 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3">Servicio / Frecuencia</th>
                      <th className="px-3 py-3 text-right">Tarifa Base</th>
                      <th className="px-3 py-3 text-right">Descuento</th>
                      <th className="px-3 py-3 text-right">Tarifa Efectiva</th>
                      <th className="px-3 py-3 text-right">Pago Cleaner</th>
                      <th className="px-3 py-3 text-right">Cleaner Efectivo</th>
                      <th className="px-3 py-3 text-right">Ganancia / Hr</th>
                      <th className="px-3 py-3 text-right font-bold">Meta Margen %</th>
                      <th className="px-3 py-3 text-right font-bold">Margen Real %</th>
                      <th className="px-3 py-3 text-right">Ingreso Real</th>
                      <th className="px-3 py-3 text-right">% de Ventas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {targets.map((t, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-foreground">{t.service}</td>
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
                    Revenue & Earnings por Grupos ({periodTitle})
                  </h4>
                </div>
                <div className="p-4 space-y-4 text-xs">
                  {/* Commercial Share */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-emerald-600" />
                        Comercial (Contratos)
                      </span>
                      <span className="font-black text-emerald-600">
                        ${commKpis.totalRevenue.toLocaleString()} ({totalKpis.totalRevenue > 0 ? ((commKpis.totalRevenue / totalKpis.totalRevenue) * 100).toFixed(1) : "0"}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${totalKpis.totalRevenue > 0 ? (commKpis.totalRevenue / totalKpis.totalRevenue) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Margen: {commKpis.totalGrossProfitPct.toFixed(1)}%</span>
                      <span>Beneficio: ${commKpis.totalGrossProfit.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Residential Share */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Home className="size-3.5 text-blue-600" />
                        Residencial (Booking Koala)
                      </span>
                      <span className="font-black text-blue-600">
                        ${resKpis.totalRevenue.toLocaleString()} ({totalKpis.totalRevenue > 0 ? ((resKpis.totalRevenue / totalKpis.totalRevenue) * 100).toFixed(1) : "0"}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${totalKpis.totalRevenue > 0 ? (resKpis.totalRevenue / totalKpis.totalRevenue) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Margen: {resKpis.totalGrossProfitPct.toFixed(1)}%</span>
                      <span>Beneficio: ${resKpis.totalGrossProfit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm flex flex-col justify-between text-xs">
                <h4 className="font-bold text-xs text-foreground uppercase tracking-wider mb-2">
                  Diagnóstico Financiero y Metas
                </h4>
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                    <strong>🏢 Comercial:</strong> Genera la mayor base recurrente mensual ($60.5k / mes) con ingresos constantes garantizados por contratos a largo plazo.
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300">
                    <strong>🏠 Residencial:</strong> Ofrece el mayor margen bruto unitario (~53.2%), destacándose servicios como Move In/Out Clean y Deep Clean.
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border flex justify-between items-center text-[11px] text-muted-foreground">
                  <span>Margen Global Empresa:</span>
                  <span className="font-black text-foreground text-sm">{totalKpis.totalGrossProfitPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: COMPARISON (RESIDENTIAL VS COMMERCIAL SPLIT PANEL) */}
        {activeTab === "comparison" && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-base font-bold text-foreground mb-4">
                <Scale className="size-5 text-primary" />
                Panel Comparativo: Residencial (Booking Koala) vs Comercial (Contratos)
              </div>

              {/* Side-by-Side Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Residential Side */}
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-blue-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <Home className="size-5 text-blue-600" />
                      <h3 className="font-bold text-base text-foreground">Limpiezas Residenciales</h3>
                    </div>
                    <Badge className="bg-blue-600 text-white font-bold">Booking Koala</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-card p-3 rounded-xl border border-border/60">
                      <span className="text-muted-foreground">Total Ingresos:</span>
                      <p className="text-lg font-black text-foreground mt-1">${resKpis.totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border border-border/60">
                      <span className="text-muted-foreground">Margen Bruto:</span>
                      <p className="text-lg font-black text-emerald-600 mt-1">{resKpis.totalGrossProfitPct.toFixed(1)}%</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border border-border/60">
                      <span className="text-muted-foreground">Ganancia Bruta:</span>
                      <p className="text-lg font-black text-emerald-600 mt-1">${resKpis.totalGrossProfit.toLocaleString()}</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border border-border/60">
                      <span className="text-muted-foreground">Costo Mano de Obra:</span>
                      <p className="text-lg font-black text-amber-600 mt-1">${resKpis.totalGrossCost.toLocaleString()}</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border border-border/60">
                      <span className="text-muted-foreground">Servicios Realizados:</span>
                      <p className="text-lg font-black text-foreground mt-1">{residentialBookings.length} jobs</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border border-border/60">
                      <span className="text-muted-foreground">Horas Limpieza:</span>
                      <p className="text-lg font-black text-foreground mt-1">{resKpis.totalCleanHours.toFixed(1)} hrs</p>
                    </div>
                  </div>

                  <div className="p-3 bg-card rounded-xl border border-border/60 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Promedio por Servicio:</span>
                      <span className="font-bold text-foreground">${resKpis.avgRevenuePerClean.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ingreso por Hora:</span>
                      <span className="font-bold text-foreground">${resKpis.avgRevenuePerCleanHour.toFixed(2)}/hr</span>
                    </div>
                  </div>
                </div>

                {/* Commercial Side */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-5 text-emerald-600" />
                      <h3 className="font-bold text-base text-foreground">Limpiezas Comerciales</h3>
                    </div>
                    <Badge className="bg-emerald-600 text-white font-bold">Cuentas & Contratos</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-card p-3 rounded-xl border border-border/60">
                      <span className="text-muted-foreground">Total Ingresos:</span>
                      <p className="text-lg font-black text-foreground mt-1">${commKpis.totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border border-border/60">
                      <span className="text-muted-foreground">Margen Bruto:</span>
                      <p className="text-lg font-black text-emerald-600 mt-1">{commKpis.totalGrossProfitPct.toFixed(1)}%</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border border-border/60">
                      <span className="text-muted-foreground">Ganancia Bruta:</span>
                      <p className="text-lg font-black text-emerald-600 mt-1">${commKpis.totalGrossProfit.toLocaleString()}</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border border-border/60">
                      <span className="text-muted-foreground">Costo Mano de Obra:</span>
                      <p className="text-lg font-black text-amber-600 mt-1">${commKpis.totalGrossCost.toLocaleString()}</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border border-border/60">
                      <span className="text-muted-foreground">Cuentas Activas:</span>
                      <p className="text-lg font-black text-foreground mt-1">{commercialBookings.length} cuentas</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border border-border/60">
                      <span className="text-muted-foreground">Horas Limpieza:</span>
                      <p className="text-lg font-black text-foreground mt-1">{commKpis.totalCleanHours.toFixed(1)} hrs</p>
                    </div>
                  </div>

                  <div className="p-3 bg-card rounded-xl border border-border/60 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Promedio por Cuenta:</span>
                      <span className="font-bold text-foreground">${commKpis.avgRevenuePerClean.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ingreso por Hora:</span>
                      <span className="font-bold text-foreground">${commKpis.avgRevenuePerCleanHour.toFixed(2)}/hr</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MASTER LEDGER (MON / INDIVIDUAL BOOKINGS) */}
        {activeTab === "ledger" && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            {/* Filter and Actions Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/70 bg-card p-3 shadow-sm">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por cliente, cleaner, servicio o ciudad..."
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
                  <option value="all">Todas las frecuencias/servicios</option>
                  <option value="commercial">Comercial</option>
                  <option value="weekly">Semanal (Weekly)</option>
                  <option value="biweekly">Quincenal (Biweekly)</option>
                  <option value="monthly">Mensual (Monthly)</option>
                  <option value="deep">Deep Clean</option>
                  <option value="move">Move In/Out</option>
                </select>

                <Button
                  size="sm"
                  onClick={() => {
                    if (selectedPeriod !== "september_2026") {
                      setSelectedPeriod("september_2026");
                    }
                    setShowAddModal(true);
                  }}
                  className="h-8 text-xs gap-1.5"
                >
                  <Plus className="size-3.5" /> Registrar Cita
                </Button>
              </div>
            </div>

            {/* Master Ledger Table */}
            <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/80 bg-muted/60 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-3 py-2.5">Tipo</th>
                      <th className="px-3 py-2.5">Fecha</th>
                      <th className="px-4 py-2.5">Cliente</th>
                      <th className="px-3 py-2.5">Servicio</th>
                      <th className="px-3 py-2.5">Frecuencia</th>
                      <th className="px-3 py-2.5">Cleaner / Equipo</th>
                      <th className="px-3 py-2.5">Ciudad</th>
                      <th className="px-3 py-2.5 text-right">Subtotal</th>
                      <th className="px-3 py-2.5 text-right">Pago Cleaner</th>
                      <th className="px-3 py-2.5 text-right">Labour %</th>
                      <th className="px-3 py-2.5 text-right">PC Profit</th>
                      <th className="px-3 py-2.5 text-right">Profit %</th>
                      <th className="px-3 py-2.5 text-center">Horas</th>
                      {selectedPeriod === "september_2026" && <th className="px-3 py-2.5 text-center">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredBookings.map((b) => {
                      const isComm = isCommercialBooking(b);
                      return (
                        <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5">
                            {isComm ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <Building2 className="size-3" /> Comercial
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                <Home className="size-3" /> Residencial
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground font-mono">{b.date}</td>
                          <td className="px-4 py-2.5 font-bold text-foreground">{b.clientName}</td>
                          <td className="px-3 py-2.5 text-foreground">{b.service}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{b.frequency}</td>
                          <td className="px-3 py-2.5 font-medium text-foreground">{b.cleanerTeam}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{b.city}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-foreground">${b.subTotal.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right text-amber-600 dark:text-amber-400 font-semibold">${b.teamEarningsWithoutTips.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{(b.laborPct * 100).toFixed(0)}%</td>
                          <td className="px-3 py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">${b.pcEarnings.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{(b.pcProfitPct * 100).toFixed(0)}%</td>
                          <td className="px-3 py-2.5 text-center font-semibold text-foreground">{b.actualHours}h</td>
                          {selectedPeriod === "september_2026" && (
                            <td className="px-3 py-2.5 text-center">
                              <button
                                onClick={() => handleDeleteBooking(b.id)}
                                className="size-6 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors inline-flex items-center justify-center"
                                title="Eliminar registro"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal Manual Add Booking */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-bold text-base text-foreground">Registrar Nuevo Servicio / Cita</h3>
                <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                  ✕
                </button>
              </div>
              <form onSubmit={handleAddManualBooking} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Cliente *</span>
                    <input
                      required
                      type="text"
                      value={newBookingDraft.clientName || ""}
                      onChange={(e) => setNewBookingDraft({ ...newBookingDraft, clientName: e.target.value })}
                      placeholder="Nombre del Cliente"
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Ciudad</span>
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
                    <span className="font-semibold text-muted-foreground">Servicio</span>
                    <select
                      value={newBookingDraft.service || "Commercial Cleaning"}
                      onChange={(e) => setNewBookingDraft({ ...newBookingDraft, service: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="Commercial Cleaning">Commercial Cleaning</option>
                      <option value="Express Cleaning/Bathroom">Express Cleaning / Standard</option>
                      <option value="Deep Clean">Deep Clean</option>
                      <option value="Move In/Out Clean">Move In/Out Clean</option>
                      <option value="Airbnb Clean">Airbnb Clean</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Frecuencia</span>
                    <select
                      value={newBookingDraft.frequency || "Weekly"}
                      onChange={(e) => setNewBookingDraft({ ...newBookingDraft, frequency: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="Weekly">Weekly (Semanal)</option>
                      <option value="Every 2 weeks">Every 2 weeks (Quincenal)</option>
                      <option value="Tri Weekly">Tri Weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="5 days a week">5 days a week</option>
                      <option value="3 times per week">3 times per week</option>
                      <option value="One Time">One Time (Eventual)</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <label className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Subtotal ($)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={newBookingDraft.subTotal ?? ""}
                      onChange={(e) => setNewBookingDraft({ ...newBookingDraft, subTotal: Number(e.target.value) })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Pago Cleaner ($)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={newBookingDraft.teamEarningsWithoutTips ?? ""}
                      onChange={(e) => setNewBookingDraft({ ...newBookingDraft, teamEarningsWithoutTips: Number(e.target.value) })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Horas</span>
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
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm">
                    Guardar Registro
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
            const updated = [...extractedList, ...currentMonthBookings];
            saveCurrentBookings(updated);
            setSelectedPeriod("september_2026");
            setActiveTab("ledger");
          }}
        />
      </div>
    </DashboardShell>
  );
}

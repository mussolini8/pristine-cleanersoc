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
  CheckCircle2,
  Clock,
  ArrowUpDown,
  Filter,
  Trash2,
  Edit,
  Download,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AiSopCopilotModal } from "@/components/operations/ai-sop-copilot-modal";
import {
  exportSalesTrackToXLSX,
  exportSalesTrackToPDF,
  calculateSalesTrackSummary,
  type SalesTrackItem,
} from "@/lib/export/sales-track-export";
import { importedCommercialAccounts } from "@/lib/commercial-accounts-data";

export function SalesTrackClient() {
  const [items, setItems] = useState<SalesTrackItem[]>(() => {
    // Initialise from importedCommercialAccounts converted to SalesTrackItem
    return importedCommercialAccounts.map((acc) => {
      const rev = Number(acc.revenue) || 0;
      const cost = Number(acc.cost) || 0;
      const profit = rev - cost;
      const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;

      return {
        id: acc.id,
        clientName: acc.name,
        city: acc.city,
        serviceFrequency: acc.frequency || "Weekly",
        serviceDays: acc.schedule_rules?.map((r) => ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][r.day_of_week]).join(", ") || null,
        hoursPerVisit: acc.hours,
        cleanerTeam: acc.cleaner_name,
        pricingModel: acc.pricing_model || "Flat rate",
        monthlyRevenue: rev,
        cleanerCost: cost,
        grossProfit: profit,
        marginPct: margin,
        contractStart: acc.contract_start,
        contractEnd: acc.contract_end,
        status: "active" as const,
        notes: acc.supplies_notes || null,
      };
    });
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SalesTrackItem | null>(null);

  // Load any local storage overrides or new entries
  useEffect(() => {
    const saved = localStorage.getItem("pristine_sales_track_items");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
        }
      } catch (e) {
        console.error("Could not load stored sales track items", e);
      }
    }
  }, []);

  const saveItems = (newItems: SalesTrackItem[]) => {
    setItems(newItems);
    localStorage.setItem("pristine_sales_track_items", JSON.stringify(newItems));
  };

  const handleApplySalesTrack = (newEntries: SalesTrackItem[]) => {
    const updated = [...newEntries, ...items.filter((item) => !newEntries.some((ne) => ne.clientName.toLowerCase() === item.clientName.toLowerCase()))];
    saveItems(updated);
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        search === "" ||
        item.clientName.toLowerCase().includes(search.toLowerCase()) ||
        (item.city && item.city.toLowerCase().includes(search.toLowerCase())) ||
        (item.cleanerTeam && item.cleanerTeam.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = statusFilter === "all" || item.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [items, search, statusFilter]);

  const summary = useMemo(() => calculateSalesTrackSummary(filteredItems), [filteredItems]);

  const handleExportXLSX = () => {
    exportSalesTrackToXLSX("Pristine-Sales-Track-Report", filteredItems);
  };

  const handleExportPDF = () => {
    exportSalesTrackToPDF("Pristine-Sales-Track-Report", filteredItems, "Commercial Sales Track Report");
  };

  const handleDeleteItem = (clientName: string) => {
    const updated = items.filter((item) => item.clientName !== clientName);
    saveItems(updated);
  };

  return (
    <DashboardShell>
      <div className="space-y-6 pb-12">
        {/* Header & Hero */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="size-3.5" />
                Ventas y Seguimiento Comercial
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Sales Track Report
            </h1>
            <p className="text-sm text-muted-foreground">
              Supervisa cuentas comerciales, ingresos mensuales proyectados, costos de cleaner y márgenes de ganancia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setIsCopilotOpen(true)}
              className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-md hover:from-emerald-700 hover:to-teal-700"
            >
              <Sparkles className="size-4" />
              Copiloto IA (Gemini)
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

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/70 bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Cuentas Activas
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="size-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-foreground">{summary.totalAccounts}</span>
                <span className="text-xs text-muted-foreground">cuentas listadas</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ingresos Mensuales
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="size-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ${summary.totalMonthlyRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Costo de Cleaners
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Users className="size-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-foreground">
                  ${summary.totalCleanerCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Margen Bruto Proyectado
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <Percent className="size-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {summary.averageMarginPct}%
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  (${summary.totalGrossProfit.toLocaleString("en-US", { minimumFractionDigits: 0 })})
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/70 bg-card p-3 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, ciudad o cleaner..."
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="onboarding">En Onboarding</option>
              <option value="proposal">Propuesta</option>
              <option value="paused">Pausado</option>
            </select>
          </div>
        </div>

        {/* Sales Track Table */}
        <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/80 bg-muted/50 text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">Cliente / Cuenta</th>
                  <th className="px-4 py-3">Ciudad</th>
                  <th className="px-4 py-3">Cleaner Asignado</th>
                  <th className="px-4 py-3">Frecuencia & Días</th>
                  <th className="px-4 py-3">Horas</th>
                  <th className="px-4 py-3 text-right">Ingreso Mensual</th>
                  <th className="px-4 py-3 text-right">Costo Cleaner</th>
                  <th className="px-4 py-3 text-right">Ganancia</th>
                  <th className="px-4 py-3 text-right">Margen</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-muted-foreground">
                      No se encontraron cuentas comerciales con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => {
                    const rev = Number(item.monthlyRevenue) || 0;
                    const cost = Number(item.cleanerCost) || 0;
                    const profit = item.grossProfit !== undefined ? item.grossProfit : rev - cost;
                    const margin = item.marginPct !== undefined ? item.marginPct : (rev > 0 ? Math.round((profit / rev) * 100) : 0);
                    const days = Array.isArray(item.serviceDays) ? item.serviceDays.join(", ") : item.serviceDays;

                    return (
                      <tr key={index} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="font-bold text-foreground">{item.clientName}</div>
                          {item.pricingModel && (
                            <div className="text-[10px] text-muted-foreground">{item.pricingModel}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.city || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">
                            {item.cleanerTeam || "Sin asignar"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{item.serviceFrequency || "—"}</div>
                          <div className="text-[10px] text-muted-foreground">{days || "Sin definir"}</div>
                        </td>
                        <td className="px-4 py-3 text-foreground">{item.hoursPerVisit ? `${item.hoursPerVisit} hrs` : "—"}</td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">${rev.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">${cost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          ${profit.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                          {margin}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className={
                              item.status === "active"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : item.status === "onboarding"
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
                                : "border-border text-muted-foreground"
                            }
                          >
                            {item.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteItem(item.clientName)}
                            className="size-7 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors inline-flex items-center justify-center"
                            title="Eliminar registro"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Copilot Modal Trigger */}
        <AiSopCopilotModal
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          onApplySalesTrack={handleApplySalesTrack}
        />
      </div>
    </DashboardShell>
  );
}

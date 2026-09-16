"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle } from "lucide-react";

export type FinancialEntry = {
  accountName: string;
  hours?: number;
  cleanerName?: string;
  cleanerRate?: number;
  ratePerService?: number;
  cost?: number;
  cleanerPayType?: "hourly" | "flat" | string;
  pricingModel?: string;
};

interface BulkReviewTableProps {
  entries: FinancialEntry[];
  onApply: (entries: FinancialEntry[]) => void;
  onCancel: () => void;
  isApplying?: boolean;
}

export function BulkReviewTable({ entries, onApply, onCancel, isApplying }: BulkReviewTableProps) {
  const [rows, setRows] = useState<FinancialEntry[]>(entries);
  const [selected, setSelected] = useState<Set<number>>(new Set(Array.from({ length: entries.length }, (_, i) => i)));

  const toggleRow = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const updateRow = (idx: number, field: keyof FinancialEntry, value: string | number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const selectedRows = rows.filter((_, i) => selected.has(i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <AlertTriangle className="size-3.5 text-amber-500" />
          Revisión de {rows.length} Cuentas — Edita antes de aplicar
        </span>
        <span className="text-[10px] text-muted-foreground">{selected.size} seleccionadas</span>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-muted/80 border-b border-border">
            <tr>
              <th className="w-6 px-2 py-1.5 text-left">
                <input
                  type="checkbox"
                  checked={selected.size === rows.length}
                  onChange={() =>
                    setSelected(selected.size === rows.length ? new Set() : new Set(Array.from({ length: rows.length }, (_, i) => i)))
                  }
                  className="size-3"
                />
              </th>
              <th className="px-2 py-1.5 text-left font-bold text-muted-foreground">Cuenta</th>
              <th className="px-2 py-1.5 text-center font-bold text-muted-foreground">Hrs</th>
              <th className="px-2 py-1.5 text-center font-bold text-muted-foreground">Tarifa/h</th>
              <th className="px-2 py-1.5 text-center font-bold text-muted-foreground">$/Servicio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className={`border-b border-border/50 ${selected.has(idx) ? "bg-background" : "bg-muted/20 opacity-50"}`}>
                <td className="px-2 py-1">
                  <input type="checkbox" checked={selected.has(idx)} onChange={() => toggleRow(idx)} className="size-3" />
                </td>
                <td className="px-2 py-1 font-medium text-foreground truncate max-w-32">{row.accountName}</td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    value={row.hours ?? ""}
                    onChange={(e) => updateRow(idx, "hours", parseFloat(e.target.value) || 0)}
                    className="w-12 rounded border border-border bg-background px-1 py-0.5 text-center text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                    step="0.5"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    value={row.cleanerRate ?? ""}
                    onChange={(e) => updateRow(idx, "cleanerRate", parseFloat(e.target.value) || 0)}
                    className="w-14 rounded border border-border bg-background px-1 py-0.5 text-center text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                    step="0.5"
                  />
                </td>
                <td className="px-2 py-1 text-center font-bold text-emerald-700 dark:text-emerald-300">
                  ${((Number(row.hours) || 0) * (Number(row.cleanerRate) || 0)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-8 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onApply(selectedRows)}
          disabled={isApplying || selected.size === 0}
          className="flex-1 h-8 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          <CheckCircle className="size-3.5" />
          Aplicar {selected.size} Cuentas Revisadas
        </button>
      </div>
    </div>
  );
}

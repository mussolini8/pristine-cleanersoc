"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileClock, LockKeyhole, PencilLine, RefreshCw, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { useLanguage } from "@/components/providers/language-provider";
import {
  addPayrollAdjustment,
  fetchCommercialAccounts,
  fetchPayrollPeriodDetails,
  generatePayrollForPeriod,
  parseHours,
  updateEntryStatus,
  updatePayrollEntry,
  updatePeriodStatus,
  type CommercialAccount,
  type PayrollAdjustmentRow,
  type PayrollEntryRow,
  type PayrollPeriodRow,
} from "@/lib/payroll";
import { isCommercialPayrollEligible } from "@/lib/staff-rules";

type EntryDraft = {
  adjusted_hours: string;
  pay_rate: string;
  status: PayrollEntryRow["status"];
  review_notes: string;
  notes: string;
};

type AdjustmentDraft = {
  adjustment_type: string;
  hours_delta: string;
  amount_delta: string;
  reason: string;
  internal_note: string;
};

type BilingualMessage = {
  en: string;
  es: string;
};

const ADJUSTMENT_TYPES: Record<string, { en: string; es: string }> = {
  add_hours: { en: "Add hours", es: "Agregar horas" },
  remove_hours: { en: "Remove hours", es: "Restar horas" },
  add_bonus: { en: "Add bonus", es: "Agregar bono" },
  deduction: { en: "Deduction", es: "Deducción" },
  skipped_visit: { en: "Skipped visit", es: "Visita omitida" },
  rescheduled_visit: { en: "Rescheduled visit", es: "Visita reagendada" },
  one_time_job: { en: "One-time job", es: "Trabajo único" },
  holiday_adjustment: { en: "Holiday adjustment", es: "Ajuste por feriado" },
  correction: { en: "Correction", es: "Corrección" },
  manual_override: { en: "Manual override", es: "Ajuste manual" },
};

const STATUS_LABELS: Record<string, { en: string; es: string }> = {
  draft: { en: "Draft", es: "Borrador" },
  needs_review: { en: "Needs Review", es: "Requiere Revisión" },
  reviewed: { en: "Reviewed", es: "Revisado" },
  approved: { en: "Approved", es: "Aprobado" },
  paid: { en: "Paid", es: "Pagado" },
  in_review: { en: "In Review", es: "En Revisión" },
  partially_approved: { en: "Partially Approved", es: "Parcialmente Aprobado" },
  locked: { en: "Locked", es: "Bloqueado" },
};

const EXCEPTION_LABELS_EN: Record<string, string> = {
  missing_cleaner: "Missing cleaner",
  missing_pay_rate: "Missing pay rate",
  inactive_cleaner: "Inactive cleaner",
  zero_hours: "Zero hours",
  missing_schedule: "Missing schedule rule",
  missing_anchor_date: "Missing anchor date",
  missing_account_pay_settings: "Missing account pay settings",
  excluded_commercial_payroll: "Mixed route · Not in commercial payroll",
  hours_mismatch: "Hours mismatch",
  manual_review: "Manual review",
  contract_boundary: "Contract boundary",
};

function getStatusLabel(status: string, isEn: boolean) {
  const entry = STATUS_LABELS[status];
  return entry ? (isEn ? entry.en : entry.es) : status;
}

function getAdjustmentTypes(isEn: boolean) {
  return Object.entries(ADJUSTMENT_TYPES).map(([key, labels]) => [key, isEn ? labels.en : labels.es] as const);
}

function getAdjustmentTypeLabel(type: string | null | undefined, isEn: boolean) {
  if (!type) return "-";
  const entry = ADJUSTMENT_TYPES[type];
  return entry ? (isEn ? entry.en : entry.es) : type;
}

function translateCleanerDisplay(name: string | null | undefined, isEn: boolean) {
  if (!name || !name.trim() || name.trim().toLowerCase() === "unassigned" || name.trim().toLowerCase() === "sin asignar") {
    return isEn ? "Unassigned" : "Sin asignar";
  }
  return name;
}

function translateAccountNameDisplay(name: string, isEn: boolean) {
  if (name === "QC Supervisor Fixed Pay") {
    return isEn ? "QC Supervisor Fixed Pay" : "Pago Fijo Supervisora QC";
  }
  return name;
}

function translateScheduledDay(day: string | null | undefined, isEn: boolean) {
  if (!day) return "-";
  const map: Record<string, { en: string; es: string }> = {
    sunday: { en: "Sunday", es: "Domingo" },
    monday: { en: "Monday", es: "Lunes" },
    tuesday: { en: "Tuesday", es: "Martes" },
    wednesday: { en: "Wednesday", es: "Miércoles" },
    thursday: { en: "Thursday", es: "Jueves" },
    friday: { en: "Friday", es: "Viernes" },
    saturday: { en: "Saturday", es: "Sábado" },
    "pay period": { en: "Pay period", es: "Período de pago" },
  };
  const found = map[day.trim().toLowerCase()];
  return found ? (isEn ? found.en : found.es) : day;
}

function translateFrequencyDisplay(freq: string | null | undefined, isEn: boolean) {
  if (!freq) return isEn ? "No frequency" : "Sin frecuencia";
  if (isEn) return freq;
  const map: Record<string, string> = {
    "weekly": "Semanal",
    "weekly (fri)": "Semanal (Vie)",
    "every week on wed": "Cada semana (Mié)",
    "1x per week": "1x por semana",
    "2x per week": "2x por semana",
    "3x per week": "3x por semana",
    "4x per week": "4x por semana",
    "5x per week": "5x por semana",
    "6x per week": "6x por semana",
    "7x per week": "7x por semana",
    "daily (7x/week)": "Diario (7x/sem)",
    "every 2 weeks": "Cada 2 semanas",
    "every 14 days": "Cada 14 días",
    "every 3 weeks": "Cada 3 semanas",
    "every 21 days": "Cada 21 días",
    "every month on 2nd mon": "Mensual (2do Lun)",
    "monthly": "Mensual",
    "as needed": "Según necesidad",
    "as needed (events)": "Según necesidad (Eventos)",
    "one time": "Una vez",
    "custom": "Personalizado",
  };
  return map[freq.trim().toLowerCase()] ?? freq;
}

const SYSTEM_PAYROLL_NOTES: Array<{ match: (normalized: string) => boolean; en: string; es: string }> = [
  {
    match: (s) =>
      s.startsWith("steripax: horas") ||
      s.startsWith("steripax: hours") ||
      s.startsWith("steripax: worked hours"),
    en: "Steripax: Hours calculated manually; confirm worked hours and total cost before approving.",
    es: "Steripax: Horas calculadas manualmente; confirmar horas trabajadas y costo total antes de aprobar.",
  },
  {
    match: (s) => s.startsWith("qc supervisor fixed pay: 80 hours") || s.startsWith("pago fijo supervisora qc: 80 horas"),
    en: "QC supervisor fixed pay: 80 hours at $18/hour per pay period (biweekly: 15th & end of month).",
    es: "Pago fijo supervisora QC: 80 horas a $18/hora por período (quincenal: 15 y fin de mes).",
  },
  {
    match: (s) => s.startsWith("qc supervisor fixed pay: $1,000") || s.startsWith("pago fijo supervisora qc: $1,000"),
    en: "QC supervisor fixed pay: $1,000 per pay period.",
    es: "Pago fijo supervisora QC: $1,000 por período de pago.",
  },
  {
    match: (s) => s === "mixed route · not in commercial payroll" || s === "ruta mixta · no entra en nómina comercial",
    en: "Mixed route · Not in commercial payroll",
    es: "Ruta mixta · No entra en nómina comercial",
  },
  {
    match: (s) => s === "missing rate" || s === "falta tarifa",
    en: "Missing rate",
    es: "Falta tarifa",
  },
  {
    match: (s) => s === "missing pay rate" || s === "falta tarifa de pago",
    en: "Missing pay rate",
    es: "Falta tarifa de pago",
  },
  {
    match: (s) => s === "missing schedule rule" || s === "falta regla de horario",
    en: "Missing schedule rule",
    es: "Falta regla de horario",
  },
  {
    match: (s) => s === "missing paid hours" || s === "faltan horas pagadas",
    en: "Missing paid hours",
    es: "Faltan horas pagadas",
  },
  {
    match: (s) => s === "scheduled hours do not match account rule" || s === "las horas programadas no coinciden con la regla de la cuenta",
    en: "Scheduled hours do not match account rule",
    es: "Las horas programadas no coinciden con la regla de la cuenta",
  },
  {
    match: (s) => s === "paid hours do not match expected payable hours" || s === "las horas pagadas no coinciden con las horas esperadas",
    en: "Paid hours do not match expected payable hours",
    es: "Las horas pagadas no coinciden con las horas esperadas",
  },
  {
    match: (s) => s === "draft row" || s === "fila en borrador",
    en: "Draft row",
    es: "Fila en borrador",
  },
  {
    match: (s) => s === "needs review" || s === "requiere revisión",
    en: "Needs review",
    es: "Requiere revisión",
  },
  {
    match: (s) => s === "missing cleaner" || s === "sin cleaner asignada",
    en: "Missing cleaner",
    es: "Sin cleaner asignada",
  },
  {
    match: (s) => s === "inactive cleaner" || s === "cleaner inactiva",
    en: "Inactive cleaner",
    es: "Cleaner inactiva",
  },
  {
    match: (s) => s === "cleaner payment setting is inactive" || s === "la configuración de pago de la cleaner está inactiva",
    en: "Cleaner payment setting is inactive",
    es: "La configuración de pago de la cleaner está inactiva",
  },
  {
    match: (s) => s === "zero hours" || s === "cero horas",
    en: "Zero hours",
    es: "Cero horas",
  },
  {
    match: (s) => s === "missing anchor date" || s === "falta fecha ancla",
    en: "Missing anchor date",
    es: "Falta fecha ancla",
  },
  {
    match: (s) => s === "missing account pay settings" || s === "falta configuración de pago de la cuenta",
    en: "Missing account pay settings",
    es: "Falta configuración de pago de la cuenta",
  },
  {
    match: (s) => s === "hours mismatch" || s === "discrepancia de horas",
    en: "Hours mismatch",
    es: "Discrepancia de horas",
  },
  {
    match: (s) => s === "manual review" || s === "revisión manual",
    en: "Manual review",
    es: "Revisión manual",
  },
  {
    match: (s) => s === "contract boundary" || s === "límite de contrato",
    en: "Contract boundary",
    es: "Límite de contrato",
  },
];

function translatePayrollNote(text: string | null | undefined, isEn: boolean): string {
  if (!text) return "";
  const normalized = text.trim().toLowerCase();
  if (!normalized) return "";
  for (const rule of SYSTEM_PAYROLL_NOTES) {
    if (rule.match(normalized)) {
      return isEn ? rule.en : rule.es;
    }
  }
  return text;
}

function isKnownSystemPayrollNote(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return SYSTEM_PAYROLL_NOTES.some((rule) => rule.match(normalized));
}

type DateFilterMode = "day" | "week" | "pay_period" | "month" | "custom";

function todayLocalDateString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function isoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function getDateFilterRange(mode: DateFilterMode, selectedDate: string, period: PayrollPeriodRow | null, customStart: string, customEnd: string) {
  if (mode === "pay_period") return { start: period?.start_date ?? selectedDate, end: period?.end_date ?? selectedDate };
  if (mode === "custom") return { start: customStart || period?.start_date || selectedDate, end: customEnd || period?.end_date || selectedDate };
  const date = parseDate(selectedDate);
  if (mode === "day") return { start: selectedDate, end: selectedDate };
  if (mode === "month") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start: isoDate(start), end: isoDate(end) };
  }
  const start = new Date(date);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: isoDate(start), end: isoDate(end) };
}

function money(value: number | null | undefined) {
  return `$${Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function payableAmount(entry: PayrollEntryRow) {
  return isCommercialPayrollEligible(entry.cleaner_name) ? numberValue(entry.final_amount ?? entry.estimated_amount) : 0;
}

function validateCommercialPayrollRow(entry: PayrollEntryRow, account?: CommercialAccount | null) {
  const reasons: string[] = [];
  const expectedHours = account ? parseHours(account.hours) : 0;
  const paidHours = numberValue(entry.adjusted_hours ?? entry.base_hours);
  const scheduledHours = numberValue(entry.base_hours);
  const payrollEligible = isCommercialPayrollEligible(entry.cleaner_name);

  if (!payrollEligible) reasons.push("Mixed route · Not in commercial payroll");
  if (payrollEligible && numberValue(entry.pay_rate) <= 0) reasons.push("Missing rate");
  if (entry.source !== "schedule_rule" || (entry.exceptions ?? []).includes("missing_schedule")) reasons.push("Missing schedule rule");
  if (paidHours <= 0) reasons.push("Missing paid hours");
  if (expectedHours > 0 && Math.abs(scheduledHours - expectedHours) > 0.01) reasons.push("Scheduled hours do not match account rule");
  if (expectedHours > 0 && Math.abs(paidHours - expectedHours) > 0.01) reasons.push("Paid hours do not match expected payable hours");
  if (entry.status === "draft") reasons.push("Draft row");
  if (entry.status === "needs_review" || entry.requires_manual_review) reasons.push(entry.review_notes || "Needs review");
  for (const code of entry.exceptions ?? []) {
    const label = EXCEPTION_LABELS_EN[code] ?? code;
    if (!reasons.includes(label)) reasons.push(label);
  }

  const status = !payrollEligible
    ? "excluded_from_payroll"
    : reasons.some((reason) => reason.includes("Missing rate"))
      ? "missing_rate"
      : reasons.some((reason) => reason.includes("Missing schedule"))
        ? "missing_schedule_rule"
        : reasons.some((reason) => reason.toLowerCase().includes("hours"))
          ? "hours_mismatch"
          : entry.status === "draft"
            ? "draft"
            : reasons.length > 0
              ? "needs_review"
              : "valid";

  return { status, reasons: Array.from(new Set(reasons)), expectedHours, paidHours, scheduledHours, payrollEligible };
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

function StatusBadge({ status }: { status: string }) {
  const { isEn } = useLanguage();
  const className = status === "paid"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
    : status === "approved"
      ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
      : status === "locked"
        ? "border-slate-300 bg-slate-950 text-white dark:border-slate-700 dark:bg-slate-100 dark:text-slate-950"
        : status === "needs_review" || status === "in_review"
          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          : status === "reviewed"
            ? "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200"
            : "border-border bg-muted/60 text-muted-foreground";
  return <Badge className={className}>{getStatusLabel(status, isEn)}</Badge>;
}

function SourceBadge({ source }: { source?: string | null }) {
  const { isEn } = useLanguage();
  return source === "schedule_rule"
    ? <Badge className="border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200">{isEn ? "Synced" : "Sincronizado"}</Badge>
    : <Badge className="border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">{isEn ? "Manual Commercial" : "Comercial Manual"}</Badge>;
}

function entryToDraft(entry: PayrollEntryRow, isEn: boolean): EntryDraft {
  return {
    adjusted_hours: String(entry.adjusted_hours ?? entry.base_hours ?? 0),
    pay_rate: String(entry.pay_rate ?? 0),
    status: entry.status,
    review_notes: isKnownSystemPayrollNote(entry.review_notes)
      ? translatePayrollNote(entry.review_notes, isEn)
      : (entry.review_notes ?? ""),
    notes: isKnownSystemPayrollNote(entry.notes)
      ? translatePayrollNote(entry.notes, isEn)
      : (entry.notes ?? ""),
  };
}

function emptyAdjustment(): AdjustmentDraft {
  return { adjustment_type: "add_hours", hours_delta: "0", amount_delta: "0", reason: "", internal_note: "" };
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof WalletCards }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="size-5" /></div>
        <div>
          <p className="text-xs font-black uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-black">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PayrollPeriodPage() {
  const { isEn } = useLanguage();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const periodId = params.id;
  const [period, setPeriod] = useState<PayrollPeriodRow | null>(null);
  const [entries, setEntries] = useState<PayrollEntryRow[]>([]);
  const [adjustments, setAdjustments] = useState<PayrollAdjustmentRow[]>([]);
  const [accounts, setAccounts] = useState<CommercialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? entries[0] ?? null;
  const [entryDraft, setEntryDraft] = useState<EntryDraft | null>(null);
  const [adjustmentDraft, setAdjustmentDraft] = useState<AdjustmentDraft>(() => emptyAdjustment());
  const [message, setMessage] = useState<BilingualMessage | null>(null);
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("pay_period");
  const [selectedDate, setSelectedDate] = useState(todayLocalDateString());
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [cleanerFilter, setCleanerFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [dataFilter, setDataFilter] = useState("all");
  const [paidFilter, setPaidFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [showDetailedEntries, setShowDetailedEntries] = useState(false);

  function applyDetails(details: Awaited<ReturnType<typeof fetchPayrollPeriodDetails>>) {
    setPeriod(details.period);
    setEntries(details.entries);
    setAdjustments(details.adjustments);
    const nextSelected = details.entries.find((entry) => entry.id === selectedEntryId) ?? details.entries[0] ?? null;
    setSelectedEntryId(nextSelected?.id ?? null);
    setEntryDraft(nextSelected ? entryToDraft(nextSelected, isEn) : null);
    setAdjustmentDraft(emptyAdjustment());
  }

  async function load() {
    setLoading(true);
    const [details, accountRows] = await Promise.all([fetchPayrollPeriodDetails(periodId), fetchCommercialAccounts()]);
    setAccounts(accountRows);
    applyDetails(details);
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchPayrollPeriodDetails(periodId), fetchCommercialAccounts()]).then(([details, accountRows]) => {
      if (!mounted) return;
      setAccounts(accountRows);
      setPeriod(details.period);
      setEntries(details.entries);
      setAdjustments(details.adjustments);
      const nextSelected = details.entries[0] ?? null;
      setSelectedEntryId(nextSelected?.id ?? null);
      setEntryDraft(nextSelected ? entryToDraft(nextSelected, isEn) : null);
      setAdjustmentDraft(emptyAdjustment());
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [periodId]);

  useEffect(() => {
    setEntryDraft((prev) => {
      if (!prev) return prev;
      const nextReviewNotes = isKnownSystemPayrollNote(prev.review_notes)
        ? translatePayrollNote(prev.review_notes, isEn)
        : prev.review_notes;
      const nextNotes = isKnownSystemPayrollNote(prev.notes)
        ? translatePayrollNote(prev.notes, isEn)
        : prev.notes;
      if (nextReviewNotes === prev.review_notes && nextNotes === prev.notes) return prev;
      return { ...prev, review_notes: nextReviewNotes, notes: nextNotes };
    });
  }, [isEn]);

  function selectEntry(entry: PayrollEntryRow | undefined) {
    setSelectedEntryId(entry?.id ?? null);
    setEntryDraft(entry ? entryToDraft(entry, isEn) : null);
    setAdjustmentDraft(emptyAdjustment());
  }

  const filterOptions = useMemo(() => ({
    cleaners: Array.from(new Set(entries.map((entry) => entry.cleaner_name ?? "Unassigned"))).sort(),
    accounts: Array.from(new Set(entries.map((entry) => entry.account_name))).sort(),
  }), [entries]);
  const accountsByName = useMemo(() => new Map(accounts.map((account) => [account.name.toLowerCase(), account])), [accounts]);

  const filteredEntries = useMemo(() => {
    const range = getDateFilterRange(dateFilterMode, selectedDate, period, customStartDate, customEndDate);
    return entries.filter((entry) => {
      const serviceDate = entry.service_date;
      const matchesDate = !serviceDate || (serviceDate >= range.start && serviceDate <= range.end);
      const matchesCleaner = cleanerFilter === "all" || (entry.cleaner_name ?? "Unassigned") === cleanerFilter;
      const matchesAccount = accountFilter === "all" || entry.account_name === accountFilter;
      const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
      const matchesReview = reviewFilter === "all" || (reviewFilter === "manual_review" ? Boolean(entry.requires_manual_review || entry.status === "needs_review") : !entry.requires_manual_review && entry.status !== "needs_review");
      const hasMissingData = (entry.exceptions ?? []).some((code) => ["missing_cleaner", "missing_pay_rate", "missing_schedule", "missing_anchor_date", "zero_hours"].includes(code));
      const matchesData = dataFilter === "all" || (dataFilter === "missing" ? hasMissingData : !hasMissingData);
      const isPaid = entry.status === "paid" || Boolean(entry.paid_at);
      const matchesPaid = paidFilter === "all" || (paidFilter === "paid" ? isPaid : !isPaid);
      const query = search.trim().toLowerCase();
      const matchesSearch = !query || [
        entry.account_name,
        entry.cleaner_name,
        entry.city,
        entry.service_date,
        entry.scheduled_day,
        entry.status,
        entry.review_notes,
        entry.notes,
        translatePayrollNote(entry.review_notes, isEn),
        translatePayrollNote(entry.notes, isEn),
        ...(entry.exceptions ?? []),
      ].some((value) => String(value ?? "").toLowerCase().includes(query));
      return matchesDate && matchesCleaner && matchesAccount && matchesStatus && matchesReview && matchesData && matchesPaid && matchesSearch;
    });
  }, [accountFilter, cleanerFilter, customEndDate, customStartDate, dataFilter, dateFilterMode, entries, isEn, paidFilter, period, reviewFilter, search, selectedDate, statusFilter]);

  const rowValidations = useMemo(() => new Map(filteredEntries.map((entry) => [
    entry.id,
    validateCommercialPayrollRow(entry, accountsByName.get(entry.account_name.toLowerCase())),
  ])), [accountsByName, filteredEntries]);

  const grouped = useMemo(() => {
    const map = new Map<string, { cleaner: string; baseHours: number; adjustedHours: number; finalPay: number; estimatedPay: number; adjustments: number; serviceDates: Set<string>; accounts: Set<string>; status: string; entries: PayrollEntryRow[]; requiresReview: boolean; manualReviewCount: number; excludedCount: number; paymentMethod: string | null }>();
    for (const entry of filteredEntries) {
      const cleaner = entry.cleaner_name ?? "Unassigned";
      const validation = rowValidations.get(entry.id);
      const group = map.get(cleaner) ?? { cleaner, baseHours: 0, adjustedHours: 0, finalPay: 0, estimatedPay: 0, adjustments: 0, serviceDates: new Set<string>(), accounts: new Set<string>(), status: "draft", entries: [], requiresReview: false, manualReviewCount: 0, excludedCount: 0, paymentMethod: entry.payment_method ?? null };
      group.baseHours += numberValue(entry.base_hours);
      group.adjustedHours += numberValue(entry.adjusted_hours ?? entry.base_hours);
      group.finalPay += payableAmount(entry);
      group.estimatedPay += validation?.payrollEligible === false ? 0 : numberValue(entry.estimated_amount);
      group.adjustments += numberValue(entry.adjustment_amount);
      group.accounts.add(entry.account_name);
      if (entry.service_date) group.serviceDates.add(entry.service_date);
      group.entries.push(entry);
      group.requiresReview ||= Boolean(validation && validation.status !== "valid");
      if (validation && validation.status !== "valid") group.manualReviewCount += 1;
      if (validation?.status === "excluded_from_payroll") group.excludedCount += 1;
      group.paymentMethod ||= entry.payment_method ?? null;
      if (group.entries.some((item) => item.status === "paid")) group.status = "paid";
      else if (group.entries.every((item) => item.status === "approved" || item.status === "paid")) group.status = "approved";
      else if (group.entries.some((item) => item.status === "needs_review")) group.status = "needs_review";
      else if (group.entries.some((item) => item.status === "reviewed")) group.status = "reviewed";
      map.set(cleaner, group);
    }
    return Array.from(map.values()).sort((a, b) => b.finalPay - a.finalPay);
  }, [filteredEntries, rowValidations]);

  const summary = useMemo(() => {
    const validations = filteredEntries.map((entry) => rowValidations.get(entry.id)).filter(Boolean);
    return {
      totalHours: filteredEntries.reduce((sum, entry) => sum + numberValue(entry.adjusted_hours ?? entry.base_hours), 0),
      totalBaseHours: filteredEntries.reduce((sum, entry) => sum + numberValue(entry.base_hours), 0),
      totalEstimated: filteredEntries.reduce((sum, entry) => sum + (isCommercialPayrollEligible(entry.cleaner_name) ? numberValue(entry.estimated_amount) : 0), 0),
      totalAdjustments: filteredEntries.reduce((sum, entry) => sum + (isCommercialPayrollEligible(entry.cleaner_name) ? numberValue(entry.adjustment_amount) : 0), 0),
      totalFinal: filteredEntries.reduce((sum, entry) => sum + payableAmount(entry), 0),
      needsReview: validations.filter((validation) => validation?.status !== "valid").length,
      missingRates: validations.filter((validation) => validation?.status === "missing_rate").length,
      missingScheduleRules: validations.filter((validation) => validation?.status === "missing_schedule_rule").length,
      hoursMismatches: validations.filter((validation) => validation?.status === "hours_mismatch").length,
      excludedMixedRoute: validations.filter((validation) => validation?.status === "excluded_from_payroll").length,
      expectedHours: validations.reduce((sum, validation) => sum + numberValue(validation?.expectedHours), 0),
      approved: filteredEntries.filter((entry) => entry.status === "approved").length,
      paid: filteredEntries.filter((entry) => entry.status === "paid").length,
    };
  }, [filteredEntries, rowValidations]);
  const activeRange = getDateFilterRange(dateFilterMode, selectedDate, period, customStartDate, customEndDate);
  const selectedAccount = accountFilter === "all" ? null : accountsByName.get(accountFilter.toLowerCase()) ?? null;

  async function saveSelectedEntry() {
    if (!selectedEntry || !entryDraft) return;
    await updatePayrollEntry(selectedEntry, {
      adjusted_hours: Number(entryDraft.adjusted_hours || 0),
      pay_rate: Number(entryDraft.pay_rate || 0),
      status: entryDraft.status,
      review_notes: entryDraft.review_notes || null,
      notes: entryDraft.notes || null,
      review_status: entryDraft.status === "reviewed" || entryDraft.status === "approved" || entryDraft.status === "paid" ? "reviewed" : selectedEntry.review_status,
    });
    setMessage({
      en: "Final pay includes manual edits for this period only.",
      es: "El pago final incluye ediciones manuales solo para este período.",
    });
    await load();
  }

  async function addAdjustment() {
    if (!selectedEntry) return;
    if (!adjustmentDraft.reason.trim()) {
      setMessage({
        en: "Add a clear reason before saving the adjustment.",
        es: "Agrega un motivo claro antes de guardar el ajuste.",
      });
      return;
    }
    await addPayrollAdjustment(selectedEntry, {
      adjustment_type: adjustmentDraft.adjustment_type,
      hours_delta: Number(adjustmentDraft.hours_delta || 0),
      amount_delta: Number(adjustmentDraft.amount_delta || 0),
      reason: adjustmentDraft.reason.trim(),
      internal_note: adjustmentDraft.internal_note || null,
    });
    setMessage({
      en: "Adjustment added for this pay period only.",
      es: "Ajuste agregado únicamente para este período de pago.",
    });
    await load();
  }

  async function setPeriodStatus(status: PayrollPeriodRow["status"]) {
    if (!period) return;
    if (status === "approved" && entries.some((entry) => entry.status === "needs_review" || (entry.requires_manual_review && entry.review_status !== "reviewed"))) {
      setMessage({
        en: "Review hours before approving. Some teams still require manual review.",
        es: "Revisa las horas antes de aprobar. Algunos equipos aún requieren revisión manual.",
      });
      return;
    }
    if (
      status === "locked" &&
      !window.confirm(
        isEn
          ? "Lock this period once payments are completed? Locked periods should not be recalculated."
          : "¿Bloquear este período una vez completados los pagos? Los períodos bloqueados no deben recalcularse.",
      )
    ) {
      return;
    }
    await updatePeriodStatus(period, status);
    setMessage({
      en: `Payroll period marked ${getStatusLabel(status, true)}.`,
      es: `Período de nómina marcado como ${getStatusLabel(status, false)}.`,
    });
    await load();
  }

  async function recalculate() {
    if (!period) return;
    if (["paid", "locked"].includes(period.status)) {
      setMessage({
        en: "This period is already paid or locked. Create an adjustment instead.",
        es: "Este período ya está pagado o bloqueado. Crea un ajuste en su lugar.",
      });
      return;
    }
    await generatePayrollForPeriod({ startDate: period.start_date, endDate: period.end_date, label: period.label ?? `${period.start_date}-${period.end_date}` }, { forceRecalculate: true });
    setMessage({
      en: "Recalculated from current schedules.",
      es: "Recalculado a partir de los horarios actuales.",
    });
    await load();
  }

  function exportCsv() {
    const rows = [
      isEn
        ? ["Cleaner", "Account", "City", "Service Date", "Scheduled Day", "Base Hours", "Final Hours", "Pay Rate", "Final Pay", "Status", "Exceptions"]
        : ["Cleaner", "Cuenta", "Ciudad", "Fecha de Servicio", "Día Programado", "Horas Base", "Horas Finales", "Tarifa", "Pago Final", "Estado", "Excepciones"],
      ...filteredEntries.map((entry) => [
        translateCleanerDisplay(entry.cleaner_name, isEn),
        translateAccountNameDisplay(entry.account_name, isEn),
        entry.city ?? "",
        entry.service_date ?? "",
        entry.scheduled_day ? translateScheduledDay(entry.scheduled_day, isEn) : "",
        String(entry.base_hours ?? 0),
        String(entry.adjusted_hours ?? 0),
        String(entry.pay_rate ?? 0),
        String(entry.final_amount ?? 0),
        getStatusLabel(entry.status, isEn),
        (entry.exceptions ?? []).map((code) => translatePayrollNote(EXCEPTION_LABELS_EN[code] ?? code, isEn)).join("; "),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `commercial-payroll-${period?.start_date ?? "period"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!period && !loading) {
    return (
      <DashboardShell userEmail="pristinecleanersoc@gmail.com">
        <p className="font-bold">{isEn ? "Payroll period not found." : "Período de nómina no encontrado."}</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell userEmail="pristinecleanersoc@gmail.com">
      <div className="space-y-5">
        <section className="py-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Button className="mb-3" size="sm" type="button" variant="outline" onClick={() => router.push("/commercial/payroll")}>
                <ArrowLeft className="size-4" /> {isEn ? "Back" : "Volver"}
              </Button>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-primary">
                <WalletCards className="size-4" /> {isEn ? "Commercial Payroll Period" : "Período de Nómina Comercial"}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-normal">{period?.label ?? (isEn ? "Payroll period" : "Período de nómina")}</h1>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                {period
                  ? (isEn
                      ? `${dateLabel(period.start_date)} to ${dateLabel(period.end_date)}`
                      : `${dateLabel(period.start_date)} al ${dateLabel(period.end_date)}`)
                  : (isEn ? "Loading period" : "Cargando período")}{" "}
                · {isEn ? "Review commercial hours before approval or paid state." : "Revisa las horas comerciales antes de aprobar o marcar como pagado."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {period ? <StatusBadge status={period.status} /> : null}
              <Button type="button" variant="outline" onClick={recalculate}>
                <RefreshCw className="size-4" /> {isEn ? "Recalculate from schedules" : "Recalcular desde horarios"}
              </Button>
              <Button type="button" variant="outline" onClick={exportCsv}>
                <Download className="size-4" /> {isEn ? "Export CSV" : "Exportar CSV"}
              </Button>
            </div>
          </div>
          {message ? (
            <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-bold">
              {isEn ? message.en : message.es}
            </p>
          ) : null}
        </section>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Metric icon={FileClock} label={isEn ? "Total hours" : "Horas totales"} value={summary.totalHours.toFixed(2)} />
          <Metric icon={WalletCards} label={isEn ? "Estimated" : "Estimado"} value={money(summary.totalEstimated)} />
          <Metric icon={PencilLine} label={isEn ? "Adjustments" : "Ajustes"} value={money(summary.totalAdjustments)} />
          <Metric icon={CheckCircle2} label={isEn ? "Final payroll" : "Nómina final"} value={money(summary.totalFinal)} />
          <Metric icon={AlertTriangle} label={isEn ? "Pending review" : "Revisión pendiente"} value={String(summary.needsReview)} />
          <Metric icon={LockKeyhole} label={isEn ? "Paid entries" : "Registros pagados"} value={String(summary.paid)} />
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>{isEn ? "Payment Approval" : "Aprobación de Pagos"}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="button" variant="outline" onClick={() => period && setPeriodStatus("in_review")}>
                {isEn ? "Review exceptions" : "Revisar excepciones"}
              </Button>
              <Button size="sm" type="button" onClick={() => period && setPeriodStatus("approved")}>
                {isEn ? "Approve payroll" : "Aprobar nómina"}
              </Button>
              <Button size="sm" type="button" variant="outline" onClick={() => period && setPeriodStatus("paid")}>
                {isEn ? "Mark as paid" : "Marcar como pagado"}
              </Button>
              <Button size="sm" type="button" variant="outline" onClick={() => period && setPeriodStatus("locked")}>
                {isEn ? "Lock period" : "Bloquear período"}
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>{isEn ? "Payroll Filters" : "Filtros de Nómina"}</CardTitle>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {isEn
                ? "Filter by date, team, account, review state, or missing data without changing payroll records."
                : "Filtra por fecha, equipo, cuenta, estado de revisión o datos faltantes sin modificar los registros de nómina."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Date view" : "Vista de fecha"}</span>
                <select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={dateFilterMode} onChange={(event) => setDateFilterMode(event.target.value as DateFilterMode)}>
                  <option value="day">{isEn ? "Day" : "Día"}</option>
                  <option value="week">{isEn ? "Week" : "Semana"}</option>
                  <option value="pay_period">{isEn ? "15 Days / Pay Period" : "15 Días / Período de Pago"}</option>
                  <option value="month">{isEn ? "Month" : "Mes"}</option>
                  <option value="custom">{isEn ? "Custom Range" : "Rango Personalizado"}</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Selected date" : "Fecha seleccionada"}</span>
                <input className="h-10 w-full rounded-md border bg-background px-3 font-bold" type="date" lang="en-US" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Custom start" : "Inicio personalizado"}</span>
                <input className="h-10 w-full rounded-md border bg-background px-3 font-bold" disabled={dateFilterMode !== "custom"} type="date" lang="en-US" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Custom end" : "Fin personalizado"}</span>
                <input className="h-10 w-full rounded-md border bg-background px-3 font-bold" disabled={dateFilterMode !== "custom"} type="date" lang="en-US" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} />
              </label>
              <div className="rounded-md border bg-muted/15 px-3 py-2">
                <p className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Visible entries" : "Registros visibles"}</p>
                <p className="text-lg font-black">{filteredEntries.length}/{entries.length}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Cleaner/team" : "Cleaner / equipo"}</span>
                <select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={cleanerFilter} onChange={(event) => setCleanerFilter(event.target.value)}>
                  <option value="all">{isEn ? "All teams" : "Todos los equipos"}</option>
                  {filterOptions.cleaners.map((cleaner) => <option key={cleaner} value={cleaner}>{translateCleanerDisplay(cleaner, isEn)}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Account" : "Cuenta"}</span>
                <select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
                  <option value="all">{isEn ? "All accounts" : "Todas las cuentas"}</option>
                  {filterOptions.accounts.map((account) => <option key={account} value={account}>{translateAccountNameDisplay(account, isEn)}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Status" : "Estado"}</span>
                <select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">{isEn ? "All statuses" : "Todos los estados"}</option>
                  <option value="draft">{getStatusLabel("draft", isEn)}</option>
                  <option value="needs_review">{getStatusLabel("needs_review", isEn)}</option>
                  <option value="reviewed">{getStatusLabel("reviewed", isEn)}</option>
                  <option value="approved">{getStatusLabel("approved", isEn)}</option>
                  <option value="paid">{getStatusLabel("paid", isEn)}</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Manual review" : "Revisión manual"}</span>
                <select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}>
                  <option value="all">{isEn ? "All" : "Todos"}</option>
                  <option value="manual_review">{isEn ? "Manual review" : "Revisión manual"}</option>
                  <option value="clear">{isEn ? "Clear" : "Sin observaciones"}</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Missing data" : "Datos faltantes"}</span>
                <select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={dataFilter} onChange={(event) => setDataFilter(event.target.value)}>
                  <option value="all">{isEn ? "All" : "Todos"}</option>
                  <option value="missing">{isEn ? "Missing data" : "Datos faltantes"}</option>
                  <option value="complete">{isEn ? "Complete" : "Completos"}</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Paid state" : "Estado de pago"}</span>
                <select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={paidFilter} onChange={(event) => setPaidFilter(event.target.value)}>
                  <option value="all">{isEn ? "All" : "Todos"}</option>
                  <option value="unpaid">{isEn ? "Unpaid" : "No pagado"}</option>
                  <option value="paid">{isEn ? "Paid" : "Pagado"}</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Search" : "Buscar"}</span>
                <input className="h-10 w-full rounded-md border bg-background px-3 font-bold" placeholder={isEn ? "Account, team, review" : "Cuenta, equipo, revisión"} value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>{isEn ? "Filtered schedule review" : "Revisión de horario filtrado"}</CardTitle>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {isEn
                ? "Use this view to confirm that scheduled hours, paid hours, and payroll totals match the selected commercial accounts."
                : "Usa esta vista para confirmar que las horas programadas, las horas pagadas y los totales de nómina coincidan con las cuentas comerciales seleccionadas."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Metric icon={FileClock} label={isEn ? "Filtered rows" : "Filas filtradas"} value={String(filteredEntries.length)} />
              <Metric icon={FileClock} label={isEn ? "Scheduled hours" : "Horas programadas"} value={summary.totalBaseHours.toFixed(2)} />
              <Metric icon={FileClock} label={isEn ? "Paid hours" : "Horas pagadas"} value={summary.totalHours.toFixed(2)} />
              <Metric icon={CheckCircle2} label={isEn ? "Payable amount" : "Monto a pagar"} value={money(summary.totalFinal)} />
              <Metric icon={AlertTriangle} label={isEn ? "Rows needing review" : "Filas por revisar"} value={String(summary.needsReview)} />
              <Metric icon={AlertTriangle} label={isEn ? "Missing rates" : "Tarifas faltantes"} value={String(summary.missingRates)} />
              <Metric icon={AlertTriangle} label={isEn ? "Missing schedule rules" : "Sin regla de horario"} value={String(summary.missingScheduleRules)} />
              <Metric icon={AlertTriangle} label={isEn ? "Hours mismatches" : "Discrepancias de horas"} value={String(summary.hoursMismatches)} />
              <Metric icon={AlertTriangle} label={isEn ? "Excluded mixed-route rows" : "Filas excluidas (ruta mixta)"} value={String(summary.excludedMixedRoute)} />
              <Metric icon={WalletCards} label={isEn ? "Expected account hours" : "Horas esperadas de cuenta"} value={summary.expectedHours.toFixed(2)} />
            </div>
            <div className="grid gap-3 p-1 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Date range" : "Rango de fechas"}</p>
                <p className="font-black">
                  {isEn
                    ? `${dateLabel(activeRange.start)} to ${dateLabel(activeRange.end)}`
                    : `${dateLabel(activeRange.start)} al ${dateLabel(activeRange.end)}`}
                </p>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Cleaner/team" : "Cleaner / equipo"}</p>
                <p className="font-black">{cleanerFilter === "all" ? (isEn ? "All teams" : "Todos los equipos") : translateCleanerDisplay(cleanerFilter, isEn)}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Account" : "Cuenta"}</p>
                <p className="font-black">{accountFilter === "all" ? (isEn ? "All accounts" : "Todas las cuentas") : translateAccountNameDisplay(accountFilter, isEn)}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Account rule" : "Regla de cuenta"}</p>
                <p className="font-black">
                  {selectedAccount
                    ? `${parseHours(selectedAccount.hours).toFixed(2)} ${isEn ? "hrs" : "h"} · ${translateFrequencyDisplay(selectedAccount.frequency, isEn)}`
                    : (isEn ? "Select one account for rule detail" : "Selecciona una cuenta para ver detalle de regla")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Payroll by Team" : "Nómina por Equipo"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[1180px] border-collapse text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3">{isEn ? "Cleaner / Team" : "Cleaner / Equipo"}</th>
                        <th className="px-3 py-3">{isEn ? "Accounts served" : "Cuentas atendidas"}</th>
                        <th className="px-3 py-3">{isEn ? "Service dates" : "Fechas de servicio"}</th>
                        <th className="px-3 py-3 text-right">{isEn ? "Base hours" : "Horas base"}</th>
                        <th className="px-3 py-3 text-right">{isEn ? "Adjusted hours" : "Horas ajustadas"}</th>
                        <th className="px-3 py-3 text-right">{isEn ? "Adjustments" : "Ajustes"}</th>
                        <th className="px-3 py-3 text-right">{isEn ? "Final" : "Final"}</th>
                        <th className="px-3 py-3">{isEn ? "Review" : "Revisión"}</th>
                        <th className="px-3 py-3">{isEn ? "Payment" : "Pago"}</th>
                        <th className="px-3 py-3 text-center">{isEn ? "Status" : "Estado"}</th>
                        <th className="px-3 py-3">{isEn ? "Actions" : "Acciones"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td className="px-3 py-8 text-center font-bold text-muted-foreground" colSpan={11}>
                            {isEn ? "Loading payroll entries..." : "Cargando registros de nómina..."}
                          </td>
                        </tr>
                      ) : null}
                      {!loading && grouped.length === 0 ? (
                        <tr>
                          <td className="px-3 py-10 text-center" colSpan={11}>
                            <div className="mx-auto max-w-md">
                              <AlertTriangle className="mx-auto size-7 text-muted-foreground" />
                              <p className="mt-3 font-black">{isEn ? "No teams match these filters." : "Ningún equipo coincide con estos filtros."}</p>
                              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                                {isEn
                                  ? "Clear a filter or widen the date range to see commercial payroll entries."
                                  : "Limpia algún filtro o amplía el rango de fechas para ver registros de nómina comercial."}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      {grouped.map((group) => (
                        <Fragment key={group.cleaner}>
                          <tr className="cursor-pointer border-t hover:bg-accent/40" onClick={() => { selectEntry(group.entries[0]); setExpandedTeam(expandedTeam === group.cleaner ? null : group.cleaner); }}>
                            <td className="px-3 py-3 font-black">{translateCleanerDisplay(group.cleaner, isEn)}</td>
                            <td className="px-3 py-3 font-bold">{group.accounts.size}</td>
                            <td className="px-3 py-3 font-bold">{group.serviceDates.size}</td>
                            <td className="px-3 py-3 text-right font-bold">{group.baseHours.toFixed(2)}</td>
                            <td className="px-3 py-3 text-right font-bold">{group.adjustedHours.toFixed(2)}</td>
                            <td className="px-3 py-3 text-right font-bold">{money(group.adjustments)}</td>
                            <td className="px-3 py-3 text-right font-black">
                              {money(group.finalPay)}
                              {group.excludedCount ? (
                                <p className="text-xs font-bold text-muted-foreground">
                                  {group.excludedCount} {isEn ? "excluded" : "excluidos"}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-3 py-3">
                              {group.excludedCount ? (
                                <Badge className="bg-slate-900 text-white">{isEn ? "Mixed route · Not payable here" : "Ruta mixta · No pagable aquí"}</Badge>
                              ) : group.requiresReview ? (
                                <Badge className="bg-amber-100 text-amber-800">
                                  {group.manualReviewCount} {isEn ? "review" : "por revisar"}
                                </Badge>
                              ) : (
                                <Badge variant="outline">{isEn ? "Clear" : "Listo"}</Badge>
                              )}
                            </td>
                            <td className="px-3 py-3 font-bold">{group.paymentMethod ?? "-"}</td>
                            <td className="px-3 py-3 text-center"><div className="flex justify-center"><StatusBadge status={group.status} /></div></td>
                            <td className="px-3 py-3">
                              <Button size="sm" type="button" variant="outline">
                                {expandedTeam === group.cleaner ? (isEn ? "Hide" : "Ocultar") : (isEn ? "Open" : "Abrir")}
                              </Button>
                            </td>
                          </tr>
                          {expandedTeam === group.cleaner ? (
                            <tr className="border-t bg-muted/20" key={`${group.cleaner}-details`}>
                              <td className="px-3 py-3" colSpan={11}>
                                <div className="overflow-x-auto rounded-md border bg-background">
                                  <table className="w-full min-w-[1040px] border-collapse text-xs">
                                    <thead className="bg-muted/50 text-left uppercase text-muted-foreground">
                                      <tr>
                                        <th className="px-3 py-2">{isEn ? "Account" : "Cuenta"}</th>
                                        <th className="px-3 py-2">{isEn ? "Service date" : "Fecha de servicio"}</th>
                                        <th className="px-3 py-2">{isEn ? "Day" : "Día"}</th>
                                        <th className="px-3 py-2">{isEn ? "Frequency" : "Frecuencia"}</th>
                                        <th className="px-3 py-2 text-right">{isEn ? "Base hours" : "Horas base"}</th>
                                        <th className="px-3 py-2 text-right">{isEn ? "Adjusted" : "Ajustadas"}</th>
                                        <th className="px-3 py-2 text-right">{isEn ? "Rate" : "Tarifa"}</th>
                                        <th className="px-3 py-2 text-right">{isEn ? "Final" : "Final"}</th>
                                        <th className="px-3 py-2">{isEn ? "Exceptions" : "Excepciones"}</th>
                                        <th className="px-3 py-2 text-center">{isEn ? "Status" : "Estado"}</th>
                                        <th className="px-3 py-2">{isEn ? "Notes" : "Notas"}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {group.entries.map((entry) => {
                                        const validation = rowValidations.get(entry.id);
                                        const rawNote = entry.notes ?? entry.review_notes ?? validation?.reasons[0];
                                        return (
                                          <tr className={`cursor-pointer border-t hover:bg-accent/40 ${selectedEntry?.id === entry.id ? "bg-accent/50" : ""}`} key={entry.id} onClick={() => selectEntry(entry)}>
                                            <td className="px-3 py-2 font-black">{translateAccountNameDisplay(entry.account_name, isEn)}</td>
                                            <td className="px-3 py-2">{dateLabel(entry.service_date)}</td>
                                            <td className="px-3 py-2">{translateScheduledDay(entry.scheduled_day, isEn)}</td>
                                            <td className="px-3 py-2"><SourceBadge source={entry.source} /></td>
                                            <td className="px-3 py-2 text-right font-bold">{numberValue(entry.base_hours).toFixed(2)}</td>
                                            <td className="px-3 py-2 text-right font-bold">{numberValue(entry.adjusted_hours ?? entry.base_hours).toFixed(2)}</td>
                                            <td className="px-3 py-2 text-right font-bold">{money(validation?.payrollEligible === false ? 0 : entry.pay_rate)}</td>
                                            <td className="px-3 py-2 text-right font-black">{money(payableAmount(entry))}</td>
                                            <td className="px-3 py-2">
                                              <div className="flex flex-wrap gap-1">
                                                {(validation?.reasons ?? []).slice(0, 3).map((reason) => (
                                                  <Badge className={validation?.status === "excluded_from_payroll" ? "bg-slate-900 text-white" : "bg-amber-100 text-amber-800"} key={reason}>
                                                    {translatePayrollNote(reason, isEn)}
                                                  </Badge>
                                                ))}
                                              </div>
                                            </td>
                                            <td className="px-3 py-2 text-center"><div className="flex justify-center"><StatusBadge status={entry.status} /></div></td>
                                            <td className="px-3 py-2">{rawNote ? translatePayrollNote(rawNote, isEn) : "-"}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle>{isEn ? "Detailed Entries" : "Registros Detallados"}</CardTitle>
                <Button size="sm" type="button" variant="outline" onClick={() => setShowDetailedEntries((open) => !open)}>
                  {showDetailedEntries ? (isEn ? "Hide entries" : "Ocultar registros") : (isEn ? "Show entries" : "Mostrar registros")}
                </Button>
              </CardHeader>
              {showDetailedEntries ? (
                <CardContent>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[1120px] border-collapse text-sm">
                      <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-3">{isEn ? "Account" : "Cuenta"}</th>
                          <th className="px-3 py-3">{isEn ? "Cleaner" : "Cleaner"}</th>
                          <th className="px-3 py-3">{isEn ? "City" : "Ciudad"}</th>
                          <th className="px-3 py-3">{isEn ? "Service date" : "Fecha de servicio"}</th>
                          <th className="px-3 py-3">{isEn ? "Scheduled day" : "Día programado"}</th>
                          <th className="px-3 py-3 text-right">{isEn ? "Base" : "Base"}</th>
                          <th className="px-3 py-3 text-right">{isEn ? "Final hours" : "Horas finales"}</th>
                          <th className="px-3 py-3 text-right">{isEn ? "Rate" : "Tarifa"}</th>
                          <th className="px-3 py-3 text-right">{isEn ? "Subtotal" : "Subtotal"}</th>
                          <th className="px-3 py-3">{isEn ? "Exceptions" : "Excepciones"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEntries.map((entry) => {
                          const validation = rowValidations.get(entry.id);
                          return (
                            <tr className={`cursor-pointer border-t hover:bg-accent/40 ${selectedEntry?.id === entry.id ? "bg-accent/50" : ""}`} key={entry.id} onClick={() => selectEntry(entry)}>
                              <td className="px-3 py-3 font-black">{translateAccountNameDisplay(entry.account_name, isEn)}</td>
                              <td className="px-3 py-3 font-bold">{translateCleanerDisplay(entry.cleaner_name, isEn)}</td>
                              <td className="px-3 py-3">{entry.city ?? "-"}</td>
                              <td className="px-3 py-3">{dateLabel(entry.service_date)}</td>
                              <td className="px-3 py-3">{translateScheduledDay(entry.scheduled_day, isEn)}</td>
                              <td className="px-3 py-3 text-right font-bold">{numberValue(entry.base_hours).toFixed(2)}</td>
                              <td className="px-3 py-3 text-right font-bold">{numberValue(entry.adjusted_hours ?? entry.base_hours).toFixed(2)}</td>
                              <td className="px-3 py-3 text-right font-bold">{money(validation?.payrollEligible === false ? 0 : entry.pay_rate)}</td>
                              <td className="px-3 py-3 text-right">
                                <p className={payableAmount(entry) === 0 && numberValue(entry.base_hours) > 0 ? "font-black text-amber-700 dark:text-amber-200" : "font-black"}>
                                  {money(payableAmount(entry))}
                                </p>
                                {payableAmount(entry) === 0 && numberValue(entry.base_hours) > 0 ? (
                                  <p className="text-xs font-bold text-muted-foreground">
                                    {translatePayrollNote(validation?.reasons[0] ?? entry.review_notes ?? "Needs review", isEn)}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {(validation?.reasons ?? []).slice(0, 3).map((reason) => (
                                    <Badge className={validation?.status === "excluded_from_payroll" ? "bg-slate-900 text-white" : "bg-amber-100 text-amber-800"} key={reason}>
                                      {translatePayrollNote(reason, isEn)}
                                    </Badge>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              ) : null}
            </Card>

            <Card>
              <CardHeader><CardTitle>{isEn ? "Manual Adjustments" : "Ajustes Manuales"}</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3">{isEn ? "Cleaner" : "Cleaner"}</th>
                        <th className="px-3 py-3">{isEn ? "Type" : "Tipo"}</th>
                        <th className="px-3 py-3 text-right">{isEn ? "Hours" : "Horas"}</th>
                        <th className="px-3 py-3 text-right">{isEn ? "Amount" : "Monto"}</th>
                        <th className="px-3 py-3">{isEn ? "Reason" : "Motivo"}</th>
                        <th className="px-3 py-3">{isEn ? "Created" : "Creado"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustments.length === 0 ? (
                        <tr>
                          <td className="px-3 py-6 text-center font-bold text-muted-foreground" colSpan={6}>
                            {isEn ? "No manual adjustments yet." : "Aún no hay ajustes manuales."}
                          </td>
                        </tr>
                      ) : null}
                      {adjustments.map((adjustment) => (
                        <tr className="border-t" key={adjustment.id}>
                          <td className="px-3 py-3 font-black">{adjustment.cleaner_name ? translateCleanerDisplay(adjustment.cleaner_name, isEn) : "-"}</td>
                          <td className="px-3 py-3">{getAdjustmentTypeLabel(adjustment.adjustment_type, isEn)}</td>
                          <td className="px-3 py-3 text-right font-bold">{numberValue(adjustment.hours_delta).toFixed(2)}</td>
                          <td className="px-3 py-3 text-right font-bold">{money(adjustment.amount_delta)}</td>
                          <td className="px-3 py-3">{adjustment.reason ?? "-"}</td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{new Date(adjustment.created_at).toLocaleString(isEn ? "en-US" : "es-US")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="sticky top-20 h-fit space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Edit This Period Only" : "Editar Solo Este Período"}</CardTitle>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  {isEn ? "Period-only changes stay out of account defaults." : "Los cambios de este período no modifican los valores predeterminados de la cuenta."}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedEntry || !entryDraft ? (
                  <p className="text-sm font-bold text-muted-foreground">
                    {isEn
                      ? "Select an account entry to edit hours, rate, review, or adjustments."
                      : "Selecciona un registro para editar horas, tarifa, revisión o ajustes."}
                  </p>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-black uppercase text-muted-foreground">{translateCleanerDisplay(selectedEntry.cleaner_name, isEn)}</p>
                      <h2 className="mt-1 text-lg font-black">{translateAccountNameDisplay(selectedEntry.account_name, isEn)}</h2>
                      <p className="text-sm font-semibold text-muted-foreground">
                        {dateLabel(selectedEntry.service_date)} ·{" "}
                        {selectedEntry.scheduled_day
                          ? translateScheduledDay(selectedEntry.scheduled_day, isEn)
                          : (isEn ? "No scheduled day" : "Sin día programado")}
                      </p>
                    </div>
                    {!isCommercialPayrollEligible(selectedEntry.cleaner_name) ? (
                      <div className="rounded-md border border-slate-300 bg-slate-100 p-3 text-sm font-bold text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                        {isEn
                          ? "Mixed route · Not in commercial payroll. This row can stay visible for operations review, but payout remains $0.00."
                          : "Ruta mixta · No entra en nómina comercial. Esta fila permanece visible para revisión operativa, pero el pago es $0.00."}
                      </div>
                    ) : null}
                    {selectedEntry.requires_manual_review ? (
                      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                        {isEn
                          ? "This team requires manual hour review before approval."
                          : "Este equipo requiere revisión manual de horas antes de aprobar."}
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Final hours" : "Horas finales"}</span>
                        <input className="h-10 w-full rounded-md border bg-background px-3 font-bold" type="number" step="any" value={entryDraft.adjusted_hours} onChange={(event) => setEntryDraft({ ...entryDraft, adjusted_hours: event.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Pay rate" : "Tarifa de pago"}</span>
                        <input className="h-10 w-full rounded-md border bg-background px-3 font-bold" type="number" step="0.01" value={entryDraft.pay_rate} onChange={(event) => setEntryDraft({ ...entryDraft, pay_rate: event.target.value })} />
                      </label>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Payment status" : "Estado de pago"}</span>
                      <select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={entryDraft.status} onChange={(event) => setEntryDraft({ ...entryDraft, status: event.target.value as PayrollEntryRow["status"] })}>
                        <option value="draft">{getStatusLabel("draft", isEn)}</option>
                        <option value="needs_review">{getStatusLabel("needs_review", isEn)}</option>
                        <option value="reviewed">{getStatusLabel("reviewed", isEn)}</option>
                        <option value="approved">{getStatusLabel("approved", isEn)}</option>
                        <option value="paid">{getStatusLabel("paid", isEn)}</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-black uppercase text-muted-foreground">{isEn ? "Review notes" : "Notas de revisión"}</span>
                      <textarea
                        className="min-h-20 w-full rounded-md border bg-background p-3 text-sm font-bold"
                        value={entryDraft.review_notes}
                        onChange={(event) => setEntryDraft({ ...entryDraft, review_notes: event.target.value })}
                        placeholder={isEn ? "Confirmed hours, skipped visit, reschedule details..." : "Horas confirmadas, visita omitida, detalles de reagendamiento..."}
                      />
                    </label>
                    <Button className="w-full" type="button" onClick={saveSelectedEntry}>
                      {isEn ? "Save period-only edit" : "Guardar edición de este período"}
                    </Button>
                    <div className="grid grid-cols-3 gap-2">
                      <Button size="sm" type="button" variant="outline" onClick={() => selectedEntry && updateEntryStatus(selectedEntry, "reviewed").then(load)}>
                        {isEn ? "Reviewed" : "Revisado"}
                      </Button>
                      <Button size="sm" type="button" variant="outline" onClick={() => selectedEntry && updateEntryStatus(selectedEntry, "approved").then(load)}>
                        {isEn ? "Approve" : "Aprobar"}
                      </Button>
                      <Button size="sm" type="button" variant="outline" onClick={() => selectedEntry && updateEntryStatus(selectedEntry, "paid").then(load)}>
                        {isEn ? "Paid" : "Pagado"}
                      </Button>
                    </div>
                    <div className="border-t pt-4">
                      <h3 className="font-black">{isEn ? "Add manual adjustment" : "Agregar ajuste manual"}</h3>
                      <div className="mt-3 space-y-3">
                        <select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={adjustmentDraft.adjustment_type} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, adjustment_type: event.target.value })}>
                          {getAdjustmentTypes(isEn).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        <div className="grid grid-cols-2 gap-3">
                          <input className="h-10 rounded-md border bg-background px-3 font-bold" placeholder={isEn ? "Hours +/-" : "Horas +/-"} value={adjustmentDraft.hours_delta} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, hours_delta: event.target.value })} />
                          <input className="h-10 rounded-md border bg-background px-3 font-bold" placeholder={isEn ? "Amount +/-" : "Monto +/-"} value={adjustmentDraft.amount_delta} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, amount_delta: event.target.value })} />
                        </div>
                        <textarea
                          className="min-h-20 w-full rounded-md border bg-background p-3 text-sm font-bold"
                          placeholder={isEn ? "Reason, e.g. Team did not service account on May 6" : "Motivo, ej. El equipo no atendió la cuenta el 6 de mayo"}
                          value={adjustmentDraft.reason}
                          onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, reason: event.target.value })}
                        />
                        <Button className="w-full" type="button" variant="outline" onClick={addAdjustment}>
                          {isEn ? "Add adjustment" : "Agregar ajuste"}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground">
                      {isEn
                        ? "Default behavior: apply only to this pay period. Update account defaults from Commercial Accounts when contract terms truly change."
                        : "Comportamiento predeterminado: aplica solo a este período de pago. Actualiza los valores predeterminados en Cuentas Comerciales cuando cambien los términos del contrato."}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
            <Button asChild className="w-full" variant="outline">
              <Link href="/commercial/accounts">{isEn ? "Open Commercial Accounts" : "Abrir Cuentas Comerciales"}</Link>
            </Button>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileClock, LockKeyhole, PencilLine, RefreshCw, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
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

const adjustmentTypes = [
  ["add_hours", "Add hours"],
  ["remove_hours", "Remove hours"],
  ["add_bonus", "Add bonus"],
  ["deduction", "Deduction"],
  ["skipped_visit", "Skipped visit"],
  ["rescheduled_visit", "Rescheduled visit"],
  ["one_time_job", "One-time job"],
  ["holiday_adjustment", "Holiday adjustment"],
  ["correction", "Correction"],
  ["manual_override", "Manual override"],
] as const;

const statusLabels: Record<string, string> = {
  draft: "Draft",
  needs_review: "Needs Review",
  reviewed: "Reviewed",
  approved: "Approved",
  paid: "Paid",
  in_review: "In Review",
  partially_approved: "Partially Approved",
  locked: "Locked",
};

const exceptionLabels: Record<string, string> = {
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
    const label = exceptionLabels[code] ?? code;
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
  return <Badge className={className}>{statusLabels[status] ?? status}</Badge>;
}

function SourceBadge({ source }: { source?: string | null }) {
  return source === "schedule_rule"
    ? <Badge className="border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200">Synced</Badge>
    : <Badge className="border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">Manual Commercial</Badge>;
}

function entryToDraft(entry: PayrollEntryRow): EntryDraft {
  return {
    adjusted_hours: String(entry.adjusted_hours ?? entry.base_hours ?? 0),
    pay_rate: String(entry.pay_rate ?? 0),
    status: entry.status,
    review_notes: entry.review_notes ?? "",
    notes: entry.notes ?? "",
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
  const [message, setMessage] = useState<string | null>(null);
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
    setEntryDraft(nextSelected ? entryToDraft(nextSelected) : null);
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
      setEntryDraft(nextSelected ? entryToDraft(nextSelected) : null);
      setAdjustmentDraft(emptyAdjustment());
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [periodId]);

  function selectEntry(entry: PayrollEntryRow | undefined) {
    setSelectedEntryId(entry?.id ?? null);
    setEntryDraft(entry ? entryToDraft(entry) : null);
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
        ...(entry.exceptions ?? []),
      ].some((value) => String(value ?? "").toLowerCase().includes(query));
      return matchesDate && matchesCleaner && matchesAccount && matchesStatus && matchesReview && matchesData && matchesPaid && matchesSearch;
    });
  }, [accountFilter, cleanerFilter, customEndDate, customStartDate, dataFilter, dateFilterMode, entries, paidFilter, period, reviewFilter, search, selectedDate, statusFilter]);

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
    setMessage("Final pay includes manual edits for this period only.");
    await load();
  }

  async function addAdjustment() {
    if (!selectedEntry) return;
    if (!adjustmentDraft.reason.trim()) {
      setMessage("Add a clear reason before saving the adjustment.");
      return;
    }
    await addPayrollAdjustment(selectedEntry, {
      adjustment_type: adjustmentDraft.adjustment_type,
      hours_delta: Number(adjustmentDraft.hours_delta || 0),
      amount_delta: Number(adjustmentDraft.amount_delta || 0),
      reason: adjustmentDraft.reason.trim(),
      internal_note: adjustmentDraft.internal_note || null,
    });
    setMessage("Adjustment added for this pay period only.");
    await load();
  }

  async function setPeriodStatus(status: PayrollPeriodRow["status"]) {
    if (!period) return;
    if (status === "approved" && entries.some((entry) => entry.status === "needs_review" || (entry.requires_manual_review && entry.review_status !== "reviewed"))) {
      setMessage("Review hours before approving. Some teams still require manual review.");
      return;
    }
    if (status === "locked" && !window.confirm("Lock this period once payments are completed? Locked periods should not be recalculated.")) return;
    await updatePeriodStatus(period, status);
    setMessage(`Payroll period marked ${statusLabels[status] ?? status}.`);
    await load();
  }

  async function recalculate() {
    if (!period) return;
    if (["paid", "locked"].includes(period.status)) {
      setMessage("This period is already paid or locked. Create an adjustment instead.");
      return;
    }
    await generatePayrollForPeriod({ startDate: period.start_date, endDate: period.end_date, label: period.label ?? `${period.start_date}-${period.end_date}` }, { forceRecalculate: true });
    setMessage("Recalculated from current schedules.");
    await load();
  }

  function exportCsv() {
    const rows = [
      ["Cleaner", "Account", "City", "Service Date", "Scheduled Day", "Base Hours", "Final Hours", "Pay Rate", "Final Pay", "Status", "Exceptions"],
      ...filteredEntries.map((entry) => [entry.cleaner_name ?? "Unassigned", entry.account_name, entry.city ?? "", entry.service_date ?? "", entry.scheduled_day ?? "", String(entry.base_hours ?? 0), String(entry.adjusted_hours ?? 0), String(entry.pay_rate ?? 0), String(entry.final_amount ?? 0), entry.status, (entry.exceptions ?? []).join("; ")]),
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
    return <DashboardShell userEmail="pristinecleanersoc@gmail.com"><p className="font-bold">Payroll period not found.</p></DashboardShell>;
  }

  return (
    <DashboardShell userEmail="pristinecleanersoc@gmail.com">
      <div className="space-y-5">
        <section className="py-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Button className="mb-3" size="sm" type="button" variant="outline" onClick={() => router.push("/commercial/payroll")}><ArrowLeft className="size-4" /> Back</Button>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-primary"><WalletCards className="size-4" /> Commercial Payroll Period</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal">{period?.label ?? "Payroll period"}</h1>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">{period ? `${dateLabel(period.start_date)} to ${dateLabel(period.end_date)}` : "Loading period"} · Review commercial hours before approval or paid state.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {period ? <StatusBadge status={period.status} /> : null}
              <Button type="button" variant="outline" onClick={recalculate}><RefreshCw className="size-4" /> Recalculate from schedules</Button>
              <Button type="button" variant="outline" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>
            </div>
          </div>
          {message ? <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-bold">{message}</p> : null}
        </section>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Metric icon={FileClock} label="Total hours" value={summary.totalHours.toFixed(2)} />
          <Metric icon={WalletCards} label="Estimated" value={money(summary.totalEstimated)} />
          <Metric icon={PencilLine} label="Adjustments" value={money(summary.totalAdjustments)} />
          <Metric icon={CheckCircle2} label="Final payroll" value={money(summary.totalFinal)} />
          <Metric icon={AlertTriangle} label="Pending review" value={String(summary.needsReview)} />
          <Metric icon={LockKeyhole} label="Paid entries" value={String(summary.paid)} />
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Payment Approval</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="button" variant="outline" onClick={() => period && setPeriodStatus("in_review")}>Review exceptions</Button>
              <Button size="sm" type="button" onClick={() => period && setPeriodStatus("approved")}>Approve payroll</Button>
              <Button size="sm" type="button" variant="outline" onClick={() => period && setPeriodStatus("paid")}>Mark as paid</Button>
              <Button size="sm" type="button" variant="outline" onClick={() => period && setPeriodStatus("locked")}>Lock period</Button>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-border/80">
          <CardHeader><CardTitle>Payroll Filters</CardTitle><p className="mt-1 text-sm font-semibold text-muted-foreground">Filter by date, team, account, review state, or missing data without changing payroll records.</p></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Date view</span><select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={dateFilterMode} onChange={(event) => setDateFilterMode(event.target.value as DateFilterMode)}><option value="day">Day</option><option value="week">Week</option><option value="pay_period">15 Days / Pay Period</option><option value="month">Month</option><option value="custom">Custom Range</option></select></label>
              <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Selected date</span><input className="h-10 w-full rounded-md border bg-background px-3 font-bold" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
              <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Custom start</span><input className="h-10 w-full rounded-md border bg-background px-3 font-bold" disabled={dateFilterMode !== "custom"} type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} /></label>
              <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Custom end</span><input className="h-10 w-full rounded-md border bg-background px-3 font-bold" disabled={dateFilterMode !== "custom"} type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} /></label>
              <div className="rounded-md border bg-muted/15 px-3 py-2"><p className="text-xs font-black uppercase text-muted-foreground">Visible entries</p><p className="text-lg font-black">{filteredEntries.length}/{entries.length}</p></div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Cleaner/team</span><select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={cleanerFilter} onChange={(event) => setCleanerFilter(event.target.value)}><option value="all">All teams</option>{filterOptions.cleaners.map((cleaner) => <option key={cleaner} value={cleaner}>{cleaner}</option>)}</select></label>
              <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Account</span><select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}><option value="all">All accounts</option>{filterOptions.accounts.map((account) => <option key={account} value={account}>{account}</option>)}</select></label>
              <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Status</span><select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="needs_review">Needs Review</option><option value="reviewed">Reviewed</option><option value="approved">Approved</option><option value="paid">Paid</option></select></label>
              <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Manual review</span><select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}><option value="all">All</option><option value="manual_review">Manual review</option><option value="clear">Clear</option></select></label>
              <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Missing data</span><select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={dataFilter} onChange={(event) => setDataFilter(event.target.value)}><option value="all">All</option><option value="missing">Missing data</option><option value="complete">Complete</option></select></label>
              <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Paid state</span><select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={paidFilter} onChange={(event) => setPaidFilter(event.target.value)}><option value="all">All</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select></label>
              <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Search</span><input className="h-10 w-full rounded-md border bg-background px-3 font-bold" placeholder="Account, team, review" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Filtered schedule review</CardTitle>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">Use this view to confirm that scheduled hours, paid hours, and payroll totals match the selected commercial accounts.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Metric icon={FileClock} label="Filtered rows" value={String(filteredEntries.length)} />
              <Metric icon={FileClock} label="Scheduled hours" value={summary.totalBaseHours.toFixed(2)} />
              <Metric icon={FileClock} label="Paid hours" value={summary.totalHours.toFixed(2)} />
              <Metric icon={CheckCircle2} label="Payable amount" value={money(summary.totalFinal)} />
              <Metric icon={AlertTriangle} label="Rows needing review" value={String(summary.needsReview)} />
              <Metric icon={AlertTriangle} label="Missing rates" value={String(summary.missingRates)} />
              <Metric icon={AlertTriangle} label="Missing schedule rules" value={String(summary.missingScheduleRules)} />
              <Metric icon={AlertTriangle} label="Hours mismatches" value={String(summary.hoursMismatches)} />
              <Metric icon={AlertTriangle} label="Excluded mixed-route rows" value={String(summary.excludedMixedRoute)} />
              <Metric icon={WalletCards} label="Expected account hours" value={summary.expectedHours.toFixed(2)} />
            </div>
            <div className="grid gap-3 p-1 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div><p className="text-xs font-black uppercase text-muted-foreground">Date range</p><p className="font-black">{dateLabel(activeRange.start)} to {dateLabel(activeRange.end)}</p></div>
              <div><p className="text-xs font-black uppercase text-muted-foreground">Cleaner/team</p><p className="font-black">{cleanerFilter === "all" ? "All teams" : cleanerFilter}</p></div>
              <div><p className="text-xs font-black uppercase text-muted-foreground">Account</p><p className="font-black">{accountFilter === "all" ? "All accounts" : accountFilter}</p></div>
              <div><p className="text-xs font-black uppercase text-muted-foreground">Account rule</p><p className="font-black">{selectedAccount ? `${parseHours(selectedAccount.hours).toFixed(2)} hrs · ${selectedAccount.frequency ?? "No frequency"}` : "Select one account for rule detail"}</p></div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Payroll by Team</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[1180px] border-collapse text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3">Cleaner / Team</th>
                        <th className="px-3 py-3">Accounts served</th>
                        <th className="px-3 py-3">Service dates</th>
                        <th className="px-3 py-3 text-right">Base hours</th>
                        <th className="px-3 py-3 text-right">Adjusted hours</th>
                        <th className="px-3 py-3 text-right">Adjustments</th>
                        <th className="px-3 py-3 text-right">Final</th>
                        <th className="px-3 py-3">Review</th>
                        <th className="px-3 py-3">Payment</th>
                        <th className="px-3 py-3 text-center">Status</th>
                        <th className="px-3 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? <tr><td className="px-3 py-8 text-center font-bold text-muted-foreground" colSpan={11}>Loading payroll entries...</td></tr> : null}
                      {!loading && grouped.length === 0 ? <tr><td className="px-3 py-10 text-center" colSpan={11}><div className="mx-auto max-w-md"><AlertTriangle className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 font-black">No teams match these filters.</p><p className="mt-1 text-sm font-semibold text-muted-foreground">Clear a filter or widen the date range to see commercial payroll entries.</p></div></td></tr> : null}
                      {grouped.map((group) => (
                        <Fragment key={group.cleaner}>
                          <tr className="cursor-pointer border-t hover:bg-accent/40" onClick={() => { selectEntry(group.entries[0]); setExpandedTeam(expandedTeam === group.cleaner ? null : group.cleaner); }}>
                            <td className="px-3 py-3 font-black">{group.cleaner}</td>
                            <td className="px-3 py-3 font-bold">{group.accounts.size}</td>
                            <td className="px-3 py-3 font-bold">{group.serviceDates.size}</td>
                            <td className="px-3 py-3 text-right font-bold">{group.baseHours.toFixed(2)}</td>
                            <td className="px-3 py-3 text-right font-bold">{group.adjustedHours.toFixed(2)}</td>
                            <td className="px-3 py-3 text-right font-bold">{money(group.adjustments)}</td>
                            <td className="px-3 py-3 text-right font-black">{money(group.finalPay)}{group.excludedCount ? <p className="text-xs font-bold text-muted-foreground">{group.excludedCount} excluded</p> : null}</td>
                            <td className="px-3 py-3">{group.excludedCount ? <Badge className="bg-slate-900 text-white">Mixed route · Not payable here</Badge> : group.requiresReview ? <Badge className="bg-amber-100 text-amber-800">{group.manualReviewCount} review</Badge> : <Badge variant="outline">Clear</Badge>}</td>
                            <td className="px-3 py-3 font-bold">{group.paymentMethod ?? "-"}</td>
                            <td className="px-3 py-3 text-center"><div className="flex justify-center"><StatusBadge status={group.status} /></div></td>
                            <td className="px-3 py-3"><Button size="sm" type="button" variant="outline">{expandedTeam === group.cleaner ? "Hide" : "Open"}</Button></td>
                          </tr>
                          {expandedTeam === group.cleaner ? (
                            <tr className="border-t bg-muted/20" key={`${group.cleaner}-details`}>
                              <td className="px-3 py-3" colSpan={11}>
                                <div className="overflow-x-auto rounded-md border bg-background">
                                  <table className="w-full min-w-[1040px] border-collapse text-xs">
                                    <thead className="bg-muted/50 text-left uppercase text-muted-foreground"><tr><th className="px-3 py-2">Account</th><th className="px-3 py-2">Service date</th><th className="px-3 py-2">Day</th><th className="px-3 py-2">Frequency</th><th className="px-3 py-2 text-right">Base hours</th><th className="px-3 py-2 text-right">Adjusted</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Final</th><th className="px-3 py-2">Exceptions</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2">Notes</th></tr></thead>
                                    <tbody>{group.entries.map((entry) => {
                                      const validation = rowValidations.get(entry.id);
                                      return <tr className={`cursor-pointer border-t hover:bg-accent/40 ${selectedEntry?.id === entry.id ? "bg-accent/50" : ""}`} key={entry.id} onClick={() => selectEntry(entry)}><td className="px-3 py-2 font-black">{entry.account_name}</td><td className="px-3 py-2">{dateLabel(entry.service_date)}</td><td className="px-3 py-2">{entry.scheduled_day ?? "-"}</td><td className="px-3 py-2"><SourceBadge source={entry.source} /></td><td className="px-3 py-2 text-right font-bold">{numberValue(entry.base_hours).toFixed(2)}</td><td className="px-3 py-2 text-right font-bold">{numberValue(entry.adjusted_hours ?? entry.base_hours).toFixed(2)}</td><td className="px-3 py-2 text-right font-bold">{money(validation?.payrollEligible === false ? 0 : entry.pay_rate)}</td><td className="px-3 py-2 text-right font-black">{money(payableAmount(entry))}</td><td className="px-3 py-2"><div className="flex flex-wrap gap-1">{(validation?.reasons ?? []).slice(0, 3).map((reason) => <Badge className={validation?.status === "excluded_from_payroll" ? "bg-slate-900 text-white" : "bg-amber-100 text-amber-800"} key={reason}>{reason}</Badge>)}</div></td><td className="px-3 py-2 text-center"><div className="flex justify-center"><StatusBadge status={entry.status} /></div></td><td className="px-3 py-2">{entry.notes ?? entry.review_notes ?? validation?.reasons[0] ?? "-"}</td></tr>;
                                    })}</tbody>
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
                <CardTitle>Detailed Entries</CardTitle>
                <Button size="sm" type="button" variant="outline" onClick={() => setShowDetailedEntries((open) => !open)}>{showDetailedEntries ? "Hide entries" : "Show entries"}</Button>
              </CardHeader>
              {showDetailedEntries ? <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[1120px] border-collapse text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3">Account</th>
                        <th className="px-3 py-3">Cleaner</th>
                        <th className="px-3 py-3">City</th>
                        <th className="px-3 py-3">Service date</th>
                        <th className="px-3 py-3">Scheduled day</th>
                        <th className="px-3 py-3 text-right">Base</th>
                        <th className="px-3 py-3 text-right">Final hours</th>
                        <th className="px-3 py-3 text-right">Rate</th>
                        <th className="px-3 py-3 text-right">Subtotal</th>
                        <th className="px-3 py-3">Exceptions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry) => {
                        const validation = rowValidations.get(entry.id);
                        return (
                        <tr className={`cursor-pointer border-t hover:bg-accent/40 ${selectedEntry?.id === entry.id ? "bg-accent/50" : ""}`} key={entry.id} onClick={() => selectEntry(entry)}>
                          <td className="px-3 py-3 font-black">{entry.account_name}</td>
                          <td className="px-3 py-3 font-bold">{entry.cleaner_name ?? "Unassigned"}</td>
                          <td className="px-3 py-3">{entry.city ?? "-"}</td>
                          <td className="px-3 py-3">{dateLabel(entry.service_date)}</td>
                          <td className="px-3 py-3">{entry.scheduled_day ?? "-"}</td>
                          <td className="px-3 py-3 text-right font-bold">{numberValue(entry.base_hours).toFixed(2)}</td>
                          <td className="px-3 py-3 text-right font-bold">{numberValue(entry.adjusted_hours ?? entry.base_hours).toFixed(2)}</td>
                          <td className="px-3 py-3 text-right font-bold">{money(validation?.payrollEligible === false ? 0 : entry.pay_rate)}</td>
                          <td className="px-3 py-3 text-right"><p className={payableAmount(entry) === 0 && numberValue(entry.base_hours) > 0 ? "font-black text-amber-700 dark:text-amber-200" : "font-black"}>{money(payableAmount(entry))}</p>{payableAmount(entry) === 0 && numberValue(entry.base_hours) > 0 ? <p className="text-xs font-bold text-muted-foreground">{validation?.reasons[0] ?? entry.review_notes ?? "Needs review"}</p> : null}</td>
                          <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{(validation?.reasons ?? []).slice(0, 3).map((reason) => <Badge className={validation?.status === "excluded_from_payroll" ? "bg-slate-900 text-white" : "bg-amber-100 text-amber-800"} key={reason}>{reason}</Badge>)}</div></td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              </CardContent> : null}
            </Card>

            <Card>
              <CardHeader><CardTitle>Manual Adjustments</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3">Cleaner</th><th className="px-3 py-3">Type</th><th className="px-3 py-3 text-right">Hours</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Reason</th><th className="px-3 py-3">Created</th></tr></thead>
                    <tbody>
                      {adjustments.length === 0 ? <tr><td className="px-3 py-6 text-center font-bold text-muted-foreground" colSpan={6}>No manual adjustments yet.</td></tr> : null}
                      {adjustments.map((adjustment) => <tr className="border-t" key={adjustment.id}><td className="px-3 py-3 font-black">{adjustment.cleaner_name ?? "-"}</td><td className="px-3 py-3">{adjustment.adjustment_type ?? "-"}</td><td className="px-3 py-3 text-right font-bold">{numberValue(adjustment.hours_delta).toFixed(2)}</td><td className="px-3 py-3 text-right font-bold">{money(adjustment.amount_delta)}</td><td className="px-3 py-3">{adjustment.reason ?? "-"}</td><td className="px-3 py-3 text-xs text-muted-foreground">{new Date(adjustment.created_at).toLocaleString()}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="sticky top-20 h-fit space-y-4">
            <Card>
              <CardHeader><CardTitle>Edit This Period Only</CardTitle><p className="mt-1 text-sm font-semibold text-muted-foreground">Period-only changes stay out of account defaults.</p></CardHeader>
              <CardContent className="space-y-4">
                {!selectedEntry || !entryDraft ? <p className="text-sm font-bold text-muted-foreground">Select an account entry to edit hours, rate, review, or adjustments.</p> : (
                  <>
                    <div>
                      <p className="text-xs font-black uppercase text-muted-foreground">{selectedEntry.cleaner_name ?? "Unassigned"}</p>
                      <h2 className="mt-1 text-lg font-black">{selectedEntry.account_name}</h2>
                      <p className="text-sm font-semibold text-muted-foreground">{dateLabel(selectedEntry.service_date)} · {selectedEntry.scheduled_day ?? "No scheduled day"}</p>
                    </div>
                    {!isCommercialPayrollEligible(selectedEntry.cleaner_name) ? <div className="rounded-md border border-slate-300 bg-slate-100 p-3 text-sm font-bold text-slate-900 dark:bg-slate-900 dark:text-slate-100">Mixed route · Not in commercial payroll. This row can stay visible for operations review, but payout remains $0.00.</div> : null}
                    {selectedEntry.requires_manual_review ? <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">This team requires manual hour review before approval.</div> : null}
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Final hours</span><input className="h-10 w-full rounded-md border bg-background px-3 font-bold" type="number" step="any" value={entryDraft.adjusted_hours} onChange={(event) => setEntryDraft({ ...entryDraft, adjusted_hours: event.target.value })} /></label>
                      <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Pay rate</span><input className="h-10 w-full rounded-md border bg-background px-3 font-bold" type="number" step="0.01" value={entryDraft.pay_rate} onChange={(event) => setEntryDraft({ ...entryDraft, pay_rate: event.target.value })} /></label>
                    </div>
                    <label className="block space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Payment status</span><select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={entryDraft.status} onChange={(event) => setEntryDraft({ ...entryDraft, status: event.target.value as PayrollEntryRow["status"] })}><option value="draft">Draft</option><option value="needs_review">Needs Review</option><option value="reviewed">Reviewed</option><option value="approved">Approved</option><option value="paid">Paid</option></select></label>
                    <label className="block space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Review notes</span><textarea className="min-h-20 w-full rounded-md border bg-background p-3 text-sm font-bold" value={entryDraft.review_notes} onChange={(event) => setEntryDraft({ ...entryDraft, review_notes: event.target.value })} placeholder="Confirmed hours, skipped visit, reschedule details..." /></label>
                    <Button className="w-full" type="button" onClick={saveSelectedEntry}>Save period-only edit</Button>
                    <div className="grid grid-cols-3 gap-2">
                      <Button size="sm" type="button" variant="outline" onClick={() => selectedEntry && updateEntryStatus(selectedEntry, "reviewed").then(load)}>Reviewed</Button>
                      <Button size="sm" type="button" variant="outline" onClick={() => selectedEntry && updateEntryStatus(selectedEntry, "approved").then(load)}>Approve</Button>
                      <Button size="sm" type="button" variant="outline" onClick={() => selectedEntry && updateEntryStatus(selectedEntry, "paid").then(load)}>Paid</Button>
                    </div>
                    <div className="border-t pt-4">
                      <h3 className="font-black">Add manual adjustment</h3>
                      <div className="mt-3 space-y-3">
                        <select className="h-10 w-full rounded-md border bg-background px-3 font-bold" value={adjustmentDraft.adjustment_type} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, adjustment_type: event.target.value })}>{adjustmentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                        <div className="grid grid-cols-2 gap-3"><input className="h-10 rounded-md border bg-background px-3 font-bold" placeholder="Hours +/-" value={adjustmentDraft.hours_delta} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, hours_delta: event.target.value })} /><input className="h-10 rounded-md border bg-background px-3 font-bold" placeholder="Amount +/-" value={adjustmentDraft.amount_delta} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, amount_delta: event.target.value })} /></div>
                        <textarea className="min-h-20 w-full rounded-md border bg-background p-3 text-sm font-bold" placeholder="Reason, e.g. Team did not service account on May 6" value={adjustmentDraft.reason} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, reason: event.target.value })} />
                        <Button className="w-full" type="button" variant="outline" onClick={addAdjustment}>Add adjustment</Button>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground">Default behavior: apply only to this pay period. Update account defaults from Commercial Accounts when contract terms truly change.</p>
                  </>
                )}
              </CardContent>
            </Card>
            <Button asChild className="w-full" variant="outline"><Link href="/commercial/accounts">Open Commercial Accounts</Link></Button>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}

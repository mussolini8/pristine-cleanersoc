"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileClock, LockKeyhole, PencilLine, RefreshCw, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  addPayrollAdjustment,
  fetchPayrollPeriodDetails,
  generatePayrollForPeriod,
  updateEntryStatus,
  updatePayrollEntry,
  updatePeriodStatus,
  type PayrollAdjustmentRow,
  type PayrollEntryRow,
  type PayrollPeriodRow,
} from "@/lib/payroll";

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
  missing_schedule: "Schedule fallback",
  manual_review: "Manual review",
  contract_boundary: "Contract boundary",
};

function money(value: number | null | undefined) {
  return `$${Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

function StatusBadge({ status }: { status: string }) {
  const className = status === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : status === "approved" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" : status === "locked" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : status === "needs_review" || status === "in_review" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : status === "reviewed" ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200" : "bg-muted text-muted-foreground";
  return <Badge className={className}>{statusLabels[status] ?? status}</Badge>;
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
  const [loading, setLoading] = useState(true);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? entries[0] ?? null;
  const [entryDraft, setEntryDraft] = useState<EntryDraft | null>(null);
  const [adjustmentDraft, setAdjustmentDraft] = useState<AdjustmentDraft>(() => emptyAdjustment());
  const [message, setMessage] = useState<string | null>(null);

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
    const details = await fetchPayrollPeriodDetails(periodId);
    applyDetails(details);
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    fetchPayrollPeriodDetails(periodId).then((details) => {
      if (!mounted) return;
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

  const grouped = useMemo(() => {
    const map = new Map<string, { cleaner: string; baseHours: number; adjustedHours: number; finalPay: number; estimatedPay: number; accounts: Set<string>; status: string; entries: PayrollEntryRow[]; requiresReview: boolean; paymentMethod: string | null }>();
    for (const entry of entries) {
      const cleaner = entry.cleaner_name ?? "Unassigned";
      const group = map.get(cleaner) ?? { cleaner, baseHours: 0, adjustedHours: 0, finalPay: 0, estimatedPay: 0, accounts: new Set<string>(), status: "draft", entries: [], requiresReview: false, paymentMethod: entry.payment_method ?? null };
      group.baseHours += numberValue(entry.base_hours);
      group.adjustedHours += numberValue(entry.adjusted_hours ?? entry.base_hours);
      group.finalPay += numberValue(entry.final_amount ?? entry.estimated_amount);
      group.estimatedPay += numberValue(entry.estimated_amount);
      group.accounts.add(entry.account_name);
      group.entries.push(entry);
      group.requiresReview ||= Boolean(entry.requires_manual_review || entry.status === "needs_review");
      group.paymentMethod ||= entry.payment_method ?? null;
      if (group.entries.some((item) => item.status === "paid")) group.status = "paid";
      else if (group.entries.every((item) => item.status === "approved" || item.status === "paid")) group.status = "approved";
      else if (group.entries.some((item) => item.status === "needs_review")) group.status = "needs_review";
      else if (group.entries.some((item) => item.status === "reviewed")) group.status = "reviewed";
      map.set(cleaner, group);
    }
    return Array.from(map.values()).sort((a, b) => b.finalPay - a.finalPay);
  }, [entries]);

  const summary = useMemo(() => ({
    totalHours: entries.reduce((sum, entry) => sum + numberValue(entry.adjusted_hours ?? entry.base_hours), 0),
    totalBaseHours: entries.reduce((sum, entry) => sum + numberValue(entry.base_hours), 0),
    totalEstimated: entries.reduce((sum, entry) => sum + numberValue(entry.estimated_amount), 0),
    totalAdjustments: entries.reduce((sum, entry) => sum + numberValue(entry.adjustment_amount), 0),
    totalFinal: entries.reduce((sum, entry) => sum + numberValue(entry.final_amount ?? entry.estimated_amount), 0),
    needsReview: entries.filter((entry) => entry.status === "needs_review" || entry.requires_manual_review).length,
    approved: entries.filter((entry) => entry.status === "approved").length,
    paid: entries.filter((entry) => entry.status === "paid").length,
  }), [entries]);

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
    if (["paid", "locked"].includes(period.status) && !window.confirm("This period is paid or locked. Recalculate from current schedules anyway?")) return;
    await generatePayrollForPeriod({ startDate: period.start_date, endDate: period.end_date, label: period.label ?? `${period.start_date}-${period.end_date}` }, { forceRecalculate: true });
    setMessage("Recalculated from current schedules.");
    await load();
  }

  function exportCsv() {
    const rows = [
      ["Cleaner", "Account", "City", "Service Date", "Scheduled Day", "Base Hours", "Final Hours", "Pay Rate", "Final Pay", "Status", "Exceptions"],
      ...entries.map((entry) => [entry.cleaner_name ?? "Unassigned", entry.account_name, entry.city ?? "", entry.service_date ?? "", entry.scheduled_day ?? "", String(entry.base_hours ?? 0), String(entry.adjusted_hours ?? 0), String(entry.pay_rate ?? 0), String(entry.final_amount ?? 0), entry.status, (entry.exceptions ?? []).join("; ")]),
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
        <section className="rounded-lg border border-border/80 bg-card/95 p-5 shadow-[0_22px_60px_-52px_hsl(210_40%_20%)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Button className="mb-3" size="sm" type="button" variant="outline" onClick={() => router.push("/payments/commercial-payroll")}><ArrowLeft className="size-4" /> Back</Button>
              <p className="flex items-center gap-2 text-xs font-black uppercase text-primary"><WalletCards className="size-4" /> Commercial Payroll</p>
              <h1 className="mt-2 text-2xl font-black tracking-normal">{period?.label ?? "Payroll period"}</h1>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">{period ? `${dateLabel(period.start_date)} to ${dateLabel(period.end_date)}` : "Loading period"}</p>
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

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Cleaner / Team Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[980px] border-collapse text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3">Cleaner / Team</th>
                        <th className="px-3 py-3 text-right">Base hours</th>
                        <th className="px-3 py-3 text-right">Adjusted hours</th>
                        <th className="px-3 py-3 text-right">Estimated</th>
                        <th className="px-3 py-3 text-right">Final</th>
                        <th className="px-3 py-3">Accounts</th>
                        <th className="px-3 py-3">Review</th>
                        <th className="px-3 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? <tr><td className="px-3 py-8 text-center font-bold text-muted-foreground" colSpan={8}>Loading payroll entries…</td></tr> : null}
                      {grouped.map((group) => (
                        <tr className="cursor-pointer border-t hover:bg-accent/40" key={group.cleaner} onClick={() => selectEntry(group.entries[0])}>
                          <td className="px-3 py-3 font-black">{group.cleaner}</td>
                          <td className="px-3 py-3 text-right font-bold">{group.baseHours.toFixed(2)}</td>
                          <td className="px-3 py-3 text-right font-bold">{group.adjustedHours.toFixed(2)}</td>
                          <td className="px-3 py-3 text-right font-bold">{money(group.estimatedPay)}</td>
                          <td className="px-3 py-3 text-right font-black">{money(group.finalPay)}</td>
                          <td className="px-3 py-3 font-bold">{group.accounts.size}</td>
                          <td className="px-3 py-3">{group.requiresReview ? <Badge className="bg-amber-100 text-amber-800">Manual Review Required</Badge> : <Badge variant="outline">Clear</Badge>}</td>
                          <td className="px-3 py-3"><StatusBadge status={group.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Hours Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
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
                      {entries.map((entry) => (
                        <tr className={`cursor-pointer border-t hover:bg-accent/40 ${selectedEntry?.id === entry.id ? "bg-accent/50" : ""}`} key={entry.id} onClick={() => selectEntry(entry)}>
                          <td className="px-3 py-3 font-black">{entry.account_name}</td>
                          <td className="px-3 py-3 font-bold">{entry.cleaner_name ?? "Unassigned"}</td>
                          <td className="px-3 py-3">{entry.city ?? "-"}</td>
                          <td className="px-3 py-3">{dateLabel(entry.service_date)}</td>
                          <td className="px-3 py-3">{entry.scheduled_day ?? "-"}</td>
                          <td className="px-3 py-3 text-right font-bold">{numberValue(entry.base_hours).toFixed(2)}</td>
                          <td className="px-3 py-3 text-right font-bold">{numberValue(entry.adjusted_hours ?? entry.base_hours).toFixed(2)}</td>
                          <td className="px-3 py-3 text-right font-bold">{money(entry.pay_rate)}</td>
                          <td className="px-3 py-3 text-right font-black">{money(entry.final_amount)}</td>
                          <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{(entry.exceptions ?? []).slice(0, 3).map((code) => <Badge className="bg-amber-100 text-amber-800" key={code}>{exceptionLabels[code] ?? code}</Badge>)}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
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
              <CardHeader><CardTitle>Edit This Period Only</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {!selectedEntry || !entryDraft ? <p className="text-sm font-bold text-muted-foreground">Select an account entry to edit hours, rate, review, or adjustments.</p> : (
                  <>
                    <div>
                      <p className="text-xs font-black uppercase text-muted-foreground">{selectedEntry.cleaner_name ?? "Unassigned"}</p>
                      <h2 className="mt-1 text-lg font-black">{selectedEntry.account_name}</h2>
                      <p className="text-sm font-semibold text-muted-foreground">{dateLabel(selectedEntry.service_date)} · {selectedEntry.scheduled_day ?? "No scheduled day"}</p>
                    </div>
                    {selectedEntry.requires_manual_review ? <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">This team requires manual hour review before approval.</div> : null}
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1"><span className="text-xs font-black uppercase text-muted-foreground">Final hours</span><input className="h-10 w-full rounded-md border bg-background px-3 font-bold" type="number" step="0.25" value={entryDraft.adjusted_hours} onChange={(event) => setEntryDraft({ ...entryDraft, adjusted_hours: event.target.value })} /></label>
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
            <Button asChild className="w-full" variant="outline"><Link href="/commercial">Open Commercial Accounts</Link></Button>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}
